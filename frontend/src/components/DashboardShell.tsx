import * as React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, User, PlusCircle, BarChart2, LogOut } from 'lucide-react';

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
      { label: 'Dashboard', path: '/dashboard', icon: Home },
      { label: 'Profile', path: '/profile', icon: User },
    ];

    if (user.role === 'Student') {
      return [
        { label: 'Dashboard', path: '/dashboard', icon: Home },
        { label: 'New Request', path: '/applications/new', icon: PlusCircle },
        { label: 'Profile', path: '/profile', icon: User },
      ];
    }

    if (user.role === 'Mentor' || user.role === 'Event Coordinator' || user.role === 'Program Coordinator' || user.role === 'Head of Department') {
      return [
        { label: 'Dashboard', path: '/dashboard', icon: Home },
        { label: 'Reports', path: '/reports', icon: BarChart2 },
        { label: 'Profile', path: '/profile', icon: User },
      ];
    }

    return base;
  };

  const navLinks = getNavLinks();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans pb-16 md:pb-0">
      {/* Top Header Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 bg-black text-white rounded flex items-center justify-center font-bold text-xs">
                MCET
              </div>
              <span className="font-bold text-xs sm:text-sm tracking-tight text-gray-900">
                AI&DS On-Duty Portal
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-semibold text-gray-900 leading-tight">{user?.userId}</p>
              <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider">
                {user?.role}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm">
          {children}
        </div>
      </main>

      {/* Sticky Bottom Navigation Bar (for Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 h-16 flex items-center justify-around shadow-lg">
        {navLinks.map((link) => {
          const IconComponent = link.icon;
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex flex-col items-center justify-center gap-1 w-20 h-full transition-colors ${
                isActive ? 'text-black' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <IconComponent className="w-5 h-5" />
              <span className="text-[9px] font-medium">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop Sidebar Navigation wrapper (for tablet/desktop sizes) */}
      <div className="hidden md:block fixed left-0 top-14 bottom-0 w-48 border-r border-gray-200 bg-white p-4">
        <nav className="flex flex-col gap-1">
          {navLinks.map((link) => {
            const IconComponent = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <IconComponent className="w-4 h-4 text-gray-400" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Adjust Main content margin on desktop to handle sidebar */}
      <style>{`
        @media (min-width: 768px) {
          main {
            margin-left: 12rem;
          }
        }
      `}</style>
    </div>
  );
};
