-- AMTS passenger information portal: PostgreSQL + PostGIS starter schema
-- This creates schema only. It intentionally does not invent AMTS route or GPS rows.
-- Django models and migrations should become the application's long-term schema source.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS transit;
SET search_path TO transit, public;

CREATE TABLE IF NOT EXISTS data_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    source_type text NOT NULL CHECK (source_type IN ('official', 'licensed', 'community', 'manual', 'demo')),
    source_url text,
    license_or_permission text,
    agency_scope text,
    is_authorized_for_production boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
    source_file_name text,
    source_sha256 text,
    source_retrieved_at timestamptz,
    service_start_date date,
    service_end_date date,
    importer_version text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'imported', 'rejected')),
    validation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    imported_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (service_end_date IS NULL OR service_start_date IS NULL OR service_end_date >= service_start_date)
);

CREATE TABLE IF NOT EXISTS agencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
    external_id text NOT NULL,
    name text NOT NULL,
    url text,
    phone text,
    timezone text NOT NULL DEFAULT 'Asia/Kolkata',
    language_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (data_source_id, external_id)
);

CREATE TABLE IF NOT EXISTS stops (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
    external_id text NOT NULL,
    stop_code text,
    name text NOT NULL,
    name_gu text,
    description text,
    location geography(Point, 4326),
    parent_stop_id uuid REFERENCES stops(id) ON DELETE RESTRICT,
    wheelchair_boarding smallint CHECK (wheelchair_boarding BETWEEN 0 AND 2),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (data_source_id, external_id)
);
CREATE INDEX IF NOT EXISTS stops_location_gix ON stops USING gist (location);
CREATE INDEX IF NOT EXISTS stops_name_lower_idx ON stops (lower(name));

CREATE TABLE IF NOT EXISTS routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
    agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE RESTRICT,
    external_id text NOT NULL,
    public_code text NOT NULL,
    short_name text,
    long_name text,
    description text,
    route_type integer,
    route_color char(6),
    route_text_color char(6),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (data_source_id, external_id),
    CHECK (route_color IS NULL OR route_color ~ '^[0-9A-Fa-f]{6}$'),
    CHECK (route_text_color IS NULL OR route_text_color ~ '^[0-9A-Fa-f]{6}$')
);
CREATE INDEX IF NOT EXISTS routes_public_code_idx ON routes (public_code);

CREATE TABLE IF NOT EXISTS route_patterns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id uuid NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
    external_pattern_id text,
    direction_id smallint CHECK (direction_id IN (0, 1)),
    direction_name text NOT NULL,
    headsign text,
    origin_stop_id uuid REFERENCES stops(id) ON DELETE RESTRICT,
    destination_stop_id uuid REFERENCES stops(id) ON DELETE RESTRICT,
    shape geography(LineString, 4326),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (route_id, external_pattern_id)
);
CREATE INDEX IF NOT EXISTS route_patterns_shape_gix ON route_patterns USING gist (shape);

CREATE TABLE IF NOT EXISTS route_pattern_stops (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_pattern_id uuid NOT NULL REFERENCES route_patterns(id) ON DELETE CASCADE,
    stop_id uuid NOT NULL REFERENCES stops(id) ON DELETE RESTRICT,
    stop_sequence integer NOT NULL CHECK (stop_sequence > 0),
    distance_from_start_m integer CHECK (distance_from_start_m IS NULL OR distance_from_start_m >= 0),
    pickup_type smallint CHECK (pickup_type BETWEEN 0 AND 3),
    drop_off_type smallint CHECK (drop_off_type BETWEEN 0 AND 3),
    UNIQUE (route_pattern_id, stop_sequence)
);
CREATE INDEX IF NOT EXISTS route_pattern_stops_stop_idx ON route_pattern_stops (stop_id, route_pattern_id);

CREATE TABLE IF NOT EXISTS service_calendars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
    external_id text NOT NULL,
    monday boolean NOT NULL DEFAULT false,
    tuesday boolean NOT NULL DEFAULT false,
    wednesday boolean NOT NULL DEFAULT false,
    thursday boolean NOT NULL DEFAULT false,
    friday boolean NOT NULL DEFAULT false,
    saturday boolean NOT NULL DEFAULT false,
    sunday boolean NOT NULL DEFAULT false,
    start_date date NOT NULL,
    end_date date NOT NULL,
    UNIQUE (data_source_id, external_id),
    CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS service_calendar_exceptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_calendar_id uuid NOT NULL REFERENCES service_calendars(id) ON DELETE CASCADE,
    service_date date NOT NULL,
    exception_type smallint NOT NULL CHECK (exception_type IN (1, 2)), -- 1=added, 2=removed
    UNIQUE (service_calendar_id, service_date)
);

CREATE TABLE IF NOT EXISTS scheduled_trips (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_pattern_id uuid NOT NULL REFERENCES route_patterns(id) ON DELETE RESTRICT,
    service_calendar_id uuid NOT NULL REFERENCES service_calendars(id) ON DELETE RESTRICT,
    external_id text NOT NULL,
    headsign text,
    short_name text,
    block_id text,
    shape_id text,
    wheelchair_accessible smallint CHECK (wheelchair_accessible BETWEEN 0 AND 2),
    bikes_allowed smallint CHECK (bikes_allowed BETWEEN 0 AND 2),
    is_active boolean NOT NULL DEFAULT true,
    UNIQUE (service_calendar_id, external_id)
);
CREATE INDEX IF NOT EXISTS scheduled_trips_pattern_idx ON scheduled_trips (route_pattern_id, service_calendar_id);

CREATE TABLE IF NOT EXISTS scheduled_stop_times (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_trip_id uuid NOT NULL REFERENCES scheduled_trips(id) ON DELETE CASCADE,
    stop_id uuid NOT NULL REFERENCES stops(id) ON DELETE RESTRICT,
    stop_sequence integer NOT NULL CHECK (stop_sequence > 0),
    arrival_seconds integer CHECK (arrival_seconds IS NULL OR arrival_seconds >= 0),
    departure_seconds integer CHECK (departure_seconds IS NULL OR departure_seconds >= 0),
    pickup_type smallint CHECK (pickup_type BETWEEN 0 AND 3),
    drop_off_type smallint CHECK (drop_off_type BETWEEN 0 AND 3),
    shape_distance_m numeric(10,2) CHECK (shape_distance_m IS NULL OR shape_distance_m >= 0),
    timepoint boolean NOT NULL DEFAULT true,
    UNIQUE (scheduled_trip_id, stop_sequence),
    CHECK (arrival_seconds IS NULL OR departure_seconds IS NULL OR departure_seconds >= arrival_seconds)
);
CREATE INDEX IF NOT EXISTS scheduled_stop_times_stop_idx ON scheduled_stop_times (stop_id);

CREATE TABLE IF NOT EXISTS vehicle_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    fuel_type text CHECK (fuel_type IN ('diesel', 'cng', 'electric', 'hybrid', 'other', 'unknown')),
    has_ac boolean NOT NULL DEFAULT false,
    seated_capacity integer CHECK (seated_capacity IS NULL OR seated_capacity >= 0),
    standing_capacity integer CHECK (standing_capacity IS NULL OR standing_capacity >= 0),
    accessibility_features jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (name, fuel_type, has_ac)
);

CREATE TABLE IF NOT EXISTS vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_type_id uuid REFERENCES vehicle_types(id) ON DELETE RESTRICT,
    fleet_number text NOT NULL UNIQUE,
    registration_number text UNIQUE,
    device_reference text UNIQUE,
    operational_status text NOT NULL DEFAULT 'unknown'
        CHECK (operational_status IN ('active', 'maintenance', 'breakdown', 'retired', 'unknown')),
    in_service_from date,
    in_service_to date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (in_service_to IS NULL OR in_service_from IS NULL OR in_service_to >= in_service_from)
);

CREATE TABLE IF NOT EXISTS operating_trips (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_trip_id uuid REFERENCES scheduled_trips(id) ON DELETE RESTRICT,
    route_pattern_id uuid NOT NULL REFERENCES route_patterns(id) ON DELETE RESTRICT,
    vehicle_id uuid REFERENCES vehicles(id) ON DELETE RESTRICT,
    service_date date NOT NULL,
    status text NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'running', 'completed', 'cancelled', 'delayed', 'breakdown', 'unknown')),
    actual_start_at timestamptz,
    actual_end_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (actual_end_at IS NULL OR actual_start_at IS NULL OR actual_end_at >= actual_start_at)
);
CREATE INDEX IF NOT EXISTS operating_trips_active_idx ON operating_trips (service_date, status);

CREATE TABLE IF NOT EXISTS vehicle_positions (
    id bigserial PRIMARY KEY,
    vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    operating_trip_id uuid REFERENCES operating_trips(id) ON DELETE SET NULL,
    recorded_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    location geography(Point, 4326) NOT NULL,
    speed_mps numeric(7,2) CHECK (speed_mps IS NULL OR speed_mps >= 0),
    heading_degrees numeric(6,2) CHECK (heading_degrees IS NULL OR (heading_degrees >= 0 AND heading_degrees < 360)),
    source text NOT NULL CHECK (source IN ('authorized_gps', 'licensed_api', 'demo_simulator', 'manual')),
    quality_status text NOT NULL DEFAULT 'unreviewed'
        CHECK (quality_status IN ('valid', 'suspect', 'rejected', 'unreviewed'))
);
CREATE INDEX IF NOT EXISTS vehicle_positions_vehicle_time_idx ON vehicle_positions (vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS vehicle_positions_location_gix ON vehicle_positions USING gist (location);

CREATE TABLE IF NOT EXISTS stop_time_events (
    id bigserial PRIMARY KEY,
    operating_trip_id uuid NOT NULL REFERENCES operating_trips(id) ON DELETE RESTRICT,
    stop_id uuid NOT NULL REFERENCES stops(id) ON DELETE RESTRICT,
    event_type text NOT NULL CHECK (event_type IN ('arrival', 'departure')),
    observed_at timestamptz NOT NULL,
    source text NOT NULL CHECK (source IN ('authorized_gps', 'licensed_api', 'staff', 'demo_simulator')),
    confidence numeric(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stop_time_events_trip_time_idx ON stop_time_events (operating_trip_id, observed_at);

CREATE TABLE IF NOT EXISTS fare_products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id uuid REFERENCES data_sources(id) ON DELETE RESTRICT,
    external_id text,
    product_code text NOT NULL UNIQUE,
    name text NOT NULL,
    product_type text NOT NULL CHECK (product_type IN ('single_journey', 'day_pass', 'concession', 'other')),
    currency char(3) NOT NULL DEFAULT 'INR',
    price_minor_units integer CHECK (price_minor_units IS NULL OR price_minor_units >= 0),
    valid_from date,
    valid_to date,
    eligibility_policy text,
    is_active boolean NOT NULL DEFAULT true,
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS fare_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fare_product_id uuid NOT NULL REFERENCES fare_products(id) ON DELETE RESTRICT,
    origin_stop_id uuid REFERENCES stops(id) ON DELETE RESTRICT,
    destination_stop_id uuid REFERENCES stops(id) ON DELETE RESTRICT,
    origin_zone text,
    destination_zone text,
    amount_minor_units integer NOT NULL CHECK (amount_minor_units >= 0),
    valid_from date,
    valid_to date,
    priority integer NOT NULL DEFAULT 0,
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS service_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id uuid REFERENCES data_sources(id) ON DELETE RESTRICT,
    title text NOT NULL,
    description text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('info', 'warning', 'severe')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'expired')),
    starts_at timestamptz NOT NULL,
    ends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS service_alert_routes (
    service_alert_id uuid NOT NULL REFERENCES service_alerts(id) ON DELETE CASCADE,
    route_id uuid NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
    PRIMARY KEY (service_alert_id, route_id)
);
CREATE TABLE IF NOT EXISTS service_alert_stops (
    service_alert_id uuid NOT NULL REFERENCES service_alerts(id) ON DELETE CASCADE,
    stop_id uuid NOT NULL REFERENCES stops(id) ON DELETE RESTRICT,
    PRIMARY KEY (service_alert_id, stop_id)
);

CREATE TABLE IF NOT EXISTS crowding_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operating_trip_id uuid REFERENCES operating_trips(id) ON DELETE SET NULL,
    vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
    crowding_level text NOT NULL CHECK (crowding_level IN ('low', 'medium', 'high', 'unknown')),
    source text NOT NULL CHECK (source IN ('staff', 'passenger', 'sensor', 'demo')),
    reported_at timestamptz NOT NULL,
    confidence numeric(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    moderation_status text NOT NULL DEFAULT 'unreviewed'
        CHECK (moderation_status IN ('unreviewed', 'approved', 'rejected'))
);

-- Minimal schema sanity checks after applying:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'transit' ORDER BY table_name;
-- SELECT PostGIS_Full_Version();
