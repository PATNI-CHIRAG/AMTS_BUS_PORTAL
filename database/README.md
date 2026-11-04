# AMTS database starter

This directory contains an executable PostgreSQL/PostGIS schema for the AMTS passenger information project.

- `schema.sql` creates the normalized transit tables for sources, imports, agencies, stops, routes, route directions, schedules, vehicles, trips, GPS positions, fares, alerts, and crowding reports.
- The SQL creates **no route, stop, fare, schedule, vehicle, or GPS rows**. No operational data has been fabricated or copied from Moovit.
- The Django command `python manage.py import_gtfs` reads static GTFS schedule data. It defaults to ten public AMTS route codes and supports `--all-amts` for every AMTS route code in the feed.
- The application should use Django models and migrations as its long-term schema source. Treat `schema.sql` as the reviewed schema contract; have Antigravity implement matching Django models and migrations rather than maintaining two competing schemas.

## Why Moovit rows are not included

The requested Moovit lines page is a product reference, not a downloadable dataset. Moovit's WebApp terms restrict copying, extracting, and creating a database from its transit data. Do not scrape the page or copy its route records. Moovit data can only be integrated through a license/API arrangement that explicitly permits this use.

## Approved data path

1. Ask AMTS/AMC or its authorized technology provider for permission and an official GTFS or equivalent export. Request static routes, stops with coordinates, service calendars, stop times, fare rules, update frequency, license/attribution, and (separately) AVL/GPS or GTFS-Realtime access.
2. For research, inspect the current AMTS timetable and the community `croyla/amd-gtfs` feed listed under “Sources to review” below. That community feed combines agencies; filter to AMTS only and verify representative routes, stop sequences, timetable dates, and reuse rights before importing it. A community timetable feed does not provide live vehicle locations.
3. Download a permitted GTFS ZIP to a local `data/source/` directory. Keep its source URL, retrieval time, SHA-256, service date range, permission/license, and agency scope in an import batch.
4. Ask Antigravity to build a management command such as `python manage.py import_gtfs <zip-path> --agency <agency-id> --dry-run`. It should validate all foreign keys, time values, coordinate bounds, service dates, agency scope, and route-pattern grouping before writing records. It must report counts and validation errors; default to dry-run.
5. After reviewing the dry-run report, run the import and verify database counts and several known routes against the source publication. Reimporting the same feed must update/reconcile source-owned records without creating duplicates; it must not erase manually maintained data.
6. For live movement, configure a separate authorized GPS feed. GTFS static schedules alone cannot populate `vehicle_positions`.

## Import the first ten route codes

From the `backend/` directory, first run a dry run:

```powershell
python manage.py import_gtfs --zip ..\data\source\gtfs.zip
```

Review the route codes, agency, stops, trips, and stop-time counts. To write records after reviewing the report:

```powershell
python manage.py import_gtfs --zip ..\data\source\gtfs.zip --apply
```

The default route codes are `31`, `40`, `103`, `105`, `106`, `107`, `109`, `112`, `116`, and `117`. You can pass at least ten codes with `--route-codes`, or use `--all-amts` to import all AMTS route codes in the feed. It filters `agency_id=AMTS`, leaving out AJL/BRTS and GTSL rows. It does not fabricate fleet, GPS, fare, alert, or crowding data.

For the ZIP currently in the project, the dry run finds 10 public route codes, 39 route variants/patterns, 486 scheduled trips, 440 referenced stops, and 21,962 stop-time rows. These counts describe this selected subset and may change when the feed is updated.

## Sources to review

- AMTS timetable: <https://www.amts.co.in/time-table/>
- AMTS bus timings PDF: <https://www.amts.co.in/media/1154/amts-bus-timings.pdf>
- Community GTFS repository: <https://github.com/croyla/amd-gtfs>
- Community feed catalog and validation status: <https://mobilitydatabase.org/feeds/gtfs/mdb-3131>
- GTFS schedule specification: <https://gtfs.org/documentation/schedule/reference/>
- Moovit WebApp terms: <https://moovit.com/legal/webappterms/>
- Moovit API documentation (commercial/licensed access may be required): <https://api-docs.moovit.com/>

## Tables and purpose

| Table group | Tables | Purpose |
|---|---|---|
| Provenance | `data_sources`, `import_batches` | Record where data came from, permission, retrieval, service dates, and validation. |
| Network | `agencies`, `stops`, `routes`, `route_patterns`, `route_pattern_stops` | Model operator, physical stops, public route number, direction/variant, route geometry, and ordered stops. |
| Schedule | `service_calendars`, `service_calendar_exceptions`, `scheduled_trips`, `scheduled_stop_times` | Model weekdays, holidays/exceptions, scheduled one-way runs, and stop arrival/departure times. Times use integer seconds since the local service-day midnight so GTFS values after midnight (such as 25:10:00) remain representable. |
| Fleet and live operation | `vehicle_types`, `vehicles`, `operating_trips`, `vehicle_positions`, `stop_time_events` | Separate physical buses from scheduled and actual runs; store timestamped locations and observed stop events. |
| Passenger information | `fare_products`, `fare_rules`, `service_alerts`, `service_alert_routes`, `service_alert_stops`, `crowding_reports` | Store effective-dated fares, disruption notices, and sourced crowding reports. |

## Applying the schema manually

Create a PostgreSQL database with PostGIS installed, then run `schema.sql` as a database owner. The command line tools are not included in this workspace, so this file has not been applied to a running database here. Prefer Docker Compose and Django migrations for the project setup; ask Antigravity to reproduce the reviewed schema through migrations and verify it against a clean local database.

## Important limitations

- A database schema is not the same as an AMTS data license or a live feed.
- The schema does not yet include passenger accounts, bookings, payment details, or ticket validation. Add these only after the real ticketing rules and payment scope are confirmed.
- Physical AMTS fleet numbers, registration plates, capacities, GPS device IDs, and live bus positions are not present in static route/timetable feeds and need separate authorized sources.
- The `transit` schema and UUID identifiers are starter choices. Review them before production; Django migrations should be the authoritative implementation.
