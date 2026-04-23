import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Dashboard from './Dashboard';
import React from 'react';
import { format } from 'date-fns';

// Mock Recharts to avoid SVG rendering issues in JSDOM
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: () => <div />,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  LineChart: () => <div />,
  Line: () => <div />,
  AreaChart: () => <div />,
  Area: () => <div />,
  PieChart: () => <div />,
  Pie: () => <div />,
  Cell: () => <div />,
  Legend: () => <div />,
  RadialBarChart: () => <div />,
  RadialBar: () => <div />
}));

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user' } }
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
  setDoc: vi.fn()
}));

describe('Dashboard Component', () => {
  const mockOrders = [
    { id: '1', buyer: 'BUYER-A', style: 'STYLE-X', poNo: 'PO-001', shipDate: '2024-05-01', color: 'RED', orderQty: 1000 }
  ];

  const mockEntries = [
    { 
      id: 1, 
      date: format(new Date(), 'yyyy-MM-dd'), 
      poNo: 'PO-001', 
      color: 'RED', 
      cut: 1000, 
      sewOut: 800, 
      washR: 700,
      finIn: 600,
      finOut: 600, 
      poly: 500, 
      shipment: 400 
    }
  ];

  const getPOInfo = vi.fn((poNo: string): any => ({ 
    buyer: 'BUYER-A', 
    style: 'STYLE-X',
    poNo: 'PO-001',
    shipDate: '2024-05-01',
    colors: ['RED'],
    totalQty: 1000,
    colorRows: mockOrders
  }));

  it('renders the main dashboard cards', () => {
    const mockAggregates = {
      'PO-001-RED': { cut: 1000, sewOut: 800, finOut: 600, poly: 500, shipment: 400 }
    };
    
    render(<Dashboard orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} poColorAggregates={mockAggregates} />);
    
    expect(screen.getByText(/Command Center/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1,000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/500/).length).toBeGreaterThan(0);
  });

  it('filters by buyer and style', () => {
    render(<Dashboard orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} />);
    
    const styleSearch = screen.getByPlaceholderText(/Search Style/i);
    fireEvent.change(styleSearch, { target: { value: 'STYLE-X' } });

    expect(screen.getByDisplayValue('STYLE-X')).toBeInTheDocument();
  });

  it('toggles config mode and blocks', () => {
    render(<Dashboard orders={mockOrders} entries={mockEntries} getPOInfo={getPOInfo} />);
    
    const toggleButton = screen.getByTitle(/Toggle overview/i);
    fireEvent.click(toggleButton);

    const saveButton = screen.getByText(/Save/i);
    expect(saveButton).toBeInTheDocument();
  });
});
