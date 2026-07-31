import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from './Navbar';
import { Home, PlusCircle, User, Users, FileSpreadsheet, BarChart3 } from 'lucide-react';

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
  if (['Event Coordinator', 'Program Coordinator', 'Head of Department', 'Administrator'].includes(role || '')) {
    links.push({ label: 'Analytics', path: '/analytics', icon: BarChart3 });
  }
  if (['Event Coordinator', 'Head of Department'].includes(role || '')) {
    links.push({ label: 'Export Report', path: '/reports', icon: FileSpreadsheet });
  }
  links.push({ label: 'Profile', path: '/profile', icon: User });
  return links;
};

export const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navLinks = getNavLinks(user?.role);

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans pt-14 pb-16 md:pb-0">
      {/* Standalone Fixed Top Navbar */}
      <Navbar />

      {/* Desktop Sidebar */}
      <div className="hidden md:block fixed left-0 top-14 bottom-0 w-52 border-r border-gray-200 bg-white shadow-sm z-30">
        <nav className="flex flex-col gap-1 p-3 pt-4">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">
            Navigation
          </p>
          {navLinks.map((link) => {
            const IconComponent = link.icon;
            const isActive =
              location.pathname === link.path ||
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
                <IconComponent
                  className={`w-4 h-4 flex-shrink-0 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
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

      {/* Main Content Area */}
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
            const isActive =
              location.pathname === link.path ||
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
