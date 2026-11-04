"""Import a selected set of AMTS public route codes from a static GTFS ZIP.

This importer deliberately does not invent fleet, vehicle positions, fares,
service alerts, or crowding observations. Those require separate sources.
"""

import csv
import hashlib
import io
import json
import zipfile
from collections import defaultdict
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from transit.models import (
    Agency,
    DataSource,
    ImportBatch,
    Route,
    RoutePattern,
    RoutePatternStop,
    ScheduledStopTime,
    ScheduledTrip,
    ServiceCalendar,
    ServiceCalendarException,
    Stop,
)


DEFAULT_ROUTE_CODES = ["31", "40", "103", "105", "106", "107", "109", "112", "116", "117"]
COMMUNITY_FEED_URL = "https://github.com/croyla/amd-gtfs"


def read_csv_from_zip(archive, filename, required=True):
    try:
        raw = archive.read(filename)
    except KeyError:
        if required:
            raise CommandError(f"GTFS file is missing: {filename}")
        return []
    try:
        return list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
    except UnicodeDecodeError as exc:
        raise CommandError(f"Could not decode {filename} as UTF-8: {exc}") from exc


def parse_gtfs_time(value):
    """Return seconds from service-day midnight; GTFS allows hours above 23."""
    if not value:
        return None
    try:
        hours, minutes, seconds = (int(part) for part in value.split(":"))
    except (TypeError, ValueError) as exc:
        raise CommandError(f"Invalid GTFS time value: {value!r}") from exc
    if hours < 0 or not 0 <= minutes < 60 or not 0 <= seconds < 60:
        raise CommandError(f"Invalid GTFS time value: {value!r}")
    return hours * 3600 + minutes * 60 + seconds


def parse_optional_int(value):
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise CommandError(f"Expected an integer, received {value!r}") from exc


class Command(BaseCommand):
    help = "Import selected AMTS route codes and their real static GTFS schedule data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--zip",
            dest="zip_path",
            default="data/source/gtfs.zip",
            help="Path to a permitted static GTFS ZIP (default: data/source/gtfs.zip).",
        )
        parser.add_argument(
            "--route-codes",
            nargs="+",
            default=DEFAULT_ROUTE_CODES,
            help="AMTS public route codes to import (default: 10 codes).",
        )
        parser.add_argument(
            "--all-amts",
            action="store_true",
            help="Import all AMTS public route codes present in the feed.",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Write records. Without this flag, validate and report only.",
        )

    def handle(self, *args, **options):
        zip_path = Path(options["zip_path"]).resolve()
        if not zip_path.is_file():
            raise CommandError(f"GTFS ZIP not found: {zip_path}")

        try:
            archive = zipfile.ZipFile(zip_path)
        except zipfile.BadZipFile as exc:
            raise CommandError(f"Not a valid ZIP file: {zip_path}") from exc

        with archive:
            agencies = read_csv_from_zip(archive, "agency.txt")
            routes = read_csv_from_zip(archive, "routes.txt")
            stops = read_csv_from_zip(archive, "stops.txt")
            trips = read_csv_from_zip(archive, "trips.txt")
            stop_times = read_csv_from_zip(archive, "stop_times.txt")
            calendars = read_csv_from_zip(archive, "calendar.txt", required=False)
            calendar_dates = read_csv_from_zip(archive, "calendar_dates.txt", required=False)

        agency_rows = [row for row in agencies if row.get("agency_id") == "AMTS"]
        if len(agency_rows) != 1:
            raise CommandError(
                f"Expected exactly one AMTS agency row (agency_id=AMTS), found {len(agency_rows)}."
            )
        source_agency = agency_rows[0]

        amts_routes = [row for row in routes if row.get("agency_id") == "AMTS"]
        if not amts_routes:
            raise CommandError("The GTFS feed contains no routes for agency_id=AMTS.")

        available_codes = {row.get("route_short_name", "").strip() for row in amts_routes}
        if options["all_amts"]:
            selected_codes = available_codes - {""}
        else:
            selected_codes = {str(code).strip() for code in options["route_codes"] if str(code).strip()}
        missing_codes = sorted(selected_codes - available_codes)
        if missing_codes:
            raise CommandError(f"Route codes not found for AMTS in this feed: {', '.join(missing_codes)}")
        if len(selected_codes) < 10 and not options["all_amts"]:
            raise CommandError("Select at least 10 different route codes, or use --all-amts.")

        selected_routes = [row for row in amts_routes if row.get("route_short_name", "").strip() in selected_codes]
        selected_route_ids = {row["route_id"] for row in selected_routes}
        trips_by_id = {
            row["trip_id"]: row
            for row in trips
            if row.get("route_id") in selected_route_ids
        }
        selected_stop_times = [row for row in stop_times if row.get("trip_id") in trips_by_id]
        stop_rows = {row["stop_id"]: row for row in stops if row.get("stop_id")}
        missing_stop_ids = sorted({row.get("stop_id") for row in selected_stop_times} - set(stop_rows))
        if missing_stop_ids:
            raise CommandError(f"GTFS stop_times reference missing stops: {', '.join(missing_stop_ids[:10])}")

        stop_times_by_trip = defaultdict(list)
        for row in selected_stop_times:
            stop_times_by_trip[row["trip_id"]].append(row)
        for rows in stop_times_by_trip.values():
            rows.sort(key=lambda row: int(row["stop_sequence"]))

        selected_trips = [row for row in trips if row.get("trip_id") in trips_by_id]
        calendar_rows = {row["service_id"]: row for row in calendars if row.get("service_id")}
        missing_services = sorted(
            {row.get("service_id") for row in selected_trips if row.get("service_id")} - set(calendar_rows)
        )
        if missing_services:
            raise CommandError(
                "Trips reference service IDs missing from calendar.txt: " + ", ".join(missing_services[:10])
            )

        patterns_for_trip = {}
        pattern_specs = {}
        for trip in selected_trips:
            trip_stops = stop_times_by_trip.get(trip["trip_id"], [])
            if not trip_stops:
                raise CommandError(f"Trip {trip['trip_id']} has no stop_times records.")
            route_row = next(row for row in selected_routes if row["route_id"] == trip["route_id"])
            signature = tuple((row["stop_id"], row["stop_sequence"]) for row in trip_stops)
            # GTFS route rows commonly encode UP/DOWN variants; shape/headsign and
            # stop sequence split any additional trip variants under one route code.
            key = (
                trip["route_id"],
                trip.get("direction_id", ""),
                trip.get("shape_id", ""),
                signature,
            )
            patterns_for_trip[trip["trip_id"]] = key
            pattern_specs.setdefault(key, (route_row, trip, trip_stops))

        report = {
            "source_zip": str(zip_path),
            "agency": source_agency.get("agency_name"),
            "feed_agencies": len(agencies),
            "amts_route_records": len(amts_routes),
            "selected_route_codes": sorted(selected_codes),
            "selected_route_records": len(selected_routes),
            "pattern_count": len(pattern_specs),
            "trip_count": len(selected_trips),
            "stop_count": len({row["stop_id"] for row in selected_stop_times}),
            "stop_time_count": len(selected_stop_times),
            "calendar_count": len({row.get("service_id") for row in selected_trips}),
            "calendar_exception_count": sum(
                1 for row in calendar_dates if row.get("service_id") in calendar_rows
            ),
            "mode": "apply" if options["apply"] else "dry-run",
        }
        self.stdout.write(json.dumps(report, indent=2, ensure_ascii=False))
        if not options["apply"]:
            self.stdout.write(self.style.WARNING("Dry run only. Add --apply to write these records."))
            return

        file_hash = hashlib.sha256(zip_path.read_bytes()).hexdigest().upper()
        batch_dates = [
            (row.get("start_date"), row.get("end_date"))
            for row in calendar_rows.values()
            if row.get("start_date") and row.get("end_date")
        ]
        with transaction.atomic():
            source, _ = DataSource.objects.get_or_create(
                name="Ahmedabad Community GTFS — AMTS subset",
                defaults={
                    "source_type": "community",
                    "source_url": COMMUNITY_FEED_URL,
                    "license_or_permission": (
                        "Community feed derived from agency publications; verify upstream data reuse rights "
                        "before production use. Not an authorized live feed."
                    ),
                    "agency_scope": "AMTS only; selected public route codes",
                    "is_authorized_for_production": False,
                },
            )
            import_batch = ImportBatch.objects.create(
                data_source=source,
                source_file_name=zip_path.name,
                source_sha256=file_hash,
                source_retrieved_at=timezone.now(),
                service_start_date=min((start for start, _ in batch_dates), default=None),
                service_end_date=max((end for _, end in batch_dates), default=None),
                importer_version="1.0",
                status="pending",
                validation_summary=report,
            )

            agency, _ = Agency.objects.get_or_create(
                data_source=source,
                external_id=source_agency["agency_id"],
                defaults={
                    "name": source_agency.get("agency_name") or "AMTS",
                    "url": source_agency.get("agency_url") or None,
                    "phone": source_agency.get("agency_phone") or None,
                    "timezone": source_agency.get("agency_timezone") or "Asia/Kolkata",
                    "language_code": source_agency.get("agency_lang") or None,
                },
            )

            route_objects = {}
            gtfs_route_rows_by_code = defaultdict(list)
            for row in selected_routes:
                gtfs_route_rows_by_code[row.get("route_short_name", "").strip()].append(row)
            for code in sorted(selected_codes):
                variants = gtfs_route_rows_by_code[code]
                route, _ = Route.objects.get_or_create(
                    data_source=source,
                    external_id=code,
                    defaults={
                        "agency": agency,
                        "public_code": code,
                        "short_name": code,
                        "long_name": code,
                        "description": "Imported from AMTS agency rows in a community GTFS feed.",
                        "route_type": 3,
                        "route_color": None,
                        "route_text_color": None,
                        "is_active": True,
                    },
                )
                route_objects[code] = route

            stop_ids = {row["stop_id"] for row in selected_stop_times}
            stop_objects = {}
            for stop_id in sorted(stop_ids):
                row = stop_rows[stop_id]
                lat = float(row["stop_lat"]) if row.get("stop_lat") else None
                lon = float(row["stop_lon"]) if row.get("stop_lon") else None
                if lat is not None and not -90 <= lat <= 90:
                    raise CommandError(f"Stop {stop_id} has invalid latitude {lat}.")
                if lon is not None and not -180 <= lon <= 180:
                    raise CommandError(f"Stop {stop_id} has invalid longitude {lon}.")
                location = f"POINT({lon} {lat})" if lat is not None and lon is not None else None
                stop, _ = Stop.objects.get_or_create(
                    data_source=source,
                    external_id=stop_id,
                    defaults={
                        "stop_code": row.get("stop_code") or None,
                        "name": row.get("stop_name") or stop_id,
                        "description": row.get("stop_desc") or None,
                        "location": location,
                        "wheelchair_boarding": parse_optional_int(row.get("wheelchair_boarding")),
                        "is_active": True,
                    },
                )
                stop_objects[stop_id] = stop

            calendar_objects = {}
            for service_id in sorted({row["service_id"] for row in selected_trips}):
                row = calendar_rows[service_id]
                calendar, _ = ServiceCalendar.objects.get_or_create(
                    data_source=source,
                    external_id=service_id,
                    defaults={
                        "monday": row.get("monday") == "1",
                        "tuesday": row.get("tuesday") == "1",
                        "wednesday": row.get("wednesday") == "1",
                        "thursday": row.get("thursday") == "1",
                        "friday": row.get("friday") == "1",
                        "saturday": row.get("saturday") == "1",
                        "sunday": row.get("sunday") == "1",
                        "start_date": f"{row['start_date'][:4]}-{row['start_date'][4:6]}-{row['start_date'][6:8]}",
                        "end_date": f"{row['end_date'][:4]}-{row['end_date'][4:6]}-{row['end_date'][6:8]}",
                    },
                )
                calendar_objects[service_id] = calendar

            for exception in calendar_dates:
                calendar = calendar_objects.get(exception.get("service_id"))
                if calendar is None:
                    continue
                date_value = exception["date"]
                service_date = f"{date_value[:4]}-{date_value[4:6]}-{date_value[6:8]}"
                ServiceCalendarException.objects.get_or_create(
                    service_calendar=calendar,
                    service_date=service_date,
                    defaults={"exception_type": int(exception["exception_type"])},
                )

            pattern_objects = {}
            for key, (route_row, trip_sample, pattern_stops) in pattern_specs.items():
                code = route_row["route_short_name"].strip()
                external_pattern_id = "|".join(
                    [route_row["route_id"], trip_sample.get("direction_id", ""), trip_sample.get("shape_id", "")]
                )
                # Distinguish same route/shape trips that call at different stop sequences.
                signature_digest = hashlib.sha1(
                    ",".join(f"{row['stop_id']}:{row['stop_sequence']}" for row in pattern_stops).encode("utf-8")
                ).hexdigest()[:10]
                external_pattern_id = f"{external_pattern_id}|{signature_digest}"
                direction_name = route_row.get("route_long_name") or f"Route {code}"
                pattern, _ = RoutePattern.objects.get_or_create(
                    route=route_objects[code],
                    external_pattern_id=external_pattern_id,
                    defaults={
                        "direction_id": parse_optional_int(trip_sample.get("direction_id")),
                        "direction_name": direction_name,
                        "headsign": trip_sample.get("trip_headsign") or direction_name,
                        "origin_stop": stop_objects[pattern_stops[0]["stop_id"]],
                        "destination_stop": stop_objects[pattern_stops[-1]["stop_id"]],
                        # The provided archive has no shapes.txt; do not fabricate road geometry.
                        "shape": None,
                        "is_active": True,
                    },
                )
                pattern_objects[key] = pattern
                RoutePatternStop.objects.bulk_create(
                    [
                        RoutePatternStop(
                            route_pattern=pattern,
                            stop=stop_objects[row["stop_id"]],
                            stop_sequence=int(row["stop_sequence"]),
                            distance_from_start_m=None,
                            pickup_type=parse_optional_int(row.get("pickup_type")),
                            drop_off_type=parse_optional_int(row.get("drop_off_type")),
                        )
                        for row in pattern_stops
                    ],
                    ignore_conflicts=True,
                    batch_size=1000,
                )

            trip_objects = {}
            for trip_row in selected_trips:
                pattern = pattern_objects[patterns_for_trip[trip_row["trip_id"]]]
                service = calendar_objects[trip_row["service_id"]]
                trip, _ = ScheduledTrip.objects.get_or_create(
                    service_calendar=service,
                    external_id=trip_row["trip_id"],
                    defaults={
                        "route_pattern": pattern,
                        "headsign": trip_row.get("trip_headsign") or pattern.headsign,
                        "short_name": trip_row.get("trip_short_name") or None,
                        "block_id": trip_row.get("block_id") or None,
                        "shape_id": trip_row.get("shape_id") or None,
                        "wheelchair_accessible": parse_optional_int(trip_row.get("wheelchair_accessible")),
                        "bikes_allowed": parse_optional_int(trip_row.get("bikes_allowed")),
                        "is_active": True,
                    },
                )
                trip_objects[trip_row["trip_id"]] = trip

            stop_time_objects = []
            for row in selected_stop_times:
                trip = trip_objects[row["trip_id"]]
                stop_time_objects.append(
                    ScheduledStopTime(
                        scheduled_trip=trip,
                        stop=stop_objects[row["stop_id"]],
                        stop_sequence=int(row["stop_sequence"]),
                        arrival_seconds=parse_gtfs_time(row.get("arrival_time")),
                        departure_seconds=parse_gtfs_time(row.get("departure_time")),
                        pickup_type=parse_optional_int(row.get("pickup_type")),
                        drop_off_type=parse_optional_int(row.get("drop_off_type")),
                        shape_distance_m=None,
                        timepoint=row.get("timepoint", "1") != "0",
                    )
                )
            ScheduledStopTime.objects.bulk_create(
                stop_time_objects,
                ignore_conflicts=True,
                batch_size=2000,
            )

            import_batch.status = "imported"
            import_batch.imported_at = timezone.now()
            import_batch.validation_summary = report
            import_batch.save(update_fields=["status", "imported_at", "validation_summary"])

        self.stdout.write(self.style.SUCCESS("GTFS static schedule import completed."))
        self.stdout.write(
            "Imported route codes: " + ", ".join(sorted(selected_codes)) + ". "
            "No live fleet or GPS records were generated."
        )
