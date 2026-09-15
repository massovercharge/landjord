import React from 'react';

export default function AppFooter({ isUnlocked, onOpenUnlock }) {
  return (
    <footer className="app-footer">
      <span>Landjord Overblik (Uofficielt)</span>
      <button 
        type="button" 
        className="discreet-lock-btn" 
        onClick={onOpenUnlock}
        aria-label="Adgang"
      >
        {isUnlocked ? '🔓' : '🔒'}
      </button>
    </footer>
  );
}
