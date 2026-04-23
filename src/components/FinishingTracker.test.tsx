import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FinishingTracker from './FinishingTracker';
import React from 'react';

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user' } }
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()), // Return an unsubscribe function
  query: vi.fn(),
  where: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  orderBy: vi.fn()
}));

// Mock FlowVisualizer to simplify test
vi.mock('./FlowVisualizer', () => ({
  default: () => <div data-testid="flow-visualizer" />
}));

describe('FinishingTracker Component', () => {
  const mockOrders = [
    { id: '1', style: 'STYLE-A', color: 'RED', orderQty: 500, poNo: 'PO-1', shipDate: '2024-05-01', buyer: 'BUYER-A' },
    { id: '2', style: 'STYLE-A', color: 'BLUE', orderQty: 300, poNo: 'PO-1', shipDate: '2024-05-01', buyer: 'BUYER-A' }
  ];

  it('renders the dashboard with style progress cards', () => {
    // Initial render in dashboard mode
    render(<FinishingTracker orders={mockOrders} />);
    
    expect(screen.getByText(/Finishing Station/i)).toBeInTheDocument();
    expect(screen.getByText('STYLE-A')).toBeInTheDocument();
  });

  it('searches for a style in the dashboard', () => {
    render(<FinishingTracker orders={mockOrders} />);
    
    const searchInput = screen.getByPlaceholderText(/Search Style Code/i);
    fireEvent.change(searchInput, { target: { value: 'NON-EXISTENT' } });

    expect(screen.queryByText('STYLE-A')).not.toBeInTheDocument();
  });

  it('navigates to style detail view', async () => {
    render(<FinishingTracker orders={mockOrders} />);
    
    // StyleCard contains the text "STYLE-X". We need to click the Eye button.
    const eyeButton = screen.getByRole('button', { name: '' }); // Or find by closest to STYLE-A
    // Direct selection by clicking the card's action button
    const card = screen.getByText('STYLE-A').closest('div')?.parentElement;
    const actionButton = card?.querySelector('button');
    if (actionButton) fireEvent.click(actionButton);

    expect(await screen.findByText(/Back to Dashboard/i)).toBeInTheDocument();
    expect(await screen.findByText(/Production Entry/i)).toBeInTheDocument();
  });

  it('switches to ledger mode correctly', async () => {
    render(<FinishingTracker orders={mockOrders} />);
    
    // Select style first
    const card = screen.getByText('STYLE-A').closest('div')?.parentElement;
    const actionButton = card?.querySelector('button');
    if (actionButton) fireEvent.click(actionButton);

    // Ledger title is available in Style Detail view
    expect(await screen.findByText(/Production Ledger/i)).toBeInTheDocument();
    const lineElements = await screen.findAllByText(/Line/i);
    expect(lineElements.length).toBeGreaterThan(0);
  });
});
