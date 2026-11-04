import os
import sys
import math

sys.path.insert(0, r'C:\Users\CHIRAG\Desktop\AMTS_Portal\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from transit.models import Route, RoutePattern, RoutePatternStop, Stop
from transit.serializers import parse_wkt_point

def resequence_and_update_shape(pattern):
    """
    Ensures stop_sequence is contiguous (1, 2, 3, ...) and updates
    the pattern's shape LineString to follow the exact stops.
    """
    p_stops = list(pattern.pattern_stops.select_related('stop').order_by('stop_sequence'))
    if not p_stops:
        return

    # Update origin and destination stops
    pattern.origin_stop = p_stops[0].stop
    pattern.destination_stop = p_stops[-1].stop

    # Re-sequence
    dist = 0
    coords_wkt = []
    for idx, ps in enumerate(p_stops, start=1):
        if ps.stop_sequence != idx or ps.distance_from_start_m != dist:
            ps.stop_sequence = idx
            ps.distance_from_start_m = dist
            ps.save(update_fields=['stop_sequence', 'distance_from_start_m'])
        dist += 600
        lat, lon = parse_wkt_point(ps.stop.location)
        if lat and lon:
            coords_wkt.append(f"{lon} {lat}")

    if coords_wkt:
        pattern.shape = f"LINESTRING({', '.join(coords_wkt)})"
    pattern.save(update_fields=['origin_stop', 'destination_stop', 'shape'])
    print(f"  Pattern {pattern.direction_id} ({pattern.direction_name}): {len(p_stops)} stops re-sequenced, shape updated.")


def fix_route_50():
    print("=== Fixing Route 50 ===")
    r50 = Route.objects.filter(public_code='50').first()
    if not r50:
        print("Route 50 not found!")
        return

    clean_stop_names = [
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

    stops_up = []
    for name in clean_stop_names:
        s = Stop.objects.filter(name=name).first()
        if not s:
            print(f"ERROR: Stop {name} not found!")
            return
        stops_up.append(s)

    stops_down = list(reversed(stops_up))

    # UP Pattern (dir=0): Naroda Gam to Lal Darwaja
    p_up = r50.patterns.filter(direction_id=0).first()
    if p_up:
        RoutePatternStop.objects.filter(route_pattern=p_up).delete()
        dist = 0
        coords = []
        for idx, s in enumerate(stops_up, start=1):
            RoutePatternStop.objects.create(
                route_pattern=p_up,
                stop=s,
                stop_sequence=idx,
                distance_from_start_m=dist,
                pickup_type=0,
                drop_off_type=0
            )
            dist += 600
            lat, lon = parse_wkt_point(s.location)
            coords.append(f"{lon} {lat}")
        p_up.origin_stop = stops_up[0]
        p_up.destination_stop = stops_up[-1]
        p_up.direction_name = f"{stops_up[0].name} to {stops_up[-1].name}"
        p_up.headsign = stops_up[-1].name
        p_up.shape = f"LINESTRING({', '.join(coords)})"
        p_up.save()
        print(f"  UP Pattern rebuilt with {len(stops_up)} stops: {stops_up[0].name} -> {stops_up[-1].name}")

    # DOWN Pattern (dir=1): Lal Darwaja to Naroda Gam
    p_down = r50.patterns.filter(direction_id=1).first()
    if p_down:
        RoutePatternStop.objects.filter(route_pattern=p_down).delete()
        dist = 0
        coords = []
        for idx, s in enumerate(stops_down, start=1):
            RoutePatternStop.objects.create(
                route_pattern=p_down,
                stop=s,
                stop_sequence=idx,
                distance_from_start_m=dist,
                pickup_type=0,
                drop_off_type=0
            )
            dist += 600
            lat, lon = parse_wkt_point(s.location)
            coords.append(f"{lon} {lat}")
        p_down.origin_stop = stops_down[0]
        p_down.destination_stop = stops_down[-1]
        p_down.direction_name = f"{stops_down[0].name} to {stops_down[-1].name}"
        p_down.headsign = stops_down[-1].name
        p_down.shape = f"LINESTRING({', '.join(coords)})"
        p_down.save()
        print(f"  DOWN Pattern rebuilt with {len(stops_down)} stops: {stops_down[0].name} -> {stops_down[-1].name}")


def fix_anomaly_stops():
    print("\n=== Fixing Anomaly Stops Across Other Routes ===")
    
    # 1. Route 105: remove Meldi Matanu Mandir (AMTS-5347)
    r105 = Route.objects.filter(public_code='105').first()
    if r105:
        deleted_count = RoutePatternStop.objects.filter(
            route_pattern__route=r105,
            stop__stop_code='AMTS-5347'
        ).delete()[0]
        print(f"Route 105: Removed {deleted_count} rogue Meldi Matanu Mandir stops")
        for p in r105.patterns.all():
            resequence_and_update_shape(p)

    # 2. Route 117: remove Gujarat Food Product (AMTS-9549) and Jogni Matanu Mandir (AMTS-4835)
    r117 = Route.objects.filter(public_code='117').first()
    if r117:
        deleted_count = RoutePatternStop.objects.filter(
            route_pattern__route=r117,
            stop__stop_code__in=['AMTS-9549', 'AMTS-4835']
        ).delete()[0]
        print(f"Route 117: Removed {deleted_count} rogue stops")
        for p in r117.patterns.all():
            resequence_and_update_shape(p)

    # 3. Route 123: remove Sardar Patel Chowk in Naranpura (AMTS-3746)
    r123 = Route.objects.filter(public_code='123').first()
    if r123:
        deleted_count = RoutePatternStop.objects.filter(
            route_pattern__route=r123,
            stop__name__icontains='Sardar Patel Chowk',
            stop__location__contains='72.57'
        ).delete()[0]
        print(f"Route 123: Removed {deleted_count} rogue Sardar Patel Chowk stops")
        for p in r123.patterns.all():
            resequence_and_update_shape(p)

    # 4. Route 160: remove Ramdev Masala (AMTS-4929) and Paras Nagar (AMTS-5067)
    r160 = Route.objects.filter(public_code='160').first()
    if r160:
        deleted_count = RoutePatternStop.objects.filter(
            route_pattern__route=r160,
            stop__stop_code__in=['AMTS-4929', 'AMTS-5067']
        ).delete()[0]
        print(f"Route 160: Removed {deleted_count} rogue stops")
        for p in r160.patterns.all():
            resequence_and_update_shape(p)

    # 5. Route 40: remove Khodiyar Matanu Mandir (AMTS-3109)
    r40 = Route.objects.filter(public_code='40').first()
    if r40:
        deleted_count = RoutePatternStop.objects.filter(
            route_pattern__route=r40,
            stop__stop_code='AMTS-3109'
        ).delete()[0]
        print(f"Route 40: Removed {deleted_count} rogue Khodiyar Matanu Mandir stops")
        for p in r40.patterns.all():
            resequence_and_update_shape(p)

    # 6. Route 58: remove India Colony (AMTS-1550)
    r58 = Route.objects.filter(public_code='58').first()
    if r58:
        deleted_count = RoutePatternStop.objects.filter(
            route_pattern__route=r58,
            stop__stop_code='AMTS-1550'
        ).delete()[0]
        print(f"Route 58: Removed {deleted_count} rogue India Colony stops")
        for p in r58.patterns.all():
            resequence_and_update_shape(p)

if __name__ == '__main__':
    fix_route_50()
    fix_anomaly_stops()
    print("\nAll database fixes applied successfully!")
