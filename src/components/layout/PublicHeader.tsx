import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { PUBLIC_ALL_ROUTES, PUBLIC_HEADER_NAV } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';
import { ROLE_DASHBOARD_PATHS } from '../../types/auth';

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { currentUser } = useAuth();

  const primaryActionPath = currentUser
    ? ROLE_DASHBOARD_PATHS[currentUser.role]
    : '/login';
  const primaryActionLabel = currentUser ? 'Open Dashboard' : 'Sign In';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <Link
          to="/"
          onClick={() => setMobileMenuOpen(false)}
          className="font-display text-lg font-bold tracking-tight text-[#0B1F3A] whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] rounded-sm"
        >
          CAPACITY CONNECT
        </Link>

        {/* Zone 2: 5 concise single-line text links */}
        <nav
          aria-label="Primary Public Navigation"
          className="hidden md:flex items-center gap-7"
        >
          {PUBLIC_HEADER_NAV.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 ${
                  isActive
                    ? 'text-[#0B1F3A] border-[#0F766E]'
                    : 'text-slate-600 border-transparent hover:text-[#0B1F3A] hover:border-slate-300'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action (desktop) + mobile drawer trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to={primaryActionPath}
            className="hidden md:inline-flex items-center justify-center min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0B1F3A] hover:bg-[#122E53] rounded-md whitespace-nowrap shrink-0 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:ring-offset-2"
          >
            {primaryActionLabel}
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <nav
            aria-label="Mobile Navigation"
            className="px-4 py-4 space-y-1"
          >
            {PUBLIC_ALL_ROUTES.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-md text-sm font-medium ${
                    isActive
                      ? 'bg-slate-100 text-[#0B1F3A] font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {currentUser && (
              <Link
                to={ROLE_DASHBOARD_PATHS[currentUser.role]}
                onClick={() => setMobileMenuOpen(false)}
                className="block mt-2 px-3 py-2.5 rounded-md text-sm font-semibold bg-[#0B1F3A] text-white text-center"
              >
                Open Active Dashboard
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
