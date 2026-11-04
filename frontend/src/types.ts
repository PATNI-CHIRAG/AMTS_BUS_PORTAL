export interface Stop {
  id?: string;
  stop_id?: string;
  stop_sequence?: number;
  distance_from_start_m?: number;
  name: string;
  name_gu?: string;
  stop_code?: string;
  latitude: number;
  longitude: number;
}

export type BusLifecycleStatus = 'MOVING' | 'STOPPED_AT_TERMINAL' | 'READY_TO_DEPART' | 'STOPPED_AT_ORIGIN';

export interface ActiveBus {
  trip_id: string;
  fleet_number: string;
  registration_number: string;
  bus_model: string;
  has_ac: boolean;
  fuel_type: string;
  seated_capacity: number;
  status: string; // from API (e.g. 'RUNNING', 'DELAYED')
  lifecycle_status: BusLifecycleStatus; // 'MOVING' | 'STOPPED_AT_TERMINAL' | 'READY_TO_DEPART'
  latitude: number;
  longitude: number;
  speed_kmh: number;
  heading_degrees: number;
  rounds_completed_today: number;
  battery_or_fuel: string;
  current_stop_index: number;
  progress_ratio: number; // 0.0 to 1.0 between current and next stop
  next_stop_name?: string;
  eta_next_stop_secs?: number;
  dwell_countdown_secs?: number;
  assigned_direction_id: number;
  assigned_pattern_id: string;
}

export interface RoutePatternSummary {
  id: string;
  direction_id: number;
  direction_name: string;
  headsign: string;
  origin_name: string;
  destination_name: string;
  total_stops: number;
  active_buses_count: number;
  is_active: boolean;
}

export interface RouteItem {
  id: string;
  public_code: string;
  short_name?: string;
  long_name: string;
  description?: string;
  route_type?: number;
  route_color: string;
  route_text_color?: string;
  is_active: boolean;
  patterns: RoutePatternSummary[];
}

export interface RoutePatternDetail {
  id: string;
  route_code: string;
  route_name: string;
  direction_id: number;
  direction_name: string;
  headsign: string;
  shape_coordinates: [number, number][]; // [lat, lon][]
  stops: Stop[];
  active_buses: ActiveBus[];
}

export interface TurnaroundEvent {
  id: string;
  timestamp: string;
  fleet_number: string;
  bus_model: string;
  terminal_stop_name: string;
  from_direction: string;
  to_direction: string;
  to_pattern_id: string;
}

export interface TicketStopInfo {
  id: string;
  name: string;
  name_gu?: string;
  sequence: number;
  latitude: number;
  longitude: number;
}

export interface TicketPassenger {
  name: string;
  age: number;
  gender: string;
  concession: string;
  is_copassenger?: boolean;
}

export interface TicketTrip {
  route_code: string;
  route_name: string;
  direction_name: string;
  direction_id: number;
  fleet_number: string;
  boarding_stop: TicketStopInfo;
  exit_stop: TicketStopInfo;
  stops_count: number;
  estimated_journey_minutes: number;
  connected_legs?: {
    leg_number: number;
    route_code: string;
    route_name: string;
    direction_name?: string;
    from_stop: string;
    to_stop: string;
    stops_count: number;
    fare_rupees: number;
    fleet_number?: string;
  }[];
  transfer_hubs?: {
    name: string;
    name_gu?: string;
  }[];
}

export interface TicketFare {
  amount_rupees: number;
  currency: string;
  payment_status: string;
  payment_method?: string;
  transaction_id?: string;
}

export interface TicketValidity {
  valid_date: string;
  valid_until: string;
  validity_description: string;
  is_all_bus_pass: boolean;
}

export interface BookedTicket {
  ticket_number: string;
  ticket_hash: string;
  ticket_type: 'local' | 'golden_pass' | 'connected';
  product_name: string;
  username?: string;
  passenger: TicketPassenger;
  trip: TicketTrip;
  fare: TicketFare;
  validity: TicketValidity;
  issued_at: string;
  status?: 'ACTIVE' | 'EXPIRED';
  is_expired?: boolean;
  connected_legs?: {
    leg_number: number;
    route_code: string;
    route_name?: string;
    direction_name?: string;
    from_stop: string;
    to_stop: string;
    stops_count: number;
    fare_rupees: number;
    fleet_number?: string;
  }[];
  transfer_hubs?: {
    name: string;
    name_gu?: string;
  }[];
}

export interface PassengerJourneyState {
  ticket: BookedTicket;
  boardingStopId: string;
  boardingStopSequence: number;
  boardingStopName: string;
  exitStopId: string;
  exitStopSequence: number;
  exitStopName: string;
  fleetNumber: string;
  pathCoordinates: [number, number][];
}

export interface ConnectingLeg {
  leg_number: number;
  route_code: string;
  route_name: string;
  route_color?: string;
  route_text_color?: string;
  direction_id: number;
  direction_name: string;
  pattern_id: string;
  origin: {
    id: string;
    stop_id?: string;
    name: string;
    name_gu?: string;
    stop_sequence: number;
    latitude: number;
    longitude: number;
  };
  destination: {
    id: string;
    stop_id?: string;
    name: string;
    name_gu?: string;
    stop_sequence: number;
    latitude: number;
    longitude: number;
  };
  stops_count: number;
  estimated_travel_minutes: number;
  fare_rupees: number;
  shape_coordinates?: [number, number][];
  all_stops?: {
    stop_id: string;
    sequence: number;
    name: string;
    name_gu?: string;
    latitude: number;
    longitude: number;
  }[];
  stops_between?: {
    stop_id: string;
    sequence: number;
    name: string;
    name_gu?: string;
    latitude: number;
    longitude: number;
  }[];
  approaching_buses?: {
    fleet_number: string;
    registration_number: string;
    bus_model: string;
    has_ac: boolean;
    fuel_type: string;
    seating_capacity: number;
    status: string;
    delay_minutes?: number;
    crowding?: string;
    assigned_direction_id?: number;
    assigned_pattern_id?: string;
    latitude: number | null;
    longitude: number | null;
    eta_minutes: number;
  }[];
  schedule_config?: DirectJourneyOption['schedule_config'];
}

export interface ConnectingJourneyOption {
  type: 'ONE_TRANSFER' | 'TWO_TRANSFER';
  transfer_count: number;
  legs_count: number;
  transfer_hubs: {
    id: string;
    name: string;
    name_gu?: string;
    latitude: number;
    longitude: number;
    wait_minutes?: number;
  }[];
  legs: ConnectingLeg[];
  total_stops: number;
  total_travel_minutes: number;
  total_fare_rupees: number;
  all_day_pass_recommendation?: {
    female_rupees: number;
    male_rupees: number;
    is_cheaper_or_equal: boolean;
    savings_tip: string;
  };
}

export interface HighlightedJourneySegment {
  fromStop: Stop;
  toStop: Stop;
  coords?: [number, number][];
  isConnecting?: boolean;
  legs?: {
    legNumber: number;
    routeCode: string;
    color: string;
    fromStop: { name: string; latitude: number; longitude: number };
    toStop: { name: string; latitude: number; longitude: number };
    coords: [number, number][];
  }[];
  transferHubs?: {
    name: string;
    name_gu?: string;
    latitude: number;
    longitude: number;
    routeToSwitch?: string;
  }[];
}

export interface DirectJourneyOption {
  type: 'DIRECT';
  route_code: string;
  route_name: string;
  route_color?: string;
  route_text_color?: string;
  direction_id: number;
  direction_name: string;
  pattern_id: string;
  origin: {
    id: string;
    name: string;
    name_gu?: string;
    stop_sequence: number;
    latitude: number;
    longitude: number;
  };
  destination: {
    id: string;
    name: string;
    name_gu?: string;
    stop_sequence: number;
    latitude: number;
    longitude: number;
  };
  stops_count: number;
  estimated_travel_minutes: number;
  fare_rupees: number;
  all_day_pass_options: {
    male_rupees: number;
    female_rupees: number;
    note: string;
  };
  shape_coordinates?: [number, number][];
  all_stops?: {
    stop_id: string;
    sequence: number;
    name: string;
    name_gu?: string;
    latitude: number;
    longitude: number;
  }[];
  stops_between?: {
    stop_id: string;
    sequence: number;
    name: string;
    name_gu?: string;
    latitude: number;
    longitude: number;
  }[];
  approaching_buses: {
    fleet_number: string;
    registration_number: string;
    bus_model: string;
    has_ac: boolean;
    fuel_type: string;
    seating_capacity: number;
    status: string;
    delay_minutes?: number;
    crowding?: string;
    assigned_direction_id?: number;
    assigned_pattern_id?: string;
    latitude: number | null;
    longitude: number | null;
    eta_minutes: number;
  }[];
  schedule_config?: {
    route_code: string;
    up_pattern_id: string;
    down_pattern_id: string;
    up_direction_name: string;
    down_direction_name: string;
    up_stops: Stop[];
    down_stops: Stop[];
    fleet: {
      fleet_number: string;
      registration_number?: string;
      bus_model: string;
      has_ac: boolean;
      fuel_type: string;
      seated_capacity: number;
      status: string;
    }[];
  };
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'passenger';
}

