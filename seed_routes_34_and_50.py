import os
import sys
from django.utils import timezone
import uuid

sys.path.insert(0, os.path.abspath('backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from transit.models import (
    Agency, DataSource, Stop, Route, RoutePattern, RoutePatternStop,
    VehicleType, Vehicle, OperatingTrip, VehiclePosition
)
from transit.serializers import parse_wkt_point

def run():
    print("Seeding Routes 34 and 50 and enriching Gujarati stop names...")

    agency = Agency.objects.first()
    data_source = DataSource.objects.first()

    # 1. Enrich Gujarati stop names
    gu_mappings = {
        'Meghaninagar': 'મેઘાણીનગર',
        'Civil Hospital': 'સિવિલ હોસ્પિટલ',
        'Civil Hospital Corner': 'સિવિલ હોસ્પિટલ કોર્નર',
        'Government Colony': 'સરકારી કોલોની',
        'Ratnasagar Society': 'રત્નસાગર સોસાયટી',
        'Tatanagar': 'ટાટાનગર',
        'Mental Corner': 'મેન્ટલ કોર્નર',
        'M.L.A. Quarters': 'એમ.એલ.એ. ક્વાર્ટર્સ',
        'Cancer Hospital': 'કેન્સર હોસ્પિટલ',
        'Baliya Limbdi': 'બાળિયા લીંબડી',
        'Giradharnagar': 'ગિરધરનગર',
        'Idga': 'ઈદગાહ',
        'Saraspur Char Rasta': 'સારસપુર ચાર રસ્તા',
        'Dr.Ambedkar Hall (Saraspur)': 'ડૉ. આંબેડકર હોલ (સારસપુર)',
        'Kalupur Terminus': 'કાલુપુર ટર્મિનસ',
        'Kalupur': 'કાલુપુર',
        'Naroda': 'નરોડા',
        'Naroda Gam': 'નરોડા ગામ',
        'Bethak (Naroda)': 'બેઠક (નરોડા)',
        'Arvind Mills (Naroda)': 'અરવિંદ મિલ્સ (નરોડા)',
        'Sarkhej Gam': 'સરખેજ ગામ',
        'Sarkhej Bus Stand': 'સરખેજ બસ સ્ટેન્ડ',
        'Lal Darwaja': 'લાલ દરવાજા',
        'Lal Darwaja Terminus': 'લાલ દરવાજા ટર્મિનસ',
        'Paldi': 'પાલડી',
        'Vasna Terminus': 'વાસણા ટર્મિનસ',
        'Maninagar Terminus': 'મણિનગર ટર્મિનસ',
        'Gujarat University': 'ગુજરાત યુનિવર્સિટી',
        'Bhakti Circle': 'ભક્તિ સર્કલ',
        'Naroda Industrial Township( MuthiyaGam )': 'નરોડા ઔદ્યોગિક વસાહત (મુઠિયા)',
    }

    for eng, gu in gu_mappings.items():
        stops = Stop.objects.filter(name=eng)
        for s in stops:
            s.name_gu = gu
            s.save()
    print("Gujarati stop names updated.")

    # 2. Get Vehicle Types
    vt_electric_ac = VehicleType.objects.filter(has_ac=True, fuel_type='electric').first()
    vt_cng_nonac = VehicleType.objects.filter(has_ac=False, fuel_type='cng').first()
    vt_electric_nonac = VehicleType.objects.filter(has_ac=False, fuel_type='electric').first()

    today = timezone.now().date()

    def get_or_create_vehicle(fleet, reg, vtype):
        v, _ = Vehicle.objects.get_or_create(
            fleet_number=fleet,
            defaults={
                'registration_number': reg,
                'vehicle_type': vtype,
                'operational_status': 'active',
                'device_reference': f"GPS-DEV-{fleet}"
            }
        )
        return v

    def create_or_update_pos(vehicle, trip, stop):
        lat, lon = parse_wkt_point(stop.location)
        if lat and lon:
            VehiclePosition.objects.create(
                vehicle=vehicle,
                operating_trip=trip,
                recorded_at=timezone.now(),
                location=f"POINT({lon} {lat})",
                speed_mps=6.5,
                heading_degrees=90.0,
                source='demo_simulator',
                quality_status='valid'
            )

    # -------------------------------------------------------------
    # 3. Create Route 34 (Meghaninagar <-> Kalupur Terminus)
    # -------------------------------------------------------------
    r34 = Route.objects.filter(public_code='34').first()
    if not r34:
        r34 = Route.objects.create(
            public_code='34',
            external_id='ROUTE-34',
            agency=agency,
            data_source=data_source,
            short_name='34',
            long_name='Meghaninagar to Kalupur Terminus',
            description='Meghaninagar to Kalupur via Civil Hospital & Saraspur',
            route_type=3,
            route_color='E65100',
            route_text_color='FFFFFF',
            is_active=True,
        )

    r34_stop_names = [
        'Meghaninagar',
        'Government Colony',
        'Ratnasagar Society',
        'Tatanagar',
        'Mental Corner',
        'Cancer Hospital',
        'Civil Hospital',
        'Baliya Limbdi',
        'Saraspur Char Rasta',
        'Kalupur Terminus'
    ]

    r34_stops = []
    for sname in r34_stop_names:
        s = Stop.objects.filter(name=sname).first()
        if s:
            r34_stops.append(s)
        else:
            print(f"Warning: Stop {sname} not found")

    if len(r34_stops) >= 5:
        # Route 34 UP Pattern
        up34_origin = r34_stops[0]
        up34_dest = r34_stops[-1]
        linestring_up = "LINESTRING(" + ", ".join([f"{parse_wkt_point(s.location)[1]} {parse_wkt_point(s.location)[0]}" for s in r34_stops if parse_wkt_point(s.location)[0]]) + ")"

        rp34_up, _ = RoutePattern.objects.get_or_create(
            route=r34,
            direction_id=0,
            defaults={
                'external_pattern_id': '34-UP',
                'direction_name': f"{up34_origin.name} to {up34_dest.name}",
                'headsign': up34_dest.name,
                'origin_stop': up34_origin,
                'destination_stop': up34_dest,
                'shape': linestring_up,
                'is_active': True,
            }
        )

        RoutePatternStop.objects.filter(route_pattern=rp34_up).delete()
        dist = 0
        for seq, s in enumerate(r34_stops, start=1):
            RoutePatternStop.objects.create(
                route_pattern=rp34_up,
                stop=s,
                stop_sequence=seq,
                distance_from_start_m=dist,
                pickup_type=0,
                drop_off_type=0
            )
            dist += 550

        # Vehicle 34-P (Tata Ultra Electric AC) on UP
        v34p = get_or_create_vehicle('34-P', 'GJ-01-CZ-3401', vt_electric_ac)
        trip34_up, _ = OperatingTrip.objects.get_or_create(
            route_pattern=rp34_up,
            vehicle=v34p,
            service_date=today,
            defaults={'status': 'running'}
        )
        create_or_update_pos(v34p, trip34_up, r34_stops[2]) # near Ratnasagar

        # Route 34 DOWN Pattern
        r34_stops_down = list(reversed(r34_stops))
        down34_origin = r34_stops_down[0]
        down34_dest = r34_stops_down[-1]
        linestring_down = "LINESTRING(" + ", ".join([f"{parse_wkt_point(s.location)[1]} {parse_wkt_point(s.location)[0]}" for s in r34_stops_down if parse_wkt_point(s.location)[0]]) + ")"

        rp34_down, _ = RoutePattern.objects.get_or_create(
            route=r34,
            direction_id=1,
            defaults={
                'external_pattern_id': '34-DOWN',
                'direction_name': f"{down34_origin.name} to {down34_dest.name}",
                'headsign': down34_dest.name,
                'origin_stop': down34_origin,
                'destination_stop': down34_dest,
                'shape': linestring_down,
                'is_active': True,
            }
        )

        RoutePatternStop.objects.filter(route_pattern=rp34_down).delete()
        dist = 0
        for seq, s in enumerate(r34_stops_down, start=1):
            RoutePatternStop.objects.create(
                route_pattern=rp34_down,
                stop=s,
                stop_sequence=seq,
                distance_from_start_m=dist,
                pickup_type=0,
                drop_off_type=0
            )
            dist += 550

        # Vehicle 34-Q (Ashok Leyland CNG Standard) on DOWN
        v34q = get_or_create_vehicle('34-Q', 'GJ-01-BZ-3402', vt_cng_nonac)
        trip34_down, _ = OperatingTrip.objects.get_or_create(
            route_pattern=rp34_down,
            vehicle=v34q,
            service_date=today,
            defaults={'status': 'running'}
        )
        create_or_update_pos(v34q, trip34_down, r34_stops_down[1])

        print("Route 34 created with 34-P (Electric AC) and 34-Q (CNG).")

    # -------------------------------------------------------------
    # 4. Create Route 50 (Naroda Gam <-> Lal Darwaja via Civil Hospital)
    # -------------------------------------------------------------
    r50 = Route.objects.filter(public_code='50').first()
    if not r50:
        r50 = Route.objects.create(
            public_code='50',
            external_id='ROUTE-50',
            agency=agency,
            data_source=data_source,
            short_name='50',
            long_name='Naroda Gam to Lal Darwaja via Civil Hospital',
            description='Express corridor connecting Naroda, Meghaninagar, Civil Hospital to Lal Darwaja',
            route_type=3,
            route_color='2E7D32',
            route_text_color='FFFFFF',
            is_active=True,
        )

    r50_stop_names = [
        'Naroda Gam',
        'Bethak (Naroda)',
        'Saijpur',
        'Somnath Mahadev (Rameshwar Mahadev)',
        'Meghaninagar',
        'Ratnasagar Society',
        'Cancer Hospital',
        'Civil Hospital',
        'Baliya Limbdi',
        'Idga',
        'Kalupur Terminus',
        'Lal Darwaja'
    ]

    r50_stops = []
    for sname in r50_stop_names:
        s = Stop.objects.filter(name=sname).first()
        if s:
            r50_stops.append(s)
        else:
            print(f"Warning: Stop {sname} not found")

    if len(r50_stops) >= 5:
        # Route 50 UP Pattern
        up50_origin = r50_stops[0]
        up50_dest = r50_stops[-1]
        linestring_up = "LINESTRING(" + ", ".join([f"{parse_wkt_point(s.location)[1]} {parse_wkt_point(s.location)[0]}" for s in r50_stops if parse_wkt_point(s.location)[0]]) + ")"

        rp50_up, _ = RoutePattern.objects.get_or_create(
            route=r50,
            direction_id=0,
            defaults={
                'external_pattern_id': '50-UP',
                'direction_name': f"{up50_origin.name} to {up50_dest.name}",
                'headsign': up50_dest.name,
                'origin_stop': up50_origin,
                'destination_stop': up50_dest,
                'shape': linestring_up,
                'is_active': True,
            }
        )

        RoutePatternStop.objects.filter(route_pattern=rp50_up).delete()
        dist = 0
        for seq, s in enumerate(r50_stops, start=1):
            RoutePatternStop.objects.create(
                route_pattern=rp50_up,
                stop=s,
                stop_sequence=seq,
                distance_from_start_m=dist,
                pickup_type=0,
                drop_off_type=0
            )
            dist += 600

        # Vehicle 50-X (Tata Ultra Electric AC) on UP
        v50x = get_or_create_vehicle('50-X', 'GJ-01-CZ-5001', vt_electric_ac)
        trip50_up, _ = OperatingTrip.objects.get_or_create(
            route_pattern=rp50_up,
            vehicle=v50x,
            service_date=today,
            defaults={'status': 'running'}
        )
        create_or_update_pos(v50x, trip50_up, r50_stops[3]) # near Meghaninagar

        # Route 50 DOWN Pattern
        r50_stops_down = list(reversed(r50_stops))
        down50_origin = r50_stops_down[0]
        down50_dest = r50_stops_down[-1]
        linestring_down = "LINESTRING(" + ", ".join([f"{parse_wkt_point(s.location)[1]} {parse_wkt_point(s.location)[0]}" for s in r50_stops_down if parse_wkt_point(s.location)[0]]) + ")"

        rp50_down, _ = RoutePattern.objects.get_or_create(
            route=r50,
            direction_id=1,
            defaults={
                'external_pattern_id': '50-DOWN',
                'direction_name': f"{down50_origin.name} to {down50_dest.name}",
                'headsign': down50_dest.name,
                'origin_stop': down50_origin,
                'destination_stop': down50_dest,
                'shape': linestring_down,
                'is_active': True,
            }
        )

        RoutePatternStop.objects.filter(route_pattern=rp50_down).delete()
        dist = 0
        for seq, s in enumerate(r50_stops_down, start=1):
            RoutePatternStop.objects.create(
                route_pattern=rp50_down,
                stop=s,
                stop_sequence=seq,
                distance_from_start_m=dist,
                pickup_type=0,
                drop_off_type=0
            )
            dist += 600

        # Vehicle 50-Y (JBM Ecolife Electric Non-AC) on DOWN
        v50y = get_or_create_vehicle('50-Y', 'GJ-01-CZ-5002', vt_electric_nonac)
        trip50_down, _ = OperatingTrip.objects.get_or_create(
            route_pattern=rp50_down,
            vehicle=v50y,
            service_date=today,
            defaults={'status': 'running'}
        )
        create_or_update_pos(v50y, trip50_down, r50_stops_down[2])

        print("Route 50 created with 50-X (Electric AC) and 50-Y (Non-AC).")

    print("Seeding completed successfully!")

if __name__ == '__main__':
    run()
