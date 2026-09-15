import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import AppFooter from './AppFooter';

export default function StatsView({ sites, isUnlocked = false, unlockedKey = '', onOpenUnlock }) {
  const [period, setPeriod] = useState(30);
  const [selectedSiteSlug, setSelectedSiteSlug] = useState('all');
  const [trends, setTrends] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [watchlistForm, setWatchlistForm] = useState({
      email: '', start_date: '', end_date: '', match_type: 'any', min_days: 1, gdpr: false
  });
  const [watchlistStatus, setWatchlistStatus] = useState(null);

  const siteOccupied = useMemo(() => {
    if (selectedSiteSlug === 'all') return [];
    const site = sites.find(s => s.slug === selectedSiteSlug);
    return site ? site.occupiedDates || [] : [];
  }, [selectedSiteSlug, sites]);

  const parseDate = (dStr) => {
    if (!dStr) return null;
    const [y, m, d] = dStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const formatDate = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const periodDays = useMemo(() => {
    if (!watchlistForm.start_date || !watchlistForm.end_date) return 1;
    const start = parseDate(watchlistForm.start_date);
    const end = parseDate(watchlistForm.end_date);
    if (!start || !end || end < start) return 1;
    return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  }, [watchlistForm.start_date, watchlistForm.end_date]);

  const submitWatchlist = async (e) => {
    e.preventDefault();
    setWatchlistStatus('submitting');
    try {
        const passwordHeader = unlockedKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('landjord_alert_key') : '') || '';
        const res = await fetch('/api/alerts', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Alert-Password': passwordHeader
            },
            body: JSON.stringify({
                email: watchlistForm.email,
                site_slug: selectedSiteSlug,
                start_date: watchlistForm.start_date,
                end_date: watchlistForm.end_date,
                match_type: watchlistForm.match_type,
                min_days: watchlistForm.min_days
            })
        });
        if (res.ok) {
            setWatchlistStatus('success');
        } else {
            setWatchlistStatus('error');
        }
    } catch (err) {
        setWatchlistStatus('error');
    }
  };

  const renderWatchlistModal = () => {
    if (!isUnlocked || !showWatchlistModal) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content watchlist-modal">
                <button className="close-btn" onClick={() => {setShowWatchlistModal(false); setWatchlistStatus(null);}}>✕</button>
                <h3>Overvåg {sites.find(s => s.slug === selectedSiteSlug)?.name} 🔔</h3>
                
                {watchlistStatus === 'success' ? (
                    <div className="success-message">
                        <h4>Succes!</h4>
                        <p>Din overvågning er oprettet. Vi sender en mail, hvis der bliver ledigt i perioden.</p>
                        <p style={{fontSize: '13px', marginTop: '15px', padding: '10px', backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', borderRadius: '6px', border: '1px solid rgba(251, 191, 36, 0.3)'}}>
                            ⚠️ <b>Vigtigt:</b> Vores bekræftelses-mail lander muligvis i din Spam/Uønsket post-mappe. Husk at flytte den til indbakken og tilføje vores e-mailadresse til betroede afsendere for ikke at misse ledige pladser!
                        </p>
                        <button className="btn-primary" style={{marginTop: '20px'}} onClick={() => { setShowWatchlistModal(false); setWatchlistStatus(null); }}>Luk vindue</button>
                    </div>
                ) : (
                    <form onSubmit={submitWatchlist}>
                        <p className="form-desc">Få besked når der bliver plads i en given periode.</p>
                        <div className="form-group">
                            <label>E-mail:</label>
                            <input type="email" required value={watchlistForm.email} onChange={e => setWatchlistForm({...watchlistForm, email: e.target.value})} placeholder="din@email.dk" />
                        </div>
                        <div className="form-group row">
                            <div className="flex-1">
                                <label>Startdato:</label>
                                <DatePicker 
                                  selected={parseDate(watchlistForm.start_date)} 
                                  onChange={(date) => setWatchlistForm({...watchlistForm, start_date: formatDate(date)})} 
                                  minDate={new Date()}
                                  dateFormat="dd.MM.yyyy"
                                  placeholderText="Vælg startdato"
                                  dayClassName={(date) => siteOccupied.includes(formatDate(date)) ? 'booked-date' : 'free-date'}
                                  required
                                />
                            </div>
                            <div className="flex-1">
                                <label>Slutdato:</label>
                                <DatePicker 
                                  selected={parseDate(watchlistForm.end_date)} 
                                  onChange={(date) => setWatchlistForm({...watchlistForm, end_date: formatDate(date)})} 
                                  minDate={parseDate(watchlistForm.start_date) || new Date()}
                                  dateFormat="dd.MM.yyyy"
                                  placeholderText="Vælg slutdato"
                                  dayClassName={(date) => siteOccupied.includes(formatDate(date)) ? 'booked-date' : 'free-date'}
                                  required
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Betingelse for besked:</label>
                            <div className="radio-group" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="radio" name="match_type" value="all" checked={watchlistForm.match_type === 'all'} onChange={() => setWatchlistForm({...watchlistForm, match_type: 'all'})} />
                                    Hele perioden bliver ledig
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="radio" name="match_type" value="any" checked={watchlistForm.match_type === 'any'} onChange={() => setWatchlistForm({...watchlistForm, match_type: 'any'})} />
                                    Giv besked hvis minimum <input type="number" min="1" max={periodDays} value={watchlistForm.min_days} onChange={(e) => {
                                      let val = parseInt(e.target.value) || 1;
                                      if (val > periodDays) val = periodDays;
                                      if (val < 1) val = 1;
                                      setWatchlistForm({...watchlistForm, min_days: val, match_type: 'any'});
                                    }} onClick={(e) => setWatchlistForm({...watchlistForm, match_type: 'any'})} style={{ width: '60px', padding: '2px 5px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--card-border)', color: 'white', borderRadius: '4px' }} /> sammenhængende dage bliver ledige
                                </label>
                            </div>
                        </div>
                        <div className="form-group gdpr-group">
                            <label className="checkbox-label">
                                <input type="checkbox" required checked={watchlistForm.gdpr} onChange={e => setWatchlistForm({...watchlistForm, gdpr: e.target.checked})} />
                                Jeg accepterer at min e-mail gemmes til at sende beskeder
                            </label>
                        </div>
                        {watchlistStatus === 'error' && <div className="error-message">Der skete en fejl. Prøv igen.</div>}
                        <button type="submit" className="btn-primary" disabled={watchlistStatus === 'submitting'}>
                            {watchlistStatus === 'submitting' ? 'Opretter...' : 'Opret Overvågning'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
  };

  // Fetch booking trends when site selection changes
  React.useEffect(() => {
    fetch(`/api/booking_trends?site_slug=${selectedSiteSlug}`)
      .then(res => res.json())
      .then(data => setTrends(data))
      .catch(err => console.error("Could not fetch trends", err));
  }, [selectedSiteSlug]);

  const { historical, paddingDays, topSites, weekdays, isSingleSite, filteredSitesCount } = useMemo(() => {
    if (!sites || sites.length === 0) return { historical: [], topSites: [], weekdays: [], isSingleSite: false, filteredSitesCount: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateRange = [];
    for (let i = 0; i < period; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dateRange.push(d);
    }

    let filteredSites = sites;
    let singleSite = false;

    if (selectedSiteSlug === 'region_jylland') {
      filteredSites = sites.filter(s => s.longitude <= 9.75 || (s.latitude > 55.65 && s.longitude <= 11.0));
    } else if (selectedSiteSlug === 'region_fyn') {
      filteredSites = sites.filter(s => s.longitude > 9.75 && s.longitude <= 10.8 && s.latitude <= 55.65);
    } else if (selectedSiteSlug === 'region_sjaelland') {
      filteredSites = sites.filter(s => s.longitude > 10.8);
    } else if (selectedSiteSlug !== 'all') {
      filteredSites = sites.filter(s => s.slug === selectedSiteSlug);
      singleSite = true;
    }

    const historicalMap = {};
    const weekdayMap = { "Mandag": 0, "Tirsdag": 0, "Onsdag": 0, "Torsdag": 0, "Fredag": 0, "Lørdag": 0, "Søndag": 0 };
    const weekdayNames = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];

    dateRange.forEach(d => {
      const dStr = d.toISOString().split('T')[0];
      const displayDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      historicalMap[dStr] = { dateStr: dStr, displayDate, reservations: 0, weekday: weekdayNames[d.getDay()], isWeekend: d.getDay() === 0 || d.getDay() === 6 };
    });

    const siteStats = sites.map(s => ({ name: s.name || s.slug, reservations: 0 }));

    filteredSites.forEach(site => {
      const occupied = site.occupiedDates || [];
      occupied.forEach(dStr => {
        if (historicalMap[dStr]) {
          historicalMap[dStr].reservations += 1;
          weekdayMap[historicalMap[dStr].weekday] += 1;
        }
      });
    });

    // We only calculate top sites if we are viewing a group
    if (!singleSite) {
      filteredSites.forEach((site) => {
        const occupied = site.occupiedDates || [];
        let count = 0;
        occupied.forEach(dStr => {
          if (historicalMap[dStr]) count++;
        });
        const siteStat = siteStats.find(s => s.name === (site.name || site.slug));
        if (siteStat) siteStat.reservations = count;
      });
    }

    const historical = Object.values(historicalMap).map(h => ({
      date: h.displayDate,
      fullDate: h.dateStr,
      reservations: h.reservations,
      isWeekend: h.isWeekend
    }));
    
    // Beregn offset for kalender-grid (hvis i dag ikke er en mandag)
    const startOffset = (today.getDay() + 6) % 7;
    const paddingDays = [];
    for (let i = 0; i < (startOffset || 0); i++) {
      paddingDays.push(null);
    }

    siteStats.sort((a, b) => b.reservations - a.reservations);
    const topSites = siteStats.filter(s => s.reservations > 0).slice(0, 15);

    const weekdays = [
      { name: "Mandag", reservations: weekdayMap["Mandag"] },
      { name: "Tirsdag", reservations: weekdayMap["Tirsdag"] },
      { name: "Onsdag", reservations: weekdayMap["Onsdag"] },
      { name: "Torsdag", reservations: weekdayMap["Torsdag"] },
      { name: "Fredag", reservations: weekdayMap["Fredag"] },
      { name: "Lørdag", reservations: weekdayMap["Lørdag"] },
      { name: "Søndag", reservations: weekdayMap["Søndag"] }
    ];

    return { historical, paddingDays, topSites, weekdays, isSingleSite: singleSite, filteredSitesCount: filteredSites.length };
  }, [sites, period, selectedSiteSlug]);

  if (!sites || sites.length === 0) {
    return (
      <div className="view-container">
        <div className="loader">
          <div className="spinner"></div>
          <p>Indlæser statistik...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="stats-view">
        <div className="view-header">
          <h2>📈 Efterspørgsel og Statistik</h2>
          <p>Følg med i hvor mange reservationer der bliver lavet, og planlæg din tur udenom de travleste dage.</p>
        </div>

        <div className="stats-filters">
          <div className="filter-group">
            <label>Vis data for:</label>
            <select 
              value={selectedSiteSlug} 
              onChange={e => setSelectedSiteSlug(e.target.value)}
              className="site-select"
            >
              <optgroup label="Grupper">
                <option value="all">Alle pladser (Landsdækkende)</option>
                <option value="region_jylland">Jylland</option>
                <option value="region_fyn">Fyn</option>
                <option value="region_sjaelland">Sjælland</option>
              </optgroup>
              <optgroup label="Specifikke Pladser">
                {sites.map(s => (
                  <option key={s.slug} value={s.slug}>{s.name || s.slug}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="filter-group">
            <label>Periode:</label>
            <div className="period-pills">
              <button className={period === 14 ? 'active' : ''} onClick={() => setPeriod(14)}>14 Dage</button>
              <button className={period === 30 ? 'active' : ''} onClick={() => setPeriod(30)}>30 Dage</button>
              <button className={period === 90 ? 'active' : ''} onClick={() => setPeriod(90)}>90 Dage</button>
              <button className={period === 365 ? 'active' : ''} onClick={() => setPeriod(365)}>1 År</button>
            </div>
          </div>
        </div>

        <div className="stats-charts-grid">
          {renderWatchlistModal()}
          {/* Chart 1: Historisk over tid / Ledighedskalender */}
          <div className="chart-card">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
              <h3 style={{marginBottom: 0, borderBottom: 'none', paddingBottom: 0}}>{isSingleSite ? 'Booking Kalender' : `Efterspørgsel (De næste ${period} dage)`}</h3>
              {isUnlocked && isSingleSite && (
                  <button className="watchlist-btn" onClick={() => setShowWatchlistModal(true)}>
                      Overvåg plads 🔔
                  </button>
              )}
            </div>
            <p className="chart-desc" style={{marginTop: 0}}>
              {isSingleSite 
                ? "Viser præcist hvornår pladsen er optaget eller ledig." 
                : `Viser det forventede antal bookinger på tværs af ${filteredSitesCount} pladser dag for dag.`}
            </p>
            <div className="chart-wrapper">
              {isSingleSite ? (
                <div className="booking-calendar-wrapper">
                  <div className="booking-calendar-header">
                    <span>Man</span><span>Tir</span><span>Ons</span><span>Tor</span><span>Fre</span><span>Lør</span><span>Søn</span>
                  </div>
                  <div className="booking-calendar-grid">
                    {paddingDays?.map((_, i) => (
                      <div key={`pad-${i}`} className="calendar-day empty"></div>
                    ))}
                    {historical?.map((h, i) => (
                      <div 
                        key={`hist-${i}`} 
                        className={`calendar-day ${h?.reservations > 0 ? 'booked' : 'free'}`}
                        title={`${h?.fullDate || ''}: ${h?.reservations > 0 ? 'Reserveret' : 'Ledig'}`}
                      >
                        <span className="date-number">{h?.date ? String(h.date).split('/')[0] : ''}</span>
                        <span className="date-month">{h?.date ? String(h.date).split('/')[1] : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={historical} margin={{ top: 10, right: 10, left: isMobile ? -30 : -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#94a3b8" 
                      tick={{fontSize: isMobile ? 10 : 12}} 
                      minTickGap={isMobile ? 15 : 10} 
                      interval="preserveStartEnd" 
                    />
                    <YAxis stroke="#94a3b8" tick={{fontSize: isMobile ? 10 : 12}} width={isMobile ? 30 : 40} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => [`${value} reservationer`, 'Efterspørgsel']}
                    />
                    <Bar dataKey="reservations" fill="#4ade80" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 3: Ugedage */}
          <div className="chart-card">
            <h3>Hvornår camperer vi mest?</h3>
            <p className="chart-desc">Fordelingen af bookede nætter på ugens dage for den valgte periode.</p>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weekdays} margin={{ top: 10, right: 10, left: isMobile ? -30 : -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    tick={{fontSize: isMobile ? 10 : 12}} 
                    tickFormatter={(name) => isMobile ? name.slice(0, 3) : name} 
                  />
                  <YAxis stroke="#94a3b8" tick={{fontSize: isMobile ? 10 : 12}} width={isMobile ? 30 : 40} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    formatter={(value) => [`${value} reservationer`, 'Efterspørgsel']}
                  />
                  <Bar dataKey="reservations" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Top Sites */}
          {!isSingleSite && topSites.length > 0 && (
            <div className="chart-card top-sites-card">
              <h3>Mest populære pladser i {selectedSiteSlug === 'all' ? 'Danmark' : selectedSiteSlug.replace('region_', '').replace('sjaelland', 'Sjælland').replace('fyn', 'Fyn').replace('jylland', 'Jylland')} (Top 15)</h3>
              <p className="chart-desc">De pladser der har flest reservationer i de kommende {period} dage.</p>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={Math.max(300, topSites.length * (isMobile ? 30 : 35))}>
                  <BarChart 
                    data={topSites} 
                    layout="vertical" 
                    margin={{ top: 5, right: isMobile ? 15 : 30, left: isMobile ? 5 : 150, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" tick={{fontSize: isMobile ? 10 : 12}} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      stroke="#94a3b8" 
                      width={isMobile ? 95 : 140} 
                      tick={{fontSize: isMobile ? 10 : 12, fill: '#e2e8f0'}} 
                      tickFormatter={(name) => isMobile && name.length > 12 ? `${name.slice(0, 11)}…` : name}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => [`${value} reservationer`, 'Efterspørgsel']}
                    />
                    <Bar dataKey="reservations" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {/* Chart 4: Booking Horizon (Nyt Ledger-system) */}
          <div className="chart-card">
            <h3>Hvor længe i forvejen bookes der?</h3>
            {trends && trends.total > 0 ? (
              <>
                <p className="chart-desc">Baseret på {trends.total} nye observationer af bookinger i forhold til baseline.</p>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={trends.trends} margin={{ top: 10, right: 10, left: isMobile ? -30 : -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: isMobile ? 10 : 12}} />
                      <YAxis stroke="#94a3b8" tick={{fontSize: isMobile ? 10 : 12}} width={isMobile ? 30 : 40} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                        formatter={(value, name, props) => [`${value} bookinger (${props.payload.percentage}%)`, 'Antal']}
                      />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <p className="chart-desc" style={{fontStyle: 'normal', color: '#94a3b8', padding: '8px 0', lineHeight: 1.5}}>
                ⏱️ <em>Indsamler løbende data over nye reservationer...</em><br/>
                For at undgå misvisende tal medregnes eksisterende bookinger ikke i booking-horisonten. Grafen opbygges automatisk i takt med, at systemet observerer nye bookinger ved de kommende scraping-tjek.
              </p>
            )}
          </div>

        </div>
        <AppFooter isUnlocked={isUnlocked} onOpenUnlock={onOpenUnlock} />
      </div>
    </div>
  );
}
