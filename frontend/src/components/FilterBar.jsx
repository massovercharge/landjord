import React from 'react';

export default function FilterBar({ 
  viewMode, 
  setViewMode, 
  filterStart, 
  setFilterStart, 
  filterEnd, 
  setFilterEnd, 
  today, 
  searchLocation, 
  setSearchLocation, 
  handleLocationSearch, 
  handleAutoLocate, 
  locating, 
  userCoords, 
  setUserCoords 
}) {
  return (
    <header className="filter-bar">
      <div className="filter-content">
        <div className="logo">
          <h1>Landjord Overblik (Uofficielt)</h1>
        </div>
        
        <div className="view-toggles">
          <button className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')}>🗺️ Kort</button>
          <button className={viewMode === 'matrix' ? 'active' : ''} onClick={() => setViewMode('matrix')}>📊 Kalender</button>
          <button className={viewMode === 'weekends' ? 'active' : ''} onClick={() => setViewMode('weekends')}>🏕️ Weekender</button>
        </div>

        {viewMode === 'map' ? (
          <div className="date-filter">
            <div className="filter-input-group">
              <label>Fra</label>
              <input type="date" value={filterStart} min={today} onChange={e => setFilterStart(e.target.value)} />
            </div>
            <div className="filter-input-group">
              <label>Til</label>
              <input type="date" value={filterEnd} min={filterStart || today} onChange={e => setFilterEnd(e.target.value)} />
            </div>
            {(filterStart || filterEnd) && (
              <button className="clear-btn" onClick={() => { setFilterStart(''); setFilterEnd(''); }}>Nulstil</button>
            )}
          </div>
        ) : (
          <form className="location-filter" onSubmit={handleLocationSearch}>
            <div className="filter-input-group relative-input">
              <input 
                type="text" 
                placeholder="Din by (f.eks. Odense)" 
                value={searchLocation} 
                onChange={e => setSearchLocation(e.target.value)} 
              />
              <button type="button" className="auto-loc-btn" onClick={handleAutoLocate} title="Brug min nuværende placering">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                </svg>
              </button>
            </div>
            <button type="submit" disabled={locating} className="loc-btn">
              {locating ? 'Søger...' : '📍 Afstand'}
            </button>
            {userCoords && <button type="button" className="clear-btn" onClick={() => { setSearchLocation(''); setUserCoords(null); }}>✖</button>}
          </form>
        )}
      </div>
      <div className="mode-help-text">
         {viewMode === 'map' && "📍 Geografisk overblik: Perfekt når du kender dine eksakte rejsedatoer og hurtigt vil se de ledige muligheder på et Danmarkskort."}
         {viewMode === 'matrix' && "📊 Det store puslespil: Ideelt til den fleksible tur. Få overblikket over alle pladsernes ledige 'huller', så du nemt kan matche dem med dine fridage."}
         {viewMode === 'weekends' && "🏕️ Hurtig getaway: Skræddersyet til weekendture. Vi har samlet de næste 8 weekender, så du lynhurtigt kan se præcis hvilke pladser der er ledige fra fredag til søndag."}
      </div>
    </header>
  );
}
