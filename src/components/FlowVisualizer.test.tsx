import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FlowVisualizer from './FlowVisualizer';
import React from 'react';

describe('FlowVisualizer Component', () => {
  const defaultProps = {
    styleName: 'TEST-STYLE',
    totalOrder: 1000,
    totalInput: 800,
    totalOutput: 600,
    colors: []
  };

  it('calculates and displays WIP correctly', () => {
    render(<FlowVisualizer {...defaultProps} />);
    // WIP = totalInput - totalOutput = 800 - 600 = 200
    expect(screen.getAllByText('200').length).toBeGreaterThan(0);
  });

  it('calculates and displays completion rate correctly', () => {
    render(<FlowVisualizer {...defaultProps} />);
    // Completion Rate = (600 / 1000) * 100 = 60%
    expect(screen.getAllByText(/60%/)[0]).toBeInTheDocument();
  });

  it('renders the style name and header', () => {
    render(<FlowVisualizer {...defaultProps} />);
    expect(screen.getByText(/TEST-STYLE Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Style Material Flow/i)).toBeInTheDocument();
  });

  it('displays the correct counts for each stage', () => {
    render(<FlowVisualizer {...defaultProps} />);
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('800')).toBeInTheDocument();
    expect(screen.getByText('600')).toBeInTheDocument();
  });

  it('shows an alert if WIP is elevated', () => {
    // WIP > 100 triggers an alert-rich UI (diagnosis summary logic)
    render(<FlowVisualizer {...defaultProps} totalInput={1000} totalOutput={800} />); // WIP = 200
    expect(screen.getByText(/currently, 200 pieces are in process/i)).toBeInTheDocument();
  });
});
