import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CrisisBanner } from '../components/CrisisBanner';
import { TwinStateBadge, ProvenanceTag } from '../components/TwinStateBadge';
import { LandingPage } from '../pages/LandingPage';

describe('CrisisBanner Component', () => {
  it('renders crisis hotline numbers for safety', () => {
    render(<CrisisBanner />);
    expect(screen.getByText(/988/i)).toBeInTheDocument();
    expect(screen.getByText(/741741/i)).toBeInTheDocument();
    expect(screen.getByText(/findahelpline\.com/i)).toBeInTheDocument();
  });

  it('can be dismissed when user clicks close', () => {
    render(<CrisisBanner />);
    const closeBtn = screen.getByTitle(/dismiss banner/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByText(/988/i)).not.toBeInTheDocument();
  });
});

describe('TwinStateBadge Component', () => {
  it('renders stable baseline badge', () => {
    render(<TwinStateBadge label="STABLE_BASELINE" />);
    expect(screen.getByText(/Stable Baseline/i)).toBeInTheDocument();
  });

  it('renders elevated arousal badge', () => {
    render(<TwinStateBadge label="ELEVATED_AROUSAL" />);
    expect(screen.getByText(/Elevated Arousal/i)).toBeInTheDocument();
  });

  it('renders high vulnerability badge', () => {
    render(<TwinStateBadge label="HIGH_VULNERABILITY" />);
    expect(screen.getByText(/High Vulnerability/i)).toBeInTheDocument();
  });

  it('renders recovery badge', () => {
    render(<TwinStateBadge label="RECOVERY" />);
    expect(screen.getByText(/Recovery Phase/i)).toBeInTheDocument();
  });
});

describe('ProvenanceTag Component', () => {
  it('correctly labels synthetic demo data', () => {
    render(<ProvenanceTag source="synthetic" />);
    expect(screen.getByText(/Synthetic Demo/i)).toBeInTheDocument();
  });

  it('correctly labels user entered data', () => {
    render(<ProvenanceTag source="user_entered" />);
    expect(screen.getByText(/User Entered/i)).toBeInTheDocument();
  });

  it('correctly labels device measurement data', () => {
    render(<ProvenanceTag source="device_measurement" />);
    expect(screen.getByText(/Device Measured/i)).toBeInTheDocument();
  });
});

describe('LandingPage Component', () => {
  it('renders main application heading and buttons', () => {
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Launch My Digital Twin/i)).toBeInTheDocument();
    expect(screen.getByText(/Log In to Existing Twin/i)).toBeInTheDocument();
    expect(screen.getByText(/Explore Simulation Lab/i)).toBeInTheDocument();
  });

  it('renders non-diagnostic investigational healthcare prototype notice', () => {
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );
    expect(screen.getByText(/Investigational Healthcare Prototype Notice/i)).toBeInTheDocument();
    expect(screen.getByText(/not a medical device/i)).toBeInTheDocument();
  });

  it('renders 4-step digital twin workflow', () => {
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );
    expect(screen.getByText(/Collect Observations/i)).toBeInTheDocument();
    expect(screen.getByText(/Establish Personal Baseline/i)).toBeInTheDocument();
    expect(screen.getByText(/Explore Longitudinal Patterns/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulate Scenarios/i)).toBeInTheDocument();
  });
});
