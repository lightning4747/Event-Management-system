import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <img src="/mcet_logo.jpg" alt="MCET Logo" className="h-9 w-16 object-contain" />
          <div className="block">
            <p className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">
              Department of AI&DS
            </p>
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
  );
};
