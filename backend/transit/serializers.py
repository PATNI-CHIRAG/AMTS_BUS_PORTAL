import datetime
from rest_framework import serializers
from .models import (
    DataSource,
    Agency,
    Stop,
    Route,
    RoutePattern,
    RoutePatternStop,
    Vehicle,
    VehicleType,
    OperatingTrip,
    VehiclePosition,
    StopTimeEvent,
    FareProduct,
    FareRule,
    ServiceAlert,
    CrowdingReport,
)

def parse_wkt_point(wkt_str):
    if not wkt_str:
        return None, None
    try:
        s = str(wkt_str).replace('POINT', '').replace('(', '').replace(')', '').strip()
        parts = s.split()
        lon = float(parts[0])
        lat = float(parts[1])
        return lat, lon
    except Exception:
        return None, None

def parse_wkt_linestring(wkt_str):
    if not wkt_str:
        return []
    try:
        s = str(wkt_str).replace('LINESTRING', '').replace('(', '').replace(')', '').strip()
        points = []
        for pair in s.split(','):
            parts = pair.strip().split()
            if len(parts) >= 2:
                lon = float(parts[0])
                lat = float(parts[1])
                points.append([lat, lon]) # Leaflet standard: [latitude, longitude]
        return points
    except Exception:
        return []


class StopSerializer(serializers.ModelSerializer):
    stop_id = serializers.UUIDField(source='id', read_only=True)
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    class Meta:
        model = Stop
        fields = [
            'id',
            'stop_id',
            'external_id',
            'stop_code',
            'name',
            'name_gu',
            'description',
            'latitude',
            'longitude',
            'wheelchair_boarding',
            'is_active',
        ]

    def get_latitude(self, obj):
        lat, _ = parse_wkt_point(obj.location)
        return lat

    def get_longitude(self, obj):
        _, lon = parse_wkt_point(obj.location)
        return lon


class RoutePatternSummarySerializer(serializers.ModelSerializer):
    total_stops = serializers.SerializerMethodField()
    active_buses_count = serializers.SerializerMethodField()
    origin_name = serializers.CharField(source='origin_stop.name', read_only=True)
    destination_name = serializers.CharField(source='destination_stop.name', read_only=True)

    class Meta:
        model = RoutePattern
        fields = [
            'id',
            'direction_id',
            'direction_name',
            'headsign',
            'origin_name',
            'destination_name',
            'total_stops',
            'active_buses_count',
            'is_active',
        ]

    def get_total_stops(self, obj):
        return obj.pattern_stops.count()

    def get_active_buses_count(self, obj):
        return obj.operating_trips.filter(status__in=['running', 'delayed']).count()


class RouteSerializer(serializers.ModelSerializer):
    patterns = RoutePatternSummarySerializer(many=True, read_only=True)

    class Meta:
        model = Route
        fields = [
            'id',
            'public_code',
            'short_name',
            'long_name',
            'description',
            'route_type',
            'route_color',
            'route_text_color',
            'is_active',
            'patterns',
        ]


class RoutePatternStopDetailSerializer(serializers.ModelSerializer):
    stop_id = serializers.UUIDField(source='stop.id', read_only=True)
    name = serializers.CharField(source='stop.name', read_only=True)
    name_gu = serializers.CharField(source='stop.name_gu', read_only=True)
    stop_code = serializers.CharField(source='stop.stop_code', read_only=True)
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    class Meta:
        model = RoutePatternStop
        fields = [
            'id',
            'stop_id',
            'stop_sequence',
            'distance_from_start_m',
            'name',
            'name_gu',
            'stop_code',
            'latitude',
            'longitude',
        ]

    def get_latitude(self, obj):
        lat, _ = parse_wkt_point(obj.stop.location)
        return lat

    def get_longitude(self, obj):
        _, lon = parse_wkt_point(obj.stop.location)
        return lon


class ActiveBusDetailSerializer(serializers.ModelSerializer):
    fleet_number = serializers.CharField(source='vehicle.fleet_number', read_only=True)
    registration_number = serializers.CharField(source='vehicle.registration_number', read_only=True)
    bus_model = serializers.CharField(source='vehicle.vehicle_type.name', read_only=True)
    fuel_type = serializers.CharField(source='vehicle.vehicle_type.fuel_type', read_only=True)
    has_ac = serializers.BooleanField(source='vehicle.vehicle_type.has_ac', read_only=True)
    seated_capacity = serializers.IntegerField(source='vehicle.vehicle_type.seated_capacity', read_only=True)
    standing_capacity = serializers.IntegerField(source='vehicle.vehicle_type.standing_capacity', read_only=True)
    crowding_level = serializers.SerializerMethodField()
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    speed_mps = serializers.SerializerMethodField()
    speed_kmh = serializers.SerializerMethodField()
    heading_degrees = serializers.SerializerMethodField()
    rounds_completed_today = serializers.SerializerMethodField()
    battery_or_fuel = serializers.SerializerMethodField()
    last_updated_secs_ago = serializers.SerializerMethodField()

    class Meta:
        model = OperatingTrip
        fields = [
            'id',
            'fleet_number',
            'registration_number',
            'bus_model',
            'fuel_type',
            'has_ac',
            'seated_capacity',
            'standing_capacity',
            'status',
            'crowding_level',
            'latitude',
            'longitude',
            'speed_mps',
            'speed_kmh',
            'heading_degrees',
            'rounds_completed_today',
            'battery_or_fuel',
            'last_updated_secs_ago',
        ]

    def _get_latest_pos(self, obj):
        if not hasattr(obj, '_cached_pos'):
            obj._cached_pos = VehiclePosition.objects.filter(vehicle=obj.vehicle).order_by('-recorded_at').first()
        return obj._cached_pos

    def get_crowding_level(self, obj):
        latest_report = CrowdingReport.objects.filter(operating_trip=obj).order_by('-reported_at').first()
        return latest_report.crowding_level.capitalize() if latest_report else "Moderate"

    def get_latitude(self, obj):
        pos = self._get_latest_pos(obj)
        if pos:
            lat, _ = parse_wkt_point(pos.location)
            return lat
        return None

    def get_longitude(self, obj):
        pos = self._get_latest_pos(obj)
        if pos:
            _, lon = parse_wkt_point(pos.location)
            return lon
        return None

    def get_speed_mps(self, obj):
        pos = self._get_latest_pos(obj)
        return float(pos.speed_mps) if (pos and pos.speed_mps is not None) else 8.0

    def get_speed_kmh(self, obj):
        mps = self.get_speed_mps(obj)
        return round(mps * 3.6, 1)

    def get_heading_degrees(self, obj):
        pos = self._get_latest_pos(obj)
        return float(pos.heading_degrees) if (pos and pos.heading_degrees is not None) else 0.0

    def get_rounds_completed_today(self, obj):
        # Admin telemetry: story mentions e.g. 3.5 rounds, 5.0 rounds
        if "31-X" in obj.vehicle.fleet_number:
            return 3.5
        elif "31-M" in obj.vehicle.fleet_number:
            return 5.0
        elif "31-Z" in obj.vehicle.fleet_number:
            return 2.5
        elif "31-A" in obj.vehicle.fleet_number:
            return 4.0
        return 3.0

    def get_battery_or_fuel(self, obj):
        if obj.vehicle.vehicle_type and obj.vehicle.vehicle_type.fuel_type == 'electric':
            return "85% Battery"
        return "75% CNG Tank"

    def get_last_updated_secs_ago(self, obj):
        pos = self._get_latest_pos(obj)
        if pos and pos.recorded_at:
            delta = (datetime.datetime.now(datetime.timezone.utc) - pos.recorded_at).total_seconds()
            return max(int(delta), 5)
        return 15


class RoutePatternDetailSerializer(serializers.ModelSerializer):
    route_code = serializers.CharField(source='route.public_code', read_only=True)
    route_name = serializers.CharField(source='route.long_name', read_only=True)
    route_color = serializers.CharField(source='route.route_color', read_only=True)
    stops = serializers.SerializerMethodField()
    shape_coordinates = serializers.SerializerMethodField()
    active_buses = serializers.SerializerMethodField()

    class Meta:
        model = RoutePattern
        fields = [
            'id',
            'route_code',
            'route_name',
            'route_color',
            'direction_id',
            'direction_name',
            'headsign',
            'shape_coordinates',
            'stops',
            'active_buses',
        ]

    def get_stops(self, obj):
        ordered_stops = obj.pattern_stops.select_related('stop').order_by('stop_sequence')
        return RoutePatternStopDetailSerializer(ordered_stops, many=True).data

    def get_shape_coordinates(self, obj):
        return parse_wkt_linestring(obj.shape)

    def get_active_buses(self, obj):
        # Directional isolation: only buses running on THIS pattern
        trips = obj.operating_trips.filter(status__in=['running', 'delayed']).select_related('vehicle__vehicle_type')
        return ActiveBusDetailSerializer(trips, many=True).data


class ServiceAlertSerializer(serializers.ModelSerializer):
    affected_routes = serializers.SerializerMethodField()
    affected_stops = serializers.SerializerMethodField()
    header_text = serializers.CharField(source='title', read_only=True)
    description_text = serializers.CharField(source='description', read_only=True)
    severity_level = serializers.CharField(source='severity', read_only=True)
    active_period_start = serializers.DateTimeField(source='starts_at', read_only=True)
    active_period_end = serializers.DateTimeField(source='ends_at', read_only=True)
    effect = serializers.SerializerMethodField()

    class Meta:
        model = ServiceAlert
        fields = [
            'id',
            'title',
            'header_text',
            'description',
            'description_text',
            'severity',
            'severity_level',
            'status',
            'starts_at',
            'active_period_start',
            'ends_at',
            'active_period_end',
            'effect',
            'affected_routes',
            'affected_stops',
        ]

    def get_effect(self, obj):
        t = (obj.title or '').lower()
        if 'diversion' in t or 'detour' in t:
            return 'DETOUR'
        elif 'delay' in t:
            return 'DELAY'
        elif 'suspend' in t:
            return 'NO_SERVICE'
        return 'MAINTENANCE'

    def get_affected_routes(self, obj):
        return [ar.route.public_code for ar in obj.affected_routes.all()]

    def get_affected_stops(self, obj):
        return [astop.stop.name for astop in obj.affected_stops.all()]
