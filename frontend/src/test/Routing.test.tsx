import { render, screen } from '@testing-library/react';
import { RoleGuard } from '../components/RoleGuard';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { vi, describe, it, expect } from 'vitest';

// Mock context hook returns depending on test configurations
const mockUseAuth = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('Routing Protection Guards', () => {
  it('blocks student user from viewing Admin protected children', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'Student' },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <RoleGuard allowedRoles={['Administrator']}>
        <div data-testid="admin-panel">Admin Dashboard Panel</div>
      </RoleGuard>
    );

    expect(screen.queryByTestId('admin-panel')).not.toBeInTheDocument();
    expect(screen.getByText(/ACCESS DENIED/i)).toBeInTheDocument();
  });

  it('renders children when student user matches allowedRoles', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'Student' },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <RoleGuard allowedRoles={['Student']}>
        <div data-testid="student-panel">Student Dashboard Panel</div>
      </RoleGuard>
    );

    expect(screen.getByTestId('student-panel')).toBeInTheDocument();
    expect(screen.getByText(/Student Dashboard Panel/i)).toBeInTheDocument();
  });

  it('renders loading session screen when auth context is loading', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    render(
      <ProtectedRoute>
        <div>Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText(/LOADING SESSION.../i)).toBeInTheDocument();
  });
});
