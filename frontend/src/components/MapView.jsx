import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';

export default function MapView({ sites, userCoords, getImageUrl, goToBooking }) {
  return (
    <MapContainer center={userCoords ? [userCoords.lat, userCoords.lon] : [56.0, 10.5]} zoom={userCoords ? 9 : 7} className="leaflet-map">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {sites.map(site => (
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
}
