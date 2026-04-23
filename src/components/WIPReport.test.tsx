import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WIPReport from './WIPReport';
import React from 'react';

// Mock matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('WIPReport Component', () => {
  const mockOrders = [
    { id: 1, buyer: 'BUYER-A', style: 'STYLE-X', poNo: 'PO-001', shipDate: '2024-05-01', color: 'RED', orderQty: 1000 }
  ];

  const mockEntries = [
    { 
      id: 101, 
      date: '2024-04-21', 
      poNo: 'PO-001', 
      color: 'RED', 
      cut: 1000, 
      sewOut: 800, 
      washR: 700, 
      finIn: 600, 
      finOut: 500, 
      poly: 400, 
      shipment: 300, 
      lineNo: 'L-01' 
    }
  ];

  const mockAggregates = {
    'PO-001': { cut: 1000, sewOut: 800, washR: 700, finIn: 600, finOut: 500, poly: 400, shipment: 300 }
  };

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

  it('renders the WIP table with correct calculations', () => {
    render(<WIPReport orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} poAggregates={mockAggregates} />);
    
    expect(screen.getAllByText('BUYER-A')[0]).toBeInTheDocument();
    expect(screen.getAllByText('STYLE-X')[0]).toBeInTheDocument();
    
    // Sewing WIP = Cut (1000) - SewOut (800) = 200
    expect(screen.getAllByText('200').length).toBeGreaterThan(0);
    
    // Input WIP = WashR (700) - FinIn (600) = 100
    expect(screen.getAllByText('100').length).toBeGreaterThan(0);
    
    // Stock = Poly (400) - Shipment (300) = 100
    // Note: Multiple 100s might exist, so check presence
    expect(screen.getAllByText('100').length).toBeGreaterThan(0);
  });

  it('determines risk status based on ship date', () => {
    // Today is set in the component using new Date()
    // To test risk 'high', we'd need to mock the date or pass a PO with a near ship date
    // For now, check if the badge for 'Safe' appears (since 2024-05-01 is past, it's actually "High Risk" contextually relative to now)
    render(<WIPReport orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} poAggregates={mockAggregates} />);
    
    // 2024 is in the past, so daysLeft will be negative, resulting in 'high' risk
    expect(screen.getAllByText(/High Risk/i).length).toBeGreaterThan(0);
  });

  it('filters table by search term', () => {
    render(<WIPReport orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} poAggregates={mockAggregates} />);
    
    const searchInput = screen.getByPlaceholderText(/Search PO/i);
    fireEvent.change(searchInput, { target: { value: 'NON-EXISTENT' } });

    expect(screen.queryByText('STYLE-X')).not.toBeInTheDocument();
  });
});
