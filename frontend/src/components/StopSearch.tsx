import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MapPin,
  ArrowUpDown,
  Search,
  X,
  Bus,
  Clock,
  Sparkles,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Zap,
  Snowflake,
  ShieldCheck,
  Crown,
  ArrowRight,
  Repeat,
  Layers,
} from 'lucide-react';
import {
  Stop,
  RouteItem,
  RoutePatternDetail,
  ActiveBus,
  DirectJourneyOption,
  ConnectingJourneyOption,
  BookedTicket,
} from '../types';
import {
  getCurrentISTSeconds,
  calculateBusArrivalETA,
  getBusScheduledState,
  RouteScheduleConfig,
  BusArrivalETA,
} from '../engine/scheduleEngine';

interface StopSearchProps {
  routes: RouteItem[];
  onSelectBusOnMap: (
    route: RouteItem,
    patternId: string,
    bus: ActiveBus,
    fromStop: Stop,
    toStop: Stop,
    shapeCoords?: [number, number][]
  ) => void;
  onBookTicket: (
    bus: ActiveBus,
    pattern: RoutePatternDetail,
    fromStop: Stop,
    toStop: Stop
  ) => void;
  onSelectConnectingOnMap?: (
    connecting: ConnectingJourneyOption,
    fromStop: Stop,
    toStop: Stop
  ) => void;
  onBuyGoldenPass?: () => void;
  activeGoldenPasses: BookedTicket[];
}

// Helper to guarantee valid ID whether returned as id or stop_id from API
const normalizeStop = (s: any): Stop => {
  const validId = s.stop_id || s.id || '';
  return {
    ...s,
    stop_id: validId,
    id: validId,
  };
};

const getStopId = (s: Stop | null | undefined): string => {
  if (!s) return '';
  return s.stop_id || s.id || '';
};

export const StopSearch: React.FC<StopSearchProps> = ({
  routes,
  onSelectBusOnMap,
  onBookTicket,
  onSelectConnectingOnMap,
  onBuyGoldenPass,
  activeGoldenPasses,
}) => {
  // Input queries (Restored immediately from sessionStorage on reload)
  const [fromQuery, setFromQuery] = useState<string>(() => {
    try {
      return sessionStorage.getItem('amts_stop_from_query') || '';
    } catch {
      return '';
    }
  });
  const [toQuery, setToQuery] = useState<string>(() => {
    try {
      return sessionStorage.getItem('amts_stop_to_query') || '';
    } catch {
      return '';
    }
  });

  // Selected stop entities (Restored immediately from sessionStorage on reload)
  const [fromStop, setFromStop] = useState<Stop | null>(() => {
    try {
      const raw = sessionStorage.getItem('amts_stop_from_entity');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [toStop, setToStop] = useState<Stop | null>(() => {
    try {
      const raw = sessionStorage.getItem('amts_stop_to_entity');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Suggestions state
  const [fromSuggestions, setFromSuggestions] = useState<Stop[]>([]);
  const [toSuggestions, setToSuggestions] = useState<Stop[]>([]);
  const [isSearchingFrom, setIsSearchingFrom] = useState<boolean>(false);
  const [isSearchingTo, setIsSearchingTo] = useState<boolean>(false);
  const [showFromDropdown, setShowFromDropdown] = useState<boolean>(false);
  const [showToDropdown, setShowToDropdown] = useState<boolean>(false);

  // Journey API state (Restored from sessionStorage on reload)
  const [loadingJourneys, setLoadingJourneys] = useState<boolean>(false);
  const [journeyOptions, setJourneyOptions] = useState<DirectJourneyOption[]>(() => {
    try {
      const raw = sessionStorage.getItem('amts_stop_journeys');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [connectingJourneys, setConnectingJourneys] = useState<ConnectingJourneyOption[]>(() => {
    try {
      const raw = sessionStorage.getItem('amts_stop_connecting_journeys');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [isSameStop, setIsSameStop] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'direct' | 'connecting'>(() => {
    try {
      const saved = sessionStorage.getItem('amts_stop_active_tab');
      return saved === 'connecting' ? 'connecting' : 'direct';
    } catch {
      return 'direct';
    }
  });
  const [hasSearched, setHasSearched] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('amts_stop_has_searched') === 'true';
    } catch {
      return false;
    }
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Sorting (Restored from sessionStorage on reload)
  const [sortBy, setSortBy] = useState<'nearest' | 'fastest' | 'fare'>(() => {
    try {
      const saved = sessionStorage.getItem('amts_stop_sort_by');
      return saved === 'fastest' ? 'fastest' : saved === 'fare' ? 'fare' : 'nearest';
    } catch {
      return 'nearest';
    }
  });

  // Synchronize stop search state into sessionStorage so refreshing never removes details
  useEffect(() => {
    if (fromQuery) {
      sessionStorage.setItem('amts_stop_from_query', fromQuery);
    } else {
      sessionStorage.removeItem('amts_stop_from_query');
    }
  }, [fromQuery]);

  useEffect(() => {
    if (toQuery) {
      sessionStorage.setItem('amts_stop_to_query', toQuery);
    } else {
      sessionStorage.removeItem('amts_stop_to_query');
    }
  }, [toQuery]);

  useEffect(() => {
    if (fromStop) {
      sessionStorage.setItem('amts_stop_from_entity', JSON.stringify(fromStop));
    } else {
      sessionStorage.removeItem('amts_stop_from_entity');
    }
  }, [fromStop]);

  useEffect(() => {
    if (toStop) {
      sessionStorage.setItem('amts_stop_to_entity', JSON.stringify(toStop));
    } else {
      sessionStorage.removeItem('amts_stop_to_entity');
    }
  }, [toStop]);

  useEffect(() => {
    sessionStorage.setItem('amts_stop_sort_by', sortBy);
  }, [sortBy]);

  useEffect(() => {
    sessionStorage.setItem('amts_stop_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (journeyOptions && journeyOptions.length > 0) {
      sessionStorage.setItem('amts_stop_journeys', JSON.stringify(journeyOptions));
      sessionStorage.setItem('amts_stop_has_searched', 'true');
    } else if (hasSearched) {
      sessionStorage.setItem('amts_stop_has_searched', 'true');
    } else {
      sessionStorage.removeItem('amts_stop_journeys');
      sessionStorage.removeItem('amts_stop_has_searched');
    }
  }, [journeyOptions, hasSearched]);

  useEffect(() => {
    if (connectingJourneys && connectingJourneys.length > 0) {
      sessionStorage.setItem('amts_stop_connecting_journeys', JSON.stringify(connectingJourneys));
    } else {
      sessionStorage.removeItem('amts_stop_connecting_journeys');
    }
  }, [connectingJourneys]);

  // Second-by-second live clock for ETA ticking
  const [currentSeconds, setCurrentSeconds] = useState<number>(getCurrentISTSeconds());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSeconds(getCurrentISTSeconds());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Debounced search for From stop
  useEffect(() => {
    if (!fromQuery.trim() || (fromStop && fromStop.name === fromQuery)) {
      setFromSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingFrom(true);
      try {
        const res = await fetch(`/api/v1/stops/?query=${encodeURIComponent(fromQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          const list = (data.results || []).map(normalizeStop);
          setFromSuggestions(list);
          setShowFromDropdown(true);
        }
      } catch (e) {
        console.error('Failed to fetch from stop suggestions', e);
      } finally {
        setIsSearchingFrom(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [fromQuery, fromStop]);

  // Debounced search for To stop
  useEffect(() => {
    if (!toQuery.trim() || (toStop && toStop.name === toQuery)) {
      setToSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingTo(true);
      try {
        const res = await fetch(`/api/v1/stops/?query=${encodeURIComponent(toQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          const list = (data.results || []).map(normalizeStop);
          setToSuggestions(list);
          setShowToDropdown(true);
        }
      } catch (e) {
        console.error('Failed to fetch to stop suggestions', e);
      } finally {
        setIsSearchingTo(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [toQuery, toStop]);

  // Fetch direct and connecting journeys when both stops are chosen
  const fetchDirectJourneys = async (originId: string, destId: string) => {
    if (!originId || !destId) {
      console.warn('fetchDirectJourneys: missing stop IDs', { originId, destId });
      return;
    }

    // CASE 4: Same stand selected
    if (originId === destId) {
      setIsSameStop(true);
      setErrorMsg('Origin and Destination cannot be the same stand. Please select different stands.');
      setJourneyOptions([]);
      setConnectingJourneys([]);
      setHasSearched(true);
      return;
    }

    try {
      setLoadingJourneys(true);
      setErrorMsg(null);
      setIsSameStop(false);
      setHasSearched(true);
      const res = await fetch(`/api/v1/journey/?origin_id=${encodeURIComponent(originId)}&destination_id=${encodeURIComponent(destId)}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.is_same_stop) {
        if (data.is_same_stop) {
          setIsSameStop(true);
          setErrorMsg(data.error || 'Origin and Destination cannot be the same stand. Please select different stands.');
        } else {
          setErrorMsg(data.error || `Journey search failed: ${res.status}`);
        }
        setJourneyOptions([]);
        setConnectingJourneys([]);
        return;
      }

      const directs: DirectJourneyOption[] = data.direct_journeys || [];
      const conns: ConnectingJourneyOption[] = data.connecting_journeys || data.transfer_journeys || [];
      setJourneyOptions(directs);
      setConnectingJourneys(conns);

      // Auto-switch tabs based on results
      if (directs.length === 0 && conns.length > 0) {
        setActiveTab('connecting');
      } else if (directs.length > 0) {
        setActiveTab('direct');
      }
    } catch (err: any) {
      console.error('Error fetching journeys:', err);
      setErrorMsg(err.message || 'Could not fetch routes between selected stops. Please try again.');
      setJourneyOptions([]);
      setConnectingJourneys([]);
    } finally {
      setLoadingJourneys(false);
    }
  };

  // If user reloaded the page with both stops already chosen, re-validate and refresh live journeys
  const hasMountedFetchRef = useRef<boolean>(false);
  useEffect(() => {
    if (!hasMountedFetchRef.current) {
      hasMountedFetchRef.current = true;
      const fId = getStopId(fromStop);
      const tId = getStopId(toStop);
      if (fId && tId) {
        fetchDirectJourneys(fId, tId);
      }
    }
  }, []);

  const handleSelectFrom = (s: Stop) => {
    const normalized = normalizeStop(s);
    setFromStop(normalized);
    setFromQuery(normalized.name);
    setShowFromDropdown(false);
    const fromId = getStopId(normalized);
    const toId = getStopId(toStop);
    if (toId) {
      fetchDirectJourneys(fromId, toId);
    }
  };

  const handleSelectTo = (s: Stop) => {
    const normalized = normalizeStop(s);
    setToStop(normalized);
    setToQuery(normalized.name);
    setShowToDropdown(false);
    const fromId = getStopId(fromStop);
    const toId = getStopId(normalized);
    if (fromId) {
      fetchDirectJourneys(fromId, toId);
    }
  };

  // Swap From and To stands
  const handleSwapStops = () => {
    const tempStop = fromStop;
    const tempQuery = fromQuery;
    setFromStop(toStop);
    setFromQuery(toQuery);
    setToStop(tempStop);
    setToQuery(tempQuery);

    const fromId = getStopId(toStop);
    const toId = getStopId(tempStop);
    if (fromId && toId) {
      fetchDirectJourneys(fromId, toId);
    }
  };

  // Clear inputs
  const handleClearFrom = () => {
    setFromStop(null);
    setFromQuery('');
    setFromSuggestions([]);
    setShowFromDropdown(false);
    setJourneyOptions([]);
    setConnectingJourneys([]);
    setIsSameStop(false);
    setHasSearched(false);
    sessionStorage.removeItem('amts_stop_from_query');
    sessionStorage.removeItem('amts_stop_from_entity');
    sessionStorage.removeItem('amts_stop_journeys');
    sessionStorage.removeItem('amts_stop_connecting_journeys');
    sessionStorage.removeItem('amts_stop_has_searched');
  };

  const handleClearTo = () => {
    setToStop(null);
    setToQuery('');
    setToSuggestions([]);
    setShowToDropdown(false);
    setJourneyOptions([]);
    setConnectingJourneys([]);
    setIsSameStop(false);
    setHasSearched(false);
    sessionStorage.removeItem('amts_stop_to_query');
    sessionStorage.removeItem('amts_stop_to_entity');
    sessionStorage.removeItem('amts_stop_journeys');
    sessionStorage.removeItem('amts_stop_connecting_journeys');
    sessionStorage.removeItem('amts_stop_has_searched');
  };

  // Popular stop chips for 1-click quick selection
  const popularStops = [
    { name: 'Meghaninagar', gu: 'મેઘાણીનગર' },
    { name: 'Civil Hospital', gu: 'સિવિલ હોસ્પિટલ' },
    { name: 'Kalupur Terminus', gu: 'કાલુપુર ટર્મિનસ' },
    { name: 'Naroda Gam', gu: 'નરોડા ગામ' },
    { name: 'Lal Darwaja', gu: 'લાલ દરવાજા' },
    { name: 'Sarkhej Gam', gu: 'સરખેજ ગામ' },
  ];

  const handlePickQuickOrigin = async (name: string) => {
    setFromQuery(name);
    try {
      const res = await fetch(`/api/v1/stops/?query=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const matched = normalizeStop(data.results[0]);
          setFromStop(matched);
          setFromQuery(matched.name);
          const fromId = getStopId(matched);
          const toId = getStopId(toStop);
          if (toId) {
            fetchDirectJourneys(fromId, toId);
          }
        }
      }
    } catch (e) {}
  };

  const handlePickQuickDest = async (name: string) => {
    setToQuery(name);
    try {
      const res = await fetch(`/api/v1/stops/?query=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const matched = normalizeStop(data.results[0]);
          setToStop(matched);
          setToQuery(matched.name);
          const fromId = getStopId(fromStop);
          const toId = getStopId(matched);
          if (fromId) {
            fetchDirectJourneys(fromId, toId);
          }
        }
      }
    } catch (e) {}
  };

  // Flatten and process all buses covering that path using real-time schedule state
  // STRICT FILTER: Ongoing and standing buses covering this path in forward direction
  const processedBuses = useMemo(() => {
    const list: {
      journey: DirectJourneyOption;
      bus: ActiveBus;
      etaInfo: ReturnType<typeof calculateBusArrivalETA>;
    }[] = [];

    journeyOptions.forEach((j) => {
      const originIndex = Math.max(0, j.origin.stop_sequence - 1);

      if (j.schedule_config && j.schedule_config.fleet && j.schedule_config.fleet.length > 0) {
        const upSorted = [...(j.schedule_config.up_stops || [])].sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0));
        const downSorted = [...(j.schedule_config.down_stops || [])].sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0));
        const config: RouteScheduleConfig = {
          upStops: upSorted,
          downStops: downSorted,
          routeCode: j.schedule_config.route_code,
          upPatternId: j.schedule_config.up_pattern_id,
          downPatternId: j.schedule_config.down_pattern_id,
          upDirectionName: j.schedule_config.up_direction_name,
          downDirectionName: j.schedule_config.down_direction_name,
        };

        const totalBuses = j.schedule_config.fleet.length;

        j.schedule_config.fleet.forEach((fleetVehicle, busIdx) => {
          const baseBus: ActiveBus = {
            trip_id: fleetVehicle.fleet_number,
            fleet_number: fleetVehicle.fleet_number,
            registration_number: fleetVehicle.registration_number || 'GJ-01-AMTS',
            bus_model: fleetVehicle.bus_model,
            has_ac: fleetVehicle.has_ac,
            fuel_type: fleetVehicle.fuel_type,
            seated_capacity: fleetVehicle.seated_capacity,
            status: fleetVehicle.status,
            lifecycle_status: 'MOVING',
            latitude: j.origin.latitude,
            longitude: j.origin.longitude,
            speed_kmh: 28,
            heading_degrees: 90,
            rounds_completed_today: 3,
            battery_or_fuel: fleetVehicle.has_ac ? '85% Battery' : '75% CNG',
            current_stop_index: 0,
            progress_ratio: 0.0,
            assigned_direction_id: 0,
            assigned_pattern_id: config.upPatternId,
          };

          const { bus: evaluatedBus } = getBusScheduledState(
            busIdx,
            totalBuses,
            baseBus,
            config,
            currentSeconds
          );

          const eta = calculateBusArrivalETA(evaluatedBus, j.direction_id, originIndex);
          if (!eta.isAvailable) return;

          list.push({
            journey: j,
            bus: evaluatedBus,
            etaInfo: eta,
          });
        });
      } else if (j.approaching_buses && j.approaching_buses.length > 0) {
        j.approaching_buses.forEach((rawBus) => {
          const activeBusObj: ActiveBus = {
            trip_id: rawBus.fleet_number,
            fleet_number: rawBus.fleet_number,
            registration_number: rawBus.registration_number,
            bus_model: rawBus.bus_model,
            has_ac: rawBus.has_ac,
            fuel_type: rawBus.fuel_type,
            seated_capacity: rawBus.seating_capacity,
            status: rawBus.status,
            lifecycle_status: rawBus.status === 'RUNNING' ? 'MOVING' : 'STOPPED_AT_ORIGIN',
            latitude: rawBus.latitude || j.origin.latitude,
            longitude: rawBus.longitude || j.origin.longitude,
            speed_kmh: 28,
            heading_degrees: 90,
            rounds_completed_today: 3,
            battery_or_fuel: rawBus.has_ac ? '85% Battery' : '75% CNG',
            current_stop_index: Math.max(0, originIndex - 2),
            progress_ratio: 0.4,
            assigned_direction_id: rawBus.assigned_direction_id !== undefined ? rawBus.assigned_direction_id : j.direction_id,
            assigned_pattern_id: j.pattern_id,
          };

          const eta = calculateBusArrivalETA(activeBusObj, j.direction_id, originIndex);
          if (!eta.isAvailable) return;

          list.push({
            journey: j,
            bus: activeBusObj,
            etaInfo: eta,
          });
        });
      }
    });

    let filtered = list;
    if (sortBy === 'nearest') {
      filtered.sort((a, b) => a.etaInfo.etaSecs - b.etaInfo.etaSecs);
    } else if (sortBy === 'fastest') {
      filtered.sort((a, b) => a.journey.stops_count - b.journey.stops_count);
    } else if (sortBy === 'fare') {
      filtered.sort((a, b) => a.journey.fare_rupees - b.journey.fare_rupees);
    }

    return filtered;
  }, [journeyOptions, sortBy, currentSeconds]);

  // Process real-time Leg 1 bus arrival for each connecting journey
  const processedConnectingJourneys = useMemo<
    Array<{
      connecting: ConnectingJourneyOption;
      nearestBusEta: BusArrivalETA | null;
      evaluatedBus: ActiveBus | null;
    }>
  >(() => {
    const list: Array<{
      connecting: ConnectingJourneyOption;
      nearestBusEta: BusArrivalETA | null;
      evaluatedBus: ActiveBus | null;
    }> = connectingJourneys.map((cj) => {
      const leg1 = cj.legs[0];
      let nearestBusEta: BusArrivalETA | null = null;
      let evaluatedBus: ActiveBus | null = null;

      if (leg1 && leg1.schedule_config && leg1.schedule_config.fleet && leg1.schedule_config.fleet.length > 0) {
        const originIndex = Math.max(0, leg1.origin.stop_sequence - 1);
        const upSorted = [...(leg1.schedule_config.up_stops || [])].sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0));
        const downSorted = [...(leg1.schedule_config.down_stops || [])].sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0));
        const config: RouteScheduleConfig = {
          upStops: upSorted,
          downStops: downSorted,
          routeCode: leg1.schedule_config.route_code,
          upPatternId: leg1.schedule_config.up_pattern_id,
          downPatternId: leg1.schedule_config.down_pattern_id,
          upDirectionName: leg1.schedule_config.up_direction_name,
          downDirectionName: leg1.schedule_config.down_direction_name,
        };

        const totalBuses = leg1.schedule_config.fleet.length;
        let minSecs = Infinity;

        leg1.schedule_config.fleet.forEach((fleetVehicle, bIdx) => {
          const baseBus: ActiveBus = {
            trip_id: fleetVehicle.fleet_number,
            fleet_number: fleetVehicle.fleet_number,
            registration_number: fleetVehicle.registration_number || 'GJ-01-AMTS',
            bus_model: fleetVehicle.bus_model,
            has_ac: fleetVehicle.has_ac,
            fuel_type: fleetVehicle.fuel_type,
            seated_capacity: fleetVehicle.seated_capacity,
            status: fleetVehicle.status,
            lifecycle_status: 'MOVING',
            latitude: leg1.origin.latitude,
            longitude: leg1.origin.longitude,
            speed_kmh: 28,
            heading_degrees: 90,
            rounds_completed_today: 3,
            battery_or_fuel: fleetVehicle.has_ac ? '85% Battery' : '75% CNG',
            current_stop_index: 0,
            progress_ratio: 0.0,
            assigned_direction_id: 0,
            assigned_pattern_id: config.upPatternId,
          };

          const { bus } = getBusScheduledState(bIdx, totalBuses, baseBus, config, currentSeconds);
          const eta = calculateBusArrivalETA(bus, leg1.direction_id, originIndex);
          if (eta.isAvailable && eta.etaSecs < minSecs) {
            minSecs = eta.etaSecs;
            nearestBusEta = eta;
            evaluatedBus = bus;
          }
        });
      }

      return {
        connecting: cj,
        nearestBusEta,
        evaluatedBus,
      };
    });

    if (sortBy === 'nearest') {
      list.sort((a, b) => (a.nearestBusEta?.etaSecs || 9999) - (b.nearestBusEta?.etaSecs || 9999));
    } else if (sortBy === 'fastest') {
      list.sort((a, b) => a.connecting.total_travel_minutes - b.connecting.total_travel_minutes);
    } else if (sortBy === 'fare') {
      list.sort((a, b) => a.connecting.total_fare_rupees - b.connecting.total_fare_rupees);
    }

    return list;
  }, [connectingJourneys, currentSeconds, sortBy]);

  // Click View on Map for direct bus
  const handleViewOnMap = (item: (typeof processedBuses)[0]) => {
    if (!fromStop || !toStop) return;
    const matchedRoute = routes.find((r) => r.public_code === item.journey.route_code);
    if (!matchedRoute) return;

    onSelectBusOnMap(
      matchedRoute,
      item.journey.pattern_id,
      item.bus,
      fromStop,
      toStop,
      item.journey.shape_coordinates
    );
  };

  // Click Book E-Ticket for direct bus
  const handleBookTicketClick = async (item: (typeof processedBuses)[0]) => {
    if (!fromStop || !toStop) return;
    try {
      const res = await fetch(`/api/v1/patterns/${item.journey.pattern_id}/`);
      if (res.ok) {
        const data = await res.json();
        const patternDetail: RoutePatternDetail = data.data;
        onBookTicket(item.bus, patternDetail, fromStop, toStop);
      }
    } catch (e) {
      console.error('Failed to load pattern for booking', e);
    }
  };

  // Click View on Map for Connecting Journey
  const handleViewConnectingOnMap = (cj: ConnectingJourneyOption) => {
    if (!fromStop || !toStop) return;
    onSelectConnectingOnMap?.(cj, fromStop, toStop);
  };

  return (
    <div className="stop-search-container">
      {/* Search Header Banner */}
      <div className="stop-search-header">
        <div className="header-titles">
          <div className="header-badge">
            <MapPin size={16} className="text-red" />
            <span>Search by Stop Name (બસ સ્ટેન્ડ)</span>
          </div>
        </div>
      </div>

      {/* Input Fields Box */}
      <div className="stop-inputs-card">
        {/* FROM INPUT */}
        <div className="stop-input-row">
          <div className="stop-icon-wrapper from-icon-wrapper">
            <span className="stand-dot green-dot"></span>
          </div>
          <div className="stop-field-content">
            <label htmlFor="from-stand-input" className="field-label">
              <span>1. Boarding Stand (ચડવાનું સ્ટેશન / From)</span>
            </label>
            <div className="input-with-clear">
              <input
                id="from-stand-input"
                type="text"
                value={fromQuery}
                onChange={(e) => {
                  setFromQuery(e.target.value);
                  setShowFromDropdown(true);
                  if (fromStop && e.target.value !== fromStop.name) {
                    setFromStop(null);
                  }
                }}
                onFocus={() => {
                  if (fromSuggestions.length > 0) setShowFromDropdown(true);
                }}
                placeholder="Type boarding stop (e.g. Meghaninagar, Naroda)..."
                className="stop-text-input"
                autoComplete="off"
                spellCheck="false"
              />
              {fromQuery && (
                <button
                  type="button"
                  className="input-clear-btn"
                  onClick={handleClearFrom}
                  aria-label="Clear From Stand"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* FROM AUTOCOMPLETE DROPDOWN */}
        {showFromDropdown && fromQuery.trim().length > 0 && (
          <div className="stop-autocomplete-dropdown">
            {isSearchingFrom ? (
              <div className="dropdown-loading">
                <Search size={14} className="spinning" />
                <span>Searching stops...</span>
              </div>
            ) : fromSuggestions.length === 0 ? (
              <div className="dropdown-not-found">
                <AlertCircle size={16} className="text-amber" />
                <span>Stop not found (કોઈ સ્ટેશન મળ્યું નથી)</span>
              </div>
            ) : (
              <ul className="suggestions-list" role="listbox">
                {fromSuggestions.map((s) => (
                  <li
                    key={getStopId(s)}
                    className="suggestion-item"
                    onClick={() => handleSelectFrom(s)}
                    role="option"
                    aria-selected={getStopId(fromStop) === getStopId(s)}
                  >
                    <div className="suggestion-icon">
                      <MapPin size={15} className="text-emerald" />
                    </div>
                    <div className="suggestion-details">
                      <span className="suggestion-name">{s.name}</span>
                      {s.name_gu && <span className="suggestion-gu">{s.name_gu}</span>}
                    </div>
                    {s.stop_code && <span className="stop-code-badge">{s.stop_code}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* SWAP BUTTON */}
        <div className="swap-divider">
          <div className="swap-line"></div>
          <button
            type="button"
            className="swap-button"
            onClick={handleSwapStops}
            title="Swap Boarding and Destination Stands"
            aria-label="Swap Stops"
          >
            <ArrowUpDown size={16} />
          </button>
          <div className="swap-line"></div>
        </div>

        {/* TO INPUT */}
        <div className="stop-input-row">
          <div className="stop-icon-wrapper to-icon-wrapper">
            <span className="stand-dot red-dot"></span>
          </div>
          <div className="stop-field-content">
            <label htmlFor="to-stand-input" className="field-label">
              <span>2. Destination Stand (ઉતરવાનું સ્ટેશન / To)</span>
            </label>
            <div className="input-with-clear">
              <input
                id="to-stand-input"
                type="text"
                value={toQuery}
                onChange={(e) => {
                  setToQuery(e.target.value);
                  setShowToDropdown(true);
                  if (toStop && e.target.value !== toStop.name) {
                    setToStop(null);
                  }
                }}
                onFocus={() => {
                  if (toSuggestions.length > 0) setShowToDropdown(true);
                }}
                placeholder="Type destination stop (e.g. Civil Hospital, Kalupur)..."
                className="stop-text-input"
                autoComplete="off"
                spellCheck="false"
              />
              {toQuery && (
                <button
                  type="button"
                  className="input-clear-btn"
                  onClick={handleClearTo}
                  aria-label="Clear Destination Stand"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TO AUTOCOMPLETE DROPDOWN */}
        {showToDropdown && toQuery.trim().length > 0 && (
          <div className="stop-autocomplete-dropdown">
            {isSearchingTo ? (
              <div className="dropdown-loading">
                <Search size={14} className="spinning" />
                <span>Searching stops...</span>
              </div>
            ) : toSuggestions.length === 0 ? (
              <div className="dropdown-not-found">
                <AlertCircle size={16} className="text-amber" />
                <span>Stop not found (કોઈ સ્ટેશન મળ્યું નથી)</span>
              </div>
            ) : (
              <ul className="suggestions-list" role="listbox">
                {toSuggestions.map((s) => (
                  <li
                    key={getStopId(s)}
                    className="suggestion-item"
                    onClick={() => handleSelectTo(s)}
                    role="option"
                    aria-selected={getStopId(toStop) === getStopId(s)}
                  >
                    <div className="suggestion-icon">
                      <MapPin size={15} className="text-red" />
                    </div>
                    <div className="suggestion-details">
                      <span className="suggestion-name">{s.name}</span>
                      {s.name_gu && <span className="suggestion-gu">{s.name_gu}</span>}
                    </div>
                    {s.stop_code && <span className="stop-code-badge">{s.stop_code}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* QUICK POPULAR STAND PILLS */}
      {(!fromStop || !toStop) && (
        <div className="quick-stops-section">
          <span className="quick-title">Quick Select Stands:</span>
          <div className="quick-pills-row">
            {popularStops.map((ps) => (
              <button
                key={ps.name}
                type="button"
                className="quick-stop-pill"
                onClick={() => {
                  if (!fromStop) {
                    handlePickQuickOrigin(ps.name);
                  } else {
                    handlePickQuickDest(ps.name);
                  }
                }}
              >
                <span>{ps.name}</span>
                <span className="pill-gu">({ps.gu})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RESULTS SECTION */}
      <div className="journey-results-section">
        {loadingJourneys ? (
          <div className="journey-loading-box">
            <div className="spinner-ring"></div>
            <p className="loading-title">Planning AMTS Transit Corridors...</p>
            <p className="loading-subtitle">
              Locating direct and connecting buses for {fromStop?.name || 'Boarding'} ──▶ {toStop?.name || 'Destination'}
            </p>
          </div>
        ) : isSameStop ? (
          /* CASE 4: Same stand warning */
          <div className="same-stop-warning-card">
            <AlertCircle size={28} className="text-amber shrink-0" />
            <div className="same-stop-info">
              <h4>Same Stand Selected / એક જ સ્ટેન્ડ પસંદ કરેલ છે</h4>
              <p>{errorMsg || `Boarding stand and Destination stand cannot both be "${fromStop?.name}". Please choose different stands.`}</p>
            </div>
          </div>
        ) : errorMsg && !hasSearched ? (
          <div className="journey-error-box">
            <AlertCircle size={22} className="text-red" />
            <p>{errorMsg}</p>
          </div>
        ) : hasSearched && fromStop && toStop ? (
          <div>
            {/* TABS SWITCHER: Direct Buses (X) vs Connecting Routes (Y) */}
            {(journeyOptions.length > 0 || connectingJourneys.length > 0) && (
              <div className="journey-type-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'direct'}
                  className={`journey-type-tab ${activeTab === 'direct' ? 'active' : ''}`}
                  onClick={() => setActiveTab('direct')}
                >
                  <Bus size={15} />
                  <span>Direct Buses</span>
                  <span className="tab-count-pill">{processedBuses.length}</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'connecting'}
                  className={`journey-type-tab ${activeTab === 'connecting' ? 'active' : ''}`}
                  onClick={() => setActiveTab('connecting')}
                >
                  <Sparkles size={15} />
                  <span>Connecting Routes</span>
                  <span className="tab-count-pill connecting-count-pill">
                    {connectingJourneys.length}
                  </span>
                </button>
              </div>
            )}

            {/* TAB CONTENT: DIRECT BUSES */}
            {activeTab === 'direct' && (
              processedBuses.length === 0 ? (
                <div className="empty-journeys-box">
                  <Bus size={32} className="empty-bus-icon text-muted" />
                  <h4 className="empty-title">No Direct Bus Currently on Road</h4>
                  <p className="empty-desc">
                    No single bus is currently running directly between <strong>{fromStop.name}</strong> and <strong>{toStop.name}</strong> without transfers.
                  </p>
                  {connectingJourneys.length > 0 && (
                    <button
                      type="button"
                      className="switch-to-connecting-btn"
                      onClick={() => setActiveTab('connecting')}
                    >
                      <Sparkles size={16} />
                      <span>View {connectingJourneys.length} Connecting Route Options</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="direct-buses-container">
                  {/* Header with Results Count & Filter Controls */}
                  <div className="results-header-bar">
                    <div className="results-count-badge">
                      <span className="count-number">{processedBuses.length}</span>
                      <span className="count-text">Direct Buses Covering This Path</span>
                    </div>

                    <div className="filter-controls-row">
                      <div className="sort-buttons-group">
                        <button
                          type="button"
                          className={`sort-btn ${sortBy === 'nearest' ? 'active' : ''}`}
                          onClick={() => setSortBy('nearest')}
                          title="Sort by nearest arrival time"
                        >
                          <Zap size={13} />
                          <span>Nearest</span>
                        </button>
                        <button
                          type="button"
                          className={`sort-btn ${sortBy === 'fastest' ? 'active' : ''}`}
                          onClick={() => setSortBy('fastest')}
                          title="Sort by fewest stands"
                        >
                          <Clock size={13} />
                          <span>Fewest Stands</span>
                        </button>
                        <button
                          type="button"
                          className={`sort-btn ${sortBy === 'fare' ? 'active' : ''}`}
                          onClick={() => setSortBy('fare')}
                          title="Sort by lowest fare"
                        >
                          <span>Lowest Fare</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Direct Bus Cards List */}
                  <div className="direct-buses-list">
                    {processedBuses.map((item, index) => {
                      const { journey, bus, etaInfo } = item;
                      const isAc = bus.has_ac;
                      const isStandNow = etaInfo.isAtStandNow;

                      return (
                        <div
                          key={`${journey.route_code}-${bus.fleet_number}-${index}`}
                          className={`direct-bus-card ${isStandNow ? 'at-stand-card' : ''}`}
                        >
                          <div className="card-top-header">
                            <div className="route-and-fleet">
                              <span
                                className="route-badge-pill"
                                style={{
                                  backgroundColor: journey.route_color ? `#${journey.route_color}` : '#D32F2F',
                                  color: journey.route_text_color ? `#${journey.route_text_color}` : '#FFFFFF',
                                }}
                              >
                                Route {journey.route_code}
                              </span>
                              <span className="fleet-badge-code">Fleet #{bus.fleet_number}</span>
                              {isAc ? (
                                <span className="bus-type-badge ac-badge">
                                  <Snowflake size={12} />
                                  <span>AC Electric</span>
                                </span>
                              ) : (
                                <span className="bus-type-badge cng-badge">
                                  <span>CNG</span>
                                </span>
                              )}
                            </div>

                            {/* LIVE ARRIVAL COUNTDOWN */}
                            <div className="live-arrival-eta-box">
                              {isStandNow ? (
                                <div className="at-stand-now-badge">
                                  <span className="pulse-circle-green"></span>
                                  <span className="stand-badge-text">
                                    {etaInfo.formattedEta === 'READY TO GO' ? 'READY TO GO' : 'AT YOUR STAND NOW'}
                                  </span>
                                </div>
                              ) : (
                                <div className="approaching-eta-badge">
                                  <span className="eta-icon-clock">⚡</span>
                                  <span className="eta-label">Arrives in</span>
                                  <span className="eta-digits">{etaInfo.formattedEta}</span>
                                  {etaInfo.status === 'AT_TURNAROUND' && (
                                    <span className="turnaround-pill" title={etaInfo.message}>
                                      (At Turnaround)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="card-corridor-row">
                            <div className="corridor-name">
                              <span className="dir-name">{journey.direction_name}</span>
                            </div>
                            <div className="stands-and-time">
                              <span className="stands-count-tag">
                                <strong>{journey.stops_count} Stands</strong> (~{journey.estimated_travel_minutes} mins)
                              </span>
                            </div>
                          </div>

                          <div className="card-fare-strip">
                            <div className="fare-item">
                              <span className="fare-label">Stage Fare:</span>
                              <span className="fare-value">₹{journey.fare_rupees}</span>
                            </div>
                            <div className="pass-accepted-tag">
                              <ShieldCheck size={14} className="text-gold" />
                              <span>All-Day Golden Pass (₹35 / ₹45) Valid</span>
                            </div>
                          </div>

                          <div className="card-actions-row">
                            <button
                              type="button"
                              className="action-btn view-map-btn"
                              onClick={() => handleViewOnMap(item)}
                              title="Track bus live and highlight boarding segment on map"
                            >
                              <span className="fab-live-dot"></span>
                              <Navigation size={15} />
                              <span>View Live Map</span>
                            </button>

                            <button
                              type="button"
                              className="action-btn book-ticket-btn"
                              onClick={() => handleBookTicketClick(item)}
                              title="Book ticket with pre-selected boarding and destination stands"
                            >
                              <CheckCircle2 size={15} />
                              <span>Book E-Ticket (₹{journey.fare_rupees})</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {/* TAB CONTENT: CONNECTING ROUTES (1-Transfer & 2-Transfer Multi-Bus) */}
            {activeTab === 'connecting' && (
              processedConnectingJourneys.length === 0 ? (
                <div className="empty-journeys-box">
                  <Repeat size={32} className="empty-bus-icon text-muted" />
                  <h4 className="empty-title">No Connecting Routes Found</h4>
                  <p className="empty-desc">
                    No connecting route options found between <strong>{fromStop.name}</strong> and <strong>{toStop.name}</strong>.
                    Try selecting a major hub like <strong>Lal Darwaja</strong> or <strong>Kalupur Terminus</strong>.
                  </p>
                </div>
              ) : (
                <div className="connecting-buses-container">
                  <div className="results-header-bar">
                    <div className="results-count-badge">
                      <span className="count-number">{processedConnectingJourneys.length}</span>
                      <span className="count-text">Connecting Routes Available</span>
                    </div>

                    <div className="filter-controls-row">
                      <div className="sort-buttons-group">
                        <button
                          type="button"
                          className={`sort-btn ${sortBy === 'nearest' ? 'active' : ''}`}
                          onClick={() => setSortBy('nearest')}
                          title="Sort by nearest Leg 1 bus arrival"
                        >
                          <Zap size={13} />
                          <span>Earliest Leg 1</span>
                        </button>
                        <button
                          type="button"
                          className={`sort-btn ${sortBy === 'fastest' ? 'active' : ''}`}
                          onClick={() => setSortBy('fastest')}
                          title="Sort by shortest total journey time"
                        >
                          <Clock size={13} />
                          <span>Fastest</span>
                        </button>
                        <button
                          type="button"
                          className={`sort-btn ${sortBy === 'fare' ? 'active' : ''}`}
                          onClick={() => setSortBy('fare')}
                          title="Sort by lowest total fare"
                        >
                          <span>Lowest Fare</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="connecting-buses-list">
                    {processedConnectingJourneys.map((item, cIdx) => {
                      const { connecting, nearestBusEta, evaluatedBus } = item;
                      const isMulti = connecting.legs_count > 2;
                      const hasGoldenSavings = connecting.total_fare_rupees >= 30 || connecting.transfer_count >= 2;

                      return (
                        <div
                          key={`conn-${cIdx}-${connecting.type}`}
                          className="connecting-journey-card"
                        >
                          {/* Card Top: Badges, Transfer count, Total time & Combined Fare */}
                          <div className="card-top-header">
                            <div className="connecting-badges-cluster">
                              <span className={`transfer-tag-pill ${isMulti ? 'multi-transfer-pill' : 'single-transfer-pill'}`}>
                                <Repeat size={12} />
                                <span>
                                  {connecting.transfer_count === 1
                                    ? '1-Transfer (2 Buses)'
                                    : `${connecting.transfer_count}-Transfers (${connecting.legs_count} Buses)`}
                                </span>
                              </span>

                              {/* Leg route codes chain */}
                              <div className="connecting-route-chain">
                                {connecting.legs.map((leg, lIdx) => (
                                  <React.Fragment key={lIdx}>
                                    <span
                                      className="route-badge-pill mini-pill"
                                      style={{
                                        backgroundColor: leg.route_color ? `#${leg.route_color}` : '#2563EB',
                                        color: leg.route_text_color ? `#${leg.route_text_color}` : '#FFFFFF',
                                      }}
                                    >
                                      {leg.route_code}
                                    </span>
                                    {lIdx < connecting.legs.length - 1 && (
                                      <span className="route-chain-arrow">──▶</span>
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>

                            {/* Total Fare */}
                            <div className="connecting-stats-box">
                              <span className="connecting-fare-tag">
                                <strong>₹{connecting.total_fare_rupees}</strong> Total
                              </span>
                            </div>
                          </div>

                          {/* Step-by-Step Multi-Leg Corridor Timeline */}
                          <div className="connecting-timeline-box">
                            {connecting.legs.map((leg, lIdx) => {
                              const isFirstLeg = lIdx === 0;
                              const isLastLeg = lIdx === connecting.legs.length - 1;
                              const legColor = lIdx === 0 ? '#2563EB' : lIdx === 1 ? '#8B5CF6' : '#0D9488';

                              return (
                                <React.Fragment key={lIdx}>
                                  {/* Leg Step */}
                                  <div className="timeline-leg-step">
                                    <div
                                      className="leg-step-dot"
                                      style={{ borderColor: legColor, backgroundColor: '#FFFFFF' }}
                                    >
                                      <span style={{ color: legColor, fontWeight: 800, fontSize: '11px' }}>
                                        {leg.leg_number}
                                      </span>
                                    </div>
                                    <div className="leg-step-body">
                                      <div className="leg-step-header">
                                        <span className="leg-header-title">
                                          Board <strong>Route {leg.route_code}</strong> ({leg.direction_name})
                                        </span>
                                        <span className="leg-header-stats">
                                          {leg.stops_count} Stands • ~{leg.estimated_travel_minutes}m • ₹{leg.fare_rupees}
                                        </span>
                                      </div>
                                      <div className="leg-step-path">
                                        <span className="step-point from-point">{leg.origin.name}</span>
                                        <span className="step-arrow">──▶</span>
                                        <span className="step-point to-point">{leg.destination.name}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Transfer Hub Dwell Divider (if not final leg) */}
                                  {!isLastLeg && connecting.transfer_hubs[lIdx] && (
                                    <div className="timeline-transfer-divider">
                                      <div className="transfer-divider-line"></div>
                                      <div className="transfer-hub-badge">
                                        <Repeat size={12} className="text-purple" />
                                        <span>
                                          Transfer at <strong>{connecting.transfer_hubs[lIdx].name}</strong> (~{connecting.transfer_hubs[lIdx].wait_minutes || 6}m buffer)
                                        </span>
                                      </div>
                                      <div className="transfer-divider-line"></div>
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>

                          {/* Action Buttons: View on Map & Buy Golden Ticket Pass */}
                          <div className="card-actions-row">
                            <button
                              type="button"
                              className="action-btn view-map-btn"
                              onClick={() => handleViewConnectingOnMap(connecting)}
                              title="Render journey path with interchange hubs on map"
                            >
                              <span className="fab-live-dot"></span>
                              <Navigation size={15} />
                              <span>View Live Map</span>
                            </button>

                            <button
                              type="button"
                              className="action-btn golden-pass-btn"
                              onClick={() => onBuyGoldenPass?.()}
                              title="Buy AMTS Golden Ticket Pass for unlimited citywide rides"
                            >
                              <Crown size={15} />
                              <span>Buy Golden Pass (₹35 / ₹45)</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          /* Empty initial search state */
          <div className="search-instruction-box">
            <div className="instruction-icon">
              <Bus size={32} className="text-red" />
            </div>
            <h4>Search Any Boarding & Destination Stand</h4>
            <p>
              Type your pickup stop (From) and drop stop (To) to see all direct buses and multi-bus connecting corridors with real-time arrival countdowns!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
