import { useState, useEffect, useMemo } from 'react';
import './index.css';
import 'leaflet/dist/leaflet.css';
import { getDistanceInKm, getLocalDateString } from './utils/helpers';
import { useSites } from './hooks/useSites';

import FilterBar from './components/FilterBar';
import MapView from './components/MapView';
import MatrixView from './components/MatrixView';
import WeekendsView from './components/WeekendsView';

import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// 🛑 LEGAL SAFEGUARD: Set to true to enable displaying copyrighted images from landjord.com
const ENABLE_EXTERNAL_IMAGES = true;

function App() {
  const { sites, loading } = useSites();
  
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

  // Location Filter State
  const [searchLocation, setSearchLocation] = useState('');
  const [userCoords, setUserCoords] = useState(null);
  const [locating, setLocating] = useState(false);

  // Filtering & Sorting
  const filteredAndSortedSites = useMemo(() => {
    let result = [...sites];

    // Date Filter (kun aktiv for kortvisning)
    if (viewMode === 'map' && filterStart && filterEnd) {
      let dates = [];
      let curr = new Date(filterStart);
      let end = new Date(filterEnd);
      while (curr < end) {
        dates.push(getLocalDateString(curr));
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

  const today = getLocalDateString(new Date());

  return (
    <div className="app-container">
      <FilterBar 
        viewMode={viewMode}
        setViewMode={setViewMode}
        filterStart={filterStart}
        setFilterStart={setFilterStart}
        filterEnd={filterEnd}
        setFilterEnd={setFilterEnd}
        today={today}
        searchLocation={searchLocation}
        setSearchLocation={setSearchLocation}
        handleLocationSearch={handleLocationSearch}
        handleAutoLocate={handleAutoLocate}
        locating={locating}
        userCoords={userCoords}
        setUserCoords={setUserCoords}
      />

      <main className="main-content-wrapper">
        {loading ? (
          <div className="loader">
            <div className="spinner"></div>
            <p>Indlæser data og kalendere...</p>
          </div>
        ) : (
          <>
            {viewMode === 'map' && (
              <MapView 
                sites={filteredAndSortedSites} 
                userCoords={userCoords} 
                getImageUrl={getImageUrl} 
                goToBooking={goToBooking} 
              />
            )}
            {viewMode === 'matrix' && (
              <MatrixView 
                sites={filteredAndSortedSites} 
                getImageUrl={getImageUrl} 
                goToBooking={goToBooking} 
              />
            )}
            {viewMode === 'weekends' && (
              <WeekendsView 
                sites={filteredAndSortedSites} 
                getImageUrl={getImageUrl} 
                goToBooking={goToBooking} 
                enableExternalImages={ENABLE_EXTERNAL_IMAGES}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
