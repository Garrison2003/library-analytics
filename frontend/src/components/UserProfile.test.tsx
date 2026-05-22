import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserProfile from '../components/UserProfile';
import { useAuth0 } from '@auth0/auth0-react';

vi.mock('@auth0/auth0-react');

describe('UserProfile Component', () => {
  const mockLogout = vi.fn();
  const mockUser = {
    name: 'Morris Smith',
    email: 'morristuwasmith@gmail.com',
    picture: 'https://example.com/avatar.jpg',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth0 as any).mockReturnValue({
      logout: mockLogout,
      isAuthenticated: true,
      user: mockUser,
    });
  });

  it('returns null when user is not provided', () => {
    (useAuth0 as any).mockReturnValue({
      logout: mockLogout,
      isAuthenticated: true,
      user: null,
    });

    const { container } = render(<UserProfile user={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders user profile with name and email', () => {
    render(<UserProfile user={mockUser} />);
    expect(screen.getByText('Morris Smith')).toBeInTheDocument();
    expect(screen.getByText('morristuwasmith@gmail.com')).toBeInTheDocument();
  });

  it('renders user profile picture when available', () => {
    render(<UserProfile user={mockUser} />);
    const img = screen.getByAltText('Morris Smith') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe('https://example.com/avatar.jpg');
  });

  it('does not render profile picture when not available', () => {
    const userWithoutPicture = { ...mockUser, picture: undefined };
    render(<UserProfile user={userWithoutPicture} />);
    const img = screen.queryByAltText('Morris Smith');
    expect(img).not.toBeInTheDocument();
  });

  it('renders logout button', () => {
    render(<UserProfile user={mockUser} />);
    const button = screen.getByRole('button', { name: /Logout/i });
    expect(button).toBeInTheDocument();
  });

  it('calls logout with correct parameters when button is clicked', async () => {
    const user = userEvent.setup();
    render(<UserProfile user={mockUser} />);
    const button = screen.getByRole('button', { name: /Logout/i });

    await user.click(button);
    expect(mockLogout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    });
  });
});
