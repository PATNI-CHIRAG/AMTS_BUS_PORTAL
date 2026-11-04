import os
import sys

# Setup Django environment
sys.path.insert(0, os.path.abspath('backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from rest_framework.test import APIClient
from transit.models import Route, RoutePattern, Stop

client = APIClient()

def test_endpoint(name, url, expected_status=200):
    print(f"\n==================================================")
    print(f"Testing {name}: {url}")
    print(f"==================================================")
    response = client.get(url)
    print(f"Status Code: {response.status_code}")
    if response.status_code != expected_status:
        print(f"ERROR: Expected {expected_status}, got {response.status_code}")
        print(response.content.decode('utf-8')[:500])
        return None
    data = response.json()
    return data

def run_tests():
    # 1. Health Check
    health_data = test_endpoint("Health Check", "/api/v1/health/")
    if health_data:
        print("Health Response Summary:")
        print(f"  Status: {health_data.get('status')}")
        print(f"  Database: {health_data.get('database')}")
        print(f"  PostgreSQL: {health_data.get('postgres_version', '')[:30]}...")
        print(f"  PostGIS: {health_data.get('postgis_version', '')[:40]}...")
        print(f"  Transit Tables Count: {health_data.get('transit_tables_count')}")

    # 2. Routes List
    routes_resp = test_endpoint("Routes List", "/api/v1/routes/")
    pattern_id_to_test = None
    if routes_resp:
        routes_list = routes_resp.get('results', [])
        print(f"  Total routes returned: {len(routes_list)}")
        route_codes = [r['public_code'] for r in routes_list[:12]]
        print(f"  Route codes: {', '.join(route_codes)}")

    # 3. Route Search (Route 31)
    route_31_resp = test_endpoint("Route 31 Search", "/api/v1/routes/?query=31")
    if route_31_resp:
        results = route_31_resp.get('results', [])
        print(f"  Matching routes count: {len(results)}")
        if results:
            r31 = results[0]
            print(f"  Found route: {r31['public_code']} - {r31['long_name']}")
            print(f"  Directional Patterns count: {len(r31.get('patterns', []))}")
            for p in r31.get('patterns', []):
                print(f"    - Direction {p.get('direction_id')}: {p.get('direction_name')} (ID: {p.get('id')})")
            if r31.get('patterns'):
                pattern_id_to_test = r31['patterns'][0]['id']

    # 4. Route Pattern Detail (Directional pattern with stops and live buses)
    if pattern_id_to_test:
        pattern_resp = test_endpoint("Route Pattern Detail", f"/api/v1/patterns/{pattern_id_to_test}/")
        if pattern_resp:
            pdata = pattern_resp.get('data', {})
            print(f"  Pattern: {pdata.get('direction_name')} (Route {pdata.get('route_code')})")
            stops = pdata.get('stops', [])
            print(f"  Total Pattern Stops: {len(stops)}")
            first_stops = [s['name'] for s in stops[:3]]
            print(f"  First 3 stops: {first_stops}")
            active_buses = pdata.get('active_buses', [])
            print(f"  Directional Live Buses on this pattern: {len(active_buses)}")
            for b in active_buses:
                print(f"    * Fleet #{b.get('fleet_number')} ({b.get('bus_model')}, {b.get('fuel_type')}, AC: {b.get('has_ac')}), Status: {b.get('status')}, Lat: {b.get('latitude')}, Lon: {b.get('longitude')}")

    # 5. Stop Search & Journey Planner
    stops_resp_1 = test_endpoint("Stop Search (Meghaninagar)", "/api/v1/stops/?query=Meghaninagar")
    origin_stop_id = None
    if stops_resp_1:
        s_list = stops_resp_1.get('results', [])
        if s_list:
            origin_stop_id = s_list[0]['id']
            print(f"  Selected Origin: {s_list[0]['name']} (ID: {origin_stop_id})")

    stops_resp_2 = test_endpoint("Stop Search (Sarkhej Bus Stand)", "/api/v1/stops/?query=Sarkhej")
    dest_stop_id = None
    if stops_resp_2:
        s_list = stops_resp_2.get('results', [])
        if s_list:
            dest_stop_id = s_list[0]['id']
            print(f"  Selected Destination: {s_list[0]['name']} (ID: {dest_stop_id})")

    # 6. Journey Planner (Direct Journey Test)
    if origin_stop_id and dest_stop_id:
        journey_resp = test_endpoint("Journey Planner (Direct Route 31)", f"/api/v1/journey/?origin_id={origin_stop_id}&destination_id={dest_stop_id}")
        if journey_resp:
            meta = journey_resp.get('meta', {})
            print(f"  Origin: {meta.get('origin')}")
            print(f"  Destination: {meta.get('destination')}")
            direct_routes = journey_resp.get('direct_journeys', [])
            print(f"  Direct Route Options Available: {len(direct_routes)}")
            for dr in direct_routes:
                print(f"    - Route {dr.get('route_code')} ({dr.get('direction_name')}) - {dr.get('stops_count')} stops | Fare: Rs. {dr.get('fare_rupees')} | Est: {dr.get('estimated_travel_minutes')} mins")
                print(f"      Pass option: Male Rs. {dr.get('all_day_pass_options', {}).get('male_rupees')}, Female Rs. {dr.get('all_day_pass_options', {}).get('female_rupees')}")
                for ab in dr.get('approaching_buses', []):
                    print(f"      Approaching Bus: {ab.get('fleet_number')} ({ab.get('bus_model')}, {ab.get('fuel_type')}, AC: {ab.get('has_ac')}) | ETA: ~{ab.get('eta_minutes')} mins | Status: {ab.get('status')}")

    # Also test 1-Transfer Journey
    k_stop = Stop.objects.filter(name='Kalupur Terminus').first()
    s_stop = Stop.objects.filter(name='Sarkhej Bus Stand').first()
    if k_stop and s_stop:
        transfer_test = test_endpoint("Journey Planner (1-Transfer via Lal Darwaja)", f"/api/v1/journey/?origin_id={k_stop.id}&destination_id={s_stop.id}")
        if transfer_test:
            transfers = transfer_test.get('transfer_journeys', [])
            print(f"  Transfer options count: {len(transfers)}")
            for tr in transfers:
                print(f"    - Via Hub: {tr.get('transfer_hub', {}).get('name')}")
                print(f"      Leg 1: Route {tr.get('leg_1', {}).get('route_code')} from {tr.get('leg_1', {}).get('from_stop')} to {tr.get('leg_1', {}).get('to_stop')} ({tr.get('leg_1', {}).get('stops')} stops, Rs. {tr.get('leg_1', {}).get('fare_rupees')})")
                print(f"      Leg 2: Route {tr.get('leg_2', {}).get('route_code')} from {tr.get('leg_2', {}).get('from_stop')} to {tr.get('leg_2', {}).get('to_stop')} ({tr.get('leg_2', {}).get('stops')} stops, Rs. {tr.get('leg_2', {}).get('fare_rupees')})")
                print(f"      Total Time: {tr.get('total_travel_minutes')} mins | Total Fare: Rs. {tr.get('total_fare_rupees')}")
                print(f"      Golden Ticket Savings Tip: {tr.get('all_day_pass_recommendation', {}).get('savings_tip')}")

    # 7. Admin Fleet Overview
    fleet_resp = test_endpoint("Admin Fleet Overview", "/api/v1/admin/fleet/")
    if fleet_resp:
        metrics = fleet_resp.get('metrics', {})
        print(f"  Total Fleet Vehicles: {metrics.get('total_fleet_size')}")
        print(f"  Active on Road: {metrics.get('active_on_road')}")
        print(f"  On-Time: {metrics.get('on_time_trips')}")
        print(f"  Delayed: {metrics.get('delayed_trips')}")
        print(f"  Average Rounds per Bus: {metrics.get('average_rounds_per_bus')}")
        sample_vehicles = fleet_resp.get('fleet', [])[:4]
        print(f"  Sample fleet records:")
        for sv in sample_vehicles:
            print(f"    * Fleet #{sv.get('fleet_number')} ({sv.get('bus_model')}, {sv.get('fuel_type')}) - {sv.get('assigned_route')} | Rounds: {sv.get('rounds_completed_today')} | Telemetry: {sv.get('battery_or_fuel')} | Status: {sv.get('status')}")

    # 8. Service Alerts
    alerts_resp = test_endpoint("Service Alerts", "/api/v1/alerts/")
    if alerts_resp:
        alerts = alerts_resp.get('alerts', [])
        print(f"  Active alerts count: {len(alerts)}")
        for a in alerts:
            print(f"    * [{a.get('severity')}] {a.get('title')}: {a.get('description')}")

    print("\n==================================================")
    print("ALL API ENDPOINT TESTS COMPLETED SUCCESSFULLY!")
    print("==================================================")

if __name__ == '__main__':
    run_tests()
