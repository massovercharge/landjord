import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { getLocalDateString } from '../utils/helpers';

export default function WeekendsView({ sites, getImageUrl, goToBooking, enableExternalImages }) {
  const [weekendMode, setWeekendMode] = useState('fri-sun');
  const [expandedWeekends, setExpandedWeekends] = useState({});
  const [hoveredSiteKey, setHoveredSiteKey] = useState(null);
  const [toggledSiteKeys, setToggledSiteKeys] = useState({});

  const toggleWeekendExpanded = (startStr) => {
    setExpandedWeekends(prev => ({...prev, [startStr]: !prev[startStr]}));
  };

  const toggleSiteMedia = (siteKey) => {
    setToggledSiteKeys(prev => ({ ...prev, [siteKey]: !prev[siteKey] }));
  };

  const weekends = useMemo(() => {
    const list = [];
    let curr = new Date();
    // Find next Friday
    curr.setDate(curr.getDate() + (5 - curr.getDay() + 7) % 7);
    
    for(let i=0; i<8; i++) {
       const fri = new Date(curr);
       const sun = new Date(curr);
       sun.setDate(sun.getDate() + 2);
       
       const friStr = getLocalDateString(fri);
       const satStr = getLocalDateString(new Date(fri.getTime() + 86400000));
       const sunStr = getLocalDateString(sun);

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
       
       list.push({
          title,
          start,
          end,
          datesToCheck
       });
       curr.setDate(curr.getDate() + 7);
    }
    return list;
  }, [weekendMode]);

  return (
    <div className="view-container weekends-view">
      <div className="view-header">
         <h2>Ledige Weekender</h2>
         <p><strong>Tip:</strong> Tryk på et billede (eller hold musen over på pc) for at se pladsens lokation på kort.</p>
         <div className="weekend-mode-selector">
           <button className={weekendMode === 'fri-sun' ? 'active' : ''} onClick={() => setWeekendMode('fri-sun')}>Fre-Søn</button>
           <button className={weekendMode === 'fri-sat' ? 'active' : ''} onClick={() => setWeekendMode('fri-sat')}>Fre-Lør (1 nat)</button>
           <button className={weekendMode === 'sat-sun' ? 'active' : ''} onClick={() => setWeekendMode('sat-sun')}>Lør-Søn (1 nat)</button>
         </div>
      </div>
      <div className="weekends-list">
        {weekends.map(wknd => {
          const availableSites = sites.filter(site => {
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
                      const showMap = (!enableExternalImages) || (hoveredSiteKey === siteKey) || (!!toggledSiteKeys[siteKey]);
                      return (
                         <div 
                           className="weekend-site" 
                           key={site.slug}
                           onMouseEnter={() => setHoveredSiteKey(siteKey)}
                           onMouseLeave={() => setHoveredSiteKey(null)}
                         >
                            <div 
                              className="bg-media-container"
                              onClick={() => toggleSiteMedia(siteKey)}
                              role="button"
                              tabIndex={0}
                              title="Tryk for at skifte mellem billede og kort"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleSiteMedia(siteKey);
                                }
                              }}
                            >
                               {enableExternalImages && (
                                  <div className={`bg-img ${showMap ? 'hidden' : ''}`} style={getImageUrl(site) ? {backgroundImage: `url(${getImageUrl(site)})`} : {background: '#334155'}}></div>
                                )}
                               {showMap && (
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
                               {enableExternalImages && (
                                 <span className="media-toggle-badge">
                                   {showMap ? '📷 Foto' : '🗺️ Kort'}
                                 </span>
                               )}
                            </div>
                            <div className="info">
                               <h4>
                                 {site.name}
                                 {site.popularity_score === 'hot' && <span title="Høj efterspørgsel" style={{marginLeft:'5px'}}>🔥</span>}
                               </h4>
                               {site.distance !== undefined && <span className="dist">📍 {site.distance} km</span>}
                               {site.pois && (
                                 <div className="poi-badges" style={{display:'flex', gap:'5px', fontSize:'11px', marginTop:'6px', color:'#e2e8f0'}}>
                                    <span style={{background:'#334155', padding:'2px 6px', borderRadius:'4px'}}>🛒 {site.pois.supermarket}km</span>
                                    <span style={{background:'#334155', padding:'2px 6px', borderRadius:'4px'}}>🚌 {site.pois.bus}km</span>
                                 </div>
                               )}
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
}
