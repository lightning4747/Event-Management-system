import * as React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';

export interface DashboardShellProps {
  children: React.ReactNode;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavLinks = () => {
    if (!user) return [];

    const base = [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Profile', path: '/profile' },
    ];

    if (user.role === 'Student') {
      return [
        ...base,
        { label: 'New Request', path: '/applications/new' },
      ];
    }

    if (user.role === 'Mentor' || user.role === 'Event Coordinator' || user.role === 'Program Coordinator' || user.role === 'Head of Department') {
      return [
        ...base,
        { label: 'Reports', path: '/reports' },
      ];
    }

    return base;
  };

  const navLinks = getNavLinks();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Top Header Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 bg-black text-white rounded flex items-center justify-center font-bold text-xs">
                MCET
              </div>
              <span className="font-bold text-sm tracking-tight text-gray-900 hidden sm:inline">
                AI&DS On-Duty Portal
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-xs font-semibold text-gray-900">{user?.userId}</p>
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                {user?.role}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-xs h-8"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 text-center">
        <p className="text-[10px] text-gray-400 font-medium">
          &copy; {new Date().getFullYear()} MCET Department of Artificial Intelligence & Data Science. All rights reserved.
        </p>
      </footer>
    </div>
  );
};
