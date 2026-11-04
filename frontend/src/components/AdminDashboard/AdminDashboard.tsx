import React, { useState, useEffect, useCallback } from 'react';
import {
  AdminAnalyticsData,
  FleetVehicleTelemetry,
  ServiceAlertItem,
} from './types';
import {
  HourlyAreaChart,
  TopCorridorsBarChart,
  ProductDonutChart,
  PaymentChannelsBar,
  EVGaugeMeter,
} from './AdminAnalyticsCharts';
import { AdminFleetTable } from './AdminFleetTable';
import { AdminAlertsDispatcher } from './AdminAlertsDispatcher';
import { AdminAssetManager } from './AdminAssetManager';
import {
  Bus,
  TrendingUp,
  Users,
  Award,
  Zap,
  Building2,
  RefreshCw,
  Download,
  ShieldCheck,
  ArrowLeft,
  Clock,
  IndianRupee,
  Radio,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
  PlusCircle,
  LogOut,
  Globe,
} from 'lucide-react';
import { AuthUser } from '../../types';

export type AdminPageKey = 'overview' | 'fleet' | 'corridors' | 'depots' | 'alerts' | 'manage';

function parseAdminPageFromUrl(): AdminPageKey {
  try {
    const path = window.location.pathname.replace(/\/+$/, '');
    const hash = window.location.hash.replace(/^#/, '').replace(/\/+$/, '');
    const target = path.includes('/admin-dashboard') ? path : hash;

    if (target.endsWith('/fleet')) return 'fleet';
    if (target.endsWith('/corridors')) return 'corridors';
    if (target.endsWith('/depots')) return 'depots';
    if (target.endsWith('/alerts')) return 'alerts';
    if (target.endsWith('/manage') || target.endsWith('/create') || target.endsWith('/add')) return 'manage';
    return 'overview';
  } catch {
    return 'overview';
  }
}

interface AdminDashboardProps {
  onSwitchToPassengerPortal: () => void;
  onTrackBusOnMap?: (bus: FleetVehicleTelemetry) => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onSwitchToPassengerPortal,
  onTrackBusOnMap,
  currentUser = null,
  onLogout,
}) => {
  const [currentPage, setCurrentPage] = useState<AdminPageKey>(parseAdminPageFromUrl);
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState<boolean>(false);

  // Filters
  const [timeRange, setTimeRange] = useState<'all' | 'today' | 'yesterday' | '7d' | '30d'>('all');
  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [selectedDepot, setSelectedDepot] = useState<string>('all');
  const [hourlyMetric, setHourlyMetric] = useState<'passengers' | 'revenue'>('passengers');

  // Data states
  const [analyticsData, setAnalyticsData] = useState<AdminAnalyticsData | null>(null);
  const [fleetList, setFleetList] = useState<FleetVehicleTelemetry[]>([]);
  const [alertsList, setAlertsList] = useState<ServiceAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [liveClock, setLiveClock] = useState<string>('');

  // Browser navigation popstate listener
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(parseAdminPageFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigatePage = (page: AdminPageKey) => {
    setCurrentPage(page);
    setIsSidebarMobileOpen(false);
    const targetPath = page === 'overview' ? '/admin-dashboard' : `/admin-dashboard/${page}`;
    try {
      window.history.pushState({ adminPage: page }, '', targetPath);
    } catch (e) {}
  };

  // Live IST Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveClock(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Analytics & Fleet data
  const loadDashboardData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const params = new URLSearchParams({
        range: timeRange,
        route: selectedRoute,
        depot: selectedDepot,
      });

      // 1. Fetch Analytics
      const resAnalytics = await fetch(`/api/v1/admin/analytics/?${params.toString()}`);
      if (resAnalytics.ok) {
        const data: AdminAnalyticsData = await resAnalytics.json();
        setAnalyticsData(data);
      }

      // 2. Fetch Fleet Telemetry
      const resFleet = await fetch('/api/v1/admin/fleet/');
      if (resFleet.ok) {
        const fData = await resFleet.json();
        setFleetList(fData.fleet || []);
      }

      // 3. Fetch Service Alerts
      const resAlerts = await fetch('/api/v1/alerts/');
      if (resAlerts.ok) {
        const aData = await resAlerts.json();
        setAlertsList(aData.alerts || []);
      }

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [timeRange, selectedRoute, selectedDepot]);

  useEffect(() => {
    loadDashboardData(true);
  }, [loadDashboardData]);

  const handleManualRefresh = useCallback(() => {
    loadDashboardData(true);
  }, [loadDashboardData]);

  // Real-time smooth background polling for live fleet telemetry without screen flickering
  useEffect(() => {
    if (currentPage === 'fleet') {
      const pollFleet = async () => {
        try {
          const res = await fetch('/api/v1/admin/fleet/');
          if (res.ok) {
            const data = await res.json();
            if (data.fleet) setFleetList(data.fleet);
          }
        } catch (e) {}
      };
      const interval = setInterval(pollFleet, 2500);
      return () => clearInterval(interval);
    } else {
      const pollAll = () => loadDashboardData(false);
      const interval = setInterval(pollAll, 20000);
      return () => clearInterval(interval);
    }
  }, [currentPage, loadDashboardData]);

  // Export CSV Data
  const handleExportCSV = () => {
    if (!analyticsData) return;
    const rows = [
      ['AMTS Operations & Revenue Intelligence System — Official Government Export'],
      ['Generated On', new Date().toISOString()],
      ['Reporting Range', timeRange.toUpperCase()],
      [''],
      ['Summary KPIs'],
      ['Total Passengers Booked', analyticsData.kpis.total_bookings],
      ['Total Commercial Fare Revenue (INR)', analyticsData.kpis.total_fare_revenue_inr],
      ['Total Government Concession Subsidies (INR)', analyticsData.kpis.total_subsidies_inr],
      ['Gross System Revenue (INR)', analyticsData.kpis.total_gross_income_inr],
      ['System Punctuality Rate (%)', `${analyticsData.kpis.system_punctuality_pct}%`],
      ['Active Fleet on Road', analyticsData.kpis.active_fleet_on_road],
      ['Total Fleet Size', analyticsData.kpis.total_fleet_size],
      ['Clean EV Ratio (%)', `${analyticsData.kpis.clean_ev_ratio_pct}%`],
      [''],
      ['Corridor Ranking', 'Route Code', 'Route Long Name', 'Total Bookings', 'Gross Revenue (INR)', 'Occupancy (%)', 'On-Time (%)', 'Depot'],
      ...analyticsData.top_corridors.map((c, i) => [
        i + 1,
        c.route_code,
        `"${c.route_name}"`,
        c.bookings_count,
        c.gross_revenue_inr,
        `${c.occupancy_rate_pct}%`,
        `${c.on_time_performance_pct}%`,
        `"${c.depot_assigned}"`,
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AMTS_Operations_Report_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const kpis = analyticsData?.kpis;
  const corridors = analyticsData?.top_corridors || [];
  const availableRoutesForAlerts = corridors.map((c) => ({ code: c.route_code, name: c.route_name }));

  const pageTitles: Record<AdminPageKey, { title: string; subtitle: string }> = {
    overview: {
      title: 'Executive Overview & Commercial Analytics',
      subtitle: 'System-wide Ridership Trends, Hourly Commute Curves & Revenue Breakdown',
    },
    fleet: {
      title: 'Live Fleet Telemetry & GPS Dispatch Matrix',
      subtitle: `Real-time Monitoring of All ${fleetList.length || 32} Transit Units, Battery SoC, Speed & Round Cycles`,
    },
    corridors: {
      title: 'Corridor Profitability & Performance Rankings',
      subtitle: `Commercial Performance, Density Load & Efficiency Across All ${corridors.length || 15} AMTS Routes`,
    },
    depots: {
      title: 'Depots Inventory & Green EV Sustainability',
      subtitle: 'Depot Fleet Allocations, EV Fast Chargers, Maintenance Bays & Carbon Mitigation',
    },
    alerts: {
      title: 'Public Service Advisories & Emergency Detour Dispatcher',
      subtitle: 'Broadcast Road Work Notices, Metro Diversions & Weather Detours to Public Portal',
    },
    manage: {
      title: 'Add Route, Bus & Stand',
      subtitle: 'Register new buses, create route corridors, and add bus stands across the AMTS network',
    },
  };

  return (
    <div className="admin-portal-layout">
      {/* =====================================================================
          ENTERPRISE MULTI-PAGE LEFT SIDEBAR
          ===================================================================== */}
      <aside className={`admin-enterprise-sidebar ${isSidebarMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand-box">
          <div className="admin-brand-badge">
            <Building2 size={24} className="text-red" />
          </div>
          <div className="sidebar-brand-text">
            <div className="sidebar-super">AHMEDABAD MUNICIPAL CORP.</div>
            <div className="sidebar-title">
              <span className="text-red font-extrabold">AMTS</span> ADMIN PORTAL
            </div>
            <div className="sidebar-sub">ગવર્નમેન્ટ સ્ટાફ એડમિન</div>
          </div>
          <button
            type="button"
            className="sidebar-close-btn-mobile"
            onClick={() => setIsSidebarMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items (Dedicated Pages) */}
        <nav className="admin-sidebar-nav">
          <div className="nav-section-label">OPERATIONS & ANALYTICS</div>

          <button
            type="button"
            className={`admin-nav-item ${currentPage === 'overview' ? 'active' : ''}`}
            onClick={() => handleNavigatePage('overview')}
          >
            <TrendingUp size={18} className="nav-icon" />
            <span className="nav-label">Executive Overview</span>
          </button>

          <button
            type="button"
            className={`admin-nav-item ${currentPage === 'fleet' ? 'active' : ''}`}
            onClick={() => handleNavigatePage('fleet')}
          >
            <Bus size={18} className="nav-icon" />
            <span className="nav-label">Fleet Dispatch & GPS</span>
            <span className="nav-pill-badge">{fleetList.length}</span>
          </button>

          <button
            type="button"
            className={`admin-nav-item ${currentPage === 'corridors' ? 'active' : ''}`}
            onClick={() => handleNavigatePage('corridors')}
          >
            <Award size={18} className="nav-icon" />
            <span className="nav-label">Corridors Profitability</span>
            <span className="nav-pill-badge">{corridors.length || 15}</span>
          </button>

          <div className="nav-section-label" style={{ marginTop: '16px' }}>
            INFRASTRUCTURE & COMPLIANCE
          </div>

          <button
            type="button"
            className={`admin-nav-item ${currentPage === 'depots' ? 'active' : ''}`}
            onClick={() => handleNavigatePage('depots')}
          >
            <Zap size={18} className="nav-icon" />
            <span className="nav-label">Depots & Green EV</span>
            <span className="nav-pill-badge">{analyticsData?.depots.length || 4}</span>
          </button>

          <button
            type="button"
            className={`admin-nav-item ${currentPage === 'alerts' ? 'active' : ''}`}
            onClick={() => handleNavigatePage('alerts')}
          >
            <Radio size={18} className="nav-icon" />
            <span className="nav-label">Service Advisories</span>
            {alertsList.length > 0 && (
              <span className="nav-pill-badge alert-badge">{alertsList.length}</span>
            )}
          </button>

          <div className="nav-section-label" style={{ marginTop: '16px' }}>
            NETWORK MANAGEMENT
          </div>

          <button
            type="button"
            className={`admin-nav-item ${currentPage === 'manage' ? 'active' : ''}`}
            onClick={() => handleNavigatePage('manage')}
          >
            <PlusCircle size={18} className="nav-icon text-emerald" />
            <span className="nav-label">Add Route, Bus or Stand</span>
          </button>
        </nav>

        {/* Sidebar Footer Card */}
        <div className="admin-sidebar-footer">
          <div className="officer-card">
            <div className="officer-dot"></div>
            <div>
              <div className="officer-role">TRAFFIC CONTROL DESK</div>
              <div className="officer-agency">AMC Urban Mobility Division</div>
            </div>
          </div>

          <button
            type="button"
            className="portal-back-link"
            onClick={onSwitchToPassengerPortal}
            title="Switch to public passenger tracking view"
          >
            <ArrowLeft size={14} />
            <span>Passenger Portal</span>
            <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.7 }} />
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {isSidebarMobileOpen && (
        <div
          className="admin-sidebar-mobile-backdrop"
          onClick={() => setIsSidebarMobileOpen(false)}
        ></div>
      )}

      {/* =====================================================================
          RIGHT MAIN CONTENT VIEWPORT
          ===================================================================== */}
      <div className="admin-main-viewport">
        {/* Executive Top Bar */}
        <header className="admin-viewport-header">
          <div className="viewport-header-left">
            <button
              type="button"
              className="admin-menu-toggle-btn"
              onClick={() => setIsSidebarMobileOpen(true)}
              aria-label="Toggle navigation menu"
            >
              <Menu size={20} />
            </button>

            <div className="header-breadcrumbs">
              <span className="breadcrumb-root">AMTS Admin</span>
              <ChevronRight size={14} className="breadcrumb-arrow" />
              <span className="breadcrumb-current">{pageTitles[currentPage].title}</span>
            </div>
          </div>

          <div className="viewport-header-right">
            <div className="admin-clock-box">
              <Clock size={14} className="text-emerald" />
              <span className="live-clock-text">{liveClock || 'Live'}</span>
              <span className="live-pulse-dot"></span>
            </div>

            <button
              type="button"
              className="admin-action-btn primary"
              onClick={() => handleNavigatePage('manage')}
              title="Add New Route Corridor or Register Bus"
              style={{ background: '#059669', borderColor: '#047857', color: '#FFFFFF' }}
            >
              <PlusCircle size={14} />
              <span className="admin-btn-label-desktop">+ Add Route / Bus</span>
              <span className="admin-btn-label-mobile">Add</span>
            </button>

            <button
              type="button"
              className="admin-action-btn primary export-csv-btn"
              onClick={handleExportCSV}
              title="Export complete operational report to CSV"
            >
              <Download size={14} />
              <span className="admin-btn-label-desktop">Export CSV</span>
            </button>

            {/* Direct Switch to Website (Passenger Portal) */}
            <button
              type="button"
              className="admin-action-btn switch-portal-header-btn"
              onClick={onSwitchToPassengerPortal}
              title="Return to Public Passenger Live Bus Tracking Website"
            >
              <Globe size={15} />
              <span className="admin-btn-label-desktop">Website Portal ➔</span>
              <span className="admin-btn-label-mobile">Website ➔</span>
            </button>

            {currentUser && onLogout && (
              <button
                type="button"
                className="admin-logout-header-btn"
                onClick={onLogout}
                title="Sign out of Admin Session"
                aria-label="Sign out"
              >
                <LogOut size={14} />
                <span className="admin-btn-label-desktop">Sign Out</span>
              </button>
            )}
          </div>
        </header>

        {/* Global Operations Filter Strip */}
        <div className="admin-filter-strip">
          <div className="filter-strip-left">
            <div className="filter-pill-selector">
              <span className="filter-prefix">Period:</span>
              <button
                type="button"
                className={`range-pill ${timeRange === 'all' ? 'active' : ''}`}
                onClick={() => setTimeRange('all')}
              >
                All Time
              </button>
              <button
                type="button"
                className={`range-pill ${timeRange === 'today' ? 'active' : ''}`}
                onClick={() => setTimeRange('today')}
              >
                Today (Live)
              </button>
              <button
                type="button"
                className={`range-pill ${timeRange === 'yesterday' ? 'active' : ''}`}
                onClick={() => setTimeRange('yesterday')}
              >
                Yesterday
              </button>
              <button
                type="button"
                className={`range-pill ${timeRange === '7d' ? 'active' : ''}`}
                onClick={() => setTimeRange('7d')}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                className={`range-pill ${timeRange === '30d' ? 'active' : ''}`}
                onClick={() => setTimeRange('30d')}
              >
                Month to Date (30D)
              </button>
            </div>

            <div className="dropdown-filter-group">
              <span className="filter-prefix">Corridor:</span>
              <select
                className="filter-select"
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
              >
                <option value="all">All {corridors.length} AMTS Corridors</option>
                {corridors.map((c) => (
                  <option key={c.route_code} value={c.route_code}>
                    Route {c.route_code} - {c.route_name.slice(0, 30)}
                  </option>
                ))}
              </select>
            </div>

            <div className="dropdown-filter-group">
              <span className="filter-prefix">Depot:</span>
              <select
                className="filter-select"
                value={selectedDepot}
                onChange={(e) => setSelectedDepot(e.target.value)}
              >
                <option value="all">All Ahmedabad Depots</option>
                <option value="Meghaninagar">Meghaninagar Depot</option>
                <option value="Lal Darwaja">Lal Darwaja Central Depot</option>
                <option value="Kalupur">Kalupur Terminus Depot</option>
                <option value="Vadaj">Vadaj West Depot</option>
              </select>
            </div>
          </div>

          <div className="filter-strip-right">
            <button
              type="button"
              className="refresh-indicator-btn"
              onClick={handleManualRefresh}
              title="Reload live telemetry and statistics"
            >
              <RefreshCw size={13} className={loading ? 'spinning' : ''} />
              <span>Synced {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </button>
          </div>
        </div>

        {/* =====================================================================
            DEDICATED FULL-PAGE CONTENT
            ===================================================================== */}
        <main className="admin-page-container">
          {/* Page Headline */}
          <div className="page-headline-block">
            <h2 className="page-main-heading">{pageTitles[currentPage].title}</h2>
            <p className="page-main-subheading">{pageTitles[currentPage].subtitle}</p>
          </div>

          {/* PAGE 1: EXECUTIVE OVERVIEW */}
          {currentPage === 'overview' && kpis && (
            <div className="admin-page-flow">
              {/* KPI Cards Strip */}
              <div className="admin-kpis-grid">
                <div className="kpi-card-metric highlight-gradient-emerald">
                  <div className="kpi-card-header">
                    <span className="kpi-card-title">Gross Operating Income</span>
                    <div className="kpi-icon-pill">
                      <IndianRupee size={16} />
                    </div>
                  </div>
                  <div className="kpi-card-number">
                    ₹{kpis.total_gross_income_inr.toLocaleString()}
                  </div>
                  <div className="kpi-card-footnote">
                    <span>₹{kpis.total_fare_revenue_inr.toLocaleString()} Fares</span>
                    <span>•</span>
                    <span>₹{kpis.total_subsidies_inr.toLocaleString()} Subsidies</span>
                  </div>
                </div>

                <div className="kpi-card-metric highlight-gradient-blue">
                  <div className="kpi-card-header">
                    <span className="kpi-card-title">Total Ridership Bookings</span>
                    <div className="kpi-icon-pill">
                      <Users size={16} />
                    </div>
                  </div>
                  <div className="kpi-card-number">
                    {kpis.total_bookings.toLocaleString()}
                  </div>
                  <div className="kpi-card-footnote">
                    <span>₹{kpis.average_fare_inr} Avg Fare / Pax</span>
                    <span>•</span>
                    <span>{corridors.length} Corridors</span>
                  </div>
                </div>

                <div className="kpi-card-metric highlight-gradient-red">
                  <div className="kpi-card-header">
                    <span className="kpi-card-title">Active Fleet On-Road</span>
                    <div className="kpi-icon-pill">
                      <Bus size={16} />
                    </div>
                  </div>
                  <div className="kpi-card-number">
                    {kpis.active_fleet_on_road} <span className="kpi-small-denom">/ {kpis.total_fleet_size}</span>
                  </div>
                  <div className="kpi-card-footnote">
                    <span>{kpis.fleet_utilization_pct}% Active Utilization</span>
                    <span>•</span>
                    <span>{kpis.total_fleet_size - kpis.active_fleet_on_road} in Depot / Standby</span>
                  </div>
                </div>

                <div className="kpi-card-metric highlight-gradient-amber">
                  <div className="kpi-card-header">
                    <span className="kpi-card-title">System-wide Punctuality</span>
                    <div className="kpi-icon-pill">
                      <ShieldCheck size={16} />
                    </div>
                  </div>
                  <div className="kpi-card-number">
                    {kpis.system_punctuality_pct}%
                  </div>
                  <div className="kpi-card-footnote">
                    <span>On-Time Arrival Standard</span>
                    <span>•</span>
                    <span>Avg delay 1.8 min</span>
                  </div>
                </div>
              </div>

              {/* Hourly Ridership Curve */}
              {analyticsData.hourly_ridership && (
                <HourlyAreaChart
                  data={analyticsData.hourly_ridership}
                  metricMode={hourlyMetric}
                  onMetricChange={setHourlyMetric}
                />
              )}

              {/* Corridor Rankings & Ticket Donut */}
              <div className="admin-charts-two-col">
                <TopCorridorsBarChart
                  corridors={corridors}
                  activeRoute={selectedRoute}
                  onSelectRoute={(code) => setSelectedRoute(code)}
                />

                {analyticsData.product_breakdown && (
                  <ProductDonutChart
                    items={analyticsData.product_breakdown}
                    totalBookings={kpis.total_bookings}
                    totalRevenue={kpis.total_fare_revenue_inr}
                  />
                )}
              </div>

              {/* Payment Channels & EV Sustainability */}
              <div className="admin-charts-two-col">
                {analyticsData.payment_channels && (
                  <PaymentChannelsBar
                    channels={analyticsData.payment_channels}
                    totalRevenue={kpis.total_fare_revenue_inr}
                  />
                )}

                {analyticsData.ev_sustainability && (
                  <EVGaugeMeter metrics={analyticsData.ev_sustainability} />
                )}
              </div>
            </div>
          )}

          {/* PAGE 2: LIVE FLEET & GPS TELEMETRY */}
          {currentPage === 'fleet' && (
            <div className="admin-page-flow">
              <AdminFleetTable
                fleet={fleetList}
                onTrackBusOnMap={(b) => onTrackBusOnMap?.(b)}
                onRefresh={handleManualRefresh}
                onAddNewBus={() => handleNavigatePage('manage')}
              />
            </div>
          )}

          {/* PAGE 3: CORRIDOR PROFITABILITY */}
          {currentPage === 'corridors' && (
            <div className="admin-page-flow">
              <div className="admin-corridors-deep-dive-card">
                <div className="table-header-row">
                  <div className="table-title-group">
                    <div className="chart-icon-box gold-box">
                      <Award size={18} />
                    </div>
                    <div>
                      <h4 className="chart-heading">Corridor Commercial Performance Matrix</h4>
                      <p className="chart-subheading">
                        Ridership Volume, Gross Fare Revenue, Passenger Density & Operating Depots
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="admin-btn-action primary-btn"
                      onClick={() => handleNavigatePage('manage')}
                      title="Create New AMTS Route Corridor"
                      style={{ background: '#E11D48', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <PlusCircle size={14} />
                      <span>+ Add Route</span>
                    </button>

                    {selectedRoute !== 'all' && (
                      <button
                        type="button"
                        className="admin-btn-action secondary-btn"
                        onClick={() => setSelectedRoute('all')}
                        title={`Show All ${corridors.length} Corridors`}
                      >
                        <RefreshCw size={13} />
                        <span>Show All Corridors (Reset)</span>
                      </button>
                    )}
                  </div>
                </div>

                {selectedRoute !== 'all' && (
                  <div className="active-corridor-filter-banner" style={{ margin: '0 0 16px 0' }}>
                    <div className="filter-pill-text">
                      <span>Filtered by Corridor:</span>
                      <strong>Route {selectedRoute}</strong>
                    </div>
                    <button
                      type="button"
                      className="reset-filter-btn"
                      onClick={() => setSelectedRoute('all')}
                      title={`Reset filter and show all ${corridors.length} corridors`}
                    >
                      <RefreshCw size={12} />
                      <span>Show All {corridors.length} Corridors</span>
                    </button>
                  </div>
                )}

                <div className="table-responsive-wrapper">
                  <table className="admin-data-table" style={{ minWidth: '850px' }}>
                    <thead>
                      <tr>
                        <th style={{ whiteSpace: 'nowrap', width: '110px' }}>Route Code</th>
                        <th style={{ whiteSpace: 'nowrap', minWidth: '220px' }}>Corridor Name</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Bookings Count</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Gross Fare (₹)</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Avg Fare / Pax</th>
                        <th style={{ whiteSpace: 'nowrap', minWidth: '110px' }}>Stops</th>
                        <th style={{ whiteSpace: 'nowrap', minWidth: '180px' }}>Assigned Depot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corridors.map((c, i) => (
                        <tr
                          key={c.route_code}
                          className={`${i === 0 ? 'top-ranked-row' : ''} ${selectedRoute === c.route_code ? 'selected-corridor-row' : ''}`}
                          onClick={() => setSelectedRoute(selectedRoute === c.route_code ? 'all' : c.route_code)}
                          style={{ cursor: 'pointer' }}
                          title={selectedRoute === c.route_code ? `Click to deselect Route ${c.route_code} and show all` : `Click to isolate Route ${c.route_code}`}
                        >
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div className="corridor-code-cell">
                              <span
                                className="route-pill-colored"
                                style={{ backgroundColor: `#${c.route_color}` }}
                              >
                                {c.route_code}
                              </span>
                              {i === 0 && <span className="crown-top-tag">#1 Revenue</span>}
                            </div>
                          </td>
                          <td style={{ minWidth: '220px' }}>
                            <span className="corridor-title-text font-bold">{c.route_name}</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className="font-bold">{c.bookings_count.toLocaleString()}</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className="font-extrabold text-emerald">
                              ₹{c.gross_revenue_inr.toLocaleString()}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span>₹{(c.gross_revenue_inr / Math.max(1, c.bookings_count)).toFixed(1)}</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 600 }}>{c.total_stops} Stands</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', minWidth: '180px' }}>
                            <span
                              className="depot-tag"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                whiteSpace: 'nowrap',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: '#F1F5F9',
                                color: '#334155',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                border: '1px solid #CBD5E1',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                                flexShrink: 0,
                              }}
                            >
                              <Building2 size={12} style={{ color: '#64748B', flexShrink: 0 }} />
                              <span>{c.depot_assigned}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PAGE 4: DEPOTS & GREEN EV */}
          {currentPage === 'depots' && analyticsData && (
            <div className="admin-page-flow">
              {analyticsData.ev_sustainability && (
                <EVGaugeMeter metrics={analyticsData.ev_sustainability} />
              )}

              <div className="depots-cards-grid">
                {analyticsData.depots.map((depot) => (
                  <div key={depot.depot_code} className="depot-info-card">
                    <div className="depot-card-top">
                      <div>
                        <div className="depot-zone-tag">{depot.zone}</div>
                        <h4 className="depot-name-heading">{depot.depot_name}</h4>
                      </div>
                      <span className="depot-code-pill">{depot.depot_code}</span>
                    </div>

                    <div className="depot-metrics-matrix">
                      <div className="depot-metric-cell">
                        <div className="metric-cell-label">Total Allocated</div>
                        <div className="metric-cell-val font-bold">{depot.allocated_fleet} Buses</div>
                      </div>
                      <div className="depot-metric-cell">
                        <div className="metric-cell-label">Active on Road</div>
                        <div className="metric-cell-val text-emerald font-bold">
                          {depot.active_on_road} Buses
                        </div>
                      </div>
                      <div className="depot-metric-cell">
                        <div className="metric-cell-label">In Maintenance</div>
                        <div className="metric-cell-val text-amber font-bold">
                          {depot.in_maintenance} Bay
                        </div>
                      </div>
                      <div className="depot-metric-cell">
                        <div className="metric-cell-label">EV Fast Chargers</div>
                        <div className="metric-cell-val text-blue font-bold">
                          {depot.ev_charging_bays} Bays
                        </div>
                      </div>
                    </div>

                    <div className="depot-footer-row">
                      <div className="manager-info">
                        <span className="manager-label">Superintendent:</span>
                        <span className="manager-name">{depot.depot_manager}</span>
                      </div>
                      <div className="depot-punctuality">
                        <span className="punct-label">Punctuality:</span>
                        <span className="punct-val text-emerald">{depot.punctuality_pct}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PAGE 5: SERVICE ADVISORIES & DISPATCHER */}
          {currentPage === 'alerts' && (
            <div className="admin-page-flow">
              <AdminAlertsDispatcher
                alerts={alertsList}
                availableRoutes={availableRoutesForAlerts}
                onRefreshAlerts={handleManualRefresh}
              />
            </div>
          )}

          {/* PAGE 6: ADD ROUTE OR BUS (ASSET MANAGER) */}
          {currentPage === 'manage' && (
            <div className="admin-page-flow">
              <AdminAssetManager
                onRouteCreated={() => loadDashboardData()}
                onBusCreated={() => loadDashboardData()}
                onNavigateToFleet={() => handleNavigatePage('fleet')}
                onNavigateToCorridors={() => handleNavigatePage('corridors')}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
