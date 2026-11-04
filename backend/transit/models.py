import uuid
from django.db import models
from django.db.models import Q, F
from django.core.validators import RegexValidator
from .fields import GeographyPointField, GeographyLineStringField

hex_color_validator = RegexValidator(
    regex=r'^[0-9A-Fa-f]{6}$',
    message='Color must be a 6-character hex code without #'
)

# ---------------------------------------------------------------------------
# Provenance Group
# ---------------------------------------------------------------------------

class DataSource(models.Model):
    SOURCE_TYPE_CHOICES = [
        ('official', 'Official'),
        ('licensed', 'Licensed'),
        ('community', 'Community'),
        ('manual', 'Manual'),
        ('demo', 'Demo'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.TextField()
    source_type = models.TextField(choices=SOURCE_TYPE_CHOICES)
    source_url = models.TextField(null=True, blank=True)
    license_or_permission = models.TextField(null=True, blank=True)
    agency_scope = models.TextField(null=True, blank=True)
    is_authorized_for_production = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'transit"."data_sources'
        constraints = [
            models.CheckConstraint(
                condition=Q(source_type__in=['official', 'licensed', 'community', 'manual', 'demo']),
                name='data_sources_source_type_check'
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.source_type})"


class ImportBatch(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('validated', 'Validated'),
        ('imported', 'Imported'),
        ('rejected', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    data_source = models.ForeignKey(DataSource, on_delete=models.RESTRICT, related_name='import_batches')
    source_file_name = models.TextField(null=True, blank=True)
    source_sha256 = models.TextField(null=True, blank=True)
    source_retrieved_at = models.DateTimeField(null=True, blank=True)
    service_start_date = models.DateField(null=True, blank=True)
    service_end_date = models.DateField(null=True, blank=True)
    importer_version = models.TextField(null=True, blank=True)
    status = models.TextField(choices=STATUS_CHOICES, default='pending')
    validation_summary = models.JSONField(default=dict, blank=True)
    imported_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'transit"."import_batches'
        constraints = [
            models.CheckConstraint(
                condition=Q(status__in=['pending', 'validated', 'imported', 'rejected']),
                name='import_batches_status_check'
            ),
            models.CheckConstraint(
                condition=Q(service_end_date__isnull=True) | Q(service_start_date__isnull=True) | Q(service_end_date__gte=F('service_start_date')),
                name='import_batches_service_dates_check'
            ),
        ]

    def __str__(self):
        return f"Batch {self.id} - {self.status}"


# ---------------------------------------------------------------------------
# Network Group
# ---------------------------------------------------------------------------

class Agency(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    data_source = models.ForeignKey(DataSource, on_delete=models.RESTRICT, related_name='agencies')
    external_id = models.TextField()
    name = models.TextField()
    url = models.TextField(null=True, blank=True)
    phone = models.TextField(null=True, blank=True)
    timezone = models.TextField(default='Asia/Kolkata')
    language_code = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'transit"."agencies'
        constraints = [
            models.UniqueConstraint(fields=['data_source', 'external_id'], name='agencies_data_source_external_id_key')
        ]

    def __str__(self):
        return f"{self.name} ({self.external_id})"


class Stop(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    data_source = models.ForeignKey(DataSource, on_delete=models.RESTRICT, related_name='stops')
    external_id = models.TextField()
    stop_code = models.TextField(null=True, blank=True)
    name = models.TextField()
    name_gu = models.TextField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    location = GeographyPointField(null=True, blank=True)
    parent_stop = models.ForeignKey('self', on_delete=models.RESTRICT, null=True, blank=True, related_name='child_stops')
    wheelchair_boarding = models.SmallIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'transit"."stops'
        constraints = [
            models.UniqueConstraint(fields=['data_source', 'external_id'], name='stops_data_source_external_id_key'),
            models.CheckConstraint(
                condition=Q(wheelchair_boarding__isnull=True) | Q(wheelchair_boarding__gte=0, wheelchair_boarding__lte=2),
                name='stops_wheelchair_boarding_check'
            ),
        ]
        indexes = [
            models.Index(fields=['name'], name='stops_name_idx'),
        ]

    def __str__(self):
        return f"{self.name} ({self.external_id})"


class Route(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    data_source = models.ForeignKey(DataSource, on_delete=models.RESTRICT, related_name='routes')
    agency = models.ForeignKey(Agency, on_delete=models.RESTRICT, related_name='routes')
    external_id = models.TextField()
    public_code = models.TextField()
    short_name = models.TextField(null=True, blank=True)
    long_name = models.TextField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    route_type = models.IntegerField(null=True, blank=True)
    route_color = models.CharField(max_length=6, null=True, blank=True, validators=[hex_color_validator])
    route_text_color = models.CharField(max_length=6, null=True, blank=True, validators=[hex_color_validator])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'transit"."routes'
        constraints = [
            models.UniqueConstraint(fields=['data_source', 'external_id'], name='routes_data_source_external_id_key'),
            models.CheckConstraint(
                condition=Q(route_color__isnull=True) | Q(route_color__regex=r'^[0-9A-Fa-f]{6}$'),
                name='routes_route_color_check'
            ),
            models.CheckConstraint(
                condition=Q(route_text_color__isnull=True) | Q(route_text_color__regex=r'^[0-9A-Fa-f]{6}$'),
                name='routes_route_text_color_check'
            ),
        ]
        indexes = [
            models.Index(fields=['public_code'], name='routes_public_code_idx'),
        ]

    def __str__(self):
        return f"Route {self.public_code} - {self.short_name or self.long_name}"


class RoutePattern(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route = models.ForeignKey(Route, on_delete=models.RESTRICT, related_name='patterns')
    external_pattern_id = models.TextField(null=True, blank=True)
    direction_id = models.SmallIntegerField(null=True, blank=True)
    direction_name = models.TextField()
    headsign = models.TextField(null=True, blank=True)
    origin_stop = models.ForeignKey(Stop, on_delete=models.RESTRICT, null=True, blank=True, related_name='origin_patterns')
    destination_stop = models.ForeignKey(Stop, on_delete=models.RESTRICT, null=True, blank=True, related_name='destination_patterns')
    shape = GeographyLineStringField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'transit"."route_patterns'
        constraints = [
            models.UniqueConstraint(fields=['route', 'external_pattern_id'], name='route_patterns_route_external_pattern_key'),
            models.CheckConstraint(
                condition=Q(direction_id__isnull=True) | Q(direction_id__in=[0, 1]),
                name='route_patterns_direction_id_check'
            ),
        ]

    def __str__(self):
        return f"{self.route.public_code} ({self.direction_name})"


class RoutePatternStop(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route_pattern = models.ForeignKey(RoutePattern, on_delete=models.CASCADE, related_name='pattern_stops')
    stop = models.ForeignKey(Stop, on_delete=models.RESTRICT, related_name='pattern_stops')
    stop_sequence = models.IntegerField()
    distance_from_start_m = models.IntegerField(null=True, blank=True)
    pickup_type = models.SmallIntegerField(null=True, blank=True)
    drop_off_type = models.SmallIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'transit"."route_pattern_stops'
        ordering = ['stop_sequence']
        constraints = [
            models.UniqueConstraint(fields=['route_pattern', 'stop_sequence'], name='route_pattern_stops_seq_key'),
            models.CheckConstraint(
                condition=Q(stop_sequence__gt=0),
                name='route_pattern_stops_stop_sequence_check'
            ),
            models.CheckConstraint(
                condition=Q(distance_from_start_m__isnull=True) | Q(distance_from_start_m__gte=0),
                name='route_pattern_stops_distance_check'
            ),
            models.CheckConstraint(
                condition=Q(pickup_type__isnull=True) | Q(pickup_type__gte=0, pickup_type__lte=3),
                name='route_pattern_stops_pickup_type_check'
            ),
            models.CheckConstraint(
                condition=Q(drop_off_type__isnull=True) | Q(drop_off_type__gte=0, drop_off_type__lte=3),
                name='route_pattern_stops_drop_off_type_check'
            ),
        ]
        indexes = [
            models.Index(fields=['stop', 'route_pattern'], name='rps_stop_pattern_idx'),
        ]

    def __str__(self):
        return f"{self.route_pattern} Stop #{self.stop_sequence}: {self.stop.name}"


# ---------------------------------------------------------------------------
# Schedule Group
# ---------------------------------------------------------------------------

class ServiceCalendar(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    data_source = models.ForeignKey(DataSource, on_delete=models.RESTRICT, related_name='service_calendars')
    external_id = models.TextField()
    monday = models.BooleanField(default=False)
    tuesday = models.BooleanField(default=False)
    wednesday = models.BooleanField(default=False)
    thursday = models.BooleanField(default=False)
    friday = models.BooleanField(default=False)
    saturday = models.BooleanField(default=False)
    sunday = models.BooleanField(default=False)
    start_date = models.DateField()
    end_date = models.DateField()

    class Meta:
        db_table = 'transit"."service_calendars'
        constraints = [
            models.UniqueConstraint(fields=['data_source', 'external_id'], name='service_calendars_source_ext_key'),
            models.CheckConstraint(
                condition=Q(end_date__gte=F('start_date')),
                name='service_calendars_dates_check'
            ),
        ]

    def __str__(self):
        return f"Calendar {self.external_id} ({self.start_date} to {self.end_date})"


class ServiceCalendarException(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_calendar = models.ForeignKey(ServiceCalendar, on_delete=models.CASCADE, related_name='exceptions')
    service_date = models.DateField()
    exception_type = models.SmallIntegerField() # 1=added, 2=removed

    class Meta:
        db_table = 'transit"."service_calendar_exceptions'
        constraints = [
            models.UniqueConstraint(fields=['service_calendar', 'service_date'], name='cal_exceptions_cal_date_key'),
            models.CheckConstraint(
                condition=Q(exception_type__in=[1, 2]),
                name='service_calendar_exceptions_type_check'
            ),
        ]

    def __str__(self):
        return f"Exception for {self.service_calendar.external_id} on {self.service_date} (type {self.exception_type})"


class ScheduledTrip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route_pattern = models.ForeignKey(RoutePattern, on_delete=models.RESTRICT, related_name='scheduled_trips')
    service_calendar = models.ForeignKey(ServiceCalendar, on_delete=models.RESTRICT, related_name='scheduled_trips')
    external_id = models.TextField()
    headsign = models.TextField(null=True, blank=True)
    short_name = models.TextField(null=True, blank=True)
    block_id = models.TextField(null=True, blank=True)
    shape_id = models.TextField(null=True, blank=True)
    wheelchair_accessible = models.SmallIntegerField(null=True, blank=True)
    bikes_allowed = models.SmallIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'transit"."scheduled_trips'
        constraints = [
            models.UniqueConstraint(fields=['service_calendar', 'external_id'], name='scheduled_trips_cal_ext_key'),
            models.CheckConstraint(
                condition=Q(wheelchair_accessible__isnull=True) | Q(wheelchair_accessible__gte=0, wheelchair_accessible__lte=2),
                name='scheduled_trips_wheelchair_check'
            ),
            models.CheckConstraint(
                condition=Q(bikes_allowed__isnull=True) | Q(bikes_allowed__gte=0, bikes_allowed__lte=2),
                name='scheduled_trips_bikes_check'
            ),
        ]
        indexes = [
            models.Index(fields=['route_pattern', 'service_calendar'], name='sched_trips_pattern_cal_idx'),
        ]

    def __str__(self):
        return f"Trip {self.external_id} on {self.route_pattern}"


class ScheduledStopTime(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheduled_trip = models.ForeignKey(ScheduledTrip, on_delete=models.CASCADE, related_name='stop_times')
    stop = models.ForeignKey(Stop, on_delete=models.RESTRICT, related_name='scheduled_stop_times')
    stop_sequence = models.IntegerField()
    arrival_seconds = models.IntegerField(null=True, blank=True)
    departure_seconds = models.IntegerField(null=True, blank=True)
    pickup_type = models.SmallIntegerField(null=True, blank=True)
    drop_off_type = models.SmallIntegerField(null=True, blank=True)
    shape_distance_m = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    timepoint = models.BooleanField(default=True)

    class Meta:
        db_table = 'transit"."scheduled_stop_times'
        constraints = [
            models.UniqueConstraint(fields=['scheduled_trip', 'stop_sequence'], name='sched_stop_times_trip_seq_key'),
            models.CheckConstraint(
                condition=Q(stop_sequence__gt=0),
                name='scheduled_stop_times_seq_check'
            ),
            models.CheckConstraint(
                condition=Q(arrival_seconds__isnull=True) | Q(arrival_seconds__gte=0),
                name='scheduled_stop_times_arr_check'
            ),
            models.CheckConstraint(
                condition=Q(departure_seconds__isnull=True) | Q(departure_seconds__gte=0),
                name='scheduled_stop_times_dep_check'
            ),
            models.CheckConstraint(
                condition=Q(arrival_seconds__isnull=True) | Q(departure_seconds__isnull=True) | Q(departure_seconds__gte=F('arrival_seconds')),
                name='scheduled_stop_times_dep_arr_check'
            ),
            models.CheckConstraint(
                condition=Q(pickup_type__isnull=True) | Q(pickup_type__gte=0, pickup_type__lte=3),
                name='scheduled_stop_times_pickup_check'
            ),
            models.CheckConstraint(
                condition=Q(drop_off_type__isnull=True) | Q(drop_off_type__gte=0, drop_off_type__lte=3),
                name='scheduled_stop_times_drop_check'
            ),
            models.CheckConstraint(
                condition=Q(shape_distance_m__isnull=True) | Q(shape_distance_m__gte=0),
                name='scheduled_stop_times_dist_check'
            ),
        ]
        indexes = [
            models.Index(fields=['stop'], name='sched_stop_times_stop_idx'),
        ]

    def __str__(self):
        return f"{self.scheduled_trip.external_id} #{self.stop_sequence}: {self.stop.name}"


# ---------------------------------------------------------------------------
# Fleet and Live Operation Group
# ---------------------------------------------------------------------------

class VehicleType(models.Model):
    FUEL_TYPE_CHOICES = [
        ('diesel', 'Diesel'),
        ('cng', 'CNG'),
        ('electric', 'Electric'),
        ('hybrid', 'Hybrid'),
        ('other', 'Other'),
        ('unknown', 'Unknown'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.TextField()
    fuel_type = models.TextField(choices=FUEL_TYPE_CHOICES, null=True, blank=True)
    has_ac = models.BooleanField(default=False)
    seated_capacity = models.IntegerField(null=True, blank=True)
    standing_capacity = models.IntegerField(null=True, blank=True)
    accessibility_features = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'transit"."vehicle_types'
        constraints = [
            models.UniqueConstraint(fields=['name', 'fuel_type', 'has_ac'], name='vehicle_types_name_fuel_ac_key'),
            models.CheckConstraint(
                condition=Q(fuel_type__isnull=True) | Q(fuel_type__in=['diesel', 'cng', 'electric', 'hybrid', 'other', 'unknown']),
                name='vehicle_types_fuel_type_check'
            ),
            models.CheckConstraint(
                condition=Q(seated_capacity__isnull=True) | Q(seated_capacity__gte=0),
                name='vehicle_types_seated_capacity_check'
            ),
            models.CheckConstraint(
                condition=Q(standing_capacity__isnull=True) | Q(standing_capacity__gte=0),
                name='vehicle_types_standing_capacity_check'
            ),
        ]

    def __str__(self):
        ac_str = "AC" if self.has_ac else "Non-AC"
        return f"{self.name} ({self.fuel_type or 'unknown'}, {ac_str})"


class Vehicle(models.Model):
    OPERATIONAL_STATUS_CHOICES = [
        ('active', 'Active'),
        ('maintenance', 'Maintenance'),
        ('breakdown', 'Breakdown'),
        ('retired', 'Retired'),
        ('unknown', 'Unknown'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle_type = models.ForeignKey(VehicleType, on_delete=models.RESTRICT, null=True, blank=True, related_name='vehicles')
    assigned_depot = models.ForeignKey('Depot', on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicles')
    fleet_number = models.TextField(unique=True)
    registration_number = models.TextField(unique=True, null=True, blank=True)
    device_reference = models.TextField(unique=True, null=True, blank=True)
    operational_status = models.TextField(choices=OPERATIONAL_STATUS_CHOICES, default='unknown')
    in_service_from = models.DateField(null=True, blank=True)
    in_service_to = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'transit"."vehicles'
        constraints = [
            models.CheckConstraint(
                condition=Q(operational_status__in=['active', 'maintenance', 'breakdown', 'retired', 'unknown']),
                name='vehicles_operational_status_check'
            ),
            models.CheckConstraint(
                condition=Q(in_service_to__isnull=True) | Q(in_service_from__isnull=True) | Q(in_service_to__gte=F('in_service_from')),
                name='vehicles_service_dates_check'
            ),
        ]

    def __str__(self):
        return f"Fleet #{self.fleet_number} ({self.registration_number or 'Unregistered'})"


class OperatingTrip(models.Model):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('delayed', 'Delayed'),
        ('breakdown', 'Breakdown'),
        ('unknown', 'Unknown'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheduled_trip = models.ForeignKey(ScheduledTrip, on_delete=models.RESTRICT, null=True, blank=True, related_name='operating_trips')
    route_pattern = models.ForeignKey(RoutePattern, on_delete=models.RESTRICT, related_name='operating_trips')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.RESTRICT, null=True, blank=True, related_name='operating_trips')
    service_date = models.DateField()
    status = models.TextField(choices=STATUS_CHOICES, default='scheduled')
    actual_start_at = models.DateTimeField(null=True, blank=True)
    actual_end_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'transit"."operating_trips'
        constraints = [
            models.CheckConstraint(
                condition=Q(status__in=['scheduled', 'running', 'completed', 'cancelled', 'delayed', 'breakdown', 'unknown']),
                name='operating_trips_status_check'
            ),
            models.CheckConstraint(
                condition=Q(actual_end_at__isnull=True) | Q(actual_start_at__isnull=True) | Q(actual_end_at__gte=F('actual_start_at')),
                name='operating_trips_dates_check'
            ),
        ]
        indexes = [
            models.Index(fields=['service_date', 'status'], name='operating_trips_active_idx'),
        ]

    def __str__(self):
        return f"OperatingTrip {self.id} on {self.service_date} ({self.status})"


class VehiclePosition(models.Model):
    SOURCE_CHOICES = [
        ('authorized_gps', 'Authorized GPS'),
        ('licensed_api', 'Licensed API'),
        ('demo_simulator', 'Demo Simulator'),
        ('manual', 'Manual'),
    ]
    QUALITY_CHOICES = [
        ('valid', 'Valid'),
        ('suspect', 'Suspect'),
        ('rejected', 'Rejected'),
        ('unreviewed', 'Unreviewed'),
    ]

    id = models.BigAutoField(primary_key=True)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.RESTRICT, related_name='positions')
    operating_trip = models.ForeignKey(OperatingTrip, on_delete=models.SET_NULL, null=True, blank=True, related_name='positions')
    recorded_at = models.DateTimeField()
    received_at = models.DateTimeField(auto_now_add=True)
    location = GeographyPointField()
    speed_mps = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    heading_degrees = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    source = models.TextField(choices=SOURCE_CHOICES)
    quality_status = models.TextField(choices=QUALITY_CHOICES, default='unreviewed')

    class Meta:
        db_table = 'transit"."vehicle_positions'
        constraints = [
            models.CheckConstraint(
                condition=Q(speed_mps__isnull=True) | Q(speed_mps__gte=0),
                name='vehicle_positions_speed_check'
            ),
            models.CheckConstraint(
                condition=Q(heading_degrees__isnull=True) | Q(heading_degrees__gte=0, heading_degrees__lt=360),
                name='vehicle_positions_heading_check'
            ),
            models.CheckConstraint(
                condition=Q(source__in=['authorized_gps', 'licensed_api', 'demo_simulator', 'manual']),
                name='vehicle_positions_source_check'
            ),
            models.CheckConstraint(
                condition=Q(quality_status__in=['valid', 'suspect', 'rejected', 'unreviewed']),
                name='vehicle_positions_quality_check'
            ),
        ]
        indexes = [
            models.Index(fields=['vehicle', '-recorded_at'], name='vp_vehicle_recorded_idx'),
        ]

    def __str__(self):
        return f"Position {self.vehicle.fleet_number} at {self.recorded_at}"


class StopTimeEvent(models.Model):
    EVENT_TYPE_CHOICES = [
        ('arrival', 'Arrival'),
        ('departure', 'Departure'),
    ]
    SOURCE_CHOICES = [
        ('authorized_gps', 'Authorized GPS'),
        ('licensed_api', 'Licensed API'),
        ('staff', 'Staff'),
        ('demo_simulator', 'Demo Simulator'),
    ]

    id = models.BigAutoField(primary_key=True)
    operating_trip = models.ForeignKey(OperatingTrip, on_delete=models.RESTRICT, related_name='stop_time_events')
    stop = models.ForeignKey(Stop, on_delete=models.RESTRICT, related_name='stop_time_events')
    event_type = models.TextField(choices=EVENT_TYPE_CHOICES)
    observed_at = models.DateTimeField()
    source = models.TextField(choices=SOURCE_CHOICES)
    confidence = models.DecimalField(max_digits=4, decimal_places=3, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'transit"."stop_time_events'
        constraints = [
            models.CheckConstraint(
                condition=Q(event_type__in=['arrival', 'departure']),
                name='stop_time_events_type_check'
            ),
            models.CheckConstraint(
                condition=Q(source__in=['authorized_gps', 'licensed_api', 'staff', 'demo_simulator']),
                name='stop_time_events_source_check'
            ),
            models.CheckConstraint(
                condition=Q(confidence__isnull=True) | Q(confidence__gte=0, confidence__lte=1),
                name='stop_time_events_confidence_check'
            ),
        ]
        indexes = [
            models.Index(fields=['operating_trip', 'observed_at'], name='ste_trip_time_idx'),
        ]

    def __str__(self):
        return f"{self.event_type} at {self.stop.name} ({self.observed_at})"


# ---------------------------------------------------------------------------
# Passenger Information and Fare Group
# ---------------------------------------------------------------------------

class FareProduct(models.Model):
    PRODUCT_TYPE_CHOICES = [
        ('single_journey', 'Single Journey'),
        ('day_pass', 'Day Pass'),
        ('concession', 'Concession'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    data_source = models.ForeignKey(DataSource, on_delete=models.RESTRICT, null=True, blank=True, related_name='fare_products')
    external_id = models.TextField(null=True, blank=True)
    product_code = models.TextField(unique=True)
    name = models.TextField()
    product_type = models.TextField(choices=PRODUCT_TYPE_CHOICES)
    currency = models.CharField(max_length=3, default='INR')
    price_minor_units = models.IntegerField(null=True, blank=True)
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    eligibility_policy = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'transit"."fare_products'
        constraints = [
            models.CheckConstraint(
                condition=Q(product_type__in=['single_journey', 'day_pass', 'concession', 'other']),
                name='fare_products_type_check'
            ),
            models.CheckConstraint(
                condition=Q(price_minor_units__isnull=True) | Q(price_minor_units__gte=0),
                name='fare_products_price_check'
            ),
            models.CheckConstraint(
                condition=Q(valid_to__isnull=True) | Q(valid_from__isnull=True) | Q(valid_to__gte=F('valid_from')),
                name='fare_products_dates_check'
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.product_code})"


class FareRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fare_product = models.ForeignKey(FareProduct, on_delete=models.RESTRICT, related_name='rules')
    origin_stop = models.ForeignKey(Stop, on_delete=models.RESTRICT, null=True, blank=True, related_name='fare_rules_origin')
    destination_stop = models.ForeignKey(Stop, on_delete=models.RESTRICT, null=True, blank=True, related_name='fare_rules_destination')
    origin_zone = models.TextField(null=True, blank=True)
    destination_zone = models.TextField(null=True, blank=True)
    amount_minor_units = models.IntegerField()
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    priority = models.IntegerField(default=0)

    class Meta:
        db_table = 'transit"."fare_rules'
        constraints = [
            models.CheckConstraint(
                condition=Q(amount_minor_units__gte=0),
                name='fare_rules_amount_check'
            ),
            models.CheckConstraint(
                condition=Q(valid_to__isnull=True) | Q(valid_from__isnull=True) | Q(valid_to__gte=F('valid_from')),
                name='fare_rules_dates_check'
            ),
        ]

    def __str__(self):
        return f"Rule {self.id} for {self.fare_product.name}: {self.amount_minor_units}"


class ServiceAlert(models.Model):
    SEVERITY_CHOICES = [
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('severe', 'Severe'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('resolved', 'Resolved'),
        ('expired', 'Expired'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    data_source = models.ForeignKey(DataSource, on_delete=models.RESTRICT, null=True, blank=True, related_name='service_alerts')
    title = models.TextField()
    description = models.TextField()
    severity = models.TextField(choices=SEVERITY_CHOICES)
    status = models.TextField(choices=STATUS_CHOICES, default='active')
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'transit"."service_alerts'
        constraints = [
            models.CheckConstraint(
                condition=Q(severity__in=['info', 'warning', 'severe']),
                name='service_alerts_severity_check'
            ),
            models.CheckConstraint(
                condition=Q(status__in=['active', 'resolved', 'expired']),
                name='service_alerts_status_check'
            ),
            models.CheckConstraint(
                condition=Q(ends_at__isnull=True) | Q(ends_at__gte=F('starts_at')),
                name='service_alerts_dates_check'
            ),
        ]

    def __str__(self):
        return f"Alert: {self.title} ({self.severity})"


class ServiceAlertRoute(models.Model):
    service_alert = models.ForeignKey(ServiceAlert, on_delete=models.CASCADE, related_name='affected_routes')
    route = models.ForeignKey(Route, on_delete=models.RESTRICT, related_name='alerts')

    class Meta:
        db_table = 'transit"."service_alert_routes'
        constraints = [
            models.UniqueConstraint(fields=['service_alert', 'route'], name='service_alert_routes_uniq')
        ]

    def __str__(self):
        return f"Alert {self.service_alert_id} affects Route {self.route.public_code}"


class ServiceAlertStop(models.Model):
    service_alert = models.ForeignKey(ServiceAlert, on_delete=models.CASCADE, related_name='affected_stops')
    stop = models.ForeignKey(Stop, on_delete=models.RESTRICT, related_name='alerts')

    class Meta:
        db_table = 'transit"."service_alert_stops'
        constraints = [
            models.UniqueConstraint(fields=['service_alert', 'stop'], name='service_alert_stops_uniq')
        ]

    def __str__(self):
        return f"Alert {self.service_alert_id} affects Stop {self.stop.name}"


class CrowdingReport(models.Model):
    CROWDING_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('unknown', 'Unknown'),
    ]
    SOURCE_CHOICES = [
        ('staff', 'Staff'),
        ('passenger', 'Passenger'),
        ('sensor', 'Sensor'),
        ('demo', 'Demo'),
    ]
    MODERATION_CHOICES = [
        ('unreviewed', 'Unreviewed'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    operating_trip = models.ForeignKey(OperatingTrip, on_delete=models.SET_NULL, null=True, blank=True, related_name='crowding_reports')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True, related_name='crowding_reports')
    crowding_level = models.TextField(choices=CROWDING_CHOICES)
    source = models.TextField(choices=SOURCE_CHOICES)
    reported_at = models.DateTimeField()
    confidence = models.DecimalField(max_digits=4, decimal_places=3, null=True, blank=True)
    moderation_status = models.TextField(choices=MODERATION_CHOICES, default='unreviewed')

    class Meta:
        db_table = 'transit"."crowding_reports'
        constraints = [
            models.CheckConstraint(
                condition=Q(crowding_level__in=['low', 'medium', 'high', 'unknown']),
                name='crowding_reports_level_check'
            ),
            models.CheckConstraint(
                condition=Q(source__in=['staff', 'passenger', 'sensor', 'demo']),
                name='crowding_reports_source_check'
            ),
            models.CheckConstraint(
                condition=Q(confidence__isnull=True) | Q(confidence__gte=0, confidence__lte=1),
                name='crowding_reports_confidence_check'
            ),
            models.CheckConstraint(
                condition=Q(moderation_status__in=['unreviewed', 'approved', 'rejected']),
                name='crowding_reports_moderation_check'
            ),
        ]

    def __str__(self):
        return f"Crowding {self.crowding_level} ({self.source}) at {self.reported_at}"


# ---------------------------------------------------------------------------
# Fare & Ticket Bookings Group (PostgreSQL Live Storage)
# ---------------------------------------------------------------------------

class BookedTicket(models.Model):
    TICKET_TYPE_CHOICES = [
        ('local', 'Local Single Journey'),
        ('golden_pass', 'Golden Pass (All-Day)'),
        ('connected', 'Connected Journey'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_number = models.CharField(max_length=64, unique=True, db_index=True)
    ticket_hash = models.CharField(max_length=64)
    ticket_type = models.CharField(max_length=32, choices=TICKET_TYPE_CHOICES, default='local')
    product_name = models.CharField(max_length=128)

    route = models.ForeignKey(Route, on_delete=models.SET_NULL, null=True, blank=True, related_name='booked_tickets')
    route_code = models.CharField(max_length=32, db_index=True)
    direction_id = models.IntegerField(default=0)
    fleet_number = models.CharField(max_length=32, blank=True, default='')

    boarding_stop = models.ForeignKey(Stop, on_delete=models.SET_NULL, null=True, blank=True, related_name='boarding_tickets')
    boarding_stop_name = models.CharField(max_length=255, blank=True, default='')
    exit_stop = models.ForeignKey(Stop, on_delete=models.SET_NULL, null=True, blank=True, related_name='exit_tickets')
    exit_stop_name = models.CharField(max_length=255, blank=True, default='')
    stops_count = models.IntegerField(default=1)

    passenger_name = models.CharField(max_length=128)
    username = models.CharField(max_length=150, blank=True, default='', db_index=True)
    age = models.IntegerField(default=25)
    gender = models.CharField(max_length=16, default='male')
    concession_type = models.CharField(max_length=64, default='Standard Fare')
    is_copassenger = models.BooleanField(default=False)

    fare_amount_inr = models.DecimalField(max_digits=10, decimal_places=2, default=10.00)
    subsidy_amount_inr = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    payment_method = models.CharField(max_length=64, default='UPI / Dynamic QR Code (GPay/PhonePe)')
    payment_status = models.CharField(max_length=32, default='PAID_ONLINE')
    transaction_id = models.CharField(max_length=64, blank=True, default='')

    valid_until = models.DateTimeField(null=True, blank=True)
    is_expired = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'transit"."booked_tickets'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.ticket_number} - {self.passenger_name} (₹{self.fare_amount_inr})"


# ---------------------------------------------------------------------------
# Depot & Facilities Group (PostgreSQL Live Storage)
# ---------------------------------------------------------------------------

class Depot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=128, unique=True)
    code = models.CharField(max_length=32, unique=True)
    zone = models.CharField(max_length=64)
    manager_name = models.CharField(max_length=128)
    contact_phone = models.CharField(max_length=32)
    ev_charging_bays = models.IntegerField(default=2)
    maintenance_bays = models.IntegerField(default=2)
    total_parking_capacity = models.IntegerField(default=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'transit"."depots'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


