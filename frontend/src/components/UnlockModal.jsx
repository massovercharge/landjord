import React, { useState } from 'react';

export default function UnlockModal({ isOpen, onClose, isUnlocked, unlock, lock }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await unlock(password);
    setLoading(false);

    if (result.success) {
      setPassword('');
      onClose();
    } else {
      setError(result.error || 'Forkert kode');
    }
  };

  const handleLock = () => {
    lock();
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', padding: '1.75rem' }}>
        <button className="modal-close-btn" onClick={onClose}>✖</button>

        <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--accent-color)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔒</span> Adgangskode
        </h3>

        {isUnlocked ? (
          <div>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              Ekstra funktioner er aktiveret på denne enhed.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleLock}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Lås igen
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-primary"
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Luk
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0 0 1rem 0', lineHeight: '1.5' }}>
              Indtast adgangskode for at aktivere ekstra funktioner.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Indtast kode"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-color)',
                  border: '1px solid var(--card-border)',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 14px',
                  background: 'transparent',
                  border: '1px solid var(--card-border)',
                  color: '#94a3b8',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Annuller
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '8px 18px',
                  backgroundColor: 'var(--accent-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? 'Validerer...' : 'Lås op'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
