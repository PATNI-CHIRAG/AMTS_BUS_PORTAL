export interface AdminKPIs {
  total_bookings: number;
  total_fare_revenue_inr: number;
  total_subsidies_inr: number;
  total_gross_income_inr: number;
  active_fleet_on_road: number;
  total_fleet_size: number;
  system_punctuality_pct: number;
  average_fare_inr: number;
  fleet_utilization_pct: number;
  clean_ev_ratio_pct: number;
}

export interface CorridorPerformance {
  route_id: string;
  route_code: string;
  route_name: string;
  route_color: string;
  bookings_count: number;
  gross_revenue_inr: number;
  occupancy_rate_pct: number;
  on_time_performance_pct: number;
  depot_assigned: string;
  fuel_type: string;
  total_stops: number;
  assigned_fleet_count: number;
}

export interface HourlyRidershipPoint {
  hour: string;
  passengers: number;
  revenue_inr: number;
  is_peak: boolean;
  period_label: string;
}

export interface ProductBreakdownItem {
  category: string;
  label: string;
  count: number;
  revenue_inr: number;
  color: string;
  percentage: number;
}

export interface PaymentChannelItem {
  method: string;
  percentage: number;
  count: number;
  amount_inr: number;
  color: string;
}

export interface DepotItem {
  depot_name: string;
  depot_code: string;
  zone: string;
  allocated_fleet: number;
  active_on_road: number;
  in_maintenance: number;
  ev_charging_bays: number;
  punctuality_pct: number;
  daily_trips_scheduled: number;
  depot_manager: string;
  contact: string;
}

export interface EVSustainabilityMetrics {
  total_ev_buses: number;
  total_cng_buses: number;
  ev_fleet_ratio_pct: number;
  clean_ev_kms_today: number;
  co2_saved_kg: number;
  fuel_saved_kg: number;
  average_battery_soc_pct: number;
  average_ev_range_km: number;
  active_charging_sessions: number;
  green_tree_equivalent: number;
}

export interface SubsidyAuditLog {
  reporting_period: string;
  government_agency: string;
  state_scheme: string;
  female_concession_claims: number;
  female_subsidy_rate_inr: number;
  female_subsidy_total_inr: number;
  special_concession_claims: number;
  special_subsidy_total_inr: number;
  net_subsidy_claim_inr: number;
  audit_hash: string;
  status: string;
}

export interface AdminAnalyticsData {
  success: boolean;
  timestamp: string;
  time_range: string;
  filters: {
    route: string;
    depot: string;
  };
  kpis: AdminKPIs;
  top_corridors: CorridorPerformance[];
  hourly_ridership: HourlyRidershipPoint[];
  product_breakdown: ProductBreakdownItem[];
  payment_channels: PaymentChannelItem[];
  depots: DepotItem[];
  ev_sustainability: EVSustainabilityMetrics;
  subsidy_audit: SubsidyAuditLog;
}

export interface FleetVehicleTelemetry {
  fleet_number: string;
  registration_number: string;
  bus_model: string;
  fuel_type: string;
  has_ac: boolean;
  seated_capacity: number;
  assigned_route: string;
  route_code?: string;
  direction_id?: number;
  depot_name?: string;
  depot_code?: string;
  status: 'RUNNING' | 'DELAYED' | 'IN_DEPOT' | 'TURNAROUND';
  movement_status?: 'MOVING' | 'STOPPED' | 'TERMINAL' | 'DELAYED' | 'IN_DEPOT' | string;
  live_location_label?: string;
  current_stand_name?: string;
  next_stand_name?: string;
  delay_minutes: number;
  scheduled_arrival?: string;
  expected_arrival?: string;
  delay_reason?: string;
  rounds_completed_today: number;
  battery_or_fuel: string;
  current_latitude: number | null;
  current_longitude: number | null;
  speed_kmh: number;
  crowding: string;
}

export interface ServiceAlertItem {
  id: string;
  title?: string;
  header_text?: string;
  description?: string;
  description_text?: string;
  severity?: 'info' | 'warning' | 'severe' | 'critical' | string;
  severity_level?: 'info' | 'warning' | 'critical' | string;
  effect?: string;
  status: string;
  starts_at?: string;
  active_period_start?: string;
  ends_at?: string;
  active_period_end?: string;
  affected_routes?: any;
  affected_stops?: string[];
}
