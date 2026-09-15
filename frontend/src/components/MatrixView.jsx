import React, { useState, useMemo, useCallback } from 'react';
import { getISOWeek, getLocalDateString, getDanishHoliday } from '../utils/helpers';
import AppFooter from './AppFooter';

export default function MatrixView({ sites, getImageUrl, goToBooking, isUnlocked, onOpenUnlock }) {
  const [matrixHoverImg, setMatrixHoverImg] = useState(null);
  const [daysCount, setDaysCount] = useState(90);

  // Memoize dates and weeks so we don't recalculate on every render
  const { dates, weeks } = useMemo(() => {
    const datesArray = Array.from({length: daysCount}, (_, i) => {
       const d = new Date(); d.setDate(d.getDate() + i); return d;
    });

    const weeksArray = [];
    let currentWeek = null;
    datesArray.forEach(d => {
      const weekNum = getISOWeek(d);
      if (!currentWeek || currentWeek.weekNum !== weekNum) {
        currentWeek = { weekNum, count: 1 };
        weeksArray.push(currentWeek);
      } else {
        currentWeek.count++;
      }
    });

    return { dates: datesArray, weeks: weeksArray };
  }, [daysCount]);

  const handleScroll = useCallback((e) => {
    const { scrollLeft, scrollWidth, clientWidth } = e.target;
    // Load more when user is 500px from the right edge
    if (scrollLeft + clientWidth >= scrollWidth - 500) {
      setDaysCount(prev => Math.min(prev + 30, 365));
    }
  }, []);

  return (
     <div className="view-container matrix-view">
       <div className="view-header">
          <h2>Kalendervisning</h2>
          <p><strong>Tip:</strong> Grøn = Ledig. Tryk på et grønt felt for at booke 1 nat. Scroll mod højre for at se længere frem i tiden (Hold musen over pladsnavn på pc for billede).</p>
       </div>
       <div className="matrix-table-wrapper" onScroll={handleScroll}>
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
                     const holidayName = getDanishHoliday(d);
                     const isHighlighted = isWeekend || holidayName;
                     return (
                     <th key={getLocalDateString(d)} className={isHighlighted ? 'weekend-col' : ''} title={holidayName || ''}>
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
               {sites.map(site => (
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
                        {site.popularity_score === 'hot' && <span title="Meget populær plads" style={{marginLeft: '5px', fontSize: '14px'}}>🔥</span>}
                        {site.distance !== undefined && <div className="dist">{site.distance} km</div>}
                        {site.pois && (
                          <div className="pois-mini" style={{fontSize:'10px', color:'#aaa', marginTop:'4px'}}>
                             🛒 {site.pois.supermarket}km 🚌 {site.pois.bus}km
                          </div>
                        )}
                     </td>
                     {dates.map(d => {
                        const isWeekend = d.getDay() === 0 || d.getDay() === 5 || d.getDay() === 6;
                        const holidayName = getDanishHoliday(d);
                        const isHighlighted = isWeekend || holidayName;
                        const dateStr = getLocalDateString(d);
                        const isOccupied = (site.occupiedDates || []).includes(dateStr);
                        
                        // Beregn afrejsedag (næste dag) for hurtig booking
                        const nextDay = new Date(d);
                        nextDay.setDate(nextDay.getDate() + 1);
                        const nextDayStr = getLocalDateString(nextDay);

                        return (
                           <td 
                             key={dateStr} 
                             className={`matrix-cell ${isOccupied ? 'occupied' : 'free'} ${isHighlighted ? 'weekend-col' : ''}`}
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
       <AppFooter isUnlocked={isUnlocked} onOpenUnlock={onOpenUnlock} />
     </div>
  );
}
