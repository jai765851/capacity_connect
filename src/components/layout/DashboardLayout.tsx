import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  BarChart3,
  BookOpen,
  BookmarkCheck,
  Briefcase,
  ClipboardCheck,
  FilePlus2,
  FolderOpen,
  GitCompareArrows,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  PlusCircle,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { ROLE_SIDEBAR_NAV, SidebarIconName } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS, UserRole } from '../../types/auth';
import { BrandMark } from '../ui/BrandMark';

const ICON_MAP: Record<
  SidebarIconName,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  LayoutDashboard,
  User,
  Sparkles,
  Target,
  ClipboardCheck,
  GitCompareArrows,
  BookOpen,
  BookmarkCheck,
  FolderOpen,
  Award,
  MessageSquare,
  Settings,
  Briefcase,
  Users,
  PlusCircle,
  Upload,
  FilePlus2,
  ListChecks,
  TrendingUp,
  UserCheck,
  Layers,
  BarChart3,
  Megaphone,
  ShieldCheck,
};

interface DashboardLayoutProps {
  role: UserRole;
  sectionTitle: string;
  children: React.ReactNode;
}

export function DashboardLayout({ role, sectionTitle, children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, signOut } = useAuth();

  const navItems = ROLE_SIDEBAR_NAV[role];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const renderSidebarLinks = () => (
    <nav
      aria-label={`${ROLE_LABELS[role]} Dashboard Navigation`}
      className="px-3 py-3 space-y-0.5"
    >
      {navItems.map((item) => {
        const Icon = ICON_MAP[item.iconName];
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
              isActive
                ? 'bg-[#0B1F3A] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon
              className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-300' : 'text-slate-500'}`}
              strokeWidth={1.75}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Role Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="h-16 px-5 flex items-center border-b border-slate-200 shrink-0">
          <Link to="/" className="focus:outline-none">
            <BrandMark showSublabel />
          </Link>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <p className="text-xs font-semibold text-[#0B1F3A]">
            {ROLE_LABELS[role]} Portal
          </p>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {currentUser?.department || 'Organisational Portal'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">{renderSidebarLinks()}</div>

        <div className="p-3 border-t border-slate-200 space-y-1 shrink-0">
          <Link
            to="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Public Portal</span>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#0B1F3A]/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 shrink-0">
              <BrandMark showSublabel />
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
              <p className="text-xs font-semibold text-[#0B1F3A]">
                {ROLE_LABELS[role]} Portal
              </p>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {currentUser?.department || 'Organisational Portal'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">{renderSidebarLinks()}</div>
            <div className="p-3 border-t border-slate-200 space-y-1 shrink-0">
              <Link
                to="/"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>Public Portal</span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="Open navigation sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="text-slate-500 whitespace-nowrap hidden sm:inline">
                {ROLE_LABELS[role]}
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
              <span className="font-display font-semibold text-slate-900 truncate">
                {sectionTitle}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600">
              <span className="font-medium text-slate-900">
                {currentUser?.fullName ?? 'Authenticated User'}
              </span>
              <span aria-hidden="true">·</span>
              {role === 'trainer' && currentUser?.approvalStatus === 'pending' ? (
                <span className="text-amber-700 font-medium">Approval Pending</span>
              ) : (
                <span className="text-[#0F766E] font-medium">{ROLE_LABELS[role]}</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center justify-center min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
