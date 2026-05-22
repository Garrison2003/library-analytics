import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AccessDenied from '../components/AccessDenied';

describe('AccessDenied Component', () => {
  it('renders access denied container', () => {
    render(<AccessDenied />);
    const container = document.querySelector('.access-denied-container');
    expect(container).toBeInTheDocument();
  });

  it('renders access denied card', () => {
    render(<AccessDenied />);
    const card = document.querySelector('.access-denied-card');
    expect(card).toBeInTheDocument();
  });

  it('renders error icon', () => {
    render(<AccessDenied />);
    const icon = document.querySelector('.access-denied-icon');
    expect(icon).toBeInTheDocument();
    const svg = icon?.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders Access Denied heading', () => {
    render(<AccessDenied />);
    const heading = screen.getByRole('heading', { level: 1, name: /Access Denied/i });
    expect(heading).toBeInTheDocument();
  });

  it('renders authorization message', () => {
    render(<AccessDenied />);
    expect(
      screen.getByText(
        /Your account has not been authorized to access this application./
      )
    ).toBeInTheDocument();
  });

  it('renders contact admin message', () => {
    render(<AccessDenied />);
    expect(
      screen.getByText(/Please contact your administrator to request access./)
    ).toBeInTheDocument();
  });

  it('renders return to login button', () => {
    render(<AccessDenied />);
    const link = screen.getByRole('link', { name: /Return to Login/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });

  it('applies correct CSS classes', () => {
    render(<AccessDenied />);
    const card = document.querySelector('.access-denied-card');
    expect(card).toHaveClass('access-denied-card');
    const button = screen.getByRole('link', { name: /Return to Login/i });
    expect(button).toHaveClass('access-denied-button');
  });
});
