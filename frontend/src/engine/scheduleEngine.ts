import { ActiveBus, Stop } from '../types';
import { getBearingDegrees } from './simulationEngine';

export interface RouteScheduleConfig {
  upStops: Stop[];
  downStops: Stop[];
  routeCode: string;
  upPatternId: string;
  downPatternId: string;
  upDirectionName: string;
  downDirectionName: string;
}

// User Requirements:
// 1. "10 second use for stop each stand."
const STOP_DWELL_SECONDS = 10;

// 2. Travel time between stands along the corridor
const SEGMENT_TRAVEL_SECONDS = 60;
const TOTAL_STOP_BLOCK = SEGMENT_TRAVEL_SECONDS + STOP_DWELL_SECONDS; // 70 seconds per stop cycle

// 3. "use turnaround time 30 minutes, when bus reach stop... when bus reach end then show that bus in opposite site with turnaroud time 30 minutes"
const TERMINAL_DWELL_SECONDS = 30 * 60; // 1800 seconds (30 minutes)

// 4. "show 1 minute when ready to go."
const READY_TO_DEPART_WINDOW = 60; // 60 seconds (1 minute)

/**
 * Calculates current seconds past midnight in Indian Standard Time (IST)
 */
export function getCurrentISTSeconds(): number {
  const now = new Date();
  const istStr = now.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const [h, m, s] = istStr.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

/**
 * Formats seconds into MMm SSs or HH:MM:SS
 */
export function formatTimeFromSeconds(totalSecs: number): string {
  const s = ((Math.floor(totalSecs) % 86400) + 86400) % 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export function formatMinutesSeconds(totalSecs: number): string {
  const safeSecs = Math.max(0, Math.floor(totalSecs));
  const m = Math.floor(safeSecs / 60);
  const s = Math.floor(safeSecs % 60);
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return `${mm}M ${ss}S`;
}

/**
 * Evaluates the exact real-world scheduled location and state of a bus for a given timestamp.
 */
export function getBusScheduledState(
  busIndex: number,
  totalBusesForRoute: number,
  baseBus: ActiveBus,
  config: RouteScheduleConfig,
  currentSeconds: number
): { bus: ActiveBus; currentDirectionId: number } {
  const { upStops, downStops, upPatternId, downPatternId } = config;

  const upStopCount = upStops.length || 1;
  const downStopCount = downStops.length || 1;

  const upTripDuration = Math.max(1, (upStopCount - 1) * TOTAL_STOP_BLOCK);
  const downTripDuration = Math.max(1, (downStopCount - 1) * TOTAL_STOP_BLOCK);

  // Total round-trip cycle time: UP trip + 30m terminal turnaround + DOWN trip + 30m origin turnaround
  const totalCycleDuration = upTripDuration + TERMINAL_DWELL_SECONDS + downTripDuration + TERMINAL_DWELL_SECONDS;

  // Stagger buses evenly along the cycle
  const busOffset = Math.round((busIndex / Math.max(1, totalBusesForRoute)) * totalCycleDuration);

  // Service operating start: 05:30 AM (19,800s)
  const serviceStart = 19800;
  let elapsed = currentSeconds - serviceStart;
  if (elapsed < 0) {
    elapsed += 86400;
  }

  const cycleTime = (elapsed + busOffset) % totalCycleDuration;
  const updated: ActiveBus = { ...baseBus };

  // Calculate rounds completed today based on elapsed hours
  const hoursRunning = Math.max(1, elapsed / 3600);
  updated.rounds_completed_today = Math.round((hoursRunning * 0.5 + (busIndex * 0.5)) * 10) / 10;

  // -------------------------------------------------------------
  // PHASE 1: Running on UP direction (e.g. Meghaninagar -> Sarkhej Gam)
  // -------------------------------------------------------------
  if (cycleTime < upTripDuration) {
    const stopIndex = Math.min(Math.floor(cycleTime / TOTAL_STOP_BLOCK), upStopCount - 1);
    const timeInBlock = cycleTime % TOTAL_STOP_BLOCK;

    updated.assigned_direction_id = 0;
    updated.assigned_pattern_id = upPatternId;
    updated.current_stop_index = stopIndex;

    const curStop = upStops[stopIndex];
    const nextStop = upStops[Math.min(stopIndex + 1, upStopCount - 1)];

    if (timeInBlock < STOP_DWELL_SECONDS) {
      // 10 second dwell for each stand -> RED
      // User rule: "10 second use for stop each stand... until show bus in red at stop."
      const remainingDwell = Math.ceil(STOP_DWELL_SECONDS - timeInBlock);
      updated.lifecycle_status = 'STOPPED_AT_ORIGIN'; // RED
      updated.latitude = curStop.latitude;
      updated.longitude = curStop.longitude;
      updated.speed_kmh = 0;
      updated.progress_ratio = 0.0;
      updated.dwell_countdown_secs = remainingDwell;
      updated.next_stop_name = `Stopped at Stand #${stopIndex + 1}: ${curStop.name} (Departs in ${remainingDwell}s)`;
    } else {
      // Moving between stands -> GREEN
      // User rule: "which bus is moving show with green colour"
      const travelElapsed = timeInBlock - STOP_DWELL_SECONDS;
      const progress = Math.min(1.0, travelElapsed / SEGMENT_TRAVEL_SECONDS);

      updated.lifecycle_status = 'MOVING'; // GREEN
      updated.progress_ratio = progress;
      updated.latitude = curStop.latitude + (nextStop.latitude - curStop.latitude) * progress;
      updated.longitude = curStop.longitude + (nextStop.longitude - curStop.longitude) * progress;
      updated.speed_kmh = 26 + Math.floor((Math.sin(travelElapsed) + 1) * 4);
      updated.heading_degrees = getBearingDegrees(curStop.latitude, curStop.longitude, nextStop.latitude, nextStop.longitude);
      updated.dwell_countdown_secs = 0;
      updated.eta_next_stop_secs = Math.max(1, Math.ceil(SEGMENT_TRAVEL_SECONDS - travelElapsed));
      updated.next_stop_name = `Next Stand: ${nextStop.name} (ETA ${updated.eta_next_stop_secs}s)`;
    }

    return { bus: updated, currentDirectionId: 0 };
  }

  // -------------------------------------------------------------
  // PHASE 2: Reached UP End Stop -> SHOW IN OPPOSITE SITE WITH 30 MIN TURNAROUND!
  // User rule: "when bus reach end then show that bus in opposite site with turnaroud time 30 minutes, show 1 minute when ready to go."
  // -------------------------------------------------------------
  const upTerminalEnd = upTripDuration + TERMINAL_DWELL_SECONDS;
  if (cycleTime < upTerminalEnd) {
    const timeAtTerminal = cycleTime - upTripDuration;
    const remainingDwell = Math.ceil(TERMINAL_DWELL_SECONDS - timeAtTerminal);

    // KEY REQUIREMENT: Show that bus in OPPOSITE site (Direction 1 / DOWN) at stop 0!
    updated.assigned_direction_id = 1; // OPPOSITE SITE!
    updated.assigned_pattern_id = downPatternId;
    updated.current_stop_index = 0; // First stop of the opposite direction
    
    // Coordinates are at the terminal station (which is downStops[0] or upStops[last])
    const terminalStop = downStops[0] || upStops[upStopCount - 1];
    updated.latitude = terminalStop.latitude;
    updated.longitude = terminalStop.longitude;
    updated.speed_kmh = 0;
    updated.progress_ratio = 0.0;
    updated.dwell_countdown_secs = remainingDwell;

    // User rule: "show 1 minute when ready to go" (In last 60 seconds -> GREEN!)
    if (remainingDwell <= READY_TO_DEPART_WINDOW) {
      updated.lifecycle_status = 'READY_TO_DEPART'; // GREEN
      updated.next_stop_name = `Terminal (${terminalStop.name}) - READY TO GO on return trip (Departs in ${formatMinutesSeconds(remainingDwell)})`;
    } else {
      // For the rest of the 30 minutes -> RED
      updated.lifecycle_status = 'STOPPED_AT_TERMINAL'; // RED
      updated.next_stop_name = `Terminal (${terminalStop.name}) - 30M Turnaround Dwell (${formatMinutesSeconds(remainingDwell)} remaining)`;
    }

    return { bus: updated, currentDirectionId: 1 };
  }

  // -------------------------------------------------------------
  // PHASE 3: Running on DOWN direction (e.g. Sarkhej Gam -> Meghaninagar)
  // -------------------------------------------------------------
  const downTripEnd = upTerminalEnd + downTripDuration;
  if (cycleTime < downTripEnd) {
    const timeInDown = cycleTime - upTerminalEnd;
    const stopIndex = Math.min(Math.floor(timeInDown / TOTAL_STOP_BLOCK), downStopCount - 1);
    const timeInBlock = timeInDown % TOTAL_STOP_BLOCK;

    updated.assigned_direction_id = 1;
    updated.assigned_pattern_id = downPatternId;
    updated.current_stop_index = stopIndex;

    const curStop = downStops[stopIndex];
    const nextStop = downStops[Math.min(stopIndex + 1, downStopCount - 1)];

    if (timeInBlock < STOP_DWELL_SECONDS) {
      // 10 second dwell at each stand -> RED
      const remainingDwell = Math.ceil(STOP_DWELL_SECONDS - timeInBlock);
      updated.lifecycle_status = 'STOPPED_AT_ORIGIN'; // RED
      updated.latitude = curStop.latitude;
      updated.longitude = curStop.longitude;
      updated.speed_kmh = 0;
      updated.progress_ratio = 0.0;
      updated.dwell_countdown_secs = remainingDwell;
      updated.next_stop_name = `Stopped at Stand #${stopIndex + 1}: ${curStop.name} (Departs in ${remainingDwell}s)`;
    } else {
      // Moving between stands -> GREEN
      const travelElapsed = timeInBlock - STOP_DWELL_SECONDS;
      const progress = Math.min(1.0, travelElapsed / SEGMENT_TRAVEL_SECONDS);

      updated.lifecycle_status = 'MOVING'; // GREEN
      updated.progress_ratio = progress;
      updated.latitude = curStop.latitude + (nextStop.latitude - curStop.latitude) * progress;
      updated.longitude = curStop.longitude + (nextStop.longitude - curStop.longitude) * progress;
      updated.speed_kmh = 26 + Math.floor((Math.sin(travelElapsed) + 1) * 4);
      updated.heading_degrees = getBearingDegrees(curStop.latitude, curStop.longitude, nextStop.latitude, nextStop.longitude);
      updated.dwell_countdown_secs = 0;
      updated.eta_next_stop_secs = Math.max(1, Math.ceil(SEGMENT_TRAVEL_SECONDS - travelElapsed));
      updated.next_stop_name = `Next Stand: ${nextStop.name} (ETA ${updated.eta_next_stop_secs}s)`;
    }

    return { bus: updated, currentDirectionId: 1 };
  }

  // -------------------------------------------------------------
  // PHASE 4: Reached DOWN End Stop -> SHOW IN OPPOSITE SITE (UP) WITH 30 MIN TURNAROUND!
  // -------------------------------------------------------------
  const timeAtOrigin = cycleTime - downTripEnd;
  const remainingDwell = Math.ceil(TERMINAL_DWELL_SECONDS - timeAtOrigin);

  // KEY REQUIREMENT: Show that bus in OPPOSITE site (Direction 0 / UP) at stop 0!
  updated.assigned_direction_id = 0; // OPPOSITE SITE!
  updated.assigned_pattern_id = upPatternId;
  updated.current_stop_index = 0;

  const originTerminalStop = upStops[0] || downStops[downStopCount - 1];
  updated.latitude = originTerminalStop.latitude;
  updated.longitude = originTerminalStop.longitude;
  updated.speed_kmh = 0;
  updated.progress_ratio = 0.0;
  updated.dwell_countdown_secs = remainingDwell;

  // In last 1 minute (60 seconds) -> GREEN (Ready to Go)
  if (remainingDwell <= READY_TO_DEPART_WINDOW) {
    updated.lifecycle_status = 'READY_TO_DEPART'; // GREEN
    updated.next_stop_name = `Terminal (${originTerminalStop.name}) - READY TO GO on UP route (Departs in ${formatMinutesSeconds(remainingDwell)})`;
  } else {
    // For 29 minutes -> RED
    updated.lifecycle_status = 'STOPPED_AT_TERMINAL'; // RED
    updated.next_stop_name = `Terminal (${originTerminalStop.name}) - 30M Turnaround Dwell (${formatMinutesSeconds(remainingDwell)} remaining)`;
  }

  return { bus: updated, currentDirectionId: 0 };
}

export interface BusArrivalETA {
  status: 'AT_STAND_NOW' | 'APPROACHING' | 'AT_TURNAROUND' | 'DEPARTED' | 'ON_RETURN_TRIP';
  etaSecs: number;
  formattedEta: string;
  isAtStandNow: boolean;
  isAvailable: boolean;
  message: string;
}

/**
 * Calculates real-time arrival countdown in minutes & seconds to a target stop
 * strictly filtering out buses that have passed or are running on the opposite direction.
 */
export function calculateBusArrivalETA(
  bus: ActiveBus,
  targetPatternDirectionId: number,
  targetStopIndex: number
): BusArrivalETA {
  // 1. Bus is currently running on the opposite direction -> NOT AVAILABLE
  if (bus.assigned_direction_id !== targetPatternDirectionId) {
    return {
      status: 'ON_RETURN_TRIP',
      etaSecs: 99999,
      formattedEta: 'Opposite Route',
      isAtStandNow: false,
      isAvailable: false,
      message: 'Running in opposite direction',
    };
  }

  // 2. Bus is on the correct direction: check where it is relative to target stop
  if (bus.current_stop_index === targetStopIndex) {
    if (bus.lifecycle_status === 'STOPPED_AT_TERMINAL') {
      const dwell = bus.dwell_countdown_secs || 0;
      return {
        status: 'AT_TURNAROUND',
        etaSecs: dwell,
        formattedEta: formatMinutesSeconds(dwell),
        isAtStandNow: false,
        isAvailable: true,
        message: `At Terminal Turnaround (Departs in ${formatMinutesSeconds(dwell)})`,
      };
    } else if (bus.lifecycle_status === 'READY_TO_DEPART') {
      const dwell = bus.dwell_countdown_secs || 0;
      return {
        status: 'AT_STAND_NOW',
        etaSecs: dwell,
        formattedEta: 'READY TO GO',
        isAtStandNow: true,
        isAvailable: true,
        message: `At Stand Now (Departs in ${dwell}s)`,
      };
    } else if (bus.lifecycle_status !== 'MOVING') {
      const dwell = bus.dwell_countdown_secs || 10;
      return {
        status: 'AT_STAND_NOW',
        etaSecs: 0,
        formattedEta: 'AT STAND NOW',
        isAtStandNow: true,
        isAvailable: true,
        message: `At Stand Now (Departs in ${dwell}s)`,
      };
    } else {
      // Just left target stop -> Has passed!
      return {
        status: 'DEPARTED',
        etaSecs: 99999,
        formattedEta: 'Passed Stand',
        isAtStandNow: false,
        isAvailable: false,
        message: 'Departed from this stand',
      };
    }
  } else if (bus.current_stop_index > targetStopIndex) {
    // Already past target stop -> NOT AVAILABLE
    return {
      status: 'DEPARTED',
      etaSecs: 99999,
      formattedEta: 'Passed Stand',
      isAtStandNow: false,
      isAvailable: false,
      message: 'Already passed this stand',
    };
  } else {
    // bus.current_stop_index < targetStopIndex: Bus is BEFORE the target stop!
    // Check if bus is standing at terminal turnaround
    if (
      bus.lifecycle_status === 'STOPPED_AT_TERMINAL' ||
      bus.lifecycle_status === 'READY_TO_DEPART'
    ) {
      // User rule: "if bus is standing at turntaround time so calulate time in turnaround time+reaching(from stop) time ."
      const turnaroundDwell = bus.dwell_countdown_secs || 0;
      const travelToTarget = targetStopIndex * TOTAL_STOP_BLOCK;
      const totalArrivalSecs = Math.max(1, turnaroundDwell + travelToTarget);
      return {
        status: 'AT_TURNAROUND',
        etaSecs: totalArrivalSecs,
        formattedEta: formatMinutesSeconds(totalArrivalSecs),
        isAtStandNow: false,
        isAvailable: true,
        message: `At Turnaround Terminal (Starts in ${formatMinutesSeconds(turnaroundDwell)})`,
      };
    } else if (bus.lifecycle_status === 'MOVING') {
      // Bus is ongoing / moving between stands towards target stop
      const remainingStops = targetStopIndex - bus.current_stop_index;
      const etaSecs = Math.max(
        1,
        Math.round((remainingStops - 1) * TOTAL_STOP_BLOCK + (1 - (bus.progress_ratio || 0)) * SEGMENT_TRAVEL_SECONDS)
      );
      return {
        status: 'APPROACHING',
        etaSecs,
        formattedEta: formatMinutesSeconds(etaSecs),
        isAtStandNow: false,
        isAvailable: true,
        message: `${remainingStops} stand${remainingStops > 1 ? 's' : ''} away`,
      };
    } else {
      // Bus is stopped for dwell at an intermediate stand before target stop
      const remainingStops = targetStopIndex - bus.current_stop_index;
      const dwell = bus.dwell_countdown_secs || STOP_DWELL_SECONDS;
      const etaSecs = Math.max(
        1,
        Math.round((remainingStops - 1) * TOTAL_STOP_BLOCK + SEGMENT_TRAVEL_SECONDS + dwell)
      );
      return {
        status: 'APPROACHING',
        etaSecs,
        formattedEta: formatMinutesSeconds(etaSecs),
        isAtStandNow: false,
        isAvailable: true,
        message: `${remainingStops} stand${remainingStops > 1 ? 's' : ''} away`,
      };
    }
  }
}
