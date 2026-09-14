import React from 'react';

const TABS = [
  { id: 'home', label: 'Forside', icon: '🏠' },
  { id: 'map', label: 'Kort', icon: '🗺️' },
  { id: 'matrix', label: 'Kalender', icon: '📊' },
  { id: 'weekends', label: 'Weekender', icon: '🏕️' },
  { id: 'stats', label: 'Statistik', icon: '📈' },
];

export default function BottomNav({ viewMode, setViewMode }) {
  return (
    <nav className="bottom-nav" aria-label="Mobil bundnavigation">
      {TABS.map((tab) => {
        const isActive = viewMode === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setViewMode(tab.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="bottom-nav-icon">{tab.icon}</span>
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
