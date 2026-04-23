import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DPRReport from './DPRReport';
import React from 'react';

describe('DPRReport Component', () => {
  const mockOrders = [
    { id: 1, buyer: 'BUYER-A', style: 'STYLE-X', poNo: 'PO-001', shipDate: '2024-05-01', color: 'RED', orderQty: 1000 }
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
      shipment: 200, 
      lineNo: 'L-01' 
    }
  ];

  const getPOInfo = vi.fn((poNo) => {
    if (poNo === 'PO-001') {
      return {
        buyer: 'BUYER-A',
        style: 'STYLE-X',
        poNo: 'PO-001',
        shipDate: '2024-05-01',
        colors: ['RED'],
        totalQty: 1000,
        colorRows: [mockOrders[0]]
      };
    }
    return null;
  });

  it('renders correctly with given date entries', () => {
    render(<DPRReport orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} />);
    
    // Changing date to match entry
    const dateInput = screen.getByDisplayValue(/202[0-9]/); // Date default
    fireEvent.change(dateInput, { target: { value: '2024-04-21' } });

    expect(screen.getAllByText(/BUYER-A/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/STYLE-X/i)[0]).toBeInTheDocument();
  });

  it('calculates grand totals accurately', () => {
    render(<DPRReport orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} />);
    
    const dateInput = screen.getByDisplayValue(/202[0-9]/);
    fireEvent.change(dateInput, { target: { value: '2024-04-21' } });

    // Poly achievement for STYLE-X (PO-001 RED): 250 / 1000 = 25%
    expect(screen.getAllByText('25%')[0]).toBeInTheDocument();
  });

  it('filters results by buyer', () => {
    render(<DPRReport orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} />);
    
    // Changing date to match entry
    const dateInput = screen.getByDisplayValue(/202[0-9]/);
    fireEvent.change(dateInput, { target: { value: '2024-04-21' } });

    const buyerSelect = screen.getByRole('combobox');
    fireEvent.change(buyerSelect, { target: { value: 'BUYER-A' } });

    expect(screen.getAllByText(/STYLE-X/i)[0]).toBeInTheDocument();
  });
});
