import React, { useState, useMemo } from 'react';
import {
  X,
  Bus,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Crown,
  MapPin,
  ArrowRight,
  User,
  HeartHandshake,
  Lock,
} from 'lucide-react';
import { ActiveBus, RoutePatternDetail, Stop, BookedTicket, AuthUser } from '../types';
import { saveTicket, getActiveGoldenTickets } from '../utils/ticketStorage';
import { PaymentModal, PaymentDetails } from './PaymentModal';

interface BookingModalProps {
  bus?: ActiveBus | null;
  pattern?: RoutePatternDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onBookingSuccess: (ticket: BookedTicket) => void;
  onShowActivePass?: (ticket: BookedTicket) => void;
  initialBoardingStopId?: string;
  initialExitStopId?: string;
  fromStop?: Stop | null;
  toStop?: Stop | null;
  isGoldenPassOnly?: boolean;
  currentUser?: AuthUser | null;
  onOpenAuth?: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  bus,
  pattern,
  isOpen,
  onClose,
  onBookingSuccess,
  initialBoardingStopId,
  initialExitStopId,
  isGoldenPassOnly,
  currentUser = null,
  onOpenAuth,
}) => {
  const activeGoldenPasses = useMemo(() => getActiveGoldenTickets(currentUser), [isOpen, currentUser]);
  const hasActiveGoldenPass = activeGoldenPasses.length > 0;

  // Ticket type choice: 'local' (Single Journey) | 'golden_pass' (All-Day Pass)
  const [ticketType, setTicketType] = useState<'local' | 'golden_pass'>(() => {
    return isGoldenPassOnly ? 'golden_pass' : 'local';
  });

  React.useEffect(() => {
    if (isGoldenPassOnly) {
      setTicketType('golden_pass');
    }
  }, [isGoldenPassOnly]);
  const [isCoPassengerBooking, setIsCoPassengerBooking] = useState<boolean>(hasActiveGoldenPass);

  // Passenger form states
  const [passengerName, setPassengerName] = useState<string>(() => {
    return currentUser ? (currentUser.full_name || currentUser.username) : '';
  });

  React.useEffect(() => {
    if (currentUser && !passengerName) {
      setPassengerName(currentUser.full_name || currentUser.username);
    }
  }, [currentUser]);
  const [ageStr, setAgeStr] = useState<string>('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Eligible boarding & exit stops for Local Ticket
  const matchedInitialBoarding = useMemo(() => {
    if (!initialBoardingStopId || !pattern) return null;
    return (
      pattern.stops?.find(
        (s) =>
          (s.stop_id && s.stop_id === initialBoardingStopId) ||
          (s.id && s.id === initialBoardingStopId)
      ) || null
    );
  }, [pattern, initialBoardingStopId]);

  const matchedInitialExit = useMemo(() => {
    if (!initialExitStopId || !pattern) return null;
    return (
      pattern.stops?.find(
        (s) =>
          (s.stop_id && s.stop_id === initialExitStopId) ||
          (s.id && s.id === initialExitStopId)
      ) || null
    );
  }, [pattern, initialExitStopId]);

  const eligibleBoardingStops = useMemo(() => {
    if (!pattern) return [];
    const stops = pattern.stops || [];
    const minBoardingIdx =
      bus && bus.lifecycle_status === 'MOVING' ? bus.current_stop_index + 1 : (bus?.current_stop_index || 0);
    return stops.filter((s, idx) => {
      if (
        matchedInitialBoarding &&
        ((s.stop_id && s.stop_id === matchedInitialBoarding.stop_id) ||
          (s.id && s.id === matchedInitialBoarding.id))
      ) {
        return true;
      }
      return idx >= minBoardingIdx && idx < stops.length - 1;
    });
  }, [pattern, bus, matchedInitialBoarding]);

  const [selectedBoardingId, setSelectedBoardingId] = useState<string>(() => {
    if (matchedInitialBoarding) {
      return matchedInitialBoarding.stop_id || matchedInitialBoarding.id || '';
    }
    return eligibleBoardingStops[0]?.stop_id || eligibleBoardingStops[0]?.id || '';
  });

  React.useEffect(() => {
    if (matchedInitialBoarding) {
      setSelectedBoardingId(matchedInitialBoarding.stop_id || matchedInitialBoarding.id || '');
    } else if (
      eligibleBoardingStops.length > 0 &&
      (!selectedBoardingId ||
        !eligibleBoardingStops.some((s) => (s.stop_id || s.id) === selectedBoardingId))
    ) {
      setSelectedBoardingId(eligibleBoardingStops[0].stop_id || eligibleBoardingStops[0].id || '');
    }
  }, [eligibleBoardingStops, selectedBoardingId, matchedInitialBoarding]);

  const selectedBoardingStop = useMemo(() => {
    if (!pattern) return null;
    return (
      pattern.stops?.find(
        (s) =>
          (s.stop_id && s.stop_id === selectedBoardingId) ||
          (s.id && s.id === selectedBoardingId) ||
          (s.stop_id || s.id) === selectedBoardingId
      ) || null
    );
  }, [pattern, selectedBoardingId]);

  const boardingIndex = useMemo(() => {
    if (!selectedBoardingStop || !pattern) return -1;
    const bid = selectedBoardingStop.stop_id || selectedBoardingStop.id;
    return pattern.stops.findIndex((s) => (s.stop_id || s.id) === bid);
  }, [pattern, selectedBoardingStop]);

  const eligibleExitStops = useMemo(() => {
    if (!pattern) return [];
    const stops = pattern.stops || [];
    if (boardingIndex === -1) return [];
    return stops.filter((s, idx) => {
      if (
        matchedInitialExit &&
        ((s.stop_id && s.stop_id === matchedInitialExit.stop_id) ||
          (s.id && s.id === matchedInitialExit.id))
      ) {
        return true;
      }
      return idx > boardingIndex;
    });
  }, [pattern, boardingIndex, matchedInitialExit]);

  const [selectedExitId, setSelectedExitId] = useState<string>(() => {
    if (matchedInitialExit) {
      return matchedInitialExit.stop_id || matchedInitialExit.id || '';
    }
    return '';
  });

  React.useEffect(() => {
    if (matchedInitialExit) {
      setSelectedExitId(matchedInitialExit.stop_id || matchedInitialExit.id || '');
    } else if (
      eligibleExitStops.length > 0 &&
      (!selectedExitId ||
        !eligibleExitStops.some((s) => (s.stop_id || s.id) === selectedExitId))
    ) {
      const last = eligibleExitStops[eligibleExitStops.length - 1];
      setSelectedExitId(last.stop_id || last.id || '');
    } else if (eligibleExitStops.length === 0) {
      setSelectedExitId('');
    }
  }, [eligibleExitStops, selectedExitId, matchedInitialExit]);

  const selectedExitStop = useMemo(() => {
    if (!pattern) return null;
    return (
      pattern.stops?.find(
        (s) =>
          (s.stop_id && s.stop_id === selectedExitId) ||
          (s.id && s.id === selectedExitId) ||
          (s.stop_id || s.id) === selectedExitId
      ) || null
    );
  }, [pattern, selectedExitId]);

  const exitIndex = useMemo(() => {
    if (!selectedExitStop || !pattern) return -1;
    const eid = selectedExitStop.stop_id || selectedExitStop.id;
    return pattern.stops.findIndex((s) => (s.stop_id || s.id) === eid);
  }, [pattern, selectedExitStop]);

  // Calculations: stops count & journey time
  const stopsCount = Math.max(0, exitIndex - boardingIndex);
  const estimatedJourneyMinutes = Math.max(3, Math.round(stopsCount * 1.5));

  // Numeric age & concessions
  const numericAge = parseInt(ageStr, 10) || 0;
  const isChild = numericAge > 0 && numericAge < 12;
  const isSenior = numericAge >= 60;

  // Single bus stage fare
  const stageFare = useMemo(() => {
    if (stopsCount <= 0) return 5;
    if (stopsCount <= 3) return 5;
    if (stopsCount <= 7) return 10;
    if (stopsCount <= 12) return 15;
    if (stopsCount <= 18) return 20;
    return 25;
  }, [stopsCount]);

  const localFare = useMemo(() => {
    if (isChild || isSenior) {
      return Math.max(5, Math.round(stageFare * 0.5));
    }
    return stageFare;
  }, [stageFare, isChild, isSenior]);

  const goldenPassFare = gender === 'female' ? 35 : 45;
  const finalPrice = ticketType === 'golden_pass' ? goldenPassFare : localFare;

  if (!isOpen) return null;

  // Validate and proceed to payment
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentUser) {
      setErrorMessage('Sign in required. Please sign in or create an account to book tickets.');
      if (onOpenAuth) onOpenAuth();
      return;
    }

    if (!passengerName.trim()) {
      setErrorMessage('Please enter passenger full name.');
      return;
    }
    if (!numericAge || numericAge <= 0 || numericAge > 120) {
      setErrorMessage('Please enter a valid age between 1 and 120.');
      return;
    }

    if (ticketType === 'local') {
      if (!selectedBoardingId || !selectedExitId) {
        setErrorMessage('Please select both boarding and destination stops.');
        return;
      }
      if (exitIndex <= boardingIndex) {
        setErrorMessage('Ending stop must be strictly ahead of boarding stop.');
        return;
      }
    }

    setShowPaymentModal(true);
  };

  // Called after payment is verified and completed by gateway
  const handlePaymentSuccess = async (details: PaymentDetails) => {
    try {
      setLoading(true);
      const payload: any = {
        ticket_type: ticketType,
        passenger_name: passengerName.trim(),
        username: currentUser?.username || '',
        age: numericAge,
        gender: gender,
        is_copassenger: isCoPassengerBooking,
        payment_method: details.methodName,
        transaction_id: details.transactionId,
      };

      if (ticketType === 'local' && bus && pattern) {
        payload.fleet_number = bus.fleet_number;
        payload.pattern_id = pattern.id;
        payload.boarding_stop_id = selectedBoardingStop?.stop_id || selectedBoardingId;
        payload.exit_stop_id = selectedExitStop?.stop_id || selectedExitId;
      }

      const res = await fetch('/api/v1/tickets/book/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const bookedData: BookedTicket = await res.json();
      if (isCoPassengerBooking) {
        bookedData.passenger.is_copassenger = true;
      }
      saveTicket(bookedData, currentUser);
      setShowPaymentModal(false);
      onBookingSuccess(bookedData);
    } catch (err: any) {
      console.error('Booking failed:', err);
      setErrorMessage(err.message || 'Failed to generate ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="booking-modal-card">
        <div className="sheet-drag-pill"></div>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="header-left">
            {isGoldenPassOnly ? (
              <div className="bus-fleet-pill golden-fleet-pill" style={{ background: '#FEF3C7', color: '#B45309', borderColor: '#F59E0B' }}>
                <Crown size={16} />
                <span>All-Day Transit Pass</span>
              </div>
            ) : (
              <div className="bus-fleet-pill">
                <Bus size={16} />
                <span>Bus {bus?.fleet_number || 'AMTS'}</span>
              </div>
            )}
            <div>
              <h3 className="modal-title">
                {isGoldenPassOnly ? 'Buy AMTS Golden Ticket Pass' : 'Book AMTS Online E-Ticket'}
              </h3>
              <p className="modal-subtitle">
                {isGoldenPassOnly
                  ? 'Unlimited rides on ALL AMTS buses today until 23:59:59'
                  : `Route ${pattern?.route_code || ''}: ${pattern?.direction_name || ''}`}
              </p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Require Sign In Alert if not authenticated */}
        {!currentUser && (
          <div className="auth-booking-gate-banner">
            <Lock size={16} className="text-red shrink-0" />
            <div className="gate-text">
              <strong>Account Required:</strong> Sign in or register to book your ticket and access it in your passbook.
            </div>
            <button
              type="button"
              className="gate-signin-link-btn"
              onClick={() => {
                if (onOpenAuth) onOpenAuth();
              }}
            >
              Sign In ➔
            </button>
          </div>
        )}

        {/* Informative notice if user already has an active Golden Pass */}
        {hasActiveGoldenPass && (
          <div className="active-pass-holder-banner">
            <Crown size={18} className="text-amber shrink-0" />
            <div className="banner-text">
              <strong>Active Golden Pass Detected ({activeGoldenPasses[0].passenger.name})</strong>
              <p>
                Your personal rides are already covered on ALL AMTS buses today! You can book a ticket for your co-passenger below.
              </p>
            </div>
          </div>
        )}

        {/* Ticket Type Selector (Only shown if opened for a specific bus route, not Golden Pass only) */}
        {!isGoldenPassOnly && (
          <div className="ticket-type-top-selector">
            <button
              type="button"
              className={`type-selector-tab ${ticketType === 'local' ? 'active' : ''}`}
              onClick={() => setTicketType('local')}
            >
              <div className="tab-icon-box">
                <Bus size={18} />
              </div>
              <div className="tab-info">
                <div className="tab-title">Single Journey Local Ticket</div>
                <div className="tab-sub">Valid for this route ({pattern?.route_code})</div>
              </div>
              <div className="tab-price-chip">₹{localFare}</div>
            </button>

            <button
              type="button"
              className={`type-selector-tab golden-tab ${ticketType === 'golden_pass' ? 'active' : ''}`}
              onClick={() => setTicketType('golden_pass')}
            >
              <div className="tab-icon-box golden-icon">
                <Crown size={18} />
              </div>
              <div className="tab-info">
                <div className="tab-title">AMTS Golden Ticket (All-Day Pass)</div>
                <div className="tab-sub">Unlimited rides on ALL buses today</div>
              </div>
              <div className="tab-price-chip golden-price-chip">
                {gender === 'female' ? '₹35' : '₹45'}
              </div>
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="modal-error-alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleProceedToPayment} className="booking-form">
          {/* Co-Passenger Checkbox */}
          <div className="form-group copassenger-checkbox-group">
            <label className="checkbox-row-label">
              <input
                type="checkbox"
                checked={isCoPassengerBooking}
                onChange={(e) => setIsCoPassengerBooking(e.target.checked)}
              />
              <span>
                Book as <strong>Co-Passenger Ticket</strong> (Family or Friend traveling with you)
              </span>
            </label>
          </div>

          {/* PASSENGER DETAILS */}
          <div className="form-section">
            <div className="section-title">
              <User size={15} className="text-red" />
              <span>Passenger Details</span>
            </div>

            <div className="passenger-inputs-grid">
              <div className="form-group name-group">
                <label className="form-label">Full Name (મુસાફરનું નામ)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ramesh Patel"
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group age-group">
                <label className="form-label">Age in Number (ઉંમર)</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max="120"
                  placeholder="e.g. 24"
                  value={ageStr}
                  onChange={(e) => setAgeStr(e.target.value)}
                  required
                />
              </div>

              <div className="form-group gender-group">
                <label className="form-label">Gender (જાતિ)</label>
                <div className="gender-toggle-row">
                  <button
                    type="button"
                    className={`gender-btn ${gender === 'male' ? 'active' : ''}`}
                    onClick={() => setGender('male')}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    className={`gender-btn ${gender === 'female' ? 'active' : ''}`}
                    onClick={() => setGender('female')}
                  >
                    Female
                  </button>
                </div>
              </div>
            </div>

            {ticketType === 'local' && (isChild || isSenior) && (
              <div className="concession-badge-notice">
                <HeartHandshake size={14} className="text-emerald" />
                <span>
                  {isChild
                    ? '🎉 Child Concession Applied (50% Off Fare)'
                    : '🎉 Senior Citizen Concession Applied (50% Off Fare)'}
                </span>
              </div>
            )}
          </div>

          {/* LOCAL TICKET: Select Journey Stands */}
          {ticketType === 'local' && pattern && (
            <div className="form-section">
              <div className="section-title">
                <MapPin size={15} className="text-red" />
                <span>Select Journey Stands</span>
              </div>

              <div className="stops-select-grid">
                {/* Boarding Stop */}
                <div className="form-group">
                  <label className="form-label">
                    <span>1. Boarding Stand (ચડવાનું સ્ટેશન)</span>
                    <span className="label-tip">Ahead of bus position</span>
                  </label>
                  <select
                    className="form-select"
                    value={selectedBoardingId}
                    onChange={(e) => setSelectedBoardingId(e.target.value)}
                    required
                  >
                    {eligibleBoardingStops.length === 0 ? (
                      <option value="">No upcoming stops on this trip</option>
                    ) : (
                      eligibleBoardingStops.map((stop) => {
                        const stopVal = stop.stop_id || stop.id;
                        return (
                          <option key={stopVal} value={stopVal}>
                            Stand #{stop.stop_sequence}: {stop.name} {stop.name_gu ? `(${stop.name_gu})` : ''}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                <div className="stop-arrow-divider">
                  <ArrowRight size={18} />
                </div>

                {/* Exit Stop */}
                <div className="form-group">
                  <label className="form-label">
                    <span>2. Exit Stand (ઉતરવાનું સ્ટેશન)</span>
                    <span className="label-tip">Destination</span>
                  </label>
                  <select
                    className="form-select"
                    value={selectedExitId}
                    onChange={(e) => setSelectedExitId(e.target.value)}
                    required
                  >
                    {eligibleExitStops.length === 0 ? (
                      <option value="">Select boarding stand first</option>
                    ) : (
                      eligibleExitStops.map((stop) => {
                        const stopVal = stop.stop_id || stop.id;
                        return (
                          <option key={stopVal} value={stopVal}>
                            Stand #{stop.stop_sequence}: {stop.name} {stop.name_gu ? `(${stop.name_gu})` : ''}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>
              </div>

              {selectedBoardingStop && selectedExitStop && stopsCount > 0 && (
                <div className="journey-estimates-strip">
                  <div className="estimate-item">
                    <Clock size={14} className="text-primary" />
                    <span>
                      Est. Journey Time: <strong>~{estimatedJourneyMinutes} mins</strong>
                    </span>
                  </div>
                  <div className="estimate-divider">•</div>
                  <div className="estimate-item">
                    <span>
                      Distance: <strong>{stopsCount} Stands</strong>
                    </span>
                  </div>
                  <div className="estimate-divider">•</div>
                  <div className="estimate-item">
                    <span>
                      Standard Stage Fare: <strong>₹{stageFare}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GOLDEN TICKET: Citywide Pass Notice */}
          {ticketType === 'golden_pass' && (
            <div className="golden-pass-info-card">
              <div className="golden-info-header">
                <Crown size={20} className="text-amber shrink-0" />
                <div>
                  <strong>All-Day AMTS Citywide Pass (માનપસંદ પાસ)</strong>
                  <p>
                    Valid across ALL AMTS routes & buses in Ahmedabad until 23:59:59 tonight with unlimited transfers.
                  </p>
                </div>
              </div>
              <div className="golden-pass-pricing-row">
                <span className={`gender-price-pill ${gender === 'female' ? 'selected' : ''}`}>
                  Female: ₹35
                </span>
                <span className={`gender-price-pill ${gender === 'male' ? 'selected' : ''}`}>
                  Male: ₹45
                </span>
              </div>
            </div>
          )}

          {/* Modal Footer / Payment Action */}
          <div className="modal-footer">
            <div className="footer-price-summary">
              <div className="price-label">Total Payable Fare</div>
              <div className="price-value">
                ₹{finalPrice}
                <span className="price-sub">
                  ({ticketType === 'golden_pass'
                    ? gender === 'female'
                      ? 'Female Pass (₹35)'
                      : 'Male Pass (₹45)'
                    : `${stopsCount} Stands`})
                </span>
              </div>
            </div>

            <div className="footer-action-buttons">
              <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              {!currentUser ? (
                <button
                  type="button"
                  className="btn-submit-booking auth-required-submit-btn"
                  onClick={() => {
                    if (onOpenAuth) onOpenAuth();
                  }}
                >
                  <Lock size={16} />
                  <span>Sign In to Book Ticket</span>
                  <ArrowRight size={15} />
                </button>
              ) : (
                <button type="submit" className="btn-submit-booking" disabled={loading}>
                  <CreditCard size={16} />
                  <span>Proceed to Payment (₹{finalPrice})</span>
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Payment Gateway Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        amount={finalPrice}
        passengerName={passengerName}
        ticketDescription={
          ticketType === 'golden_pass'
            ? `AMTS Golden Ticket All-Day Pass (${gender === 'female' ? 'Female ₹35' : 'Male ₹45'})`
            : `Single Journey (${stopsCount} Stands)`
        }
        busFleet={
          ticketType === 'golden_pass'
            ? 'All AMTS Buses (Citywide)'
            : (bus?.fleet_number || 'AMTS-BUS')
        }
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};
