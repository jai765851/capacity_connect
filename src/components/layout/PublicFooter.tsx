import React from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../ui/BrandMark';

export function PublicFooter() {
  return (
    <footer className="bg-[#0B1F3A] text-slate-300 border-t border-[#122E53]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          <div className="md:col-span-5 space-y-4">
            <BrandMark inverted showSublabel />
            <p className="text-sm text-slate-300 leading-relaxed max-w-md">
              Digital Capacity Building and Learning Management Portal built for structured
              organisational competency mapping, baseline skill assessment, gap analysis,
              targeted training assignment, and verified reassessment.
            </p>
            <p className="font-mono text-xs text-teal-300">
              Project Reference: SIH26075
            </p>
          </div>

          <div className="md:col-span-4">
            <h3 className="font-display text-xs font-semibold text-white tracking-wide mb-4">
              Portal Pages
            </h3>
            <ul className="grid grid-cols-2 gap-y-2.5 gap-x-6 text-sm">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/programmes" className="hover:text-white transition-colors">
                  Training Programmes
                </Link>
              </li>
              <li>
                <Link to="/trainers" className="hover:text-white transition-colors">
                  Trainers
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <h3 className="font-display text-xs font-semibold text-white tracking-wide mb-4">
              Access &amp; Governance
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Portal Sign In
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-white transition-colors">
                  Register Organisational Account
                </Link>
              </li>
              <li>
                <Link to="/forgot-password" className="hover:text-white transition-colors">
                  Reset Account Password
                </Link>
              </li>
              <li>
                <Link to="/bootstrap-admin" className="hover:text-white transition-colors">
                  Initial Admin Setup
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400">
          <p>CAPACITY CONNECT · Digital Capacity Building and Learning Management Portal</p>
          <p>PostgreSQL · Supabase Auth &amp; Row-Level Security Architecture</p>
        </div>
      </div>
    </footer>
  );
}
