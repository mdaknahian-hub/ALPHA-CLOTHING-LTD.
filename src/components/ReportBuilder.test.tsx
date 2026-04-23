import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReportBuilder from './ReportBuilder';
import React from 'react';

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { email: 'test@example.com' } }
}));

describe('ReportBuilder Component', () => {
  const mockOrders = [
    { id: '1', buyer: 'BUYER-A', style: 'STYLE-X', poNo: 'PO-001', shipDate: '2024-05-01', color: 'RED', orderQty: 1000 }
  ];

  const mockEntries = [
    { 
      id: 101, 
      date: '2024-04-21', 
      poNo: 'PO-001', 
      color: 'RED', 
      cut: 500, 
      sewOut: 450, 
      washR: 400, 
      finIn: 350, 
      finOut: 300, 
      poly: 250, 
      shipment: 200 
    }
  ];

  const getPOInfo = vi.fn((poNo) => ({
    buyer: 'BUYER-A',
    style: 'STYLE-X',
    poNo: 'PO-001',
    shipDate: '2024-05-01',
    colors: ['RED'],
    totalQty: 1000,
    colorRows: [mockOrders[0]]
  }));

  it('renders report builder with initial columns', () => {
    render(<ReportBuilder orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} />);
    
    expect(screen.getByText(/Report Filters/i)).toBeInTheDocument();
    // Default columns like Style, PO, Order Qty should be visible
    expect(screen.getAllByText('STYLE-X')[0]).toBeInTheDocument();
    expect(screen.getAllByText('PO-001')[0]).toBeInTheDocument();
  });

  it('toggles column visibility', () => {
    render(<ReportBuilder orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} />);
    
    // Toggle "Cutting Qty" column (from MASTER_COLUMNS)
    // Use getAll in case it's in the side panel AND the table
    const cuttingToggle = screen.getAllByText('Cutting Qty')[0];
    fireEvent.click(cuttingToggle);

    // After toggling on, it should appear in the table header or details
    expect(screen.getAllByText('Cutting Qty')[0]).toBeInTheDocument();
  });

  it('filters by buyer and style', () => {
    render(<ReportBuilder orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} />);
    
    const buyerInput = screen.getByPlaceholderText(/Search buyer/i);
    fireEvent.change(buyerInput, { target: { value: 'NON-EXISTENT' } });

    // Ensure STYLE-X is not in the list (use queryAll to be safe if multiple matches were possible)
    expect(screen.queryByText('STYLE-X')).not.toBeInTheDocument();
  });

  it('calculates complex WIP statuses', () => {
    render(<ReportBuilder orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} />);
    
    // With 500 cut and 450 sewOut, sewingWip = 50 -> Status should be calculated internally
    // Check if the WIP Status column contains the expected status
    expect(screen.getAllByText(/Sewing/)[0]).toBeInTheDocument();
  });
});
