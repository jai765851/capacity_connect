import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { AdminAnnouncementsPage } from './AdminAnnouncementsPage';
import { AdminAssessmentsPage } from './AdminAssessmentsPage';
import { AdminCertificatesPage } from './AdminCertificatesPage';
import { AdminCompetencyManagementPage } from './AdminCompetencyManagementPage';
import { AdminCoursesPage } from './AdminCoursesPage';
import { AdminEnrolmentsPage } from './AdminEnrolmentsPage';
import { AdminJobRolesPage } from './AdminJobRolesPage';
import { AdminOverviewPage } from './AdminOverviewPage';
import { AdminReportsPage } from './AdminReportsPage';
import { AdminSettingsPage } from './AdminSettingsPage';
import { AdminTrainerApprovalPage } from './AdminTrainerApprovalPage';
import { AdminUserManagementPage } from './AdminUserManagementPage';

function getAdminSectionTitle(pathname: string): string {
  if (pathname.endsWith('/users')) return 'User Management';
  if (pathname.endsWith('/trainer-approval')) return 'Trainer Approval';
  if (pathname.endsWith('/competencies')) return 'Competency Management';
  if (pathname.endsWith('/job-roles')) return 'Job Roles';
  if (pathname.endsWith('/courses')) return 'Courses';
  if (pathname.endsWith('/enrolments')) return 'Enrolments';
  if (pathname.endsWith('/assessments')) return 'Assessments';
  if (pathname.endsWith('/certificates')) return 'Certificates';
  if (pathname.endsWith('/reports')) return 'Reports';
  if (pathname.endsWith('/announcements')) return 'Announcements';
  if (pathname.endsWith('/settings')) return 'Settings';
  return 'Dashboard';
}

export function AdminDashboard() {
  const location = useLocation();
  const sectionTitle = getAdminSectionTitle(location.pathname);

  return (
    <DashboardLayout role="admin" sectionTitle={sectionTitle}>
      <Routes>
        <Route index element={<AdminOverviewPage />} />
        <Route path="users" element={<AdminUserManagementPage />} />
        <Route path="trainer-approval" element={<AdminTrainerApprovalPage />} />
        <Route path="competencies" element={<AdminCompetencyManagementPage />} />
        <Route path="job-roles" element={<AdminJobRolesPage />} />
        <Route path="courses" element={<AdminCoursesPage />} />
        <Route path="enrolments" element={<AdminEnrolmentsPage />} />
        <Route path="assessments" element={<AdminAssessmentsPage />} />
        <Route path="certificates" element={<AdminCertificatesPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="announcements" element={<AdminAnnouncementsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard/admin" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
