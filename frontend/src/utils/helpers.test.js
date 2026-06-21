import { describe, it, expect } from 'vitest';
import { getDistanceInKm, getLocalDateString, getISOWeek } from './helpers';

describe('helpers', () => {
  describe('getDistanceInKm', () => {
    it('calculates distance between Copenhagen and Aarhus correctly', () => {
      // Copenhagen
      const lat1 = 55.6761;
      const lon1 = 12.5683;
      // Aarhus
      const lat2 = 56.1567;
      const lon2 = 10.2108;
      
      const distance = getDistanceInKm(lat1, lon1, lat2, lon2);
      // Rough distance is around 150-160 km
      expect(distance).toBeGreaterThan(150);
      expect(distance).toBeLessThan(165);
    });

    it('returns 0 for the exact same coordinates', () => {
      expect(getDistanceInKm(55.0, 10.0, 55.0, 10.0)).toBe(0);
    });
  });

  describe('getLocalDateString', () => {
    it('formats a date correctly using local timezone', () => {
      // Create a date in local time
      const date = new Date(2026, 5, 21, 15, 30); // June 21, 2026
      expect(getLocalDateString(date)).toBe('2026-06-21');
    });
    
    it('pads single digit months and days', () => {
      const date = new Date(2026, 0, 5, 12, 0); // Jan 5, 2026
      expect(getLocalDateString(date)).toBe('2026-01-05');
    });
  });

  describe('getISOWeek', () => {
    it('returns the correct ISO week number', () => {
      const date1 = new Date(2026, 0, 1); // Jan 1 2026 is week 1
      expect(getISOWeek(date1)).toBe(1);
      
      const date2 = new Date(2026, 5, 21); // June 21 2026 is week 25
      expect(getISOWeek(date2)).toBe(25);
    });
  });
});
