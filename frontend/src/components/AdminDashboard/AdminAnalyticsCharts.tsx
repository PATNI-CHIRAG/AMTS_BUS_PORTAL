import React, { useState } from 'react';
import {
  HourlyRidershipPoint,
  CorridorPerformance,
  ProductBreakdownItem,
  PaymentChannelItem,
  EVSustainabilityMetrics,
} from './types';
import {
  TrendingUp,
  Zap,
  Award,
  Users,
  IndianRupee,
  ShieldCheck,
  Leaf,
  Layers,
  Clock,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

// ============================================================================
// 1. HOURLY RIDERSHIP & REVENUE CURVED AREA CHART
// ============================================================================
interface HourlyChartProps {
  data: HourlyRidershipPoint[];
  metricMode: 'passengers' | 'revenue';
  onMetricChange: (mode: 'passengers' | 'revenue') => void;
}

export const HourlyAreaChart: React.FC<HourlyChartProps> = ({
  data,
  metricMode,
  onMetricChange,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const width = 800;
  const height = 280;
  const padding = { top: 25, right: 30, bottom: 45, left: 60 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => (metricMode === 'passengers' ? d.passengers : d.revenue_inr));
  const maxVal = Math.max(...values, 5);
  const minVal = 0;

  const getX = (idx: number) => padding.left + (idx / (data.length - 1)) * chartW;
  const getY = (val: number) => padding.top + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;

  // Build smooth bezier curve
  const points = data.map((d, i) => ({
    x: getX(i),
    y: getY(metricMode === 'passengers' ? d.passengers : d.revenue_inr),
  }));

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
    const val = Math.round(minVal + ratio * maxVal);
    const y = getY(val);
    return { val, y };
  });

  const activePoint = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-title-group">
          <div className="chart-icon-box blue-box">
            <TrendingUp size={18} />
          </div>
          <div>
            <h4 className="chart-heading">Hourly System Ridership & Revenue Profile</h4>
            <p className="chart-subheading">
              Real-time Passenger Flow (06:00 to 23:00) with Morning & Evening Peak Detection
            </p>
          </div>
        </div>

        <div className="chart-controls-group">
          <button
            type="button"
            className={`metric-toggle-btn ${metricMode === 'passengers' ? 'active' : ''}`}
            onClick={() => onMetricChange('passengers')}
          >
            <Users size={14} />
            <span>Passenger Volume</span>
          </button>
          <button
            type="button"
            className={`metric-toggle-btn ${metricMode === 'revenue' ? 'active' : ''}`}
            onClick={() => onMetricChange('revenue')}
          >
            <IndianRupee size={14} />
            <span>Fare Revenue (₹)</span>
          </button>
        </div>
      </div>

      <div className="svg-chart-container">
        <svg viewBox={`0 0 ${width} ${height}`} className="responsive-svg-chart">
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={metricMode === 'passengers' ? '#2563EB' : '#059669'}
                stopOpacity="0.45"
              />
              <stop
                offset="100%"
                stopColor={metricMode === 'passengers' ? '#2563EB' : '#059669'}
                stopOpacity="0.02"
              />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop
                offset="0%"
                stopColor={metricMode === 'passengers' ? '#3B82F6' : '#10B981'}
              />
              <stop
                offset="100%"
                stopColor={metricMode === 'passengers' ? '#1D4ED8' : '#047857'}
              />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={width - padding.right}
                y2={tick.y}
                stroke="#E2E8F0"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 10}
                y={tick.y + 4}
                textAnchor="end"
                className="axis-tick-text"
              >
                {metricMode === 'revenue' ? `₹${(tick.val / 1000).toFixed(0)}k` : tick.val.toLocaleString()}
              </text>
            </g>
          ))}

          {/* Area fill */}
          <path d={areaD} fill="url(#areaGradient)" />

          {/* Main smooth curve */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Points & Peak highlights */}
          {data.map((d, i) => {
            const cx = getX(i);
            const cy = getY(metricMode === 'passengers' ? d.passengers : d.revenue_inr);
            const isHovered = hoverIndex === i;

            return (
              <g
                key={i}
                className="chart-data-point-group"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Invisible hover target */}
                <rect
                  x={cx - (chartW / (data.length - 1)) / 2}
                  y={padding.top}
                  width={chartW / (data.length - 1)}
                  height={chartH}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                />

                {/* X axis labels */}
                {i % 2 === 0 && (
                  <text
                    x={cx}
                    y={padding.top + chartH + 20}
                    textAnchor="middle"
                    className="axis-tick-text"
                  >
                    {d.hour}
                  </text>
                )}

                {/* Point circle - clean and static without red moving pulses */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 3.5}
                  fill={metricMode === 'passengers' ? '#2563EB' : '#059669'}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {/* Active Hover Crosshair Line */}
          {hoverIndex !== null && (
            <line
              x1={getX(hoverIndex)}
              y1={padding.top}
              x2={getX(hoverIndex)}
              y2={padding.top + chartH}
              stroke="#64748B"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {activePoint && hoverIndex !== null && (
          <div
            className="chart-tooltip-floating"
            style={{
              left: `${(getX(hoverIndex) / width) * 100}%`,
              top: '10px',
            }}
          >
            <div className="tooltip-header">
              <Clock size={12} />
              <span className="tooltip-hour">{activePoint.hour} IST</span>
              {activePoint.is_peak && <span className="peak-pill">PEAK HOUR</span>}
            </div>
            <div className="tooltip-body">
              <div className="tooltip-row">
                <span className="tooltip-label">Passengers:</span>
                <span className="tooltip-val font-bold text-blue">
                  {activePoint.passengers.toLocaleString()}
                </span>
              </div>
              <div className="tooltip-row">
                <span className="tooltip-label">Gross Revenue:</span>
                <span className="tooltip-val font-bold text-emerald">
                  ₹{activePoint.revenue_inr.toLocaleString()}
                </span>
              </div>
              <div className="tooltip-sub">{activePoint.period_label}</div>
            </div>
          </div>
        )}
      </div>

      <div className="chart-footer-meta">
        <div className="legend-strip">
          <span className="legend-item">
            <span
              className="legend-dot"
              style={{ backgroundColor: metricMode === 'passengers' ? '#2563EB' : '#059669' }}
            ></span>
            <span>Hourly {metricMode === 'passengers' ? 'Passenger Volume' : 'Fare Revenue (₹)'} (06:00 to 23:00)</span>
          </span>
        </div>
        <div className="chart-insight-badge">
          <Clock size={13} className="text-blue" />
          <span>Real-time System Distribution from PostgreSQL Database</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. TOP PERFORMING CORRIDORS (HIGHEST BOOKINGS & REVENUE HORIZONTAL BARS)
// ============================================================================
interface TopCorridorsProps {
  corridors: CorridorPerformance[];
  activeRoute?: string;
  onSelectRoute?: (routeCode: string) => void;
}

export const TopCorridorsBarChart: React.FC<TopCorridorsProps> = ({
  corridors,
  activeRoute = 'all',
  onSelectRoute,
}) => {
  const [metric, setMetric] = useState<'bookings' | 'revenue'>('bookings');

  if (!corridors || corridors.length === 0) return null;

  const sorted = [...corridors].sort((a, b) =>
    metric === 'bookings'
      ? b.bookings_count - a.bookings_count
      : b.gross_revenue_inr - a.gross_revenue_inr
  );

  const maxVal = metric === 'bookings' ? sorted[0].bookings_count : sorted[0].gross_revenue_inr;

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-title-group">
          <div className="chart-icon-box red-box">
            <Award size={18} />
          </div>
          <div>
            <h4 className="chart-heading">Corridor Rankings & Commercial Performance</h4>
            <p className="chart-subheading">
              Comparing Highest Bookings & Revenue Across All {corridors.length} AMTS Ahmedabad Routes
            </p>
          </div>
        </div>

        <div className="chart-controls-group">
          <button
            type="button"
            className={`metric-toggle-btn ${metric === 'bookings' ? 'active' : ''}`}
            onClick={() => setMetric('bookings')}
          >
            <span>Rank by Bookings</span>
          </button>
          <button
            type="button"
            className={`metric-toggle-btn ${metric === 'revenue' ? 'active' : ''}`}
            onClick={() => setMetric('revenue')}
          >
            <span>Rank by Revenue (₹)</span>
          </button>
        </div>
      </div>

      {/* Active Corridor Filter Banner with Reset Button */}
      {activeRoute !== 'all' && (
        <div className="active-corridor-filter-banner">
          <div className="filter-pill-text">
            <span>Filtered by Corridor:</span>
            <strong>Route {activeRoute}</strong>
          </div>
          <button
            type="button"
            className="reset-filter-btn"
            onClick={() => onSelectRoute?.('all')}
            title={`Reset filter and show all ${corridors.length} corridors`}
          >
            <RotateCcw size={12} />
            <span>Show All {corridors.length} Corridors</span>
          </button>
        </div>
      )}

      <div className="corridor-bars-list">
        {sorted.slice(0, 8).map((c, idx) => {
          const val = metric === 'bookings' ? c.bookings_count : c.gross_revenue_inr;
          const pct = Math.round((val / maxVal) * 100);
          const isTop = idx === 0;
          const isSelected = activeRoute === c.route_code;

          return (
            <div
              key={c.route_code}
              className={`corridor-bar-row ${isTop ? 'top-ranked-row' : ''} ${isSelected ? 'selected-corridor-row' : ''}`}
              onClick={() => onSelectRoute?.(activeRoute === c.route_code ? 'all' : c.route_code)}
              title={isSelected ? `Click to deselect Route ${c.route_code} and show all` : `Click to filter Route ${c.route_code}`}
            >
              <div className="corridor-rank-badge">#{idx + 1}</div>

              <div className="corridor-route-pill" style={{ backgroundColor: `#${c.route_color}` }}>
                {c.route_code}
              </div>

              <div className="corridor-info-col">
                <div className="corridor-title-row">
                  <span className="corridor-name" title={c.route_name}>
                    {c.route_name}
                  </span>
                  <span className="corridor-metric-val">
                    {metric === 'bookings' ? `${c.bookings_count.toLocaleString()} Bookings` : `₹${c.gross_revenue_inr.toLocaleString()}`}
                  </span>
                </div>

                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isTop ? '#DC2626' : `#${c.route_color}`,
                    }}
                  ></div>
                </div>

                <div className="corridor-meta-sub">
                  <span>Occupancy: {c.occupancy_rate_pct}%</span>
                  <span>•</span>
                  <span>On-Time: {c.on_time_performance_pct}%</span>
                  <span>•</span>
                  <span>Fleet: {c.assigned_fleet_count} Buses</span>
                  <span>•</span>
                  <span className="depot-tag">{c.depot_assigned}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 3. TICKET & CONCESSION CATEGORY DONUT CHART
// ============================================================================
interface DonutChartProps {
  items: ProductBreakdownItem[];
  totalBookings: number;
  totalRevenue: number;
}

export const ProductDonutChart: React.FC<DonutChartProps> = ({
  items,
  totalBookings,
  totalRevenue,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!items || items.length === 0) return null;

  const size = 260;
  const strokeWidth = 36;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  const segments = items.map((item, idx) => {
    const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativeOffset;
    cumulativeOffset += (item.percentage / 100) * circumference;

    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
      idx,
    };
  });

  const active = hoveredIndex !== null ? items[hoveredIndex] : null;

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-title-group">
          <div className="chart-icon-box gold-box">
            <Layers size={18} />
          </div>
          <div>
            <h4 className="chart-heading">Ticket Categories & Concession Distribution</h4>
            <p className="chart-subheading">
              Female Pass Subsidies, Senior Concessions & Single Journeys
            </p>
          </div>
        </div>
      </div>

      <div className="donut-and-legend-layout">
        <div className="donut-svg-wrapper">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
            <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              {totalBookings === 0 ? (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#E2E8F0"
                  strokeWidth={strokeWidth}
                />
              ) : (
                segments.map((seg) => (
                  <circle
                    key={seg.category}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth={hoveredIndex === seg.idx ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                    className="donut-segment"
                    onMouseEnter={() => setHoveredIndex(seg.idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{
                      cursor: 'pointer',
                      transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                      opacity: hoveredIndex === null || hoveredIndex === seg.idx ? 1 : 0.45,
                    }}
                  />
                ))
              )}
            </g>
          </svg>

          {/* Donut Center Display */}
          <div className="donut-center-content">
            {active ? (
              <>
                <div className="center-category-pill" style={{ backgroundColor: `${active.color}15`, color: active.color }}>
                  {active.percentage}%
                </div>
                <div className="center-stat-val text-slate">{active.count.toLocaleString()}</div>
                <div className="center-stat-sub">₹{active.revenue_inr.toLocaleString()}</div>
              </>
            ) : (
              <>
                <div className="center-stat-sub text-muted">TOTAL BOOKINGS</div>
                <div className="center-stat-val font-extrabold">{totalBookings.toLocaleString()}</div>
                <div className="center-stat-sub text-emerald">₹{totalRevenue.toLocaleString()} Gross</div>
              </>
            )}
          </div>
        </div>

        {/* Legend List */}
        <div className="donut-legend-col">
          {items.map((item, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <div
                key={item.category}
                className={`donut-legend-item ${isHovered ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="legend-item-left">
                  <span className="color-swatch" style={{ backgroundColor: item.color }}></span>
                  <div className="legend-label-group">
                    <span className="legend-cat-name">{item.category}</span>
                    {item.label && item.label !== item.category && (
                      <span className="legend-cat-sub">{item.label}</span>
                    )}
                  </div>
                </div>

                <div className="legend-item-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="legend-count">{item.count.toLocaleString()} bookings</span>
                  <span className="legend-pct-badge" style={{ backgroundColor: `${item.color}20`, color: item.color, padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
                    {item.percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. PAYMENT CHANNEL DISTRIBUTION STRIP
// ============================================================================
interface PaymentProps {
  channels: PaymentChannelItem[];
  totalRevenue: number;
}

export const PaymentChannelsBar: React.FC<PaymentProps> = ({ channels, totalRevenue }) => {
  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-title-group">
          <div className="chart-icon-box green-box">
            <IndianRupee size={18} />
          </div>
          <div>
            <h4 className="chart-heading">Payment Channels & Cashless Collection</h4>
            <p className="chart-subheading">
              UPI Dynamic QR vs Janmitra Transit Smart Card vs Conductor ETIM
            </p>
          </div>
        </div>
      </div>

      {/* Segmented Progress Bar */}
      <div className="segmented-payment-bar">
        {channels.map((c) => (
          <div
            key={c.method}
            className="payment-bar-segment"
            style={{ width: `${c.percentage}%`, backgroundColor: c.color }}
            title={`${c.method}: ${c.percentage}% (₹${c.amount_inr.toLocaleString()})`}
          ></div>
        ))}
        {channels.every((c) => c.percentage === 0) && (
          <div
            className="payment-bar-segment"
            style={{ width: '100%', backgroundColor: '#E2E8F0' }}
            title="No transactions recorded for this period"
          ></div>
        )}
      </div>

      {/* 4 Cards Grid */}
      <div className="payment-grid-cards">
        {channels.map((c) => (
          <div key={c.method} className="payment-stat-box">
            <div className="payment-box-top">
              <span className="payment-dot" style={{ backgroundColor: c.color }}></span>
              <span className="payment-share-badge">{c.percentage}%</span>
            </div>
            <div className="payment-amount">₹{c.amount_inr.toLocaleString()}</div>
            <div className="payment-method-name">{c.method}</div>
            <div className="payment-count-sub">{c.count.toLocaleString()} transactions</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 5. GREEN EV SUSTAINABILITY GAUGE & IMPACT
// ============================================================================
interface EVProps {
  metrics: EVSustainabilityMetrics;
}

export const EVGaugeMeter: React.FC<EVProps> = ({ metrics }) => {
  const soc = metrics.average_battery_soc_pct;
  const radius = 60;
  const circumference = Math.PI * radius; // Half circle (180 deg)
  const offset = circumference - (soc / 100) * circumference;

  return (
    <div className="chart-card ev-card">
      <div className="chart-header">
        <div className="chart-title-group">
          <div className="chart-icon-box green-emerald-box">
            <Leaf size={18} />
          </div>
          <div>
            <h4 className="chart-heading">Green Mobility & EV Fleet Sustainability</h4>
            <p className="chart-subheading">
              Clean Electric Bus Operations, Battery State of Charge & Carbon Mitigation
            </p>
          </div>
        </div>
      </div>

      <div className="ev-dashboard-grid">
        {/* Radial Semi-Circle Gauge */}
        <div className="ev-gauge-container">
          <svg width="160" height="100" viewBox="0 0 160 100" className="gauge-svg">
            {/* Background arc */}
            <path
              d="M 20 85 A 60 60 0 0 1 140 85"
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="14"
              strokeLinecap="round"
            />
            {/* Value arc */}
            <path
              d="M 20 85 A 60 60 0 0 1 140 85"
              fill="none"
              stroke="#10B981"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="gauge-fill-anim"
            />
          </svg>
          <div className="gauge-value-text">
            <span className="gauge-val font-extrabold">{soc}%</span>
            <span className="gauge-sub">Avg Battery SoC</span>
          </div>
        </div>

        {/* Impact stats columns */}
        <div className="ev-stats-group">
          <div className="ev-stat-item">
            <div className="ev-stat-label">Clean EV Distance Today</div>
            <div className="ev-stat-val text-blue">{metrics.clean_ev_kms_today.toLocaleString()} km</div>
            <div className="ev-stat-tip">Zero Tailpipe Emissions</div>
          </div>

          <div className="ev-stat-item">
            <div className="ev-stat-label">CO₂ Emission Saved</div>
            <div className="ev-stat-val text-emerald">{metrics.co2_saved_kg.toLocaleString()} kg</div>
            <div className="ev-stat-tip">≈ {metrics.green_tree_equivalent} mature trees planted</div>
          </div>

          <div className="ev-stat-item">
            <div className="ev-stat-label">Diesel/CNG Fuel Avoided</div>
            <div className="ev-stat-val text-amber">{metrics.fuel_saved_kg.toLocaleString()} kg</div>
            <div className="ev-stat-tip">₹52,400 fuel expense saved</div>
          </div>

          <div className="ev-stat-item">
            <div className="ev-stat-label">Fleet Electrification</div>
            <div className="ev-stat-val text-purple">{metrics.ev_fleet_ratio_pct}%</div>
            <div className="ev-stat-tip">{metrics.total_ev_buses} of {metrics.total_ev_buses + metrics.total_cng_buses} Buses are Electric</div>
          </div>
        </div>
      </div>
    </div>
  );
};
