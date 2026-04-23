import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrderMaster from './OrderMaster';
import React from 'react';

// Mock Modal components or sub-components if necessary
vi.mock('./HistoricalImportModal', () => ({
  default: () => <div data-testid="historical-modal" />
}));

describe('OrderMaster Component', () => {
  const mockOrders = [
    { id: '1', buyer: 'BUYER-A', style: 'STYLE-X', poNo: 'PO-001', shipDate: '2024-05-01', color: 'RED', orderQty: 1000 },
    { id: '2', buyer: 'BUYER-B', style: 'STYLE-Y', poNo: 'PO-002', shipDate: '2024-05-10', color: 'BLUE', orderQty: 2000 }
  ];

  const addToast = vi.fn();
  const userProfile = { role: 'admin' };

  it('renders the order list correctly', () => {
    render(<OrderMaster orders={mockOrders} addToast={addToast} userProfile={userProfile} />);
    expect(screen.getAllByText('STYLE-X')[0]).toBeInTheDocument();
    expect(screen.getAllByText('STYLE-Y')[0]).toBeInTheDocument();
    expect(screen.getAllByText('PO-001')[0]).toBeInTheDocument();
  });

  it('filters orders based on search input', () => {
    render(<OrderMaster orders={mockOrders} addToast={addToast} userProfile={userProfile} />);
    
    const searchInput = screen.getByPlaceholderText(/Search PO, Buyer or Style/i);
    fireEvent.change(searchInput, { target: { value: 'STYLE-X' } });

    expect(screen.getAllByText('STYLE-X')[0]).toBeInTheDocument();
    expect(screen.queryByText('STYLE-Y')).not.toBeInTheDocument();
  });

  it('opens the "Add Order" modal when clicking the plus button', () => {
    render(<OrderMaster orders={mockOrders} addToast={addToast} userProfile={userProfile} />);
    
    const addButton = screen.getByText(/Add Order/i);
    fireEvent.click(addButton);

    expect(screen.getByText(/Add New Order/i)).toBeInTheDocument();
  });

  it('sorts orders when clicking on table headers', () => {
    render(<OrderMaster orders={mockOrders} addToast={addToast} userProfile={userProfile} />);
    
    const buyerHeader = screen.getByText('Buyer');
    fireEvent.click(buyerHeader);

    const rows = screen.getAllByRole('row');
    // Check sorting logic (Simplified: check if first row is BUYER-A or BUYER-B depending on direction)
    // By default it sorts by PO descending
    expect(rows[1]).toHaveTextContent('BUYER-A'); 
  });
});
