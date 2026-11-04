import { BookedTicket, ActiveBus, AuthUser } from '../types';

export function getCurrentAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('amts_auth_user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u && u.username ? (u as AuthUser) : null;
  } catch {
    return null;
  }
}

export function getStorageKey(user?: { username?: string } | null | string): string | null {
  if (user === null) return null;
  let username: string | undefined;

  if (typeof user === 'string') {
    username = user;
  } else if (user && user.username) {
    username = user.username;
  } else {
    const current = getCurrentAuthUser();
    username = current?.username;
  }

  if (!username) return null;
  return `amts_booked_tickets_${username.trim().toLowerCase()}`;
}

/**
 * Retrieves all stored tickets for the active or specified user account.
 * If no user is logged in, returns an empty array to prevent cross-account ticket leakage.
 */
export function getStoredTickets(user?: { username?: string } | null | string): BookedTicket[] {
  const key = getStorageKey(user);
  if (!key) return [];

  try {
    // One-time migration of legacy global key if applicable to this user
    const legacyRaw = localStorage.getItem('amts_booked_tickets');
    if (legacyRaw) {
      try {
        const legacyList: BookedTicket[] = JSON.parse(legacyRaw);
        if (Array.isArray(legacyList) && legacyList.length > 0) {
          const currentUsername = (typeof user === 'string' ? user : user?.username || getCurrentAuthUser()?.username || '').toLowerCase();
          const userLegacy = legacyList.filter(
            (t) =>
              (t.passenger?.name || '').toLowerCase() === currentUsername ||
              (t.username || '').toLowerCase() === currentUsername
          );
          if (userLegacy.length > 0) {
            localStorage.setItem(key, JSON.stringify(userLegacy));
          }
        }
      } catch (e) {}
      localStorage.removeItem('amts_booked_tickets');
    }

    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const list: BookedTicket[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];

    const currentUsername = (typeof user === 'string' ? user : user?.username || getCurrentAuthUser()?.username || '').trim().toLowerCase();
    if (currentUsername) {
      try {
        const tombstoneKey = `amts_deleted_tickets_${currentUsername}`;
        const rawTombstones = localStorage.getItem(tombstoneKey);
        if (rawTombstones) {
          const tombstones = new Set<string>(JSON.parse(rawTombstones));
          return list.filter((t) => !tombstones.has(t.ticket_number));
        }
      } catch (e) {}
    }

    return list;
  } catch (err) {
    console.error('Failed to parse stored tickets for user:', err);
    return [];
  }
}

/**
 * Saves a new booked ticket to the account's isolated storage key.
 */
export function saveTicket(ticket: BookedTicket, user?: { username?: string } | null | string): void {
  const key = getStorageKey(user);
  if (!key) return;

  try {
    const existing = getStoredTickets(user);
    const filtered = existing.filter((t) => t.ticket_number !== ticket.ticket_number);
    const updated = [ticket, ...filtered];
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save ticket for user:', err);
  }
}

/**
 * Evaluates whether a ticket is expired.
 */
export function isTicketExpired(ticket: BookedTicket, buses?: ActiveBus[]): boolean {
  if (ticket.is_expired || ticket.status === 'EXPIRED') {
    return true;
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Check date validity
  if (ticket.validity?.valid_date && ticket.validity.valid_date < todayStr) {
    return true;
  }

  // Golden ticket and Connected multi-bus ticket expiration (expires at 23:59:59 of that date)
  if (ticket.ticket_type === 'golden_pass' || ticket.ticket_type === 'connected') {
    if (ticket.validity?.valid_until) {
      const validUntil = new Date(ticket.validity.valid_until);
      if (now.getTime() > validUntil.getTime()) {
        return true;
      }
    }
    return false;
  }

  // Local ticket expiration based on bus position & completed route
  if (ticket.ticket_type === 'local') {
    if (!buses || buses.length === 0) {
      return false; // Cannot determine bus position yet, keep active
    }

    const matchedBus = buses.find((b) => b.fleet_number === ticket.trip.fleet_number);
    if (!matchedBus) {
      return false;
    }

    // If bus transitioned to opposite direction pattern, the trip on this direction has concluded
    if (
      matchedBus.assigned_direction_id !== undefined &&
      ticket.trip.direction_id !== undefined &&
      matchedBus.assigned_direction_id !== ticket.trip.direction_id
    ) {
      return true;
    }

    const exitIdx = ticket.trip.exit_stop.sequence - 1;

    // If bus is past passenger's destination exit stand
    if (matchedBus.current_stop_index > exitIdx) {
      return true;
    }

    // If bus is at passenger's destination exit stand and stand dwell is finishing
    if (matchedBus.current_stop_index === exitIdx) {
      if (
        matchedBus.lifecycle_status === 'STOPPED_AT_ORIGIN' &&
        (matchedBus.dwell_countdown_secs || 0) <= 2
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Explicitly marks a ticket as expired and updates account-scoped localStorage.
 */
export function markTicketAsExpired(ticketNumber: string, user?: { username?: string } | null | string): void {
  const key = getStorageKey(user);
  if (!key) return;

  try {
    const existing = getStoredTickets(user);
    const updated = existing.map((t) => {
      if (t.ticket_number === ticketNumber) {
        return { ...t, is_expired: true, status: 'EXPIRED' as const };
      }
      return t;
    });
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to mark ticket as expired:', err);
  }
}

/**
 * Periodically syncs ticket expiration against live fleet buses.
 */
export function syncTicketExpiration(buses: ActiveBus[], user?: { username?: string } | null | string): BookedTicket[] {
  const key = getStorageKey(user);
  if (!key) return [];

  const existing = getStoredTickets(user);
  let hasChanges = false;

  const updated = existing.map((t) => {
    if (t.is_expired || t.status === 'EXPIRED') return t;
    if (isTicketExpired(t, buses)) {
      hasChanges = true;
      return { ...t, is_expired: true, status: 'EXPIRED' as const };
    }
    return t;
  });

  if (hasChanges) {
    localStorage.setItem(key, JSON.stringify(updated));
  }

  return updated;
}

/**
 * Checks for ALL ACTIVE AMTS Golden Ticket All-Day Passes for the user account today.
 */
export function getActiveGoldenTickets(user?: { username?: string } | null | string): BookedTicket[] {
  const tickets = getStoredTickets(user);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  return tickets.filter((t) => {
    if (t.ticket_type !== 'golden_pass') return false;
    if (t.is_expired || t.status === 'EXPIRED') return false;
    if (t.validity?.valid_date !== todayStr) return false;
    if (t.validity?.valid_until) {
      const validUntil = new Date(t.validity.valid_until);
      return validUntil.getTime() > now.getTime();
    }
    return true;
  });
}

/**
 * Checks if the user holds an ACTIVE AMTS Golden Ticket All-Day Pass for today.
 */
export function getActiveGoldenTicket(passengerName?: string, user?: { username?: string } | null | string): BookedTicket | null {
  const all = getActiveGoldenTickets(user);
  if (all.length === 0) return null;
  if (passengerName) {
    const matched = all.find(
      (t) => t.passenger.name.trim().toLowerCase() === passengerName.trim().toLowerCase()
    );
    if (matched) return matched;
  }
  return all[0];
}

/**
 * Checks for an active local single-journey ticket for a specific fleet number.
 */
export function getActiveLocalTicket(
  fleetNumber?: string,
  buses?: ActiveBus[],
  user?: { username?: string } | null | string
): BookedTicket | null {
  const tickets = getStoredTickets(user);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  return (
    tickets.find((t) => {
      if (t.ticket_type !== 'local') return false;
      if (t.validity?.valid_date !== todayStr) return false;
      if (fleetNumber && t.trip.fleet_number !== fleetNumber) return false;
      if (isTicketExpired(t, buses)) return false;
      return true;
    }) || null
  );
}

/**
 * Calculates active booked ticket count aboard a specific bus for the current user.
 */
export function getActiveBookedTicketCountForBus(
  fleetNumber?: string,
  buses?: ActiveBus[],
  user?: { username?: string } | null | string
): number {
  if (!fleetNumber) return 0;

  if (buses && buses.length > 0) {
    const bus = buses.find((b) => b.fleet_number === fleetNumber);
    if (bus && bus.lifecycle_status === 'STOPPED_AT_TERMINAL') {
      return 0;
    }
  }

  const tickets = getStoredTickets(user);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  return tickets.filter((t) => {
    if (t.trip?.fleet_number !== fleetNumber) return false;
    if (t.validity?.valid_date && t.validity.valid_date < todayStr) return false;
    if (isTicketExpired(t, buses)) return false;
    return true;
  }).length;
}

/**
 * Permanently deletes a ticket from account-scoped localStorage AND PostgreSQL database.
 */
export async function deleteTicket(ticketNumber: string, user?: { username?: string } | null | string): Promise<void> {
  const key = getStorageKey(user);
  const username = (typeof user === 'string' ? user : user?.username || getCurrentAuthUser()?.username || '').trim();

  // 1. Immediately delete from localStorage so UI updates instantly
  if (key) {
    try {
      const existing = getStoredTickets(user);
      const updated = existing.filter((t) => t.ticket_number !== ticketNumber);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to delete ticket for user from localStorage:', err);
    }
  }

  // 2. Register tombstone locally so that background sync never resurrects this ticket
  if (username) {
    try {
      const tombstoneKey = `amts_deleted_tickets_${username.toLowerCase()}`;
      const raw = localStorage.getItem(tombstoneKey);
      const tombstones: string[] = raw ? JSON.parse(raw) : [];
      if (!tombstones.includes(ticketNumber)) {
        tombstones.push(ticketNumber);
        localStorage.setItem(tombstoneKey, JSON.stringify(tombstones));
      }
    } catch (e) {}
  }

  // 3. Permanently remove from PostgreSQL database
  try {
    const url = `/api/v1/tickets/book/?ticket_number=${encodeURIComponent(ticketNumber)}${username ? `&username=${encodeURIComponent(username)}` : ''}`;
    await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_number: ticketNumber, username }),
    });
  } catch (err) {
    console.error('Failed to delete ticket from backend PostgreSQL:', err);
  }
}

/**
 * Fetches verified tickets from PostgreSQL database for the logged in user and merges with localStorage.
 */
export async function syncUserTicketsFromBackend(username: string): Promise<BookedTicket[]> {
  if (!username) return [];
  try {
    const normUser = username.trim().toLowerCase();
    const tombstoneKey = `amts_deleted_tickets_${normUser}`;
    const rawTombstones = localStorage.getItem(tombstoneKey);
    const tombstones = new Set<string>(rawTombstones ? JSON.parse(rawTombstones) : []);

    const res = await fetch(`/api/v1/tickets/book/?username=${encodeURIComponent(username)}`);
    if (!res.ok) return getStoredTickets(username).filter((t) => !tombstones.has(t.ticket_number));
    const data = await res.json();
    if (!data.success || !Array.isArray(data.tickets)) {
      return getStoredTickets(username).filter((t) => !tombstones.has(t.ticket_number));
    }

    const localTickets = getStoredTickets(username).filter((t) => !tombstones.has(t.ticket_number));
    const localMap = new Map<string, BookedTicket>();
    localTickets.forEach((t) => localMap.set(t.ticket_number, t));

    // Merge backend tickets, strictly filtering out any tombstoned/deleted tickets
    data.tickets.forEach((bt: BookedTicket) => {
      if (!tombstones.has(bt.ticket_number) && !localMap.has(bt.ticket_number)) {
        localMap.set(bt.ticket_number, bt);
      }
    });

    const merged = Array.from(localMap.values());
    const key = `amts_booked_tickets_${normUser}`;
    localStorage.setItem(key, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.warn('Could not sync user tickets from backend:', e);
    return getStoredTickets(username);
  }
}
