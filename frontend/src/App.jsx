import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import './index.css';

// Fix leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// 🛑 LEGAL SAFEGUARD: Set to true to enable displaying copyrighted images from landjord.com
const ENABLE_EXTERNAL_IMAGES = true;

// Helper for coordinates distance
function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Helper for ISO week number
function getISOWeek(d) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function App() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // App Modes
  const getInitialViewMode = () => {
    const hash = window.location.hash.replace('#', '');
    return ['map', 'matrix', 'weekends'].includes(hash) ? hash : 'map';
  };
  const [viewMode, setViewMode] = useState(getInitialViewMode());

  // Sync viewMode to URL hash
  useEffect(() => {
    window.location.hash = viewMode;
  }, [viewMode]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['map', 'matrix', 'weekends'].includes(hash)) {
        setViewMode(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  
  // Map Filter State
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  // Hover Map State
  const [hoveredSiteKey, setHoveredSiteKey] = useState(null);
  const [matrixHoverImg, setMatrixHoverImg] = useState(null);

  const [weekendMode, setWeekendMode] = useState('fri-sun');
  const [expandedWeekends, setExpandedWeekends] = useState({});

  const toggleWeekendExpanded = (startStr) => {
    setExpandedWeekends(prev => ({...prev, [startStr]: !prev[startStr]}));
  };

  // Location Filter State
  const [searchLocation, setSearchLocation] = useState('');
  const [userCoords, setUserCoords] = useState(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    fetch('/api/sites_full')
      .then(res => res.json())
      .then(data => {
        const extractedSites = data?.sites?.data || data?.sites || data || [];
        const sitesArray = Array.isArray(extractedSites) ? extractedSites : Object.values(extractedSites);
        const validSites = sitesArray.filter(s => s.latitude && s.longitude);
        setSites(validSites);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch sites", err);
        setLoading(false);
      });
  }, []);

  // Filtering & Sorting
  const filteredAndSortedSites = useMemo(() => {
    let result = [...sites];

    // Date Filter (kun aktiv for kortvisning)
    if (viewMode === 'map' && filterStart && filterEnd) {
      let dates = [];
      let curr = new Date(filterStart);
      let end = new Date(filterEnd);
      while (curr < end) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }
      
      result = result.filter(site => {
        const occupied = site.occupiedDates || [];
        const isOccupied = dates.some(d => occupied.includes(d));
        return !isOccupied;
      });
    }

    // Distance Sorting
    if (userCoords) {
      result = result.map(s => ({
        ...s,
        distance: getDistanceInKm(userCoords.lat, userCoords.lon, s.latitude, s.longitude)
      })).sort((a, b) => a.distance - b.distance);
    }
    return result;
  }, [sites, userCoords, filterStart, filterEnd, viewMode]);

  // Geocoding
  const handleLocationSearch = async (e) => {
    e.preventDefault();
    if (!searchLocation) {
      setUserCoords(null);
      return;
    }
    setLocating(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchLocation)}&countrycodes=dk`);
      const data = await res.json();
      if (data && data.length > 0) {
        setUserCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: searchLocation });
      } else {
        alert("Kunne ikke finde adressen. Prøv en specifik by, f.eks. 'Odense'.");
        setUserCoords(null);
      }
    } catch (err) {
      console.error(err);
    }
    setLocating(false);
  };

  const handleAutoLocate = () => {
    if (!navigator.geolocation) {
      alert("Din browser understøtter desværre ikke geolokation.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setUserCoords({ lat, lon, name: "Min placering" });
        setSearchLocation("Min placering");
        setLocating(false);
      },
      (err) => {
        console.error(err);
        alert("Kunne ikke finde din placering. Har du givet browseren tilladelse?");
        setLocating(false);
      }
    );
  };

  // Actions
  const goToBooking = (site, start = '', end = '') => {
    const url = `https://booking.landjord.com/sites/${site.slug}`;
    window.open(url, '_blank');
  };

  const getImageUrl = (site) => {
    if (!ENABLE_EXTERNAL_IMAGES) return null;
    if (site.images && site.images.length > 0) {
      return typeof site.images[0] === 'string' ? site.images[0] : site.images[0].url;
    }
    return site.image;
  };

  // Renderers
  const renderMap = () => (
    <MapContainer center={userCoords ? [userCoords.lat, userCoords.lon] : [56.0, 10.5]} zoom={userCoords ? 9 : 7} className="leaflet-map">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {filteredAndSortedSites.map(site => (
        <Marker key={site.slug} position={[site.latitude, site.longitude]}>
          <Tooltip direction="top" offset={[0, -20]} className="site-tooltip">
            <div className="tooltip-content">
              <strong>{site.name || site.title}</strong>
              {site.distance !== undefined && <div>Afstand: {site.distance} km</div>}
            </div>
          </Tooltip>
          <Popup className="site-popup">
            <div className="popup-content">
              {getImageUrl(site) && <img src={getImageUrl(site)} alt={site.name} className="popup-image" />}
              <h3>{site.name || site.title}</h3>
              {site.distance !== undefined && <div className="dist-badge">{site.distance} km væk</div>}
              <button className="book-btn-small" onClick={() => goToBooking(site)}>Gå til booking</button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );

  const renderMatrix = () => {
    const dates = Array.from({length: 90}, (_, i) => {
       const d = new Date(); d.setDate(d.getDate() + i); return d;
    });

    const weeks = [];
    let currentWeek = null;
    dates.forEach(d => {
      const weekNum = getISOWeek(d);
      if (!currentWeek || currentWeek.weekNum !== weekNum) {
        currentWeek = { weekNum, count: 1 };
        weeks.push(currentWeek);
      } else {
        currentWeek.count++;
      }
    });
    
    return (
       <div className="view-container matrix-view">
         <div className="view-header">
            <h2>Kalendervisning (90 dage)</h2>
            <p><strong>Tip:</strong> Grøn = Ledig. Fredag-søndag er fremhævet let. Hold musen over et pladsnavn for at se et billede. Klik på et grønt felt for at booke den pågældende nat.</p>
         </div>
         <div className="matrix-table-wrapper">
           <table className="matrix-table">
              <thead>
                 <tr>
                    <th className="sticky-col" rowSpan="2">Plads</th>
                    {weeks.map((w, i) => (
                       <th key={i} colSpan={w.count} className="week-header">
                          Uge {w.weekNum}
                       </th>
                    ))}
                 </tr>
                 <tr>
                    {dates.map(d => {
                       const isWeekend = d.getDay() === 0 || d.getDay() === 5 || d.getDay() === 6;
                       return (
                       <th key={d.toISOString()} className={isWeekend ? 'weekend-col' : ''}>
                          <div className="date-header">
                            <span className="weekday">{d.toLocaleDateString('da-DK', {weekday:'short'})}</span>
                            <span className="day">{d.getDate()}/{d.getMonth()+1}</span>
                          </div>
                       </th>
                       )
                    })}
                 </tr>
              </thead>
              <tbody>
                 {filteredAndSortedSites.map(site => (
                    <tr key={site.slug}>
                       <td 
                         className="sticky-col matrix-site-name"
                         onMouseEnter={(e) => {
                           const url = getImageUrl(site);
                           if (url) {
                             const rect = e.currentTarget.getBoundingClientRect();
                             setMatrixHoverImg({ url, x: rect.right + 10, y: Math.max(10, rect.top - 40) });
                           }
                         }}
                         onMouseLeave={() => setMatrixHoverImg(null)}
                       >
                          <strong>{site.name}</strong>
                          {site.distance !== undefined && <div className="dist">{site.distance} km</div>}
                       </td>
                       {dates.map(d => {
                          const isWeekend = d.getDay() === 0 || d.getDay() === 5 || d.getDay() === 6;
                          const dateStr = d.toISOString().split('T')[0];
                          const isOccupied = (site.occupiedDates || []).includes(dateStr);
                          
                          // Beregn afrejsedag (næste dag) for hurtig booking
                          const nextDay = new Date(d);
                          nextDay.setDate(nextDay.getDate() + 1);
                          const nextDayStr = nextDay.toISOString().split('T')[0];

                          return (
                             <td 
                               key={dateStr} 
                               className={`matrix-cell ${isOccupied ? 'occupied' : 'free'} ${isWeekend ? 'weekend-col' : ''}`}
                               onClick={() => !isOccupied && goToBooking(site, dateStr, nextDayStr)}
                               title={isOccupied ? "Optaget" : "Book 1 nat"}
                             >
                             </td>
                          )
                       })}
                    </tr>
                 ))}
              </tbody>
           </table>
         </div>
         {matrixHoverImg && (
            <div className="matrix-hover-preview" style={{ left: matrixHoverImg.x, top: matrixHoverImg.y }}>
               <img src={matrixHoverImg.url} alt="Plads preview" />
            </div>
         )}
       </div>
    );
  };

  const renderWeekends = () => {
    const weekends = [];
    let curr = new Date();
    // Find next Friday
    curr.setDate(curr.getDate() + (5 - curr.getDay() + 7) % 7);
    
    for(let i=0; i<8; i++) {
       const fri = new Date(curr);
       const sun = new Date(curr);
       sun.setDate(sun.getDate() + 2);
       
       const friStr = fri.toISOString().split('T')[0];
       const satStr = new Date(fri.getTime() + 86400000).toISOString().split('T')[0];
       const sunStr = sun.toISOString().split('T')[0];

       let title = `Weekend: ${fri.toLocaleDateString('da-DK', {day:'numeric', month:'short'})} - ${sun.toLocaleDateString('da-DK', {day:'numeric', month:'short'})}`;
       let start = friStr;
       let end = sunStr;
       let datesToCheck = [friStr, satStr];

       if (weekendMode === 'fri-sat') {
         title = `Fre-Lør: ${fri.toLocaleDateString('da-DK', {day:'numeric', month:'short'})} - ${new Date(fri.getTime() + 86400000).toLocaleDateString('da-DK', {day:'numeric', month:'short'})}`;
         start = friStr;
         end = satStr;
         datesToCheck = [friStr];
       } else if (weekendMode === 'sat-sun') {
         title = `Lør-Søn: ${new Date(fri.getTime() + 86400000).toLocaleDateString('da-DK', {day:'numeric', month:'short'})} - ${sun.toLocaleDateString('da-DK', {day:'numeric', month:'short'})}`;
         start = satStr;
         end = sunStr;
         datesToCheck = [satStr];
       }
       
       weekends.push({
          title,
          start,
          end,
          datesToCheck
       });
       curr.setDate(curr.getDate() + 7);
    }

    return (
      <div className="view-container weekends-view">
        <div className="view-header">
           <h2>Ledige Weekender</h2>
           <p><strong>Tip:</strong> Hold musen over et billede af en plads for at se et kort med pladsens præcise lokation.</p>
           <div className="weekend-mode-selector">
             <button className={weekendMode === 'fri-sun' ? 'active' : ''} onClick={() => setWeekendMode('fri-sun')}>Fre-Søn</button>
             <button className={weekendMode === 'fri-sat' ? 'active' : ''} onClick={() => setWeekendMode('fri-sat')}>Fre-Lør (1 nat)</button>
             <button className={weekendMode === 'sat-sun' ? 'active' : ''} onClick={() => setWeekendMode('sat-sun')}>Lør-Søn (1 nat)</button>
           </div>
        </div>
        <div className="weekends-list">
          {weekends.map(wknd => {
            const availableSites = filteredAndSortedSites.filter(site => {
               const occupied = site.occupiedDates || [];
               return !wknd.datesToCheck.some(d => occupied.includes(d));
            });
            
            return (
               <div key={wknd.start} className="weekend-card">
                  <div className="weekend-header">
                    <h3>{wknd.title}</h3>
                    <span className="badge">{availableSites.length} pladser ledige</span>
                  </div>
                  <div className="weekend-sites-grid">
                     {availableSites.slice(0, expandedWeekends[wknd.start] ? availableSites.length : 6).map(site => {
                        const siteKey = `${wknd.start}-${site.slug}`;
                        return (
                           <div 
                             className="weekend-site" 
                             key={site.slug}
                             onMouseEnter={() => setHoveredSiteKey(siteKey)}
                             onMouseLeave={() => setHoveredSiteKey(null)}
                           >
                              <div className="bg-media-container">
                                 {ENABLE_EXTERNAL_IMAGES && (
                                    <div className={`bg-img ${hoveredSiteKey === siteKey ? 'hidden' : ''}`} style={getImageUrl(site) ? {backgroundImage: `url(${getImageUrl(site)})`} : {background: '#334155'}}></div>
                                 )}
                                 {(!ENABLE_EXTERNAL_IMAGES || hoveredSiteKey === siteKey) && (
                                    <div className="bg-map">
                                       <MapContainer 
                                         center={[site.latitude, site.longitude]} 
                                         zoom={8} 
                                         zoomControl={false} 
                                         attributionControl={false}
                                         dragging={false}
                                         scrollWheelZoom={false}
                                         doubleClickZoom={false}
                                         style={{height: '100%', width: '100%'}}
                                       >
                                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                          <Marker position={[site.latitude, site.longitude]} />
                                       </MapContainer>
                                    </div>
                                 )}
                              </div>
                              <div className="info">
                                 <h4>{site.name}</h4>
                                 {site.distance !== undefined && <span className="dist">📍 {site.distance} km</span>}
                                 <button onClick={() => goToBooking(site, wknd.start, wknd.end)}>Se plads</button>
                              </div>
                           </div>
                        );
                     })}
                     {availableSites.length > 6 && !expandedWeekends[wknd.start] && (
                        <div className="more-indicator" onClick={() => toggleWeekendExpanded(wknd.start)}>
                           + {availableSites.length - 6} flere
                        </div>
                     )}
                     {availableSites.length > 6 && expandedWeekends[wknd.start] && (
                        <div className="more-indicator" onClick={() => toggleWeekendExpanded(wknd.start)}>
                           Vis færre
                        </div>
                     )}
                     {availableSites.length === 0 && <div className="no-sites">Ingen pladser ledige denne weekend :(</div>}
                  </div>
               </div>
            )
          })}
        </div>
      </div>
    );
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="app-container">
      {/* Global Filter Bar */}
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

      {/* Main Content Area */}
      <main className="main-content-wrapper">
        {loading ? (
          <div className="loader">
            <div className="spinner"></div>
            <p>Indlæser data og kalendere...</p>
          </div>
        ) : (
          <>
            {viewMode === 'map' && renderMap()}
            {viewMode === 'matrix' && renderMatrix()}
            {viewMode === 'weekends' && renderWeekends()}
          </>
        )}
      </main>


    </div>
  );
}

export default App;
