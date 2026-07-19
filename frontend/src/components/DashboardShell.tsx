import * as React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, PlusCircle, User, LogOut, Users } from 'lucide-react';

export interface DashboardShellProps {
  children: React.ReactNode;
}

const getNavLinks = (role: string | undefined) => {
  if (role === 'Student') {
    return [
      { label: 'Dashboard', path: '/dashboard', icon: Home },
      { label: 'New Request', path: '/applications/new', icon: PlusCircle },
      { label: 'Profile', path: '/profile', icon: User },
    ];
  }
  return [
    { label: 'Dashboard', path: '/dashboard', icon: Home },
    { label: 'Students', path: '/students', icon: Users },
    { label: 'Profile', path: '/profile', icon: User },
  ];
};

export const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navLinks = getNavLinks(user?.role);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleBadgeColor = () => {
    switch (user?.role) {
      case 'Student': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Mentor': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Event Coordinator': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Program Coordinator': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Head of Department': return 'bg-red-50 text-red-700 border-red-200';
      case 'Administrator': return 'bg-gray-100 text-gray-700 border-gray-300';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans pb-16 md:pb-0">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center">
            <span className="text-sm font-bold text-gray-900">Dept of AI&DS</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end gap-0.5">
              <p className="text-xs font-bold text-gray-900">{user?.userId}</p>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${roleBadgeColor()}`}>
                {user?.role}
              </span>
            </div>
            <div className="w-px h-6 bg-gray-200 hidden sm:block" />
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <div className="hidden md:block fixed left-0 top-14 bottom-0 w-52 border-r border-gray-200 bg-white shadow-sm z-30">
        <nav className="flex flex-col gap-1 p-3 pt-4">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">
            Navigation
          </p>
          {navLinks.map((link) => {
            const IconComponent = link.icon;
            const isActive = location.pathname === link.path || 
              (link.path !== '/dashboard' && location.pathname.startsWith(link.path));
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <IconComponent className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-100">
          <div className="px-3 py-2">
            <p className="text-[11px] font-semibold text-gray-900 truncate">{user?.userId}</p>
            <p className="text-[10px] text-gray-400 truncate">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-52">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex items-center justify-around h-16">
          {navLinks.map((link) => {
            const IconComponent = link.icon;
            const isActive = location.pathname === link.path ||
              (link.path !== '/dashboard' && location.pathname.startsWith(link.path));
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                  isActive ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <IconComponent className="w-5 h-5" />
                <span className="text-[9px] font-semibold">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
