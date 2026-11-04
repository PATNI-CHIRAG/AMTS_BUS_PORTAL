import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ActiveBus, RoutePatternDetail, PassengerJourneyState, HighlightedJourneySegment } from '../types';
import { formatMinutesSeconds } from '../engine/scheduleEngine';
import { getActiveBookedTicketCountForBus } from '../utils/ticketStorage';
import { Layers, Map as MapIcon, Ticket } from 'lucide-react';

interface MapViewProps {
  pattern: RoutePatternDetail | null;
  activeBuses: ActiveBus[];
  allBuses?: ActiveBus[];
  selectedBus: ActiveBus | null;
  onSelectBus: (bus: ActiveBus) => void;
  passengerJourney?: PassengerJourneyState | null;
  highlightedSearchSegment?: HighlightedJourneySegment | null;
  onBookTicketForBus?: (bus: ActiveBus) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  pattern,
  activeBuses,
  allBuses = [],
  selectedBus,
  onSelectBus,
  passengerJourney,
  highlightedSearchSegment,
  onBookTicketForBus,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polylineLayerRef = useRef<L.Polyline | null>(null);
  const passengerPolylineRef = useRef<L.Polyline | null>(null);
  const multiLegPolylinesRef = useRef<L.Polyline[]>([]);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const busesLayerRef = useRef<L.LayerGroup | null>(null);
  const passengerMarkersLayerRef = useRef<L.LayerGroup | null>(null);

  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [showAllLabels, setShowAllLabels] = useState<boolean>(true);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialTileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    const map = L.map(mapContainerRef.current, {
      center: [23.0225, 72.5714], // Ahmedabad central
      zoom: 12,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const tileLayer = L.tileLayer(initialTileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    const stopsLayer = L.layerGroup().addTo(map);
    const busesLayer = L.layerGroup().addTo(map);
    const passengerMarkersLayer = L.layerGroup().addTo(map);

    stopsLayerRef.current = stopsLayer;
    busesLayerRef.current = busesLayer;
    passengerMarkersLayerRef.current = passengerMarkersLayer;
    mapInstanceRef.current = map;

    // Automatic responsive ResizeObserver so Leaflet handles mobile view switches and orientation changes
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Map Style Switcher (Real Street vs Satellite)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    let tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attribution = '&copy; OpenStreetMap contributors';

    if (mapStyle === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = '&copy; Esri, Maxar, Earthstar Geographics';
    }

    const newLayer = L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = newLayer;
  }, [mapStyle]);

  // Update Route Polyline & Stops
  useEffect(() => {
    const map = mapInstanceRef.current;
    const stopsLayer = stopsLayerRef.current;
    if (!map || !stopsLayer) return;

    stopsLayer.clearLayers();
    if (polylineLayerRef.current) {
      polylineLayerRef.current.remove();
      polylineLayerRef.current = null;
    }

    // If viewing a connecting route or no pattern is selected, do not draw single route polyline or stops
    if (highlightedSearchSegment?.isConnecting || !pattern || !pattern.stops || pattern.stops.length === 0) {
      if (busesLayerRef.current) {
        busesLayerRef.current.clearLayers();
      }
      return;
    }

    // Always ensure stops are strictly in ascending stop_sequence order
    const sortedStops = [...pattern.stops].sort(
      (a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0)
    );

    const coords: [number, number][] =
      pattern.shape_coordinates && pattern.shape_coordinates.length > 0
        ? pattern.shape_coordinates
        : sortedStops.map((s) => [s.latitude, s.longitude]);

    // Draw General Route Polyline (Red)
    const polyline = L.polyline(coords, {
      color: '#D32F2F',
      weight: 6,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    polylineLayerRef.current = polyline;

    // Add Stops with visible labels on the map
    sortedStops.forEach((stop, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === sortedStops.length - 1;

      let markerHtml = '';
      if (isFirst) {
        markerHtml = `
          <div class="terminal-stop-marker origin-marker" title="Origin: ${stop.name}">
            <div class="marker-core">A</div>
          </div>
        `;
      } else if (isLast) {
        markerHtml = `
          <div class="terminal-stop-marker dest-marker" title="Terminal: ${stop.name}">
            <div class="marker-core">B</div>
          </div>
        `;
      } else {
        markerHtml = `
          <div class="intermediate-stop-marker" title="${idx + 1}. ${stop.name}">
            <div class="dot-core"></div>
          </div>
        `;
      }

      const stopIcon = L.divIcon({
        className: 'custom-stop-divicon',
        html: markerHtml,
        iconSize: isFirst || isLast ? [30, 30] : [14, 14],
        iconAnchor: isFirst || isLast ? [15, 15] : [7, 7],
      });

      const stopMarker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon });

      if (showAllLabels) {
        stopMarker.bindTooltip(
          `<div class="map-stop-label-pill ${isFirst ? 'origin-label' : isLast ? 'dest-label' : ''}">
            <span class="label-seq">#${stop.stop_sequence || idx + 1}</span>
            <span class="label-name">${stop.name}</span>
          </div>`,
          {
            permanent: true,
            direction: 'right',
            className: 'custom-map-stop-tooltip',
            offset: [10, 0],
          }
        );
      }

      stopMarker.bindPopup(`
        <div class="amts-popup-card">
          <div class="popup-stop-seq">Stand #${stop.stop_sequence || idx + 1} of ${pattern.stops.length}</div>
          <div class="popup-stop-name">${stop.name}</div>
          ${stop.name_gu ? `<div class="popup-stop-gu">${stop.name_gu}</div>` : ''}
          <div class="popup-meta-badge">Route ${pattern.route_code} (${pattern.direction_name})</div>
        </div>
      `);

      stopsLayer.addLayer(stopMarker);
    });

    // Auto-fit to route corridor
    if (coords.length > 0) {
      map.fitBounds(polyline.getBounds(), { padding: [60, 60], maxZoom: 15 });
    }
  }, [pattern, showAllLabels, highlightedSearchSegment]);

  // User requirement: "also show that path in blue colour."
  // Render user's booked path from boarding stop to exit stop in BLUE
  useEffect(() => {
    const map = mapInstanceRef.current;
    const passengerLayer = passengerMarkersLayerRef.current;
    if (!map || !passengerLayer) return;

    passengerLayer.clearLayers();
    if (passengerPolylineRef.current) {
      passengerPolylineRef.current.remove();
      passengerPolylineRef.current = null;
    }
    multiLegPolylinesRef.current.forEach((p) => p.remove());
    multiLegPolylinesRef.current = [];

    if (!passengerJourney && !highlightedSearchSegment) return;

    // CASE 2 / CASE 3: Multi-Leg Connecting Journey Selected on Map
    if (highlightedSearchSegment?.isConnecting && highlightedSearchSegment.legs && highlightedSearchSegment.legs.length > 0) {
      // Remove any leftover route polyline, stops, and buses from previous number search so they don't collide
      if (polylineLayerRef.current) {
        polylineLayerRef.current.remove();
        polylineLayerRef.current = null;
      }
      if (stopsLayerRef.current) {
        stopsLayerRef.current.clearLayers();
      }
      if (busesLayerRef.current) {
        busesLayerRef.current.clearLayers();
      }

      const allCoords: [number, number][] = [];

      highlightedSearchSegment.legs.forEach((leg, idx) => {
        if (!leg.coords || leg.coords.length === 0) return;
        leg.coords.forEach((c) => allCoords.push(c));

        const legPoly = L.polyline(leg.coords, {
          color: leg.color || (idx === 0 ? '#2563EB' : idx === 1 ? '#8B5CF6' : '#0D9488'),
          weight: 8,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        legPoly.bindTooltip(
          `<div class="passenger-tooltip">
            <span class="tooltip-badge">LEG ${leg.legNumber} • ROUTE ${leg.routeCode}</span>
            <span>${leg.fromStop.name} ──▶ ${leg.toStop.name}</span>
          </div>`,
          { sticky: true }
        );

        multiLegPolylinesRef.current.push(legPoly);
      });

      // Place Transfer Hub Pins (🔄)
      if (highlightedSearchSegment.transferHubs && highlightedSearchSegment.transferHubs.length > 0) {
        highlightedSearchSegment.transferHubs.forEach((hub, idx) => {
          const transferIcon = L.divIcon({
            className: 'passenger-transfer-divicon',
            html: `
              <div class="passenger-pin transfer-hub-pin" title="Transfer Hub #${idx + 1}: ${hub.name}">
                <div class="pin-ring animate-ping transfer-ring"></div>
                <div class="pin-core">🔄</div>
              </div>
            `,
            iconSize: [34, 34],
            iconAnchor: [17, 34],
          });

          const tMarker = L.marker([hub.latitude, hub.longitude], {
            icon: transferIcon,
            zIndexOffset: 2050,
          }).addTo(passengerLayer);

          tMarker.bindTooltip(
            `<div class="passenger-tooltip transfer-tooltip">
              <span class="tooltip-badge">🔄 TRANSFER HUB #${idx + 1}</span>
              <strong>${hub.name}</strong>
              ${hub.name_gu ? `<span style="font-size:10px; color:#E2E8F0;">${hub.name_gu}</span>` : ''}
              ${hub.routeToSwitch ? `<div style="font-size:11px; margin-top:2px; color:#FCD34D; font-weight:700;">Take Route ${hub.routeToSwitch}</div>` : ''}
            </div>`,
            { permanent: true, direction: 'top', offset: [0, -32] }
          );
        });
      }

      // Add Special Marker at Boarding Stand (A)
      const bStop = highlightedSearchSegment.fromStop;
      const firstLegRoute = highlightedSearchSegment.legs?.[0]?.routeCode;
      const boardingIcon = L.divIcon({
        className: 'passenger-boarding-divicon',
        html: `
          <div class="passenger-pin boarding-pin" title="Your Boarding Stand: ${bStop.name}">
            <div class="pin-ring animate-ping"></div>
            <div class="pin-core">🚏</div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });

      const bMarker = L.marker([bStop.latitude, bStop.longitude], {
        icon: boardingIcon,
        zIndexOffset: 2100,
      }).addTo(passengerLayer);

      bMarker.bindTooltip(
        `<div class="passenger-tooltip boarding-tooltip">
          <span class="tooltip-badge">ORIGIN STAND</span>
          <strong>${bStop.name}</strong>
          ${firstLegRoute ? `<div style="font-size:11px; margin-top:2px; color:#FCD34D; font-weight:700;">Take Route ${firstLegRoute}</div>` : ''}
        </div>`,
        { permanent: true, direction: 'top', offset: [0, -32] }
      );

      // Add Special Marker at Final Destination Stand (B)
      const eStop = highlightedSearchSegment.toStop;
      const exitIcon = L.divIcon({
        className: 'passenger-exit-divicon',
        html: `
          <div class="passenger-pin exit-pin" title="Your Destination Stand: ${eStop.name}">
            <div class="pin-core">🏁</div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });

      const eMarker = L.marker([eStop.latitude, eStop.longitude], {
        icon: exitIcon,
        zIndexOffset: 2100,
      }).addTo(passengerLayer);

      eMarker.bindTooltip(
        `<div class="passenger-tooltip exit-tooltip">
          <span class="tooltip-badge">FINAL DESTINATION</span>
          <strong>${eStop.name}</strong>
        </div>`,
        { permanent: true, direction: 'top', offset: [0, -32] }
      );

      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords);
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
      }
      return;
    }

    // Direct Single-Leg Journey
    if (!pattern || !pattern.stops || pattern.stops.length === 0) return;

    // Ensure pattern stops are strictly ordered by stop_sequence
    const sortedPatternStops = [...pattern.stops].sort(
      (a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0)
    );

    let bStop: { name: string; latitude: number; longitude: number } | null = null;
    let eStop: { name: string; latitude: number; longitude: number } | null = null;
    let blueCoords: [number, number][] = [];

    if (passengerJourney) {
      // Verify pattern matches ticket's route and direction
      if (
        passengerJourney.ticket?.trip?.route_code &&
        pattern.route_code !== passengerJourney.ticket.trip.route_code
      ) {
        return;
      }
      if (
        passengerJourney.ticket?.trip?.direction_id !== undefined &&
        pattern.direction_id !== passengerJourney.ticket.trip.direction_id
      ) {
        return;
      }

      const bStopId = passengerJourney.boardingStopId;
      const eStopId = passengerJourney.exitStopId;
      const bName = (passengerJourney.boardingStopName || '').trim().toLowerCase();
      const eName = (passengerJourney.exitStopName || '').trim().toLowerCase();

      // Match by ID or exact name
      let bIdx = sortedPatternStops.findIndex(
        (s) => (bStopId && s.stop_id === bStopId) || (bName && s.name.trim().toLowerCase() === bName)
      );
      let eIdx = sortedPatternStops.findIndex(
        (s) => (eStopId && s.stop_id === eStopId) || (eName && s.name.trim().toLowerCase() === eName)
      );

      // Fallback to stop_sequence only if sequence matches and direction is verified
      if (bIdx === -1 && passengerJourney.boardingStopSequence) {
        bIdx = sortedPatternStops.findIndex((s) => s.stop_sequence === passengerJourney.boardingStopSequence);
      }
      if (eIdx === -1 && passengerJourney.exitStopSequence) {
        eIdx = sortedPatternStops.findIndex((s) => s.stop_sequence === passengerJourney.exitStopSequence);
      }

      if (bIdx === -1 || eIdx === -1 || eIdx <= bIdx) return;

      bStop = sortedPatternStops[bIdx];
      eStop = sortedPatternStops[eIdx];
      const journeyStops = sortedPatternStops.slice(bIdx, eIdx + 1);
      blueCoords = journeyStops.map((s) => [s.latitude, s.longitude]);
    } else if (highlightedSearchSegment) {
      const bName = highlightedSearchSegment.fromStop.name.trim().toLowerCase();
      const eName = highlightedSearchSegment.toStop.name.trim().toLowerCase();
      const bId = highlightedSearchSegment.fromStop.stop_id || highlightedSearchSegment.fromStop.id;
      const eId = highlightedSearchSegment.toStop.stop_id || highlightedSearchSegment.toStop.id;

      let bIdx = sortedPatternStops.findIndex(
        (s) => (bId && (s.stop_id === bId || (s as any).id === bId)) || s.name.trim().toLowerCase() === bName
      );
      let eIdx = sortedPatternStops.findIndex(
        (s) => (eId && (s.stop_id === eId || (s as any).id === eId)) || s.name.trim().toLowerCase() === eName
      );

      if (bIdx !== -1 && eIdx !== -1 && eIdx > bIdx) {
        bStop = sortedPatternStops[bIdx];
        eStop = sortedPatternStops[eIdx];
        const journeyStops = sortedPatternStops.slice(bIdx, eIdx + 1);
        blueCoords = journeyStops.map((s) => [s.latitude, s.longitude]);
      } else {
        bStop = highlightedSearchSegment.fromStop;
        eStop = highlightedSearchSegment.toStop;
        if (highlightedSearchSegment.coords && highlightedSearchSegment.coords.length > 0) {
          blueCoords = highlightedSearchSegment.coords;
        } else {
          blueCoords = [
            [bStop.latitude, bStop.longitude],
            [eStop.latitude, eStop.longitude],
          ];
        }
      }
    }

    if (!bStop || !eStop || blueCoords.length === 0) return;

    // Draw user journey path in BLUE (#2563EB)
    const bluePolyline = L.polyline(blueCoords, {
      color: '#2563EB',
      weight: 8,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    passengerPolylineRef.current = bluePolyline;

    // Focus map view on passenger's travel path
    if (blueCoords.length > 0) {
      map.fitBounds(bluePolyline.getBounds(), { padding: [80, 80], maxZoom: 15 });
    }

    // Add Special Blue Marker at Boarding Stand
    const boardingIcon = L.divIcon({
      className: 'passenger-boarding-divicon',
      html: `
        <div class="passenger-pin boarding-pin" title="Your Boarding Stand: ${bStop.name}">
          <div class="pin-ring animate-ping"></div>
          <div class="pin-core">🚏</div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });

    const bMarker = L.marker([bStop.latitude, bStop.longitude], {
      icon: boardingIcon,
      zIndexOffset: 2000,
    }).addTo(passengerLayer);

    bMarker.bindTooltip(
      `<div class="passenger-tooltip boarding-tooltip">
        <span class="tooltip-badge">YOUR BOARDING STAND</span>
        <strong>${bStop.name}</strong>
      </div>`,
      { permanent: true, direction: 'top', offset: [0, -32] }
    );

    // Add Special Blue Marker at Destination Stand
    const exitIcon = L.divIcon({
      className: 'passenger-exit-divicon',
      html: `
        <div class="passenger-pin exit-pin" title="Your Destination Stand: ${eStop.name}">
          <div class="pin-core">🏁</div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });

    const eMarker = L.marker([eStop.latitude, eStop.longitude], {
      icon: exitIcon,
      zIndexOffset: 2000,
    }).addTo(passengerLayer);

    eMarker.bindTooltip(
      `<div class="passenger-tooltip exit-tooltip">
        <span class="tooltip-badge">YOUR DESTINATION</span>
        <strong>${eStop.name}</strong>
      </div>`,
      { permanent: true, direction: 'top', offset: [0, -32] }
    );
  }, [passengerJourney, pattern, highlightedSearchSegment]);

  // Update Buses on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const busesLayer = busesLayerRef.current;
    if (!map || !busesLayer) return;

    busesLayer.clearLayers();
    if (!pattern || highlightedSearchSegment?.isConnecting) return;

    activeBuses.forEach((bus) => {
      const isMoving = bus.lifecycle_status === 'MOVING';
      const isStopped =
        bus.lifecycle_status === 'STOPPED_AT_TERMINAL' || bus.lifecycle_status === 'STOPPED_AT_ORIGIN';
      const isReadyToGo = bus.lifecycle_status === 'READY_TO_DEPART';

      const colorClass = isStopped ? 'bus-marker-red' : 'bus-marker-green';
      const pulseClass = isMoving || isReadyToGo ? 'pulse-green' : 'pulse-red';
      let countdownLabel = '';
      if (bus.dwell_countdown_secs) {
        countdownLabel = bus.dwell_countdown_secs >= 60
          ? formatMinutesSeconds(bus.dwell_countdown_secs)
          : `${bus.dwell_countdown_secs}S`;
      }

      const isTurnaround = bus.lifecycle_status === 'STOPPED_AT_TERMINAL';
      const statusLabel = isStopped
        ? (isTurnaround && bus.dwell_countdown_secs
            ? `TURNAROUND (${formatMinutesSeconds(bus.dwell_countdown_secs)})`
            : countdownLabel
            ? `STOPPED (${countdownLabel})`
            : 'STOPPED AT STATION')
        : isReadyToGo
        ? (bus.dwell_countdown_secs
            ? `READY TO GO (${bus.dwell_countdown_secs >= 60 ? formatMinutesSeconds(bus.dwell_countdown_secs) : `${bus.dwell_countdown_secs}S`})`
            : 'READY TO GO')
        : `${bus.speed_kmh} km/h`;

      const isSelected = selectedBus?.fleet_number === bus.fleet_number;
      const isPassengerBus = passengerJourney?.fleetNumber === bus.fleet_number;

      const markerHtml = `
        <div class="amts-bus-marker ${colorClass} ${pulseClass} ${isSelected ? 'selected-bus' : ''} ${isPassengerBus ? 'passenger-bus-highlight' : ''}">
          <div class="bus-label-tag">
            <span class="fleet-code">${bus.fleet_number}</span>
            <span class="speed-code ${colorClass}">${statusLabel}</span>
          </div>
          <div class="bus-icon-circle" ${isMoving ? `style="transform: rotate(${bus.heading_degrees || 0}deg);"` : ''}>
            <svg class="bus-svg" viewBox="0 0 24 24" width="16" height="16" fill="white">
              <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
            </svg>
            ${isMoving ? '<span class="bus-heading-pointer"></span>' : ''}
          </div>
        </div>
      `;

      const busIcon = L.divIcon({
        className: 'custom-bus-divicon',
        html: markerHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const busMarker = L.marker([bus.latitude, bus.longitude], {
        icon: busIcon,
        zIndexOffset: isSelected || isPassengerBus ? 1200 : 500,
      });

      busMarker.on('click', () => {
        onSelectBus(bus);
      });

      const popupId = `popup-book-btn-${bus.fleet_number.replace(/\s+/g, '-')}`;

      busMarker.bindPopup(`
        <div class="amts-bus-popup">
          <div class="popup-header ${colorClass}">
            <div class="bus-number-badge">${bus.fleet_number}</div>
            <div class="bus-status-text">${bus.lifecycle_status.replace(/_/g, ' ')}</div>
          </div>
          <div class="popup-body">
            <div class="popup-row">
              <span class="row-label">Model:</span>
              <span class="row-value">${bus.bus_model}</span>
            </div>
            <div class="popup-row">
              <span class="row-label">Feature:</span>
              <span class="row-value">${bus.has_ac ? '❄️ AC Electric' : 'CNG Standard'} (${bus.seated_capacity} Seats)</span>
            </div>
            <div class="popup-row">
              <span class="row-label">Speed:</span>
              <span class="row-value">${bus.speed_kmh} km/h</span>
            </div>
            <div class="popup-row">
              <span class="row-label">Schedule Info:</span>
              <span class="row-value ${isStopped ? 'text-red font-bold' : 'text-emerald font-bold'}">
                ${bus.next_stop_name || 'In Transit'}
              </span>
            </div>
            <div class="popup-row">
              <span class="row-label">Booked Tickets:</span>
              <span class="row-value font-bold ${getActiveBookedTicketCountForBus(bus.fleet_number, allBuses && allBuses.length > 0 ? allBuses : activeBuses) > 0 ? 'text-emerald' : ''}">
                ${getActiveBookedTicketCountForBus(bus.fleet_number, allBuses && allBuses.length > 0 ? allBuses : activeBuses) > 0 ? `🎟️ ${getActiveBookedTicketCountForBus(bus.fleet_number, allBuses && allBuses.length > 0 ? allBuses : activeBuses)} Booked` : '0 Booked'}
              </span>
            </div>

            <!-- Book Ticket Action in Map Popup -->
            <div class="popup-book-action-row">
              <button id="${popupId}" type="button" class="popup-book-ticket-button">
                🎟️ Book E-Ticket on Bus ${bus.fleet_number}
              </button>
            </div>
          </div>
        </div>
      `);

      busMarker.on('popupopen', () => {
        setTimeout(() => {
          const btn = document.getElementById(popupId);
          if (btn && onBookTicketForBus) {
            btn.onclick = () => {
              onBookTicketForBus(bus);
            };
          }
        }, 50);
      });

      busesLayer.addLayer(busMarker);
    });
  }, [activeBuses, selectedBus, onSelectBus, passengerJourney, onBookTicketForBus, pattern, highlightedSearchSegment]);

  return (
    <div className="map-view-wrapper">
      <div ref={mapContainerRef} className="leaflet-map-canvas" />

      {/* Real Map Style Switcher (Streets vs Satellite) */}
      <div className="map-layer-switcher">
        <div className="layer-switcher-title">
          <Layers size={14} />
          <span>Map Layer</span>
        </div>
        <div className="layer-switcher-buttons">
          <button
            type="button"
            className={`layer-btn ${mapStyle === 'streets' ? 'active' : ''}`}
            onClick={() => setMapStyle('streets')}
            title="Real OpenStreetMap with streets, parks, river, and landmarks"
          >
            🗺️ Real Street Map
          </button>
          <button
            type="button"
            className={`layer-btn ${mapStyle === 'satellite' ? 'active' : ''}`}
            onClick={() => setMapStyle('satellite')}
            title="Real-world Satellite Aerial Imagery of Ahmedabad"
          >
            🛰️ Satellite Aerial
          </button>
        </div>
      </div>

      {/* Stop Names Toggle */}
      <div className="map-controls-overlay">
        <button
          type="button"
          className={`toggle-labels-btn ${showAllLabels ? 'active' : ''}`}
          onClick={() => setShowAllLabels((prev) => !prev)}
        >
          <MapIcon size={14} />
          <span>{showAllLabels ? 'Hide Stop Names' : 'Show Stop Names'}</span>
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className="map-legend-overlay">
        <div className="legend-item">
          <span className="legend-dot dot-green"></span>
          <span>Moving / Ready to Go (Green)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot dot-red"></span>
          <span>Stopped at Stop/Terminal (Red)</span>
        </div>
        {passengerJourney && (
          <div className="legend-item legend-passenger-item">
            <span className="legend-line line-blue"></span>
            <span>Your Travel Path (Blue)</span>
          </div>
        )}
      </div>
    </div>
  );
};
