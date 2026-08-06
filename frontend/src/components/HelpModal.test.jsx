import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import HelpModal from './HelpModal';

afterEach(cleanup);

describe('HelpModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(<HelpModal isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly when isOpen is true', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Opslagsværk & Hjælp ⛺')).toBeTruthy();
    expect(screen.getByText(/Popularitet & Trends/i)).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<HelpModal isOpen={true} onClose={handleClose} />);
    
    const closeBtn = screen.getByText('✖');
    fireEvent.click(closeBtn);
    
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
