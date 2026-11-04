# AMTS Live Bus Portal — Product Requirements Document

**Status:** Draft for academic project planning  
**Product:** Responsive web portal for Ahmedabad Municipal Transport Service (AMTS)  
**Audience:** Passenger, operations/admin, and project development team  
**Last updated:** 22 October 2026

> This is a project specification for everyday Ahmedabad travel (school/college, work, errands, appointments, and other city trips). It is not an official AMTS system unless AMTS authorizes and operates it. Treat route names, fares, timings, eligibility rules, vehicle details, GPS availability, and booking policies in examples as sample data. Confirm operational rules and data access with AMTS before presenting them as fact.

## 1. Product summary

Build a mobile-first, accessible web portal focused on everyday intra-city AMTS travel. A student going to college, a worker commuting to a job, a resident doing errands, and a visitor going to an appointment should be able to find a practical bus journey, follow its progress on an Ahmedabad map, and know when the information was last updated. Provide authorized staff with tools to manage reference data and monitor service health. Make live information trustworthy by showing its freshness and falling back gracefully when GPS or network data is unavailable.

The first release should prove the complete journey-planning loop using a verified sample of Ahmedabad stops and routes. The map must be centered on Ahmedabad and display the actual selected route geometry/stops. A moving bus marker is only “live” when driven by an authorized AVL/GPS feed (or an explicitly labelled local simulator during development). Real GPS tracking, online payment, and official integrations depend on access to authorized data and services; they must not be simulated as live facts in a public deployment.

## 2. Problem and opportunity

Passengers may struggle to know which route serves a stop, whether a bus is approaching, how long a trip will take, whether a transfer is practical, and what fare applies. Static route lists do not answer service disruption or crowding questions. Operators need a consolidated view of vehicles, trips, delays, incidents, and demand.

The portal can reduce uncertainty and make public transport easier to use. It can also help identify service gaps from operational data, while clearly separating measured data from estimates.

## 3. Goals and non-goals

### Goals

- Find routes by route code, stop name, or origin/destination.
- See the selected route and its buses on an Ahmedabad city map, including visible movement when fresh GPS updates are available.
- Display direction-specific route paths and ordered stops.
- Plan direct trips and simple transfers with understandable walking/transfer costs.
- Show vehicle status, last GPS update, estimated arrival, and disruption notices.
- Explain a fare quote and any configured concession or pass rules.
- Give authorized staff a dashboard for routes, schedules, vehicles, incidents, and demand.
- Keep records auditable and protect passenger data.

### Non-goals for the first release

- Claiming official AMTS affiliation or live feeds without authorization.
- Guaranteeing exact ETAs, seat availability, crowd levels, or on-time performance.
- Replacing dispatch, vehicle maintenance, accounting, or the official ticketing system.
- Collecting gender, age, or precise user location unless a specific implemented feature and lawful policy requires it.
- Building a native mobile app before validating the responsive web experience.

## 4. Primary users and needs

| User | Needs |
|---|---|
| Passenger / visitor | Search routes and stops, compare journeys, understand fare and ETA, get service alerts, use the site on a phone or with assistive technology. |
| Operations staff | See active trips and stale/missing GPS, report incidents, update service notices, inspect route and schedule information. |
| Administrator | Manage users/roles, routes, stops, vehicles, schedules, fare products, and audit history. |
| Analyst / project evaluator | View aggregated demand, delays, crowding reports, and booking metrics without unnecessary personal data. |

## 5. Corrected domain model and terminology

The original story mixes a route, a direction, a physical bus, and a scheduled journey. Keep these separate:

- **Route:** Public route identity, such as route code `31`.
- **Route direction/pattern:** A specific ordered path, such as Meghaninagar → Sarkhej. The reverse direction is a separate pattern. A route may have more than two patterns or short-turn variants.
- **Stop:** A physical passenger stop with a stable identity and coordinates. Its position in a pattern belongs in a route-stop record, not in the stop itself.
- **Vehicle:** One physical bus with a unique fleet identifier and registration/plate. It has a vehicle type, capacity, and accessibility/amenity attributes. Route number is not the vehicle identifier.
- **Trip:** One planned or operated one-way run of a vehicle on a route pattern on a service date. A round trip is a sequence of trips; “3.5 rounds” should be derived from completed trips, not stored as a decimal counter.
- **Schedule:** Planned departure and stop-arrival/departure times, effective dates, weekdays/holidays, and exceptions. Actual times are separate observations.
- **Fare product / fare rule:** A configurable product (single journey, day pass, concession) and the rule used to quote a fare for an origin/destination or travel zone. The sample ₹5–₹25 and male/female golden-ticket values are unverified examples, not hard-coded policy.
- **Vehicle position:** A timestamped GPS observation. Current position is derived from the newest valid observation; history may be retained under a retention policy.
- **ETA / delay:** An estimate calculated from the last known position, route progress, schedule, and traffic or observed travel times. Always label estimates and data freshness.

Do not assume that every stop is 300–400 metres apart, all routes have 25 stops, every bus follows exactly one route all day, or every vehicle has an operational GPS tracker. Model those as data, not rules.

## 6. Core passenger stories and scenarios

### A. Search a route and its live buses

Passenger searches `31`, selects a direction, sees the ordered route, stop list, service span, and eligible vehicles currently assigned to trips on that pattern. Opposite-direction vehicles are not mixed into the selected direction. Each live marker shows “updated X min ago”; stale positions are visually distinct and do not imply a live location.

### B. Plan a direct journey

Passenger selects origin and destination stops. The portal returns direct options with boarding stop, alighting stop, route/direction, next scheduled or estimated departure, estimated ride duration, transfer/walking notes, fare quote, and service alerts. Results must respect direction and stop order.

### C. Plan a transfer journey

If no direct service is suitable, return a small number of practical one-transfer options first. Include transfer stop, estimated wait, walking distance when known, total time, and each leg's route and fare treatment. Avoid impossible transfers when the first leg arrives after the second departs. More transfers can be added later; do not promise a globally optimal path until the routing algorithm and data are validated.

### D. GPS missing, delayed, or implausible

When a device stops reporting, the admin view flags stale data and passengers see the last update time with a scheduled estimate fallback. Reject or quarantine impossible jumps and duplicate/out-of-order messages. A GPS outage must never make an old point look current.

### E. Breakdown, diversion, or stop closure

Authorized staff create an incident with affected trips/routes/stops, start and optional end time, severity, passenger-facing text, and audit trail. Passenger route results and ETAs reflect the incident. Closure or diversion can be removed or expired without deleting history.

### F. Capacity and crowding

For the MVP, show crowding only when a defined source exists (e.g. staff report, passenger report, or authorized occupancy sensor), along with source and time. Store a categorical level such as low/medium/high plus provenance and confidence; do not infer real-time occupancy solely from ticket bookings. Provide “unknown” when unavailable.

### G. Tickets and passes

Passenger can view a fare quote and, only if payment/ticketing is implemented, purchase a ticket. A purchased ticket stores the fare rule/version and amount at purchase time, so later price changes do not rewrite history. Payment requests use an idempotency key and maintain pending/succeeded/failed/refunded states. Never store card details. If booking is only a prototype, label it clearly as a demo and do not collect real payment details.

### H. Accessibility, language, and connectivity

Passenger can use keyboard navigation, screen reader labels, high contrast, scalable text, and a low-bandwidth list view. Plan for English and Gujarati labels; preserve a stable stop ID even when names have localized spellings. Map features have an equivalent text/list representation.

### I. Admin analytics

Staff can filter service metrics by date, route, direction, and time band: trips scheduled/completed, observed punctuality, stale GPS rate, incidents, aggregate fare/ticket counts, and reported crowding. Define denominators and data coverage; do not rank “best/worst” routes from incomplete data without a coverage indicator.

## 7. Functional requirements

### Passenger portal (P0)

- Search route codes and stop names with spelling-tolerant suggestions.
- Show route directions, route map/list, ordered stops, and service hours where available.
- Search origin/destination by stop; optionally use the browser's location only after the passenger grants permission.
- Return direct options and one-transfer options with explainable legs and assumptions.
- Show scheduled time vs estimated time distinctly; show last-updated time and service alerts.
- Display configured fare quote and fare basis; handle unavailable fare data explicitly.
- Show Ahmedabad map at a useful city scale, fit the selected route and relevant stops, and provide a text-list alternative.
- Move a bus marker when new timestamped GPS positions arrive; show route/direction and last-updated age. Interpolate only briefly between fresh positions. Freeze and mark stale after the freshness threshold; never keep an old marker moving indefinitely.
- Provide accessible responsive layout and clear empty/error/offline states.

### Operations/admin (P0)

- Role-based login for staff; passenger browsing should not require an account.
- Create/edit/deactivate stops, route patterns, ordered stop sequences, vehicles, schedules, and fare rules.
- Assign a vehicle to a trip and record actual status (scheduled, running, completed, cancelled, delayed, breakdown).
- Create/resolve incidents and service alerts.
- View active trips, last GPS report, freshness, and data-quality warnings.
- Audit important edits with actor, timestamp, and before/after values.

### Later (P1/P2)

- Ticket purchase, QR validation, pass wallet, refunds, and payment reconciliation after selecting a payment provider and confirming official policies.
- Push notifications / saved routes, passenger crowding reports with moderation, multilingual content management.
- GTFS/GTFS-Realtime import/export or other official feed integration, if provided and authorized.
- Multi-transfer routing, accessibility-aware routing, operational forecasting, and service planning.

## 8. Proposed technology architecture

- **Frontend:** React + TypeScript, Vite, React Router, TanStack Query, a tested component system (e.g. MUI or shadcn/ui with accessible primitives), and MapLibre GL or Leaflet with an appropriate Ahmedabad map/tile provider. Pick one UI system and one map library; show map attribution and comply with tile-provider usage limits.
- **Backend:** Python 3, Django + Django REST Framework for the data-heavy admin/API, or FastAPI if the team prefers explicit async APIs. For a student project with admin CRUD, Django + DRF is a strong default. Keep API contracts documented with OpenAPI.
- **Database:** PostgreSQL with PostGIS for stop and vehicle coordinates. Use Django migrations (or Alembic for FastAPI) as the schema source of truth.
- **Live updates:** Start with REST polling every 10–20 seconds and clear freshness labels if the authorized feed supports this cadence. A marker moves only when a new position arrives; interpolate only between fresh points. Add WebSockets/SSE only when there is a real update source and the MVP works.
- **Background jobs/cache:** Add Redis + Celery only when scheduled imports, notifications, or ETA work requires them.
- **Deployment:** Docker Compose for local development (frontend, API, PostgreSQL, optional Redis); managed PostgreSQL and an application host for a demo. Keep secrets in environment configuration, never committed.
- **Observability:** Structured logs, request IDs, error reporting, health checks, database backups, and a GPS ingestion lag metric.

## 9. Database design (PostgreSQL)

Use UUID primary keys for externally referenced entities (or bigint internally with UUID public IDs). Include `created_at`, `updated_at`, and where relevant `is_active`. Use `timestamptz` in UTC for instants; store service times as local time with an explicit service timezone (`Asia/Kolkata`) and service date. Money is integer paise or `numeric(10,2)` with currency code, never floating point.

### Reference and network tables

| Table | Key fields and constraints |
|---|---|
| `stops` | `id`, `public_code` unique nullable, `name`, `name_gu`, `description`, `location geography(Point,4326)`, `is_accessible`, `is_active`. A stop is a physical place, independent of routes. |
| `routes` | `id`, `code` (e.g. `31`), `display_name`, `operator`, `is_active`; route code may repeat across agencies only if scoped by operator. |
| `route_patterns` | `id`, `route_id`, `direction_name`, `origin_stop_id`, `destination_stop_id`, `variant_code`, `shape geometry(LineString,4326)`, `is_active`; unique route + variant/direction as appropriate. |
| `route_pattern_stops` | `id`, `pattern_id`, `stop_id`, `stop_sequence` positive and unique per pattern, `distance_from_start_m`, `shape_distance_m` optional. This permits the same stop on many routes and patterns. |
| `service_calendars` | `id`, `start_date`, `end_date`, weekday flags, `calendar_name`, `timezone`; date exceptions in `service_calendar_exceptions`. |
| `scheduled_trips` | `id`, `pattern_id`, `service_calendar_id`, `trip_code`, `start_time`, `end_time`, `service_date` only for dated overrides, `headsign`, `is_active`. Recurring schedules and exceptions must be represented explicitly. |
| `scheduled_stop_times` | `trip_id`, `pattern_stop_id`, `arrival_offset_seconds`, `departure_offset_seconds`, `stop_sequence`; unique trip + sequence; allows accurate stop-level schedule and trips crossing midnight. |

### Fleet, operations, and live data

| Table | Key fields and constraints |
|---|---|
| `vehicle_types` | `id`, `name` (diesel, electric, etc.), `fuel_type`, `has_ac`, `seated_capacity`, `standing_capacity`, `accessibility_features` JSONB or normalized features. Avoid encoding “normal” as petrol without confirmation. |
| `vehicles` | `id`, `fleet_number` unique, `registration_number` unique, `vehicle_type_id`, `capacity_override` nullable, `operational_status`, `device_id` nullable unique, `in_service_from/to`. Vehicle is independent of route. |
| `trips` | `id`, `scheduled_trip_id` nullable, `pattern_id`, `vehicle_id` nullable, `service_date`, `actual_start_at`, `actual_end_at`, `status`, `dispatch_reference`; one physical run. |
| `vehicle_positions` | `id`, `vehicle_id`, `trip_id` nullable, `recorded_at`, `received_at`, `location geography(Point,4326)`, `speed_mps`, `heading_degrees`, `source`, `quality_status`; index vehicle + recorded time and geospatial index. Retention/partition by date as volume grows. |
| `stop_time_events` | `id`, `trip_id`, `pattern_stop_id`, `event_type` (arrival/departure), `observed_at`, `source`, `confidence`; actual times are not overwritten into schedule rows. |
| `service_incidents` | `id`, `title`, `description`, `severity`, `status`, `starts_at`, `ends_at`, `created_by`; affected patterns/stops/trips through join tables. |
| `incident_affected_patterns`, `incident_affected_stops`, `incident_affected_trips` | Composite unique foreign keys; identify exactly what an incident affects. |
| `crowding_reports` | `id`, `trip_id`, `vehicle_id`, `level` (low/medium/high/unknown), `source`, `reported_at`, `confidence`, `moderation_status`; avoid storing reporter identity unless needed. |

### Fares, passengers, and administration

| Table | Key fields and constraints |
|---|---|
| `fare_products` | `id`, `code`, `name`, `product_type` (single, day pass, concession), `currency`, `price_minor_units`, `valid_from`, `valid_to`, `eligibility_policy_id` nullable, `is_active`. |
| `fare_rules` | `id`, `product_id`, `origin_zone_id`/`destination_zone_id` or distance/stop-count band, `amount_minor_units`, `valid_from/to`, priority. Resolve ambiguity and overlapping effective rules with validation. |
| `fare_quotes` | Optional short-lived quote: origin/destination, product, amount, rule version, quoted_at, expires_at. Do not treat quote as a booking. |
| `users` | Staff/passenger identity only if needed; unique normalized login identifier, password hash managed by framework, `is_active`. Prefer a separate staff role model or RBAC. |
| `roles`, `user_roles` | Roles such as administrator, dispatcher, analyst; least privilege. |
| `bookings` | `id`, opaque booking reference, `user_id` nullable for guest if policy permits, status, amount, currency, idempotency key unique, created_at. |
| `booking_legs` | `booking_id`, `trip_id` nullable, route/pattern, origin/destination stop, travel date, fare amount snapshot. Multiple legs allow transfer itineraries. |
| `tickets` | `id`, `booking_id`, `fare_product_id`, fare rule/name/amount snapshot, valid_from/to, token hash/QR payload reference, status; never expose sequential DB IDs in QR codes. |
| `payments` | `id`, `booking_id`, provider, provider_reference unique, amount, status, idempotency key, timestamps; no card data. Include refund records if needed. |
| `audit_log` | `id`, actor user, action, entity type/id, timestamp, request id, redacted before/after JSONB. Do not log secrets or sensitive payment data. |

### Data relationships at a glance

```text
route 1---many route_patterns 1---many route_pattern_stops many---1 stops
route_pattern 1---many scheduled_trips 1---many scheduled_stop_times
vehicle 1---many trips 1---many vehicle_positions
trip 1---many stop_time_events / crowding_reports
fare_product 1---many fare_rules; booking 1---many booking_legs / tickets / payments
service_incidents many---many route_patterns, stops, and trips
```

### Essential integrity and indexing

- Foreign keys on all relationships; restrict deletion of referenced operational records. Prefer deactivation/archival over hard deletion.
- Unique `(pattern_id, stop_sequence)`, `(trip_id, stop_sequence)`, vehicle fleet number, and registration number.
- Check latitude/longitude bounds, non-negative capacities/distances/fare amounts, valid time ranges, and enumerated statuses.
- Index route code, normalized stop name, pattern stop `(stop_id, pattern_id)`, trip service date/status, position `(vehicle_id, recorded_at DESC)`, and PostGIS location.
- Use transactions for booking/payment state changes; enforce idempotency and prevent duplicate tickets on webhook retries.
- Store the fare policy/version on a quote and ticket so historical purchases remain explainable.

## 10. API outline

Version APIs under `/api/v1` and document them with OpenAPI.

- `GET /routes?query=31`, `GET /routes/{id}/patterns`
- `GET /stops?query=...`, `GET /stops/nearby?lat=...&lon=...`
- `GET /patterns/{id}` (ordered stops and shape)
- `GET /journeys?from_stop_id=...&to_stop_id=...&depart_at=...` (direct + limited transfers)
- `GET /patterns/{id}/vehicles` (trip status, latest position, freshness, ETA when available)
- `GET /stops/{id}/departures`
- `GET /fares/quote?from_stop_id=...&to_stop_id=...&travel_at=...`
- `GET /service-alerts?pattern_id=...`
- Staff-only CRUD endpoints for reference data, dispatch, incidents, and analytics.
- `POST /tickets` only after authentication/policy/payment decisions; webhook endpoint verifies provider signatures.

Return consistent error codes, pagination, validation messages, and a request ID. Public read endpoints should be rate-limited and return only data needed by the passenger UI.

## 11. ETA, routing, and fare logic

- **Route search:** Identify route patterns and direction explicitly; never infer direction from route code alone.
- **Stop order:** A direct journey is valid only when destination sequence is after origin sequence on the same pattern.
- **Transfers:** Build a stop-to-stop graph from service patterns. Begin with direct and one-transfer search. Rank by estimated total time, transfer count, walking, and reliability, and explain the ranking.
- **ETA:** Prefer fresh GPS map-matched to the pattern plus recent observed segment travel time. Otherwise use schedule. Include confidence/freshness and never display a false precision (e.g. use a range or rounded minutes when uncertain).
- **Delay:** Compare observed or estimated arrival with scheduled stop time, accounting for service date and midnight rollover. Mark unknown when evidence is stale or absent.
- **Fare:** Centralize in versioned fare rules. Do not derive ticket price from examples or user gender/age unless verified policy says eligibility depends on it. Ask only for the minimum eligibility proof needed and avoid retaining sensitive attributes.
- **Rounds:** Compute from trip completion events per vehicle/day; a half-round is simply one completed one-way trip in the operational sequence, not a special decimal field.

## 12. UX, visual quality, and accessibility

- Design for mobile first, since passengers may search while walking or waiting.
- Home screen: prominent “From” and “To” search, route search, nearby stops (opt-in), and active alerts.
- Results: readable cards with total duration, transfers, fare, reliability/freshness, and expandable leg details.
- Map and list are paired; never make the map the only way to understand a route.
- The Ahmedabad map shows the selected AMTS route in a high-contrast line, stops in travel order, and moving markers only for buses with fresh GPS. Do not show BRTS or metro as AMTS unless those modes are deliberately included and clearly distinguished.
- Selecting a bus marker shows route code/direction, next stop, ETA if available, status, and GPS update time; keep the map and bus list selection synchronized.
- Use a small, consistent design system, clear typography, strong contrast, large touch targets, and distinct colors plus text/icon for statuses.
- Include loading skeletons, no-result guidance, GPS stale/offline state, retry controls, and “report an issue” feedback.
- Meet WCAG 2.2 AA as a target: keyboard support, focus visibility, semantic headings, form labels, reduced motion, and screen-reader announcements for live updates.
- Support Gujarati and English from the data model onward. Test transliteration, long stop names, and mixed-language search.
- Use real route/stop data only with permission. Map tiles and geocoding have provider terms, cost, and attribution requirements; choose deliberately.

## 13. Security, privacy, and reliability

- HTTPS in deployment, secure password hashing, session/token rotation, CSRF protections where applicable, CORS allowlist, input validation, rate limits, and staff MFA if available.
- Role-check every staff endpoint; record administrative changes.
- Do not expose exact vehicle device credentials, private passenger data, or payment details.
- Location data may reveal operational patterns. Limit access, retention, and precision according to a documented policy.
- Minimize passenger account data; support guest journey planning.
- Backups and restore procedure for PostgreSQL; migrations reviewed and reversible where practical.
- Health endpoints, error monitoring, graceful read-only behavior if GPS ingestion is down, and clear data freshness metrics.
- Define retention for GPS history, bookings, audit records, and analytics before production use.

## 14. Success measures

- Passenger can find a route and understand direction without help in a usability walkthrough.
- Journey results have valid stop order and no impossible transfers in a curated test set.
- Percentage of active vehicles with a position newer than the agreed freshness threshold (report the threshold and coverage).
- ETA error measured against observed arrivals, segmented by route/time/data source.
- Route search success rate, journey result latency, API error rate, and accessibility defects.
- Admin completeness: trips with assigned vehicle, incident response time, and schedule adherence coverage.
- For tickets, payment success/failure/refund reconciliation and duplicate-charge rate (target zero).

## 15. Delivery plan: build in small, reviewable milestones

### Phase 0 — Validate and scope

1. Confirm the assignment requirements and what “live” means for the demo.
2. Identify data sources and permissions. Gather a small set of stops, route directions, stop order, schedules, and fare rules. Mark unknowns; do not invent authoritative data.
3. Write sample user journeys and acceptance criteria. Decide Django REST Framework vs FastAPI, map provider, and whether any ticketing is real or demonstrative.

### Phase 1 — Project foundation

1. Create a Git repository and `README.md`, `PRD.md`, `.env.example`, and clear contribution notes.
2. Set up a React + TypeScript frontend, Python API, PostgreSQL/PostGIS, and Docker Compose for local use.
3. Establish formatting/linting, migrations, API schema, environment separation, and a small seed-data command.
4. Add health checks and a first vertical slice: search stops from the database and display results in the UI.

### Phase 2 — Network and route discovery

1. Implement stops, routes, patterns, ordered pattern stops, and schedule tables.
2. Build staff CRUD or an import workflow with validation and audit history.
3. Build route code/direction and stop search pages, map/list route visualization, and accessible empty/error states.

### Phase 3 — Journey planning and fare quotes

1. Implement direct journeys using stop order and scheduled stop times.
2. Add fare rules/quotes with validity dates and visible explanations.
3. Add one-transfer suggestions with wait and walking cost; test with hand-built scenarios.

### Phase 4 — Vehicle operations and live view

1. Model trips and vehicle assignments, statuses, GPS observations, and stop-time events.
2. Build a simulator for local development that sends clearly labeled fake GPS data; never confuse simulator data with actual service.
3. Show freshness, scheduled fallback, delay estimate, and incidents. Add live polling only after the end-to-end flow works.
4. Connect a real feed only with authorization and a data contract.

### Phase 5 — Tickets (optional after core portal)

1. Confirm actual fare, pass, refund, identity, and ticket-validation policy.
2. Add booking and payment provider sandbox, webhook verification, idempotency, ticket QR, and admin reconciliation.
3. Clearly label sandbox purchases and obtain a security review before real payments.

### Phase 6 — Analytics, polish, and launch

1. Add coverage-aware dashboards and CSV export for authorized staff.
2. Test accessibility, mobile layouts, multilingual search, data validation, API permissions, and GPS outage handling.
3. Deploy a staging environment, verify backups/logging/secrets, then demo with a known data set and disclose limitations.

### Required phase gate for every milestone

Antigravity must work on **one phase at a time**. At the end of each phase it must stop and report: (1) what changed, (2) files added/changed, (3) setup or migration commands, (4) verification commands and their actual results, (5) screenshots or browser observations for UI work, (6) known issues and assumptions, and (7) the exact next phase. Do not silently continue into the next phase. The human reviews the report and working app, then explicitly asks Antigravity to continue. If a check fails, fix that phase and repeat its checks before moving on.

Do not claim a phase is verified unless commands were actually run and succeeded. If a check cannot be run because a dependency, credential, live feed, or data source is missing, state the blocker and give a precise manual verification path. Keep the local app runnable at every phase after the foundation is in place.

### From-zero phase checklist and acceptance gates

| Phase | Antigravity deliverables | Required verification before continuing |
|---|---|---|
| 0. Inspect and plan | Inspect current folder; preserve this PRD and original story; propose repository tree, dependencies, phases, data assumptions, and install steps. No code edits. | User reviews plan and confirms chosen stack/map/data approach. |
| 1. Bootstrap | Initialize Git if absent; document setup; create React + TypeScript frontend, Django + DRF backend, PostgreSQL/PostGIS local setup with Docker Compose, `.env.example`, health endpoint, and basic CI/check commands. | Fresh setup instructions are followed; frontend loads, API health endpoint works, DB connects; no secrets committed. |
| 2. Data foundation | Define models/migrations for agency, stops, routes, route patterns/directions, ordered pattern stops, service calendars, trips, stop times; GTFS ZIP import and validation report; clearly labelled sample data only as fallback. | Import source-documented feed; report row counts, invalid references, duplicate IDs, coordinates, timezone/date range. Migration applies on empty DB and can be recreated from docs. |
| 3. Passenger route discovery | Stop/route search API and responsive React pages; route direction, stop sequence, schedule view; list-first accessibility and Ahmedabad map view with actual route geometry. | Search known stops/routes; compare sample records to source; verify direction/order, map attribution, mobile layout, keyboard and empty/error states. |
| 4. Journey planner | Direct journey search by stop and departure time; schedule-aware results; sourced fare quote only; one-transfer itinerary with wait and transfer. | Check direct, reverse direction, no service, transfer, midnight, calendar exception, and invalid-stop scenarios. No impossible transfer or wrong-direction trip. |
| 5. Operations/admin | Staff roles; admin CRUD/import review for routes/stops/schedules, vehicles, trips, incidents; audit log and permission boundaries. | Verify permitted staff changes; public user cannot call admin endpoints; changes appear in passenger views; audit entries identify actor/change. |
| 6. GPS simulator and map animation | Local simulator moves a demo vehicle along a route with timestamped positions; marker follows the route; persistent “Simulated bus location” label and stale state. | Start/stop simulator; observe marker updates; freeze feed and confirm marker stops/becomes stale; invalid/out-of-order points are rejected or flagged. Never call this production live tracking. |
| 7. Authorized live feed (conditional) | Adapter for documented AMTS/AVL or licensed GTFS-Realtime API; credentials outside source control; freshness, validation, alerting, and timetable fallback. If access is missing, record blocker and keep demo mode. | Confirm authorization/schema; compare a feed message to UI; test outage, stale vehicle, duplicate point, and recovery. No private endpoint/key in browser. |
| 8. Ticketing (optional/conditional) | After policy approval only: fares, booking state, payment sandbox, verified callbacks, idempotency, QR/token ticket, reconciliation. | Sandbox purchase, retries/webhook duplicate, failure/refund, ticket validation, and no sensitive card storage. No real charges without operational approval. |
| 9. Analytics, security, release | Coverage-aware dashboards; logs/monitoring, backups/restore, privacy/retention, accessibility and performance review; staging deployment/runbook. | Restore backup in staging; run API/UI/security checks; verify map/API licenses and attribution, secrets, role access, and data limitations. Production release is an explicit operator action. |

Phase dependencies matter: do not build live tracking before route/trip identity is stable; do not build payment before fare policy is confirmed; do not claim accuracy from unvalidated timetables.

## 16. Working with Google Antigravity

Antigravity is an agentic development environment; treat its agents as assistants that produce changes for review. Its official getting-started guide describes creating/opening a project and starting agent sessions from the project context ([Google Antigravity getting started](https://www.antigravity.google/docs/getting-started?tab=ide)).

1. Open the `AMTS_Portal` folder as the Antigravity project/workspace. Save the work in Git and keep `PRD.md` and the original `AMTS_Portal.txt` in context. Antigravity's official guide covers opening a project and starting an agent session ([getting started](https://www.antigravity.google/docs/getting-started?tab=ide)).
2. Paste the Phase 0 prompt below. It must inspect and plan without edits. Answer setup questions before implementation.
3. Start each phase by referring to its row in section 15. Give Antigravity only one phase's work. Ask it to stop at the end and provide the phase-gate report; do not ask it to “build everything” in one prompt.
4. Review the changes and run the verification steps it provides. For UI work, open the local app and inspect the reported screens. Do not continue until acceptance checks pass or a blocker is documented.
5. If verification fails, provide the error and ask Antigravity to fix only that phase, then rerun the checks. Keep each milestone small enough to understand and roll back.
6. Keep secrets out of prompts and repository files. Use `.env.example` placeholders and least-privilege access. Never share production database credentials or GPS device keys with an agent.
7. Use browser/preview capabilities for responsive UI review. Update this PRD when an approved design or data decision changes.

### Phase 0 prompt — paste this first

> Read `PRD.md` and `AMTS_Portal.txt`, and inspect the existing repository. This is a from-zero, multi-phase full-stack project. Do not create, edit, delete, install, or deploy anything in this phase. Explain the full roadmap in beginner-friendly terms, propose the repository structure and local setup for React + TypeScript, Python Django REST Framework, PostgreSQL/PostGIS, and Docker Compose, identify decisions I must make, and list Phase 1 deliverables and exact verification steps. For real-world data, distinguish first-party AMTS data, community GTFS, licensed map tiles, and live GPS; do not assume public access grants reuse permission. Do not invent official AMTS routes, fares, schedules, or GPS data. Stop after the plan and wait for my instruction.

After approving the plan, tell Antigravity: “Implement Phase 1 only, following section 15 of `PRD.md`. Do not start Phase 2. Keep the app runnable. At completion, stop and provide the required phase-gate report and actual verification results. Wait for my review.” Continue in this style for each phase. Phase 1 establishes the local foundation; the first passenger-facing slice is in Phase 3 and must use source-documented data.

For the map/live slice, use a clearly labelled local simulator first: load a sample Ahmedabad route shape and make a simulated bus move along its ordered stops. Keep a persistent “Demo GPS” label. Replace the simulator with an AMTS-authorized feed before calling it real-time. Never imply that a particular bus is currently operating based on invented data.

## 17. Relationship to the original AMTS_Portal.txt story

The PRD retains the original requirements, while assigning each concept to the correct entity so the database and screens behave reliably.

| Original story item | Where it is covered / clarified |
|---|---|
| Many buses; normal/petrol, EV, EV with AC; different seat counts | `vehicle_types` and `vehicles`; fuel, AC, and seated/standing capacity are configurable attributes. |
| Different number plates and several buses on route number 31, e.g. 31-X/31-M | Unique vehicle registration and fleet number are separate from public route code `31`. Suffix examples are fleet labels only if AMTS uses them. |
| Route 31 Meghaninagar ↔ Sarkhej | `routes` plus two `route_patterns`, one per direction; stops are ordered in each pattern. |
| Stops and approximate distances | `route_pattern_stops.distance_from_start_m`; there is no fixed 300–400m assumption. |
| Different departure times and route travel duration | `scheduled_trips` and `scheduled_stop_times`; each direction may have different timing. |
| Multiple rounds / half rounds | Each one-way operation is a `trip`; round counts derive from completed trips rather than a decimal field. |
| Several buses at different stops at the same time | Many active trips and timestamped `vehicle_positions`, shown on the selected direction's Ahmedabad map. |
| Stop names reverse as a bus travels back | Shared physical `stops`; pattern origin/destination and stop sequence change by direction. |
| ₹5–₹25 fares and male/female “golden ticket” examples | Effective-dated `fare_products` and `fare_rules`; example prices and eligibility are unverified and not hard-coded. |
| Bus GPS tracker | `vehicle_positions`, optional device records, ingestion, freshness and quality checks, and map movement; real tracking needs authorized GPS data. |
| Search route and show only buses in selected direction | Direction-specific pattern search and active trip results. |
| Current stop to destination; direct and transfer buses | Journey planner supports direct and limited transfer options with leg details. |
| Ticket by date/time, stops, gender, age, fare | Date/time and stops as appropriate; gender/age only if verified fare eligibility rules require them. Booking is optional and requires approved ticketing/payment policy. |
| Bus details, ETA, trip time, crowding, breakdown | Vehicle/trip, position, schedule, incident, and crowding data; crowding remains unknown without a defined source. |
| Delay/advance/on-time | Compare actual/estimated stop events with schedule; include confidence and show unknown when data is stale. |
| Admin route coverage, crowding, peak times, bookings, dashboard | Coverage-aware admin dashboard and analytics requirements. |

## 18. Ahmedabad map, reference link, and real live tracking

The supplied [Moovit Ahmedabad lines reference](https://moovitapp.com/tripplan/ahmedabad-4504/lines/en?ref=4&customerId=4908) is useful as a product reference for presenting transit lines. The page was not accessible to the browsing tool during this update. Do not scrape, bulk-copy, or create a route database from Moovit's web app. Its terms restrict copying and extracting content; use data only through an appropriately licensed API agreement if that approach is selected ([Moovit WebApp and Widget Terms](https://moovit.com/legal/webappterms/), [Moovit API documentation](https://api-docs.moovit.com/)).

For a real Ahmedabad deployment, obtain AMTS/municipal permission and a supported route/schedule/AVL feed or data export. The official AMTS app listing describes real-time tracking, and the Ahmedabad city portal has an AMTS route-tracking page. These indicate tracking exists in the local ecosystem, but do not grant this project API or reuse rights ([AMTS app listing](https://play.google.com/store/apps/details?id=ahmedabad.municipal.transport.service.smart.amts), [Ahmedabad AMTS route tracking](https://amdavadone.in/amts/route-tracking)). Contact the responsible agency/service provider to confirm developer access and terms.

### Practical route, stop, timetable, fare, and GPS data plan

1. **Start with first-party AMTS publications.** Check the AMTS [timetable page](https://www.amts.co.in/time-table/) and [bus timings PDF](https://www.amts.co.in/media/1154/amts-bus-timings.pdf). Record publication date, route/direction coverage, service-day notes, stop names, and ask AMTS about update frequency and reuse permission. A public page does not automatically grant bulk reuse rights.
2. **Use GTFS where available.** GTFS separates agency, stops, routes, trips, stop times, calendars, shapes, and fares; preserve its identifiers and validate service dates against the current timetable ([GTFS Schedule reference](https://gtfs.org/documentation/schedule/reference/)).
3. **Treat the community GTFS as a candidate, not an official guarantee.** [`croyla/amd-gtfs`](https://github.com/croyla/amd-gtfs) says it builds GTFS from AMTS/AJL websites; [MobilityDatabase lists a community Ahmedabad feed](https://mobilitydatabase.org/feeds/gtfs/mdb-3131) with validation information and a service date range. Before use, inspect its license, sources, agency coverage (AMTS vs BRTS/AJL and other agencies), validation report, service dates, and attribution requirements. Verify representative records against current AMTS publications and get reuse confirmation before production. Exclude other agencies from an AMTS-only product unless deliberately included and clearly separated.
4. **Keep a source register.** For every imported dataset record source name/URL, file hash, retrieval date, service date range, permission/license, agency scope, importer version, validation status, and reviewer. Keep raw files only if the license permits; never commit secrets.
5. **Validate then import.** Choose routes and directions across the city. Check route code, termini, ordered stops, coordinates, weekdays/holidays, first/last trip, stop times, and fares against an AMTS publication or confirmation. Record conflicts and selected source rather than silently overwriting. Then check row counts and referential integrity for the full feed.
6. **GPS is separate from schedules.** Static route data does not provide changing positions for each physical bus. Ask AMTS/provider for an authorized AVL/GPS or GTFS-Realtime endpoint, docs, credentials, permitted polling rate, vehicle IDs, timestamp semantics, coverage, and reuse terms. The official app having live tracking does not imply a public developer API. If access is unavailable, use a timetable/map product with clearly labelled demo GPS; do not scrape the app or Moovit.
7. **Verify fares independently.** Ask AMTS for current fare stages, passes, discounts/eligibility, transfer rules, validity, and refunds. Preserve effective dates and evidence. Do not infer prices from story examples or community data.
8. **Map tiles are separate from transit data.** Use MapLibre/Leaflet with an appropriate licensed tile provider (a compliant OpenStreetMap tile service or commercial provider). Transit routes/stops overlay on the map; background map tiles do not provide AMTS schedules or live locations. Respect attribution, usage limits, privacy, and API-key restrictions.

The app/admin must distinguish data source status as `official/authorized`, `community reference`, `manually verified`, or `demo`, and show effective/verification dates where relevant.

### Moving marker behavior

1. The backend receives timestamped vehicle locations and associates them with an active trip/pattern when possible.
2. Validate timestamps, coordinates, speed, and route proximity; reject duplicates/out-of-order points and flag suspect jumps.
3. The frontend animates between consecutive fresh points for a short bounded interval. Follow the route line only when map matching is reliable; otherwise show the observed position and uncertainty.
4. Show “Updated just now / X min ago”, next stop/ETA if available, and trip status. When stale, stop animation and label the location stale. On feed outage, fall back to timetable information.
5. A local simulator can demonstrate motion, but must say “Simulated bus location”. An animated marker alone is not live tracking.

## 19. Decisions to confirm before production claims

- What official route/stop/schedule/fare data can be used, and under what terms?
- Is any authorized live GPS or real-time feed available? What fields, update cadence, and SLA does it provide?
- What does “online ticket” mean for the project: fare display, simulated booking, or an authorized real ticket?
- Are the example fare values, day pass (“golden ticket”), and eligibility policies correct and current?
- What are the service calendar, holiday, short-turn, cancellation, and disruption rules?
- What crowding source exists, and how will its accuracy and freshness be shown?
- What is the expected user, deployment scale, language set, and data retention period?

## 20. Glossary

- **Pattern:** One direction/variant of a route, including a fixed ordered stop sequence.
- **Trip:** A single scheduled or actual one-way vehicle run.
- **Service date:** Local operating date associated with a trip, even if it runs past midnight.
- **Freshness:** Time since a live source last reported usable information.
- **Headway:** Planned time between successive trips on a route pattern.
- **GTFS:** A common format for static transit schedules; GTFS-Realtime carries updates where an operator publishes it.
- **Golden ticket:** User's informal name for an all-day pass in this story; use the official product name and policy if verified.

