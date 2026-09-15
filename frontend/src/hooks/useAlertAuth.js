import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'landjord_alert_key';

export function useAlertAuth() {
  const [unlockedKey, setUnlockedKey] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const isUnlocked = Boolean(unlockedKey);

  const lock = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setUnlockedKey('');
  }, []);

  const unlock = useCallback(async (password) => {
    if (!password) return { success: false, error: 'Indtast venligst en kode' };
    try {
      const res = await fetch('/api/alerts/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (res.ok) {
        try {
          localStorage.setItem(STORAGE_KEY, password);
        } catch {}
        setUnlockedKey(password);
        return { success: true };
      } else {
        return { success: false, error: 'Forkert adgangskode' };
      }
    } catch (e) {
      return { success: false, error: 'Netværksfejl under validering' };
    }
  }, []);

  // Check for ?unlock=... or ?key=... URL query parameter on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('unlock') || params.get('key');
      if (urlCode) {
        unlock(urlCode).then(result => {
          if (result.success) {
            // Remove the unlock parameter from the URL to keep it clean
            params.delete('unlock');
            params.delete('key');
            const newQuery = params.toString() ? `?${params.toString()}` : '';
            const newUrl = `${window.location.pathname}${newQuery}${window.location.hash}`;
            window.history.replaceState({}, document.title, newUrl);
          }
        });
      }
    } catch {}
  }, [unlock]);

  return {
    isUnlocked,
    unlockedKey,
    unlock,
    lock
  };
}
