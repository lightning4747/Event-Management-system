import * as React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, PlusCircle, User, LogOut, Users, FileSpreadsheet } from 'lucide-react';

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
  const links = [
    { label: 'Dashboard', path: '/dashboard', icon: Home },
    { label: 'Students', path: '/students', icon: Users },
  ];
  if (role === 'Event Coordinator') {
    links.push({ label: 'Export Report', path: '/reports', icon: FileSpreadsheet });
  }
  links.push({ label: 'Profile', path: '/profile', icon: User });
  return links;
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



  return (
    <div className="min-h-screen bg-background flex flex-col font-sans pb-16 md:pb-0">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <img src="/mcet_logo.jpg" alt="MCET Logo" className="h-9 w-16 object-contain"/>
            <div className="block">
              <p className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">Department of AI&DS</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <p className="text-xs font-bold text-gray-900">{user?.userId}</p>
              <p className="text-[10px] font-medium text-gray-500">{user?.role}</p>
            </div>
            <div className="w-px h-6 bg-gray-200 hidden sm:block" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 text-red-500 sm:text-gray-500" />
              <span className="text-xs font-semibold">Sign Out</span>
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
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-muted hover:text-gray-900'
                }`}
              >
                <IconComponent className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
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
                  isActive ? 'text-primary' : 'text-muted-foreground'
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
