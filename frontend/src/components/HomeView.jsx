import React from 'react';
import AppFooter from './AppFooter';

export default function HomeView({ sites, setViewMode, isUnlocked, onOpenUnlock }) {
  const totalSites = sites.length;
  const hotSites = sites.filter(s => s.popularity_score === 'hot').length;
  const mediumSites = sites.filter(s => s.popularity_score === 'medium').length;

  return (
    <div className="view-container">
      <div className="home-view">
        <div className="hero-section">
        <h1>Velkommen til Landjord Overblik</h1>
        <p>Dit uofficielle community-værktøj til at finde den perfekte naturoplevelse i Danmark.</p>
        <button className="primary-btn hero-btn" onClick={() => setViewMode('map')}>Find en lejrplads nu</button>
      </div>
      
      <div className="home-grid">
        <div className="stats-card">
          <h2>📊 Live Statistik</h2>
          <div className="stat-row">
            <span className="stat-value">{totalSites}</span>
            <span className="stat-label">Lejrpladser på Landjord.com</span>
          </div>
          <div className="stat-row">
            <span className="stat-value">🔥 {hotSites}</span>
            <span className="stat-label">Høj efterspørgsel lige nu</span>
          </div>
          <div className="stat-row">
            <span className="stat-value">⭐ {mediumSites}</span>
            <span className="stat-label">Moderat efterspørgsel</span>
          </div>
        </div>

        <div className="cta-card">
          <h2>🌱 Støt Organisationen</h2>
          <p>Dette er et uofficielt værktøj drevet af fællesskabet. Landjord arbejder hårdt på at gøre den danske natur tilgængelig for os alle.</p>
          <p>Overvej at støtte deres arbejde eller find mere information på deres officielle platform.</p>
          <a href="https://www.landjord.com/blivmedlem" target="_blank" rel="noreferrer" className="support-link">Bliv Medlem & Støt</a>
        </div>

        <div className="instagram-card">
          <h2>📸 Sidste Nyt fra Landjord</h2>
          <div className="ig-embed-container">
            <iframe 
                src="https://www.instagram.com/reel/DPLbZ7CDCIt/embed" 
                width="100%" 
                height="480" 
                frameBorder="0" 
                scrolling="no" 
                allowTransparency="true"
                style={{ borderRadius: '12px' }}
                title="Instagram Reel"
            ></iframe>
          </div>
        </div>
        </div>
        <AppFooter isUnlocked={isUnlocked} onOpenUnlock={onOpenUnlock} />
      </div>
    </div>
  );
}
