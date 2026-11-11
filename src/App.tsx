/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PublicLayout } from './components/layout/PublicLayout';
import { Card } from './components/ui/Card';
import { AuthProvider } from './context/AuthContext';
import { BootstrapAdminPage } from './pages/auth/BootstrapAdminPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { AdminDashboard } from './pages/dashboard/admin/AdminDashboard';
import { TraineeDashboard } from './pages/dashboard/trainee/TraineeDashboard';
import { TrainerDashboard } from './pages/dashboard/trainer/TrainerDashboard';
import { AboutPage } from './pages/public/AboutPage';
import { ContactPage } from './pages/public/ContactPage';
import { HomePage } from './pages/public/HomePage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { ProgrammesPage } from './pages/public/ProgrammesPage';
import { TrainersPage } from './pages/public/TrainersPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFoundPage() {
  return (
    <div className="py-20 px-4 bg-slate-50 min-h-full flex items-center justify-center">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <p className="font-mono text-xs text-[#0F766E]">404 · Route Not Found</p>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
          Requested page does not exist
        </h1>
        <p className="text-sm text-slate-600">
          The requested path could not be resolved on CAPACITY CONNECT.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center min-h-[42px] px-5 py-2.5 text-sm font-semibold rounded-md bg-[#0B1F3A] text-white hover:bg-[#122E53]"
          >
            Return to Home
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <Routes>
          {/* Public Portal Routes */}
          <Route
            path="/"
            element={
              <PublicLayout>
                <HomePage />
              </PublicLayout>
            }
          />
          <Route
            path="/about"
            element={
              <PublicLayout>
                <AboutPage />
              </PublicLayout>
            }
          />
          <Route
            path="/how-it-works"
            element={
              <PublicLayout>
                <HowItWorksPage />
              </PublicLayout>
            }
          />
          <Route
            path="/programmes"
            element={
              <PublicLayout>
                <ProgrammesPage />
              </PublicLayout>
            }
          />
          <Route
            path="/trainers"
            element={
              <PublicLayout>
                <TrainersPage />
              </PublicLayout>
            }
          />
          <Route
            path="/contact"
            element={
              <PublicLayout>
                <ContactPage />
              </PublicLayout>
            }
          />
          <Route
            path="/login"
            element={
              <PublicLayout>
                <LoginPage />
              </PublicLayout>
            }
          />
          <Route
            path="/register"
            element={
              <PublicLayout>
                <RegisterPage />
              </PublicLayout>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicLayout>
                <ForgotPasswordPage />
              </PublicLayout>
            }
          />
          <Route
            path="/reset-password"
            element={
              <PublicLayout>
                <ResetPasswordPage />
              </PublicLayout>
            }
          />
          <Route
            path="/bootstrap-admin"
            element={
              <PublicLayout>
                <BootstrapAdminPage />
              </PublicLayout>
            }
          />

          {/* Role-Scoped Authenticated Dashboard Routes */}
          <Route
            path="/dashboard/trainee/*"
            element={
              <ProtectedRoute requiredRole="trainee">
                <TraineeDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/trainer/*"
            element={
              <ProtectedRoute requiredRole="trainer">
                <TrainerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/admin/*"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route
            path="*"
            element={
              <PublicLayout>
                <NotFoundPage />
              </PublicLayout>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
