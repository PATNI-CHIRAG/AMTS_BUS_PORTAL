import React from 'react';
import { Bus, ShieldCheck, Radio, Ticket, Crown, ArrowLeft, Building2, User, LogIn, LogOut, LayoutDashboard } from 'lucide-react';
import { AuthUser } from '../types';

interface NavbarProps {
  totalRoutes: number;
  activeBusCount: number;
  ticketsCount?: number;
  hasGoldenTicket?: boolean;
  goldenPassCount?: number;
  onOpenPassbook?: () => void;
  onHomeClick?: () => void;
  canGoBack?: boolean;
  onBackClick?: () => void;
  advisoriesCount?: number;
  onOpenAdvisories?: () => void;
  currentUser?: AuthUser | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onSwitchToAdmin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  totalRoutes,
  activeBusCount,
  ticketsCount = 0,
  hasGoldenTicket = false,
  goldenPassCount = 0,
  onOpenPassbook,
  onHomeClick,
  canGoBack = false,
  onBackClick,
  advisoriesCount = 0,
  onOpenAdvisories,
  currentUser = null,
  onOpenAuth,
  onLogout,
  onSwitchToAdmin,
}) => {
  return (
    <header className="amts-header">
      <div className="header-brand">
        {canGoBack && onBackClick && (
          <button
            type="button"
            className="navbar-mobile-back-btn"
            onClick={(e) => {
              e.stopPropagation();
              onBackClick();
            }}
            aria-label="Exit back one step"
            title="Exit / Back (One step back)"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div
          className="brand-logo-and-name"
          onClick={onHomeClick}
          style={onHomeClick ? { cursor: 'pointer' } : undefined}
          title={onHomeClick ? 'Return to Home / Search Screen' : undefined}
          role={onHomeClick ? 'button' : undefined}
          tabIndex={onHomeClick ? 0 : undefined}
          aria-label={onHomeClick ? 'AMTS Home / Bus Search' : undefined}
          onKeyDown={(e) => {
            if (onHomeClick && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onHomeClick();
            }
          }}
        >
          <div className="logo-badge" title="AMTS Home">
            <Bus className="logo-icon" size={24} />
          </div>
          <div className="brand-text-group">
            <div className="brand-title">
              <span className="title-red">AMTS</span> <span className="brand-title-full">LIVE BUS PORTAL</span><span className="brand-title-compact">LIVE</span>
            </div>
            <div className="brand-subtitle">Ahmedabad Municipal Transport Service • લાઈવ બસ ટ્રેકિંગ</div>
          </div>
        </div>
      </div>

      <div className="header-meta">
        <div className="status-pill live-pill">
          <span className="live-dot pulse-dot"></span>
          <Radio size={14} className="pulse-icon" />
          <span className="live-pill-text">NETWORK LIVE</span>
        </div>

        <div className="status-pill fleet-pill">
          <ShieldCheck size={14} className="text-emerald" />
          <span className="fleet-pill-text">{totalRoutes} Corridors • {activeBusCount} Live Fleet</span>
        </div>

        {onOpenAdvisories && (
          <button
            type="button"
            className="status-pill advisories-nav-pill"
            onClick={onOpenAdvisories}
            title="View active AMTS transit advisories and detour notices"
            aria-label={`AMTS Transit Notices${advisoriesCount > 0 ? ` (${advisoriesCount} active)` : ''}`}
          >
            <Radio size={14} className="text-amber flex-shrink-0" />
            <span className="advisories-pill-label">Notices</span>
            {advisoriesCount > 0 && <span className="advisory-count-badge">{advisoriesCount}</span>}
          </button>
        )}

        {onOpenPassbook && (
          <button
            type="button"
            className={`status-pill my-tickets-pill ${hasGoldenTicket || goldenPassCount > 0 ? 'golden-active' : ''}`}
            onClick={onOpenPassbook}
            title="Open digital passbook with today's E-Tickets and Golden Passes"
            aria-label={`Open digital passbook${ticketsCount > 0 ? ` (${ticketsCount} tickets)` : ''}`}
          >
            {hasGoldenTicket || goldenPassCount > 0 ? (
              <Crown size={15} className="text-amber flex-shrink-0" />
            ) : (
              <Ticket size={15} className="text-red flex-shrink-0" />
            )}
            <span className="tickets-pill-label">
              {hasGoldenTicket || goldenPassCount > 0 ? 'Pass' : 'Tickets'}
            </span>
            {ticketsCount > 0 && <span className="ticket-count-badge">{ticketsCount}</span>}
          </button>
        )}

        {/* Authentication & Admin Portal Switch Buttons */}
        {currentUser ? (
          <div className="auth-nav-cluster">
            {currentUser.role === 'admin' && onSwitchToAdmin && (
              <button
                type="button"
                className="admin-switch-nav-btn"
                onClick={onSwitchToAdmin}
                title="Open Municipal Fleet Telemetry & Dispatch Control Room"
              >
                <LayoutDashboard size={15} />
                <span className="admin-switch-text-full">Admin Dashboard ⚡</span>
                <span className="admin-switch-text-compact">Admin ⚡</span>
              </button>
            )}

            <div
              className={`auth-user-chip ${currentUser.role === 'admin' ? 'admin-chip' : 'passenger-chip'}`}
              title={`Logged in as @${currentUser.username} (${currentUser.full_name || currentUser.username})`}
            >
              {currentUser.role === 'admin' ? (
                <ShieldCheck size={14} className="text-emerald flex-shrink-0" />
              ) : (
                <User size={14} className="flex-shrink-0" />
              )}
              <span className="user-name-text">
                {currentUser.role === 'admin' ? 'admin' : currentUser.username}
              </span>
            </div>

            {onLogout && (
              <button
                type="button"
                className="auth-logout-btn"
                onClick={onLogout}
                title="Sign out of AMTS session"
                aria-label="Sign out"
              >
                <LogOut size={14} />
                <span className="logout-label">Sign Out</span>
              </button>
            )}
          </div>
        ) : (
          onOpenAuth && (
            <button
              type="button"
              className="auth-login-nav-btn"
              onClick={onOpenAuth}
              title="Sign in or create account (Passenger / Admin)"
            >
              <LogIn size={15} />
              <span>Sign In</span>
            </button>
          )
        )}
      </div>
    </header>
  );
};
