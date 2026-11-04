import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { RouteSearch } from './components/RouteSearch';
import { StopSearch } from './components/StopSearch';
import { MapView } from './components/MapView';
import { LiveBusTracker } from './components/LiveBusTracker';
import { BookingModal } from './components/BookingModal';
import { TicketModal } from './components/TicketModal';
import { PassbookModal } from './components/PassbookModal';
import { ServiceAdvisoriesModal } from './components/ServiceAdvisoriesModal';
import { PassengerTripBanner } from './components/PassengerTripBanner';
import { AdminDashboard } from './components/AdminDashboard/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { ServiceAlertItem, FleetVehicleTelemetry } from './components/AdminDashboard/types';
import {
  RouteItem,
  RoutePatternSummary,
  RoutePatternDetail,
  ActiveBus,
  TurnaroundEvent,
  BookedTicket,
  PassengerJourneyState,
  Stop,
  ConnectingJourneyOption,
  HighlightedJourneySegment,
  AuthUser,
} from './types';
import {
  getCurrentISTSeconds,
  getBusScheduledState,
  RouteScheduleConfig,
  formatTimeFromSeconds,
} from './engine/scheduleEngine';
import {
  getStoredTickets,
  getActiveGoldenTickets,
  getActiveGoldenTicket,
  getActiveLocalTicket,
  isTicketExpired,
  syncTicketExpiration,
  deleteTicket,
  syncUserTicketsFromBackend,
} from './utils/ticketStorage';
import { Bus, Navigation, AlertCircle, Compass, MapPin, List } from 'lucide-react';

export default function App() {
  const [routes, setRoutes] = useState<RouteItem[]>([]);

  // Government AMTS Admin Dashboard Routing (URL: http://localhost:5173/admin-dashboard)
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    try {
      return (
        window.location.pathname.startsWith('/admin-dashboard') ||
        window.location.hash === '#admin-dashboard'
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setIsAdminMode(
        window.location.pathname.startsWith('/admin-dashboard') ||
        window.location.hash === '#admin-dashboard'
      );
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const handleNavigateToAdmin = useCallback(() => {
    try {
      window.history.pushState({ adminMode: true }, '', '/admin-dashboard');
    } catch (e) {}
    setIsAdminMode(true);
  }, []);

  const handleNavigateToPassenger = useCallback(() => {
    try {
      window.history.pushState({ adminMode: false }, '', '/');
    } catch (e) {}
    setIsAdminMode(false);
  }, []);

  // Authentication State (Commuter Passenger & Municipal Admin)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem('amts_auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);

  // Queue booking action if commuter clicked book before signing in
  const [pendingBooking, setPendingBooking] = useState<{
    type: 'local' | 'golden_pass' | 'stop_search';
    bus?: ActiveBus;
    pattern?: RoutePatternDetail | null;
    fromStop?: Stop;
    toStop?: Stop;
  } | null>(null);

  const handleOpenAuth = useCallback(() => {
    setIsAuthModalOpen(true);
  }, []);

  const handleCloseAuth = useCallback(() => {
    setIsAuthModalOpen(false);
    setAuthPromptMessage(null);
    setPendingBooking(null);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout/', { method: 'POST' });
    } catch (e) {}
    try {
      localStorage.removeItem('amts_auth_user');
    } catch (e) {}
    setCurrentUser(null);
    setStoredTickets([]);
    setActiveGoldenPasses([]);
    setPassengerJourney(null);
    if (window.location.pathname.startsWith('/admin-dashboard')) {
      handleNavigateToPassenger();
    }
  }, [handleNavigateToPassenger]);

  // Responsive Mobile View Switcher: 'list' (Search & Fleet list) vs 'map' (Full Live Map)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  // User requirement: Search starts clean unless restored from reload
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    try {
      return sessionStorage.getItem('amts_session_search') || '';
    } catch {
      return '';
    }
  });

  // Search mode switcher: 'by_stop' (Search by Stop Name) vs 'by_number' (Search by Bus Number)
  // Default is 'by_stop' (Search by Stop Name on the left side)
  const [searchMode, setSearchMode] = useState<'by_number' | 'by_stop'>(() => {
    try {
      const version = sessionStorage.getItem('amts_search_mode_version');
      if (version !== '2') {
        sessionStorage.setItem('amts_search_mode_version', '2');
        sessionStorage.setItem('amts_session_search_mode', 'by_stop');
        return 'by_stop';
      }
      const saved = sessionStorage.getItem('amts_session_search_mode');
      return saved === 'by_number' ? 'by_number' : 'by_stop';
    } catch {
      return 'by_stop';
    }
  });

  // Highlighted segment from stop search on map (Restored immediately from sessionStorage)
  const [highlightedSearchSegment, setHighlightedSearchSegment] = useState<HighlightedJourneySegment | null>(() => {
    try {
      const raw = sessionStorage.getItem('amts_session_highlighted_segment');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Pre-selected boarding & exit stops for booking from stop search (Restored from sessionStorage)
  const [bookingStops, setBookingStops] = useState<{
    boardingStopId?: string;
    exitStopId?: string;
  } | null>(() => {
    try {
      const raw = sessionStorage.getItem('amts_session_booking_stops');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const [selectedPatternSummary, setSelectedPatternSummary] = useState<RoutePatternSummary | null>(null);

  // Pattern Details for both UP and DOWN of the selected route
  const [upPatternDetail, setUpPatternDetail] = useState<RoutePatternDetail | null>(null);
  const [downPatternDetail, setDownPatternDetail] = useState<RoutePatternDetail | null>(null);

  // All base fleet buses for this route (e.g. 31-X, 31-Z, 31-M, 31-A)
  const [baseFleet, setBaseFleet] = useState<ActiveBus[]>([]);

  // Live Calculated Buses for UP and DOWN (Derived from real-time schedule)
  const [upBuses, setUpBuses] = useState<ActiveBus[]>([]);
  const [downBuses, setDownBuses] = useState<ActiveBus[]>([]);

  // Selected inspected bus (Restored immediately from sessionStorage)
  const [selectedBus, setSelectedBus] = useState<ActiveBus | null>(() => {
    try {
      const raw = sessionStorage.getItem('amts_session_bus_obj');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Ticket Booking & Passbook State (Restored immediately from sessionStorage)
  const [bookingBus, setBookingBus] = useState<ActiveBus | null>(() => {
    try {
      const raw = sessionStorage.getItem('amts_session_booking_bus_obj');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [bookingPattern, setBookingPattern] = useState<RoutePatternDetail | null>(() => {
    try {
      const raw = sessionStorage.getItem('amts_session_booking_pattern');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isBookingGoldenPass, setIsBookingGoldenPass] = useState<boolean>(false);
  const [viewingTicket, setViewingTicket] = useState<BookedTicket | null>(() => {
    try {
      const raw = sessionStorage.getItem('amts_session_viewing_ticket_obj');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  const [isPassbookOpen, setIsPassbookOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('amts_session_passbook_open') === 'true';
    } catch {
      return false;
    }
  });

  const [isAdvisoriesOpen, setIsAdvisoriesOpen] = useState<boolean>(false);
  const [activeAlerts, setActiveAlerts] = useState<ServiceAlertItem[]>([]);

  // Fetch Public Service Advisories on Mount & Periodic Sync
  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch('/api/v1/alerts/');
        if (res.ok) {
          const data = await res.json();
          setActiveAlerts(data.alerts || []);
        }
      } catch (e) {
        console.error('Failed to load active service advisories:', e);
      }
    }
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 25000);
    return () => clearInterval(interval);
  }, []);

  const [storedTickets, setStoredTickets] = useState<BookedTicket[]>([]);
  const [activeGoldenPasses, setActiveGoldenPasses] = useState<BookedTicket[]>([]);

  // Initialize passenger journey immediately from sessionStorage on mount (if active)
  const [passengerJourney, setPassengerJourney] = useState<PassengerJourneyState | null>(() => {
    try {
      const raw = sessionStorage.getItem('amts_session_journey');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.ticket) {
          if (isTicketExpired(parsed.ticket)) {
            sessionStorage.removeItem('amts_session_journey');
            return null;
          }
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  });

  // Simulation controls (Restored from sessionStorage)
  const [simSpeed, setSimSpeed] = useState<number>(() => {
    try {
      const s = sessionStorage.getItem('amts_session_sim_speed');
      return s ? parseFloat(s) : 1;
    } catch {
      return 1;
    }
  });
  const [isPaused, setIsPaused] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('amts_session_is_paused') === 'true';
    } catch {
      return false;
    }
  });
  const [timeOffsetSecs, setTimeOffsetSecs] = useState<number>(0);

  // Turnaround history log
  const [turnaroundEvents, setTurnaroundEvents] = useState<TurnaroundEvent[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active direction: 0 = UP, 1 = DOWN
  const currentDirectionId = selectedPatternSummary?.direction_id ?? 0;
  // If no route is selected or when viewing connecting route, do not draw number-search route or buses
  const currentPatternDetail =
    selectedRoute && !highlightedSearchSegment?.isConnecting
      ? (currentDirectionId === 0 ? upPatternDetail : downPatternDetail)
      : null;
  const currentBuses =
    selectedRoute && !highlightedSearchSegment?.isConnecting
      ? (currentDirectionId === 0 ? upBuses : downBuses)
      : [];
  const allCurrentRouteBuses =
    selectedRoute && !highlightedSearchSegment?.isConnecting
      ? [...upBuses, ...downBuses]
      : [];

  // Ref guarding against premature sessionStorage removal on initial mount
  const isReadyToSyncStorageRef = useRef<boolean>(false);

  // 1. Fetch Routes List on Mount & Restore Session if Present
  const loadRoutes = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/routes/');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      const routesList: RouteItem[] = data.results || [];
      setRoutes(routesList);
      return routesList;
    } catch (err: any) {
      console.error('Failed to load routes:', err);
      return [];
    }
  }, []);

  useEffect(() => {
    async function initRoutes() {
      try {
        setLoading(true);
        const routesList = await loadRoutes();

        // USER REQUIREMENT:
        // "when i refresh show that page(or anything) where am i , just in Starting no need do show last thing."
        try {
          const savedRouteCode = sessionStorage.getItem('amts_session_route');
          const savedDirId = sessionStorage.getItem('amts_session_dir_id');
          const savedViewingTicket = sessionStorage.getItem('amts_session_viewing_ticket');

          // If a route was active before reload, restore it
          if (savedRouteCode) {
            const matchedRoute = routesList.find((r) => r.public_code === savedRouteCode);
            if (matchedRoute) {
              setSelectedRoute(matchedRoute);
              const dirId = savedDirId !== null ? parseInt(savedDirId, 10) : 0;
              const matchedPattern =
                matchedRoute.patterns.find((p) => p.direction_id === dirId) || matchedRoute.patterns[0];
              if (matchedPattern) {
                setSelectedPatternSummary(matchedPattern);
              }
            }
          }

          if (savedViewingTicket) {
            const stored = getStoredTickets();
            const ticket = stored.find((t) => t.ticket_number === savedViewingTicket);
            if (ticket) {
              setViewingTicket(ticket);
            }
          }
        } catch (e) {
          console.error('Failed to restore reload session:', e);
        } finally {
          // Allow sessionStorage synchronization now that restoration has run
          isReadyToSyncStorageRef.current = true;
        }
      } catch (err: any) {
        console.error('Failed to init routes:', err);
        setError('Failed to connect to AMTS backend. Ensure Django server is running.');
      } finally {
        setLoading(false);
      }
    }
    initRoutes();
  }, [loadRoutes]);

  useEffect(() => {
    if (!isReadyToSyncStorageRef.current) return;
    sessionStorage.setItem('amts_session_search_mode', searchMode);
  }, [searchMode]);

  // Synchronize active screen state to sessionStorage so page refresh remembers where user is
  useEffect(() => {
    if (!isReadyToSyncStorageRef.current) return;
    if (highlightedSearchSegment) {
      sessionStorage.setItem('amts_session_highlighted_segment', JSON.stringify(highlightedSearchSegment));
    } else {
      sessionStorage.removeItem('amts_session_highlighted_segment');
    }
  }, [highlightedSearchSegment]);

  useEffect(() => {
    if (!isReadyToSyncStorageRef.current) return;
    if (bookingStops) {
      sessionStorage.setItem('amts_session_booking_stops', JSON.stringify(bookingStops));
    } else {
      sessionStorage.removeItem('amts_session_booking_stops');
    }
  }, [bookingStops]);

  useEffect(() => {
    if (!isReadyToSyncStorageRef.current) return;
    if (bookingPattern) {
      sessionStorage.setItem('amts_session_booking_pattern', JSON.stringify(bookingPattern));
    } else {
      sessionStorage.removeItem('amts_session_booking_pattern');
    }
  }, [bookingPattern]);

  useEffect(() => {
    if (!isReadyToSyncStorageRef.current) return;
    if (selectedRoute) {
      sessionStorage.setItem('amts_session_route', selectedRoute.public_code);
    } else {
      sessionStorage.removeItem('amts_session_route');
    }
  }, [selectedRoute]);

  useEffect(() => {
    if (!isReadyToSyncStorageRef.current) return;
    if (selectedPatternSummary) {
      sessionStorage.setItem('amts_session_dir_id', String(selectedPatternSummary.direction_id));
    } else {
      sessionStorage.removeItem('amts_session_dir_id');
    }
  }, [selectedPatternSummary]);

  useEffect(() => {
    if (!isReadyToSyncStorageRef.current) return;
    if (selectedBus) {
      sessionStorage.setItem('amts_session_bus_fleet', selectedBus.fleet_number);
      sessionStorage.setItem('amts_session_bus_obj', JSON.stringify(selectedBus));
    } else {
      sessionStorage.removeItem('amts_session_bus_fleet');
      sessionStorage.removeItem('amts_session_bus_obj');
    }
  }, [selectedBus]);

  useEffect(() => {
    if (!isReadyToSyncStorageRef.current) return;
    if (searchQuery) {
      sessionStorage.setItem('amts_session_search', searchQuery);
    } else {
      sessionStorage.removeItem('amts_session_search');
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!isReadyToSyncStorageRef.current) return;
    if (passengerJourney) {
      sessionStorage.setItem('amts_session_journey', JSON.stringify(passengerJourney));
    } else {
      sessionStorage.removeItem('amts_session_journey');
    }
  }, [passengerJourney]);

  useEffect(() => {
    if (!isReadyToSyncStorageRef.current) return;
    if (viewingTicket) {
      sessionStorage.setItem('amts_session_viewing_ticket', viewingTicket.ticket_number);
      sessionStorage.setItem('amts_session_viewing_ticket_obj', JSON.stringify(viewingTicket));
    } else {
      sessionStorage.removeItem('amts_session_viewing_ticket');
      sessionStorage.removeItem('amts_session_viewing_ticket_obj');
    }
  }, [viewingTicket]);

  useEffect(() => {
    if (!isReadyToSyncStorageRef.current) return;
    sessionStorage.setItem('amts_session_passbook_open', isPassbookOpen ? 'true' : 'false');
  }, [isPassbookOpen]);

  useEffect(() => {
    if (!isReadyToSyncStorageRef.current) return;
    if (bookingBus) {
      sessionStorage.setItem('amts_session_booking_bus', bookingBus.fleet_number);
      sessionStorage.setItem('amts_session_booking_bus_obj', JSON.stringify(bookingBus));
    } else {
      sessionStorage.removeItem('amts_session_booking_bus');
      sessionStorage.removeItem('amts_session_booking_bus_obj');
    }
  }, [bookingBus]);

  useEffect(() => {
    if (!isReadyToSyncStorageRef.current) return;
    sessionStorage.setItem('amts_session_sim_speed', String(simSpeed));
  }, [simSpeed]);

  useEffect(() => {
    if (!isReadyToSyncStorageRef.current) return;
    sessionStorage.setItem('amts_session_is_paused', isPaused ? 'true' : 'false');
  }, [isPaused]);

  // Restore selectedBus & bookingBus once fleet buses load on page reload
  useEffect(() => {
    const all = [...upBuses, ...downBuses];
    if (all.length === 0) return;

    // If passenger is tracking a journey, prioritize the passenger's bus
    if (passengerJourney) {
      const bus = all.find((b) => b.fleet_number === passengerJourney.fleetNumber);
      if (bus && (!selectedBus || selectedBus.fleet_number !== bus.fleet_number)) {
        setSelectedBus(bus);
        return;
      }
    }

    // Otherwise restore the user's previously selected bus with live moving state
    const savedBusFleet = sessionStorage.getItem('amts_session_bus_fleet');
    if (savedBusFleet) {
      const matched = all.find((b) => b.fleet_number === savedBusFleet);
      if (matched && (!selectedBus || selectedBus.fleet_number !== matched.fleet_number || selectedBus.current_stop_index !== matched.current_stop_index)) {
        setSelectedBus(matched);
      }
    }

    const savedBookingBusFleet = sessionStorage.getItem('amts_session_booking_bus');
    if (savedBookingBusFleet) {
      const matchedBooking = all.find((b) => b.fleet_number === savedBookingBusFleet);
      if (matchedBooking && (!bookingBus || bookingBus.fleet_number !== matchedBooking.fleet_number)) {
        setBookingBus(matchedBooking);
      }
    }
  }, [upBuses, downBuses, passengerJourney, selectedBus, bookingBus]);

  // Reset back to clean starting screen (when clicking AMTS logo in Navbar or Close in Tracker)
  const handleResetToHome = () => {
    setSelectedRoute(null);
    setSelectedPatternSummary(null);
    setSelectedBus(null);
    setSearchQuery('');
    setPassengerJourney(null);
    setHighlightedSearchSegment(null);
    setBookingStops(null);
    setBookingBus(null);
    setBookingPattern(null);
    setIsBookingGoldenPass(false);
    setViewingTicket(null);
    setIsPassbookOpen(false);
    setSearchMode('by_stop');
    setMobileView('list');
    historyDepthRef.current = 0;
    try {
      sessionStorage.clear();
      localStorage.removeItem('amts_last_selected_route');
      localStorage.removeItem('amts_last_direction');
      window.history.replaceState({ amtsRoot: true, depth: 0 }, '');
    } catch (e) {}
  };

  // Sync tickets & passes for active logged-in user from localStorage and PostgreSQL
  const refreshTicketState = useCallback((activeUser?: AuthUser | null) => {
    const targetUser = activeUser !== undefined ? activeUser : currentUser;
    if (!targetUser) {
      setStoredTickets([]);
      setActiveGoldenPasses([]);
      return;
    }

    const all = getStoredTickets(targetUser);
    setStoredTickets(all);
    const goldenPasses = getActiveGoldenTickets(targetUser);
    setActiveGoldenPasses(goldenPasses);

    // Sync client tickets to PostgreSQL database
    if (all.length > 0) {
      fetch('/api/v1/tickets/sync/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickets: all }),
      }).catch((e) => console.error('Failed to sync tickets with PostgreSQL:', e));
    }

    // Pull verified account tickets from PostgreSQL
    if (targetUser.username) {
      syncUserTicketsFromBackend(targetUser.username).then((merged) => {
        setStoredTickets(merged);
        setActiveGoldenPasses(getActiveGoldenTickets(targetUser));
      });
    }
  }, [currentUser]);

  const handleDeleteTicket = useCallback(
    async (ticketNumber: string) => {
      setStoredTickets((prev) => prev.filter((t) => t.ticket_number !== ticketNumber));
      setActiveGoldenPasses((prev) => prev.filter((t) => t.ticket_number !== ticketNumber));
      setPassengerJourney((prev) => (prev?.ticket.ticket_number === ticketNumber ? null : prev));
      if (viewingTicket?.ticket_number === ticketNumber) {
        setViewingTicket(null);
      }
      await deleteTicket(ticketNumber, currentUser);
    },
    [currentUser, viewingTicket]
  );

  useEffect(() => {
    refreshTicketState(currentUser);
  }, [currentUser, refreshTicketState]);

  // =========================================================================
  // MOBILE EXIT & ONE-STEP-BACK HISTORY MANAGER (Handles Hardware Back, Browser Exit, & UI Back)
  // User Requirement: "mobile exit button work for this website. simple one step back when click exit back."
  // =========================================================================
  const historyDepthRef = useRef<number>(0);
  const isPoppingRef = useRef<boolean>(false);
  const openedFromPassbookRef = useRef<boolean>(false);

  const viewingTicketRef = useRef(viewingTicket);
  const bookingBusRef = useRef(bookingBus);
  const isBookingGoldenPassRef = useRef(isBookingGoldenPass);
  const isPassbookOpenRef = useRef(isPassbookOpen);
  const isAdvisoriesOpenRef = useRef(isAdvisoriesOpen);
  const isAuthModalOpenRef = useRef(isAuthModalOpen);
  const mobileViewRef = useRef(mobileView);
  const highlightedSearchSegmentRef = useRef(highlightedSearchSegment);
  const selectedRouteRef = useRef(selectedRoute);

  useEffect(() => {
    viewingTicketRef.current = viewingTicket;
    bookingBusRef.current = bookingBus;
    isBookingGoldenPassRef.current = isBookingGoldenPass;
    isPassbookOpenRef.current = isPassbookOpen;
    isAdvisoriesOpenRef.current = isAdvisoriesOpen;
    isAuthModalOpenRef.current = isAuthModalOpen;
    mobileViewRef.current = mobileView;
    highlightedSearchSegmentRef.current = highlightedSearchSegment;
    selectedRouteRef.current = selectedRoute;
  });

  const pushHistoryStep = useCallback((stepTag: string) => {
    try {
      historyDepthRef.current += 1;
      window.history.pushState(
        { amtsStep: stepTag, depth: historyDepthRef.current },
        ''
      );
    } catch (e) {
      console.error('Failed to push history step:', e);
    }
  }, []);

  const executeOneStepBack = useCallback((): boolean => {
    // 0. If payment checkout modal is open inside booking modal, cancel payment and return to booking form
    const paymentCloseBtn = document.querySelector('.payment-close-btn') as HTMLButtonElement | null;
    if (paymentCloseBtn) {
      paymentCloseBtn.click();
      return true;
    }

    // 1. Close Viewing Ticket Modal
    if (viewingTicketRef.current) {
      setViewingTicket(null);
      if (openedFromPassbookRef.current) {
        openedFromPassbookRef.current = false;
        setIsPassbookOpen(true);
      }
      return true;
    }

    // 2. Close Booking Wizard Modal
    if (bookingBusRef.current || isBookingGoldenPassRef.current) {
      setBookingBus(null);
      setBookingPattern(null);
      setBookingStops(null);
      setIsBookingGoldenPass(false);
      return true;
    }

    // 3. Close Passbook / My Tickets Modal
    if (isPassbookOpenRef.current) {
      setIsPassbookOpen(false);
      refreshTicketState();
      return true;
    }

    // 3b. Close Service Advisories Modal
    if (isAdvisoriesOpenRef.current) {
      setIsAdvisoriesOpen(false);
      return true;
    }

    // 3c. Close Auth Modal
    if (isAuthModalOpenRef.current) {
      setIsAuthModalOpen(false);
      return true;
    }

    // 4. On Mobile: Switch from Map view back to List/Search view
    if (mobileViewRef.current === 'map') {
      setMobileView('list');
      return true;
    }

    // 5. Clear highlighted search segment
    if (highlightedSearchSegmentRef.current) {
      setHighlightedSearchSegment(null);
      return true;
    }

    // 6. Clear selected route back to initial search screen
    if (selectedRouteRef.current) {
      setSelectedRoute(null);
      setSelectedPatternSummary(null);
      setSelectedBus(null);
      setUpPatternDetail(null);
      setDownPatternDetail(null);
      setUpBuses([]);
      setDownBuses([]);
      try {
        sessionStorage.removeItem('amts_session_route');
        sessionStorage.removeItem('amts_session_dir_id');
        sessionStorage.removeItem('amts_session_bus_fleet');
        sessionStorage.removeItem('amts_session_bus_obj');
      } catch (e) {}
      return true;
    }

    return false;
  }, [refreshTicketState]);

  const handleOneStepBack = useCallback(() => {
    if (historyDepthRef.current > 0) {
      window.history.back();
    } else {
      executeOneStepBack();
    }
  }, [executeOneStepBack]);

  // Mobile Exit / Browser Back Button Listener (popstate)
  useEffect(() => {
    try {
      window.history.replaceState({ amtsRoot: true, depth: 0 }, '');
      if (
        sessionStorage.getItem('amts_session_route') ||
        sessionStorage.getItem('amts_session_viewing_ticket') ||
        sessionStorage.getItem('amts_session_booking_bus_obj') ||
        sessionStorage.getItem('amts_session_passbook_open') === 'true'
      ) {
        window.history.pushState({ amtsStep: 'restored', depth: 1 }, '');
        historyDepthRef.current = 1;
      }
    } catch (e) {}

    const onPopState = () => {
      isPoppingRef.current = true;
      if (historyDepthRef.current > 0) {
        historyDepthRef.current -= 1;
      }
      executeOneStepBack();
      setTimeout(() => {
        isPoppingRef.current = false;
      }, 100);
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [executeOneStepBack]);

  // Open Handlers that push a history step for mobile exit back support
  const handleOpenViewingTicket = (ticket: BookedTicket, fromPassbook: boolean = false) => {
    if (fromPassbook || isPassbookOpenRef.current) {
      openedFromPassbookRef.current = true;
    } else {
      openedFromPassbookRef.current = false;
    }
    setIsPassbookOpen(false);
    pushHistoryStep('ticket');
    setViewingTicket(ticket);
  };

  const handleOpenPassbook = () => {
    pushHistoryStep('passbook');
    setIsPassbookOpen(true);
  };

  const handleOpenBooking = (bus: ActiveBus, pattern?: RoutePatternDetail | null) => {
    if (!currentUser) {
      setPendingBooking({ type: 'local', bus, pattern });
      setAuthPromptMessage('Please sign in or create an account to book your AMTS ticket.');
      setIsAuthModalOpen(true);
      return;
    }
    pushHistoryStep('booking');
    setBookingBus(bus);
    if (pattern) setBookingPattern(pattern);
  };

  const handleOpenGoldenPassBooking = () => {
    if (!currentUser) {
      setPendingBooking({ type: 'golden_pass' });
      setAuthPromptMessage('Please sign in or create an account to purchase the AMTS Golden Pass.');
      setIsAuthModalOpen(true);
      return;
    }
    pushHistoryStep('golden_booking');
    setIsBookingGoldenPass(true);
  };

  const handleSelectBusFromStopSearch = (
    route: RouteItem,
    patternId: string,
    bus: ActiveBus,
    fromStop: Stop,
    toStop: Stop,
    shapeCoords?: [number, number][]
  ) => {
    pushHistoryStep('stop_bus_map');
    setSelectedRoute(route);
    const matchedPattern = route.patterns.find((p) => p.id === patternId) || route.patterns[0];
    if (matchedPattern) {
      setSelectedPatternSummary(matchedPattern);
    }
    setSelectedBus(bus);
    setHighlightedSearchSegment({
      fromStop,
      toStop,
      coords: shapeCoords,
    });
    // On mobile, automatically show the map focused on this bus/journey
    setMobileView('map');
  };

  const handleSelectConnectingFromStopSearch = (
    connecting: ConnectingJourneyOption,
    fromStop: Stop,
    toStop: Stop
  ) => {
    pushHistoryStep('connecting_map');
    const legColors = ['#2563EB', '#8B5CF6', '#0D9488'];
    const mappedLegs = connecting.legs.map((leg, idx) => ({
      legNumber: leg.leg_number,
      routeCode: leg.route_code,
      color: legColors[idx % legColors.length],
      fromStop: {
        name: leg.origin.name,
        latitude: leg.origin.latitude,
        longitude: leg.origin.longitude,
      },
      toStop: {
        name: leg.destination.name,
        latitude: leg.destination.latitude,
        longitude: leg.destination.longitude,
      },
      coords: leg.shape_coordinates || [],
    }));

    const mappedHubs = connecting.transfer_hubs.map((hub, idx) => ({
      name: hub.name,
      name_gu: hub.name_gu,
      latitude: hub.latitude,
      longitude: hub.longitude,
      routeToSwitch: connecting.legs[idx + 1]?.route_code,
    }));

    setHighlightedSearchSegment({
      fromStop,
      toStop,
      isConnecting: true,
      legs: mappedLegs,
      transferHubs: mappedHubs,
    });

    // User requirement: For connecting routes, do NOT show the entire path or all stops of each bus.
    // Clear selectedRoute and number search route data so MapView renders ONLY the origin-to-destination connecting journey without route clutter.
    setSelectedRoute(null);
    setSelectedPatternSummary(null);
    setSelectedBus(null);
    setUpPatternDetail(null);
    setDownPatternDetail(null);
    setUpBuses([]);
    setDownBuses([]);
    try {
      sessionStorage.removeItem('amts_session_route');
      sessionStorage.removeItem('amts_session_dir_id');
      sessionStorage.removeItem('amts_session_bus_fleet');
      sessionStorage.removeItem('amts_session_bus_obj');
    } catch (e) {}
    // Automatically focus on the map on mobile
    setMobileView('map');
  };

  const handleBookFromStopSearch = (
    bus: ActiveBus,
    pattern: RoutePatternDetail,
    fromStop: Stop,
    toStop: Stop
  ) => {
    if (!currentUser) {
      setPendingBooking({ type: 'stop_search', bus, pattern, fromStop, toStop });
      setAuthPromptMessage('Please sign in or create an account to book your AMTS ticket.');
      setIsAuthModalOpen(true);
      return;
    }
    pushHistoryStep('booking');
    const matchedRoute = routes.find((r) => r.public_code === pattern.route_code);
    if (matchedRoute) {
      setSelectedRoute(matchedRoute);
      const summary = matchedRoute.patterns.find((p) => p.id === pattern.id) || matchedRoute.patterns[0];
      if (summary) setSelectedPatternSummary(summary);
    }
    if (pattern.direction_id === 0) {
      setUpPatternDetail(pattern);
    } else {
      setDownPatternDetail(pattern);
    }
    setBookingBus(bus);
    setBookingPattern(pattern);
    setBookingStops({
      boardingStopId: fromStop.stop_id || fromStop.id,
      exitStopId: toStop.stop_id || toStop.id,
    });
  };

  const handleLoginSuccess = useCallback((user: AuthUser) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    setAuthPromptMessage(null);
    refreshTicketState(user);
    if (user.role === 'admin') {
      handleNavigateToAdmin();
      setPendingBooking(null);
      return;
    }

    if (pendingBooking) {
      if (pendingBooking.type === 'local' && pendingBooking.bus) {
        handleOpenBooking(pendingBooking.bus, pendingBooking.pattern);
      } else if (pendingBooking.type === 'golden_pass') {
        handleOpenGoldenPassBooking();
      } else if (
        pendingBooking.type === 'stop_search' &&
        pendingBooking.bus &&
        pendingBooking.pattern &&
        pendingBooking.fromStop &&
        pendingBooking.toStop
      ) {
        handleBookFromStopSearch(
          pendingBooking.bus,
          pendingBooking.pattern,
          pendingBooking.fromStop,
          pendingBooking.toStop
        );
      }
      setPendingBooking(null);
    }
  }, [handleNavigateToAdmin, pendingBooking]);

  // Handle successful E-Ticket booking
  const handleBookingSuccess = (ticket: BookedTicket) => {
    refreshTicketState();
    setBookingBus(null);
    setBookingPattern(null);
    setBookingStops(null);
    setIsBookingGoldenPass(false);
    pushHistoryStep('ticket');
    setViewingTicket(ticket);

    // Only activate live route tracking for LOCAL single-journey tickets
    // Golden Pass is citywide across all buses without fixed stops
    if (ticket.ticket_type === 'local') {
      const targetRoute = routes.find((r) => r.public_code === ticket.trip.route_code);
      if (targetRoute) {
        setSelectedRoute(targetRoute);
        const targetPattern = targetRoute.patterns.find(
          (p) => p.direction_id === ticket.trip.direction_id
        );
        if (targetPattern) {
          setSelectedPatternSummary(targetPattern);
        }
      }

      const journey: PassengerJourneyState = {
        ticket,
        boardingStopId: ticket.trip.boarding_stop.id,
        boardingStopSequence: ticket.trip.boarding_stop.sequence,
        boardingStopName: ticket.trip.boarding_stop.name,
        exitStopId: ticket.trip.exit_stop.id,
        exitStopSequence: ticket.trip.exit_stop.sequence,
        exitStopName: ticket.trip.exit_stop.name,
        fleetNumber: ticket.trip.fleet_number,
        pathCoordinates: [],
      };

      setPassengerJourney(journey);

      try {
        sessionStorage.setItem('amts_session_route', ticket.trip.route_code);
        sessionStorage.setItem('amts_session_dir_id', String(ticket.trip.direction_id));
        sessionStorage.setItem('amts_session_bus_fleet', ticket.trip.fleet_number);
        sessionStorage.setItem('amts_session_journey', JSON.stringify(journey));
      } catch (e) {}

      const matchedBus = [...upBuses, ...downBuses].find(
        (b) => b.fleet_number === ticket.trip.fleet_number
      );
      if (matchedBus) {
        setSelectedBus(matchedBus);
      }
    } else if (ticket.ticket_type === 'connected' && ticket.connected_legs && ticket.connected_legs.length > 0) {
      const leg1 = ticket.connected_legs[0];
      const targetRoute = routes.find((r) => r.public_code === leg1.route_code);
      if (targetRoute) {
        setSelectedRoute(targetRoute);
        if (targetRoute.patterns[0]) {
          setSelectedPatternSummary(targetRoute.patterns[0]);
        }
      }
    }
  };

  const handleTrackOnMap = (ticket: BookedTicket) => {
    // Only single-journey local tickets have route tracking
    if (ticket.ticket_type !== 'local') return;

    const allBuses = [...upBuses, ...downBuses];
    if (isTicketExpired(ticket, allBuses)) {
      return;
    }

    pushHistoryStep('track_map');

    // Switch route and direction to the booked ticket's corridor
    const targetRoute = routes.find((r) => r.public_code === ticket.trip.route_code);
    if (targetRoute) {
      setSelectedRoute(targetRoute);
      const targetPattern = targetRoute.patterns.find(
        (p) => p.direction_id === ticket.trip.direction_id
      );
      if (targetPattern) {
        setSelectedPatternSummary(targetPattern);
      }
    }

    const journey: PassengerJourneyState = {
      ticket,
      boardingStopId: ticket.trip.boarding_stop.id,
      boardingStopSequence: ticket.trip.boarding_stop.sequence,
      boardingStopName: ticket.trip.boarding_stop.name,
      exitStopId: ticket.trip.exit_stop.id,
      exitStopSequence: ticket.trip.exit_stop.sequence,
      exitStopName: ticket.trip.exit_stop.name,
      fleetNumber: ticket.trip.fleet_number,
      pathCoordinates: [],
    };

    setPassengerJourney(journey);

    try {
      sessionStorage.setItem('amts_session_route', ticket.trip.route_code);
      sessionStorage.setItem('amts_session_dir_id', String(ticket.trip.direction_id));
      sessionStorage.setItem('amts_session_bus_fleet', ticket.trip.fleet_number);
      sessionStorage.setItem('amts_session_journey', JSON.stringify(journey));
    } catch (e) {}

    const matchedBus = allBuses.find(
      (b) => b.fleet_number === ticket.trip.fleet_number
    );
    if (matchedBus) {
      setSelectedBus(matchedBus);
    }
    setIsPassbookOpen(false);
    setViewingTicket(null);
    setMobileView('map');
  };

  // Automatically keep passenger's selected bus in sync once fleet loads or updates
  useEffect(() => {
    if (!passengerJourney) return;
    const all = [...upBuses, ...downBuses];
    const bus = all.find((b) => b.fleet_number === passengerJourney.fleetNumber);
    if (bus && (!selectedBus || selectedBus.fleet_number !== bus.fleet_number)) {
      setSelectedBus(bus);
    }
  }, [upBuses, downBuses, passengerJourney, selectedBus]);

  // 2. Fetch Full UP & DOWN Details when Selected Route changes
  useEffect(() => {
    if (!selectedRoute) return;

    async function loadRouteData() {
      try {
        const res = await fetch(`/api/v1/routes/${selectedRoute!.public_code}/live/`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();

        if (data.up) {
          if (data.up.stops) {
            data.up.stops.sort((a: any, b: any) => (a.stop_sequence || 0) - (b.stop_sequence || 0));
          }
          setUpPatternDetail(data.up);
        }
        if (data.down) {
          if (data.down.stops) {
            data.down.stops.sort((a: any, b: any) => (a.stop_sequence || 0) - (b.stop_sequence || 0));
          }
          setDownPatternDetail(data.down);
        }

        // Use canonical deterministic fleet order from backend for consistent simulation
        if (data.fleet && data.fleet.length > 0) {
          setBaseFleet(data.fleet);
        } else {
          // Fallback: Combine all buses from both directions as the route's full fleet
          const combinedFleet: ActiveBus[] = [
            ...(data.up?.active_buses || []),
            ...(data.down?.active_buses || []),
          ];

          // Deduplicate by fleet_number
          const uniqueFleetMap = new Map<string, ActiveBus>();
          combinedFleet.forEach((b) => {
            if (!uniqueFleetMap.has(b.fleet_number)) {
              uniqueFleetMap.set(b.fleet_number, b);
            }
          });

          const fleetList = Array.from(uniqueFleetMap.values());
          setBaseFleet(fleetList);
        }
      } catch (err) {
        console.error('Failed to load live route details:', err);
      }
    }

    loadRouteData();
  }, [selectedRoute]);

  // Handle selecting a pattern from search
  const handleSelectPattern = (route: RouteItem, pattern: RoutePatternSummary) => {
    pushHistoryStep('route_pattern');
    setSelectedRoute(route);
    setSelectedPatternSummary(pattern);
    setMobileView('map');
  };

  // Handle toggle between UP and DOWN
  const handleToggleDirection = () => {
    if (!selectedRoute) return;
    const targetDir = currentDirectionId === 0 ? 1 : 0;
    const newSummary = selectedRoute.patterns.find((p) => p.direction_id === targetDir);
    if (newSummary) {
      setSelectedPatternSummary(newSummary);
    }
  };

  // Ref to hold state for real-time schedule evaluation interval
  const stateRef = useRef({
    upPatternDetail,
    downPatternDetail,
    baseFleet,
    simSpeed,
    isPaused,
    timeOffsetSecs,
    selectedRoute,
  });

  useEffect(() => {
    stateRef.current = {
      upPatternDetail,
      downPatternDetail,
      baseFleet,
      simSpeed,
      isPaused,
      timeOffsetSecs,
      selectedRoute,
    };
  });

  // Track previous directions of each bus to detect and broadcast Turnaround Events
  const previousBusDirections = useRef<Map<string, number>>(new Map());

  // 3. Real-World Scheduled Clock Engine
  // Evaluates every second based on ACTUAL current time past midnight
  // User requirement 4: "bus moving all time so when i refresh or reopen then show current location of bus using schedule time , it is live so why you use default data. (important)."
  // User requirement 5: "when bus reaching stop , then next start when it schedule time is come , until show bus in red at stop."
  useEffect(() => {
    const interval = setInterval(() => {
      const {
        upPatternDetail: upPat,
        downPatternDetail: downPat,
        baseFleet: fleet,
        simSpeed: speed,
        isPaused: paused,
        timeOffsetSecs: offsetSecs,
        selectedRoute: route,
      } = stateRef.current;

      if (paused || !upPat || !downPat || !route || fleet.length === 0) return;

      // Current real-world seconds past midnight in Ahmedabad (IST)
      const baseSeconds = getCurrentISTSeconds();
      const currentSeconds = baseSeconds + offsetSecs;

      const scheduleConfig: RouteScheduleConfig = {
        upStops: upPat.stops || [],
        downStops: downPat.stops || [],
        routeCode: route.public_code,
        upPatternId: upPat.id,
        downPatternId: downPat.id,
        upDirectionName: upPat.direction_name,
        downDirectionName: downPat.direction_name,
      };

      const calculatedUp: ActiveBus[] = [];
      const calculatedDown: ActiveBus[] = [];
      const newTurnarounds: TurnaroundEvent[] = [];

      fleet.forEach((bus, busIdx) => {
        const { bus: evaluatedBus, currentDirectionId: dirId } = getBusScheduledState(
          busIdx,
          fleet.length,
          bus,
          scheduleConfig,
          currentSeconds
        );

        // Detect if this bus just turned around from the opposite direction!
        const prevDir = previousBusDirections.current.get(evaluatedBus.fleet_number);
        if (prevDir !== undefined && prevDir !== dirId) {
          // Bus transitioned across terminal!
          const fromName = prevDir === 0 ? upPat.direction_name : downPat.direction_name;
          const toName = dirId === 0 ? upPat.direction_name : downPat.direction_name;
          const termStop = prevDir === 0 ? upPat.stops[upPat.stops.length - 1]?.name : downPat.stops[downPat.stops.length - 1]?.name;

          newTurnarounds.push({
            id: `${evaluatedBus.fleet_number}-${Date.now()}`,
            timestamp: formatTimeFromSeconds(currentSeconds),
            fleet_number: evaluatedBus.fleet_number,
            bus_model: evaluatedBus.bus_model,
            terminal_stop_name: termStop || 'Terminal',
            from_direction: fromName,
            to_direction: toName,
            to_pattern_id: dirId === 0 ? upPat.id : downPat.id,
          });

          // Sync backend in background
          fetch('/api/v1/trips/turnaround/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fleet_number: evaluatedBus.fleet_number }),
          }).catch((e) => console.log('Turnaround sync:', e));
        }

        previousBusDirections.current.set(evaluatedBus.fleet_number, dirId);

        if (dirId === 0) {
          calculatedUp.push(evaluatedBus);
        } else {
          calculatedDown.push(evaluatedBus);
        }
      });

      setUpBuses(calculatedUp);
      setDownBuses(calculatedDown);

      // Periodically sync ticket expiration against live fleet
      const combinedFleet = [...calculatedUp, ...calculatedDown];
      syncTicketExpiration(combinedFleet);

      if (newTurnarounds.length > 0) {
        setTurnaroundEvents((prev) => [...newTurnarounds, ...prev.slice(0, 9)]);
      }

      // If simulation speed > 1, advance timeOffsetSecs
      if (speed > 1) {
        setTimeOffsetSecs((prev) => prev + (speed - 1));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // User rule: Count only buses actively running on the road between stands (not standing at start or end terminal)
  const isRunningOnRoad = (bus: ActiveBus, totalStops: number) => {
    if (bus.lifecycle_status === 'MOVING') return true;
    if (bus.current_stop_index > 0 && bus.current_stop_index < totalStops - 1) return true;
    return false;
  };

  const totalRunningOnRoad =
    upBuses.filter((b) => isRunningOnRoad(b, upPatternDetail?.stops?.length || 1)).length +
    downBuses.filter((b) => isRunningOnRoad(b, downPatternDetail?.stops?.length || 1)).length;

  const networkActiveBusCount = useMemo(() => {
    const total = routes.reduce((sum, r) => {
      return sum + (r.patterns || []).reduce((pSum, p) => pSum + (p.active_buses_count || 0), 0);
    }, 0);
    return total > 0 ? total : 27;
  }, [routes]);

  // Active bus for passenger's booked trip
  const passengerBus = passengerJourney
    ? [...upBuses, ...downBuses].find((b) => b.fleet_number === passengerJourney.fleetNumber) || null
    : null;

  // Track if any modal is currently active to prevent mobile FAB overlay
  const isAnyModalOpen = Boolean(
    (bookingBus && (bookingPattern || currentPatternDetail)) ||
    isBookingGoldenPass ||
    viewingTicket ||
    isPassbookOpen ||
    isAdvisoriesOpen ||
    isAuthModalOpen
  );

  // Determine if the user is in a non-root state where mobile exit / back button can step back
  const canGoBack = Boolean(
    viewingTicket ||
    bookingBus ||
    isBookingGoldenPass ||
    isPassbookOpen ||
    isAdvisoriesOpen ||
    isAuthModalOpen ||
    mobileView === 'map' ||
    highlightedSearchSegment ||
    selectedRoute
  );

  // If in Admin Dashboard mode (URL: http://localhost:5173/admin-dashboard)
  if (isAdminMode) {
    return (
      <AdminDashboard
        onSwitchToPassengerPortal={handleNavigateToPassenger}
        currentUser={currentUser}
        onLogout={handleLogout}
        onTrackBusOnMap={async (bus: FleetVehicleTelemetry) => {
          handleNavigateToPassenger();
          pushHistoryStep('admin_track_bus');

          // Extract target route code from bus telemetry
          const routeCode =
            (bus as any).route_code ||
            bus.assigned_route?.match(/Route\s+([0-9A-Z]+)/i)?.[1] ||
            bus.fleet_number?.split('-')?.[0];

          if (!routeCode) return;

          try {
            // Immediately fetch fresh routes list & live tracking endpoint for this route
            const [freshRoutesList, liveRes] = await Promise.all([
              loadRoutes(),
              fetch(`/api/v1/routes/${routeCode}/live/`),
            ]);

            const targetRoute = (freshRoutesList.length > 0 ? freshRoutesList : routes).find(
              (r) => r.public_code.toLowerCase() === String(routeCode).toLowerCase()
            );

            if (liveRes.ok) {
              const liveData = await liveRes.json();
              if (liveData.up) {
                if (liveData.up.stops) {
                  liveData.up.stops.sort((a: any, b: any) => (a.stop_sequence || 0) - (b.stop_sequence || 0));
                }
                setUpPatternDetail(liveData.up);
              }
              if (liveData.down) {
                if (liveData.down.stops) {
                  liveData.down.stops.sort((a: any, b: any) => (a.stop_sequence || 0) - (b.stop_sequence || 0));
                }
                setDownPatternDetail(liveData.down);
              }
              if (liveData.fleet && liveData.fleet.length > 0) {
                setBaseFleet(liveData.fleet);
              }

              // Determine direction based on where the bus is operating in PostgreSQL
              let dirId = (bus as any).direction_id;
              if (dirId === undefined || dirId === null) {
                if (liveData.down?.active_buses?.some((b: any) => b.fleet_number === bus.fleet_number)) {
                  dirId = 1;
                } else if (liveData.up?.active_buses?.some((b: any) => b.fleet_number === bus.fleet_number)) {
                  dirId = 0;
                } else {
                  dirId = 0;
                }
              }

              const targetPattern =
                targetRoute?.patterns?.find((p) => p.direction_id === dirId) ||
                targetRoute?.patterns?.[0] ||
                null;

              if (targetRoute) {
                setSelectedRoute(targetRoute);
                if (targetPattern) {
                  setSelectedPatternSummary(targetPattern);
                }
              }

              const targetDetail = dirId === 1 ? (liveData.down || liveData.up) : (liveData.up || liveData.down);
              const activeBusFromLive = targetDetail?.active_buses?.find((b: any) => b.fleet_number === bus.fleet_number);
              const firstStop = targetDetail?.stops?.[0];
              const secondStop = targetDetail?.stops?.[1];

              const lat = bus.current_latitude || activeBusFromLive?.latitude || (firstStop ? firstStop.latitude : 23.01502);
              const lon = bus.current_longitude || activeBusFromLive?.longitude || (firstStop ? firstStop.longitude : 72.56555);

              setSelectedBus({
                fleet_number: bus.fleet_number,
                registration_number: bus.registration_number,
                bus_model: bus.bus_model,
                fuel_type: bus.fuel_type,
                has_ac: bus.has_ac,
                seated_capacity: bus.seated_capacity,
                current_stop_index: 0,
                current_stop_name: bus.current_stand_name || activeBusFromLive?.current_stop_name || (firstStop ? firstStop.name : ''),
                next_stop_name: bus.next_stand_name || activeBusFromLive?.next_stop_name || (secondStop ? secondStop.name : ''),
                latitude: lat,
                longitude: lon,
                speed_kmh: bus.speed_kmh || activeBusFromLive?.speed_kmh || 28,
                crowd_density: (bus.crowding as any) || 'Moderate',
                status: bus.status === 'DELAYED' ? 'delayed' : 'running',
                progress_ratio: 0.1,
                delay_minutes: bus.delay_minutes || 0,
                rounds_completed: bus.rounds_completed_today || 1,
              } as any);

              try {
                sessionStorage.setItem('amts_session_route', targetRoute ? targetRoute.public_code : String(routeCode));
                sessionStorage.setItem('amts_session_dir_id', String(dirId));
                sessionStorage.setItem('amts_session_bus_fleet', bus.fleet_number);
              } catch (e) {}
            }
          } catch (err) {
            console.error('Failed to load tracking data for bus:', err);
          }

          setSearchMode('by_number');
          setHighlightedSearchSegment(null);
          setMobileView('map');
        }}
      />
    );
  }

  return (
    <div className="portal-root">
      <Navbar
        totalRoutes={routes.length}
        activeBusCount={selectedRoute ? totalRunningOnRoad : networkActiveBusCount}
        ticketsCount={storedTickets.length}
        hasGoldenTicket={activeGoldenPasses.length > 0}
        goldenPassCount={activeGoldenPasses.length}
        onOpenPassbook={handleOpenPassbook}
        onHomeClick={handleResetToHome}
        canGoBack={canGoBack}
        onBackClick={handleOneStepBack}
        advisoriesCount={activeAlerts.length}
        onOpenAdvisories={() => {
          pushHistoryStep('advisories');
          setIsAdvisoriesOpen(true);
        }}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
        onSwitchToAdmin={handleNavigateToAdmin}
      />

      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Floating Live Passenger Journey Arrival Assistant Banner */}
      {passengerJourney && (
        <PassengerTripBanner
          ticket={passengerJourney.ticket}
          bus={passengerBus}
          onViewTicket={() => handleOpenViewingTicket(passengerJourney.ticket)}
          onDismiss={() => setPassengerJourney(null)}
          onTicketExpired={() => refreshTicketState()}
        />
      )}

      <main className="portal-main-layout">
        {/* Left Side: Route Search & Real-time Filter */}
        <aside className={`portal-sidebar-left ${mobileView === 'map' ? 'mobile-hidden' : 'mobile-active'}`}>
          {/* Top Search Mode Switcher: By Stop Name (Left) | By Number (Right) */}
          <div className="search-mode-switcher-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === 'by_stop'}
              className={`search-mode-tab ${searchMode === 'by_stop' ? 'active' : ''}`}
              onClick={() => {
                setSearchMode('by_stop');
                // Remove route of search by number so it doesn't collide with stop search or connected routes
                setSelectedRoute(null);
                setSelectedPatternSummary(null);
                setSelectedBus(null);
                setUpPatternDetail(null);
                setDownPatternDetail(null);
                setUpBuses([]);
                setDownBuses([]);
                try {
                  sessionStorage.removeItem('amts_session_route');
                  sessionStorage.removeItem('amts_session_dir_id');
                  sessionStorage.removeItem('amts_session_bus_fleet');
                  sessionStorage.removeItem('amts_session_bus_obj');
                } catch (e) {}
              }}
            >
              <MapPin size={15} />
              <span>Search by Stop Name</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === 'by_number'}
              className={`search-mode-tab ${searchMode === 'by_number' ? 'active' : ''}`}
              onClick={() => {
                setSearchMode('by_number');
                setHighlightedSearchSegment(null);
              }}
            >
              <Bus size={15} />
              <span>Search by Number</span>
            </button>
          </div>

          {searchMode === 'by_number' ? (
            <>
              <RouteSearch
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                routes={routes}
                selectedPatternId={selectedPatternSummary?.id || null}
                onSelectPattern={handleSelectPattern}
              />

              {selectedRoute ? (
                <LiveBusTracker
                  pattern={currentPatternDetail}
                  activeBuses={currentBuses}
                  allBuses={allCurrentRouteBuses}
                  selectedBus={selectedBus}
                  onSelectBus={setSelectedBus}
                  onToggleDirection={handleToggleDirection}
                  turnaroundEvents={turnaroundEvents}
                  simSpeed={simSpeed}
                  onSpeedChange={setSimSpeed}
                  isPaused={isPaused}
                  onTogglePause={() => setIsPaused((p) => !p)}
                  onBookTicket={(bus) => handleOpenBooking(bus)}
                  activeGoldenPass={activeGoldenPasses[0] || null}
                  activeGoldenPasses={activeGoldenPasses}
                  onShowPass={handleOpenViewingTicket}
                  onCloseRoute={handleOneStepBack}
                />
              ) : (
                <div className="welcome-search-panel">
                  <div className="welcome-icon-box">
                    <Compass size={40} className="text-red" />
                  </div>
                  <h3 className="welcome-title">Search Any AMTS Bus Number</h3>
                  <p className="welcome-desc">
                    Type any bus route number (e.g. <strong>31</strong>, <strong>34</strong>, <strong>50</strong>, <strong>103</strong>, <strong>117</strong>) above to track live buses moving along their official scheduled corridors.
                  </p>
                  <div className="welcome-highlights">
                    <div className="highlight-row">
                      <span className="dot dot-green"></span>
                      <span><strong>Green Bus:</strong> Moving or Ready to Depart on Schedule</span>
                    </div>
                    <div className="highlight-row">
                      <span className="dot dot-red"></span>
                      <span><strong>Red Bus:</strong> Stopped at Stop/Terminal for Scheduled Dwell</span>
                    </div>
                    <div className="highlight-row">
                      <span className="dot dot-blue"></span>
                      <span><strong>Live Schedule:</strong> Real time-of-day clock tracking that persists across browser refresh</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <StopSearch
              routes={routes}
              onSelectBusOnMap={handleSelectBusFromStopSearch}
              onBookTicket={handleBookFromStopSearch}
              onSelectConnectingOnMap={handleSelectConnectingFromStopSearch}
              onBuyGoldenPass={handleOpenGoldenPassBooking}
              activeGoldenPasses={activeGoldenPasses}
            />
          )}
        </aside>

        {/* Right Side: High-Performance Live Map */}
        <section className={`portal-map-section ${mobileView === 'list' ? 'mobile-hidden' : 'mobile-active'}`}>
          <MapView
            pattern={currentPatternDetail}
            activeBuses={currentBuses}
            allBuses={allCurrentRouteBuses}
            selectedBus={selectedBus}
            onSelectBus={setSelectedBus}
            passengerJourney={passengerJourney}
            highlightedSearchSegment={highlightedSearchSegment}
            onBookTicketForBus={(bus) => {
              handleOpenBooking(bus, currentPatternDetail);
            }}
          />
        </section>
      </main>

      {/* Floating Action Button (FAB) for Mobile Device View Switcher (Hidden when any modal is open) */}
      {!isAnyModalOpen && (
        <div className="mobile-view-fab-container">
          <button
            type="button"
            className="mobile-view-fab"
            onClick={() => {
              if (mobileView === 'list') {
                pushHistoryStep('map');
                setMobileView('map');
              } else {
                handleOneStepBack();
              }
            }}
            aria-label={mobileView === 'list' ? 'Switch to live map view' : 'Switch to bus search list view'}
          >
            {mobileView === 'list' ? (
              <>
                <span className="fab-live-dot"></span>
                <Navigation size={17} />
                <span>View Live Map</span>
              </>
            ) : (
              <>
                <List size={17} />
                <span>Search & Buses</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Booking Wizard Modal */}
      {(Boolean(bookingBus && (bookingPattern || currentPatternDetail)) || isBookingGoldenPass) && (
        <BookingModal
          bus={bookingBus}
          pattern={bookingPattern || currentPatternDetail}
          isGoldenPassOnly={isBookingGoldenPass}
          isOpen={Boolean(bookingBus || isBookingGoldenPass)}
          onClose={handleOneStepBack}
          onBookingSuccess={handleBookingSuccess}
          onShowActivePass={handleOpenViewingTicket}
          initialBoardingStopId={bookingStops?.boardingStopId}
          initialExitStopId={bookingStops?.exitStopId}
          currentUser={currentUser}
          onOpenAuth={handleOpenAuth}
        />
      )}

      {/* Digital E-Ticket & Pass Modal */}
      <TicketModal
        ticket={viewingTicket}
        allActiveTickets={storedTickets.filter((t) => !isTicketExpired(t, [...upBuses, ...downBuses]))}
        isOpen={Boolean(viewingTicket)}
        onClose={handleOneStepBack}
        onTrackOnMap={handleTrackOnMap}
        onDeleteTicket={handleDeleteTicket}
        buses={[...upBuses, ...downBuses]}
      />

      {/* Digital Passbook / My Tickets Modal */}
      <PassbookModal
        isOpen={isPassbookOpen}
        onClose={handleOneStepBack}
        onSelectTicket={(t) => handleOpenViewingTicket(t, true)}
        onTrackOnMap={handleTrackOnMap}
        onDeleteTicket={handleDeleteTicket}
        buses={[...upBuses, ...downBuses]}
        currentUser={currentUser}
      />

      {/* Public Service Advisories & Detours Modal */}
      <ServiceAdvisoriesModal
        isOpen={isAdvisoriesOpen}
        onClose={handleOneStepBack}
        alerts={activeAlerts}
      />

      {/* User & Admin Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={handleCloseAuth}
        onLoginSuccess={handleLoginSuccess}
        promptMessage={authPromptMessage}
      />
    </div>
  );
}
