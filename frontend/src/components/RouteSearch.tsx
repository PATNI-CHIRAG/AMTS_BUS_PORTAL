import React from 'react';
import { Search, X, ArrowUpRight, ArrowDownLeft, Bus, Navigation } from 'lucide-react';
import { RouteItem, RoutePatternSummary } from '../types';

interface RouteSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  routes: RouteItem[];
  selectedPatternId: string | null;
  onSelectPattern: (route: RouteItem, pattern: RoutePatternSummary) => void;
}

export const RouteSearch: React.FC<RouteSearchProps> = ({
  searchQuery,
  onSearchChange,
  routes,
  selectedPatternId,
  onSelectPattern,
}) => {
  // Real-time filter: matches public_code, short_name, or origin/destination
  const filteredRoutes = routes.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const codeMatch = r.public_code.toLowerCase().includes(q);
    const nameMatch = r.long_name?.toLowerCase().includes(q);
    const patternMatch = r.patterns?.some(
      (p) =>
        p.origin_name?.toLowerCase().includes(q) ||
        p.destination_name?.toLowerCase().includes(q) ||
        p.direction_name?.toLowerCase().includes(q)
    );
    return codeMatch || nameMatch || patternMatch;
  });

  return (
    <div className="search-panel">
      <div className="search-header-text">
        <label htmlFor="bus-number-search" className="search-label">
          <Bus size={18} className="text-red" />
          <span>Search Bus by Number</span>
        </label>
      </div>

      <div className="search-input-wrapper">
        <Search className="search-icon" size={20} />
        <input
          id="bus-number-search"
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Type bus number (e.g. 31, 103, 40)..."
          className="search-input"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        {searchQuery && (
          <button
            type="button"
            className="clear-search-btn"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Results List */}
      <div className="search-results-list" role="list">
        {filteredRoutes.length === 0 ? (
          <div className="empty-results">
            <Navigation size={28} className="empty-icon" />
            <p className="empty-title">No routes matching "{searchQuery}"</p>
            <p className="empty-hint">Try searching Route 31, 40, 103, 117, or 138</p>
          </div>
        ) : (
          filteredRoutes.map((route) => {
            const upPattern = route.patterns.find((p) => p.direction_id === 0);
            const downPattern = route.patterns.find((p) => p.direction_id === 1);

            return (
              <div key={route.id} className="route-card">
                <div className="route-card-header">
                  <div className="route-badge" style={{ backgroundColor: `#${route.route_color || 'D32F2F'}` }}>
                    Route {route.public_code}
                  </div>
                  <div className="route-corridor-title">{route.long_name}</div>
                </div>

                <div className="directional-options-grid">
                  {/* UP Direction */}
                  {upPattern && (
                    <button
                      type="button"
                      className={`direction-option-btn up-option ${
                        selectedPatternId === upPattern.id ? 'selected-direction' : ''
                      }`}
                      onClick={() => onSelectPattern(route, upPattern)}
                    >
                      <div className="direction-tag up-tag">
                        <ArrowUpRight size={15} />
                        <span>{route.public_code}-UP</span>
                      </div>
                      <div className="direction-details">
                        <div className="direction-name-text">
                          <span className="origin-stop">{upPattern.origin_name}</span>
                          <span className="arrow-sep">➔</span>
                          <span className="dest-stop">{upPattern.destination_name}</span>
                        </div>
                        <div className="direction-meta">
                          <span className="stops-count-tag">{upPattern.total_stops} Stands</span>
                          <span className="live-bus-count-tag">
                            <span className="tiny-green-dot"></span>
                            {upPattern.active_buses_count} Fleet Assigned
                          </span>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* DOWN Direction */}
                  {downPattern && (
                    <button
                      type="button"
                      className={`direction-option-btn down-option ${
                        selectedPatternId === downPattern.id ? 'selected-direction' : ''
                      }`}
                      onClick={() => onSelectPattern(route, downPattern)}
                    >
                      <div className="direction-tag down-tag">
                        <ArrowDownLeft size={15} />
                        <span>{route.public_code}-DOWN</span>
                      </div>
                      <div className="direction-details">
                        <div className="direction-name-text">
                          <span className="origin-stop">{downPattern.origin_name}</span>
                          <span className="arrow-sep">➔</span>
                          <span className="dest-stop">{downPattern.destination_name}</span>
                        </div>
                        <div className="direction-meta">
                          <span className="stops-count-tag">{downPattern.total_stops} Stands</span>
                          <span className="live-bus-count-tag">
                            <span className="tiny-green-dot"></span>
                            {downPattern.active_buses_count} Fleet Assigned
                          </span>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
