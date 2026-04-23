import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DataEntry from './DataEntry';
import React from 'react';
import { format } from 'date-fns';

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
  addAuditLog: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn()
}));

describe('DataEntry Component', () => {
  const mockOrders = [
    { id: '1', buyer: 'BUYER-A', style: 'STYLE-X', poNo: 'PO-001', shipDate: '2024-05-01', color: 'RED', orderQty: 1000 }
  ];

  const mockEntries = [];
  const addToast = vi.fn();
  const getPOInfo = vi.fn(() => ({
    buyer: 'BUYER-A',
    style: 'STYLE-X',
    poNo: 'PO-001',
    shipDate: '2024-05-01',
    colors: ['RED'],
    totalQty: 1000,
    colorRows: [mockOrders[0]]
  }));
  const userProfile = { role: 'admin' };
  
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the entry form', () => {
    render(<DataEntry orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} addToast={addToast} userProfile={userProfile} />);
    expect(screen.getByText(/Daily Production Entry/i)).toBeInTheDocument();
  });

  it('validates mandatory fields for Poly entry', () => {
    render(<DataEntry orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} addToast={addToast} userProfile={userProfile} />);
    
    // Set Poly > 0 without floor
    fireEvent.change(screen.getByLabelText(/PO \*/i), { target: { value: 'PO-001' } });
    fireEvent.change(screen.getByLabelText(/Color \*/i), { target: { value: 'RED' } });
    
    const polyInput = screen.getByLabelText(/Poly Entry/i);
    fireEvent.change(polyInput, { target: { value: '100' } });

    const submitButton = screen.getByText(/Save/i);
    fireEvent.click(submitButton);

    expect(addToast).toHaveBeenCalledWith('Floor is mandatory for Poly Entry', 'er');
  });

  it('validates mandatory fields for Finishing entries', () => {
    render(<DataEntry orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} addToast={addToast} userProfile={userProfile} />);
    
    fireEvent.change(screen.getByLabelText(/PO \*/i), { target: { value: 'PO-001' } });
    fireEvent.change(screen.getByLabelText(/Color \*/i), { target: { value: 'RED' } });
    
    // Set preceding production steps to avoid violations
    fireEvent.change(screen.getByLabelText(/Cutting Qty/i), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText(/Sewing Output/i), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText(/Wash Received/i), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText(/Finishing Input/i), { target: { value: '100' } });

    const submitButton = screen.getByText(/Save/i);
    fireEvent.click(submitButton);

    expect(addToast).toHaveBeenCalledWith('Line No is mandatory for Finishing Input/Output', 'er');
  });

  it('filters entries table correctly', () => {
    const entriesWithOne = [{ 
      id: 1, 
      date: format(new Date(), 'yyyy-MM-dd'), 
      poNo: 'PO-001', 
      color: 'RED', 
      cut: 100,
      sewOut: 0,
      washR: 0,
      finIn: 0,
      finOut: 0,
      poly: 0,
      shipment: 0
    }];
    render(<DataEntry orders={mockOrders} entries={entriesWithOne} getPOInfo={getPOInfo} addToast={addToast} userProfile={userProfile} />);
    
    expect(screen.getAllByText('PO-001').length).toBeGreaterThan(0);
    
    const searchInput = screen.getByPlaceholderText(/Color\.\.\./i);
    fireEvent.change(searchInput, { target: { value: 'NON-EXISTENT' } });

    // PO-001 might still be in the dropdown options, so check for the table row/cell specifically
    expect(screen.queryByRole('cell', { name: 'PO-001' })).not.toBeInTheDocument();
  });
});
