import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AboutSection from './AboutSection';
import React from 'react';

describe('AboutSection Component', () => {
  it('renders the company name correctly', () => {
    render(<AboutSection />);
    expect(screen.getAllByText(/ALPHA CLOTHING LTD./i).length).toBeGreaterThan(0);
  });

  it('displays the correct application version', () => {
    render(<AboutSection />);
    expect(screen.getByText(/v5.5.42/i)).toBeInTheDocument();
  });

  it('renders all main technical architecture items', () => {
    render(<AboutSection />);
    expect(screen.getByText(/React 18 \+ Vite/i)).toBeInTheDocument();
    expect(screen.getByText(/Firebase Firestore \+ Auth/i)).toBeInTheDocument();
    expect(screen.getByText(/Tailwind CSS \+ Glassmorphism/i)).toBeInTheDocument();
  });

  it('renders information about all functional modules', () => {
    render(<AboutSection />);
    expect(screen.getAllByText(/Order Master/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Finishing Tracker/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/DPR Engine/i)[0]).toBeInTheDocument();
  });
});
