from django.core.management.base import BaseCommand
from django.utils import timezone
from transit.models import (
    Agency, DataSource, Stop, Route, RoutePattern, RoutePatternStop,
    VehicleType, Vehicle, OperatingTrip, VehiclePosition
)
from transit.serializers import parse_wkt_point

class Command(BaseCommand):
    help = "Seeds Routes 34 and 50 and enriches Gujarati stop names"

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Seeding Routes 34 and 50 and enriching Gujarati stop names..."))

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
                s.save(update_fields=['name_gu'])
        self.stdout.write(self.style.SUCCESS("Gujarati stop names updated."))

        # 2. Get Vehicle Types
        vt_electric_ac = VehicleType.objects.filter(has_ac=True, fuel_type='electric').first()
        vt_cng_nonac = VehicleType.objects.filter(has_ac=False, fuel_type='cng').first()
        vt_electric_nonac = VehicleType.objects.filter(has_ac=False, fuel_type='electric').first()

        today = timezone.now().date()

        def get_or_create_vehicle(fleet, reg, vtype):
            v = Vehicle.objects.filter(registration_number=reg).first()
            if not v:
                v = Vehicle.objects.filter(fleet_number=fleet).first()
            if not v:
                v = Vehicle.objects.create(
                    fleet_number=fleet,
                    registration_number=reg,
                    vehicle_type=vtype,
                    operational_status='active',
                    device_reference=f"GPS-DEV-{fleet}"
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
            'M.L.A. Quarters',
            'Cancer Hospital',
            'Civil Hospital',
            'Civil Hospital Corner',
            'Baliya Limbdi',
            'Giradharnagar',
            'Idga',
            'Saraspur Char Rasta',
            'Dr.Ambedkar Hall (Saraspur)',
            'Kalupur Terminus'
        ]

        def build_pattern(route, dir_id, dir_name, stop_names_list):
            pat = RoutePattern.objects.filter(route=route, direction_id=dir_id).first()
            if not pat:
                p_stops = []
                for sname in stop_names_list:
                    st = Stop.objects.filter(name=sname).first()
                    if st:
                        p_stops.append(st)
                
                if p_stops:
                    origin = p_stops[0]
                    dest = p_stops[-1]
                    coords = []
                    for s in p_stops:
                        lat, lon = parse_wkt_point(s.location)
                        if lat and lon:
                            coords.append(f"{lon} {lat}")
                    shape_wkt = f"LINESTRING({', '.join(coords)})" if coords else "LINESTRING(0 0, 1 1)"

                    pat = RoutePattern.objects.create(
                        route=route,
                        direction_id=dir_id,
                        direction_name=dir_name,
                        origin_stop=origin,
                        destination_stop=dest,
                        shape=shape_wkt,
                        is_active=True
                    )
                    
                    dist = 0
                    for idx, s in enumerate(p_stops, start=1):
                        RoutePatternStop.objects.create(
                            route_pattern=pat,
                            stop=s,
                            stop_sequence=idx,
                            distance_from_start_m=dist
                        )
                        dist += 600
            return pat

        p34_up = build_pattern(r34, 0, 'Meghaninagar to Kalupur Terminus', r34_stop_names)
        p34_dn = build_pattern(r34, 1, 'Kalupur Terminus to Meghaninagar', list(reversed(r34_stop_names)))

        if p34_up:
            v34_1 = get_or_create_vehicle('34-A', 'GJ-01-CZ-3401', vt_electric_ac)
            t34_1 = OperatingTrip.objects.filter(vehicle=v34_1, service_date=today).first()
            if not t34_1:
                t34_1 = OperatingTrip.objects.create(
                    vehicle=v34_1,
                    service_date=today,
                    route_pattern=p34_up,
                    status='running'
                )
            s_mid = Stop.objects.filter(name='Civil Hospital').first()
            if s_mid:
                create_or_update_pos(v34_1, t34_1, s_mid)

        if p34_dn:
            v34_2 = get_or_create_vehicle('34-B', 'GJ-01-CZ-3402', vt_cng_nonac)
            t34_2 = OperatingTrip.objects.filter(vehicle=v34_2, service_date=today).first()
            if not t34_2:
                t34_2 = OperatingTrip.objects.create(
                    vehicle=v34_2,
                    service_date=today,
                    route_pattern=p34_dn,
                    status='running'
                )
            s_mid_dn = Stop.objects.filter(name='Saraspur Char Rasta').first()
            if s_mid_dn:
                create_or_update_pos(v34_2, t34_2, s_mid_dn)

        self.stdout.write(self.style.SUCCESS("Route 34 provisioned."))

        # -------------------------------------------------------------
        # 4. Create Route 50 (Naroda Gam <-> Sarkhej Gam)
        # -------------------------------------------------------------
        r50 = Route.objects.filter(public_code='50').first()
        if not r50:
            r50 = Route.objects.create(
                public_code='50',
                external_id='ROUTE-50',
                agency=agency,
                data_source=data_source,
                short_name='50',
                long_name='Naroda Gam to Sarkhej Gam',
                description='Express Cross-City Link connecting East and South-West via Kalupur & Paldi',
                route_type=3,
                route_color='7B1FA2',
                route_text_color='FFFFFF',
                is_active=True,
            )

        r50_stop_names = [
            'Naroda Gam',
            'Bethak (Naroda)',
            'Naroda',
            'Arvind Mills (Naroda)',
            'Saraspur Char Rasta',
            'Kalupur Terminus',
            'Lal Darwaja Terminus',
            'Paldi',
            'Vasna Terminus',
            'Sarkhej Bus Stand',
            'Sarkhej Gam'
        ]

        p50_up = build_pattern(r50, 0, 'Naroda Gam to Sarkhej Gam', r50_stop_names)
        p50_dn = build_pattern(r50, 1, 'Sarkhej Gam to Naroda Gam', list(reversed(r50_stop_names)))

        if p50_up:
            v50_1 = get_or_create_vehicle('50-A', 'GJ-01-CZ-5001', vt_electric_ac)
            t50_1 = OperatingTrip.objects.filter(vehicle=v50_1, service_date=today).first()
            if not t50_1:
                t50_1 = OperatingTrip.objects.create(
                    vehicle=v50_1,
                    service_date=today,
                    route_pattern=p50_up,
                    status='running'
                )
            s_paldi = Stop.objects.filter(name='Paldi').first()
            if s_paldi:
                create_or_update_pos(v50_1, t50_1, s_paldi)

        if p50_dn:
            v50_2 = get_or_create_vehicle('50-B', 'GJ-01-CZ-5002', vt_electric_nonac)
            t50_2 = OperatingTrip.objects.filter(vehicle=v50_2, service_date=today).first()
            if not t50_2:
                t50_2 = OperatingTrip.objects.create(
                    vehicle=v50_2,
                    service_date=today,
                    route_pattern=p50_dn,
                    status='running'
                )
            s_kalupur = Stop.objects.filter(name='Kalupur Terminus').first()
            if s_kalupur:
                create_or_update_pos(v50_2, t50_2, s_kalupur)

        self.stdout.write(self.style.SUCCESS("Route 50 provisioned."))
        self.stdout.write(self.style.SUCCESS("All routes, vehicles and translations seeded successfully!"))
