import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrderStatus from './OrderStatus';
import React from 'react';

describe('OrderStatus Component', () => {
  const mockOrders = [
    { id: 1, buyer: 'BUYER-A', style: 'STYLE-X', poNo: 'PO-001', shipDate: '2024-05-01', color: 'RED', orderQty: 1000 },
    { id: 2, buyer: 'BUYER-B', style: 'STYLE-Y', poNo: 'PO-002', shipDate: '2024-05-10', color: 'BLUE', orderQty: 2000 },
  ];

  const mockAggregates = {
    'PO-001-RED': { cut: 1000, sewOut: 900, washR: 850, finIn: 800, finOut: 750, poly: 700, shipment: 500 }
  };

  const getPOInfo = vi.fn();

  it('renders correctly with summary stats', () => {
    render(<OrderStatus orders={mockOrders} entries={[]} getPOInfo={getPOInfo} poColorAggregates={mockAggregates} />);
    
    // Total Filtered Qty = 1000 + 2000 = 3000
    expect(screen.getByText('3,000')).toBeInTheDocument();
    
    // Total Poly = 700 (Might match multiple? Use getAll)
    expect(screen.getAllByText('700')[0]).toBeInTheDocument();
  });

  it('filters by PO Number', () => {
    render(<OrderStatus orders={mockOrders} entries={[]} getPOInfo={getPOInfo} />);
    
    const searchInput = screen.getByPlaceholderText(/PO-1234/i);
    fireEvent.change(searchInput, { target: { value: 'PO-001' } });

    expect(screen.getAllByText('STYLE-X')[0]).toBeInTheDocument();
    
    // STYLE-Y is in the filter select options, so we check that it's NOT in the style cards list
    const styleCards = screen.queryAllByText('STYLE'); // The label above the style name
    const styleNames = styleCards.map(el => el.nextElementSibling?.textContent);
    expect(styleNames).toContain('STYLE-X');
    expect(styleNames).not.toContain('STYLE-Y');
  });

  it('calculates style wide achievement correctly', () => {
    render(<OrderStatus orders={mockOrders} entries={[]} getPOInfo={getPOInfo} poColorAggregates={mockAggregates} />);
    
    // Style X: order 1000, poly 700 -> 70%
    expect(screen.getAllByText('70%')[0]).toBeInTheDocument();
  });

  it('expands style card to show PO details', async () => {
    render(<OrderStatus orders={mockOrders} entries={[]} getPOInfo={getPOInfo} poColorAggregates={mockAggregates} />);
    
    // Find the style name in the card (not the option)
    const styleLabel = screen.getAllByText('STYLE').find(el => el.nextElementSibling?.textContent === 'STYLE-X');
    const styleCardHeader = styleLabel?.parentElement?.parentElement;
    if (styleCardHeader) fireEvent.click(styleCardHeader);

    expect(await screen.findByText(/PO Wise Details for STYLE-X/i)).toBeInTheDocument();
  });
});
