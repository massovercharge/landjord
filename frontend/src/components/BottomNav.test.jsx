import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import BottomNav from './BottomNav';

afterEach(cleanup);

describe('BottomNav Component', () => {
  it('renders all 5 navigation tabs', () => {
    render(<BottomNav viewMode="home" setViewMode={() => {}} />);
    expect(screen.getByText('Forside')).toBeTruthy();
    expect(screen.getByText('Kort')).toBeTruthy();
    expect(screen.getByText('Kalender')).toBeTruthy();
    expect(screen.getByText('Weekender')).toBeTruthy();
    expect(screen.getByText('Statistik')).toBeTruthy();
  });

  it('marks the active tab correctly', () => {
    render(<BottomNav viewMode="map" setViewMode={() => {}} />);
    const mapTab = screen.getByText('Kort').closest('button');
    expect(mapTab.classList.contains('active')).toBe(true);
    expect(mapTab.getAttribute('aria-current')).toBe('page');

    const homeTab = screen.getByText('Forside').closest('button');
    expect(homeTab.classList.contains('active')).toBe(false);
  });

  it('calls setViewMode when tab is clicked', () => {
    const handleSetViewMode = vi.fn();
    render(<BottomNav viewMode="home" setViewMode={handleSetViewMode} />);

    const statsTab = screen.getByText('Statistik').closest('button');
    fireEvent.click(statsTab);

    expect(handleSetViewMode).toHaveBeenCalledWith('stats');
  });
});
