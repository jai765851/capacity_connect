import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { TraineeAssessmentsPage } from './TraineeAssessmentsPage';
import { TraineeCertificatesPage } from './TraineeCertificatesPage';
import { TraineeEnrolmentsPage } from './TraineeEnrolmentsPage';
import { TraineeFeedbackPage } from './TraineeFeedbackPage';
import { TraineeLearningResourcesPage } from './TraineeLearningResourcesPage';
import { TraineeOverviewPage } from './TraineeOverviewPage';
import { TraineeProfilePage } from './TraineeProfilePage';
import { TraineeSettingsPage } from './TraineeSettingsPage';
import { TraineeSkillAssessmentPage } from './TraineeSkillAssessmentPage';
import { TraineeSkillGapReportPage } from './TraineeSkillGapReportPage';
import { TraineeSkillsPage } from './TraineeSkillsPage';
import { TraineeTrainingCoursesPage } from './TraineeTrainingCoursesPage';

function getTraineeSectionTitle(pathname: string): string {
  if (pathname.endsWith('/profile')) return 'Profile';
  if (pathname.endsWith('/skills')) return 'My Skills';
  if (pathname.endsWith('/skill-assessment')) return 'Skill Assessment';
  if (pathname.endsWith('/skill-gap-report')) return 'Skill Gap Report';
  if (pathname.endsWith('/training-courses')) return 'Training Courses';
  if (pathname.endsWith('/enrolments')) return 'Enrolments';
  if (pathname.endsWith('/learning-resources')) return 'Learning Resources';
  if (pathname.endsWith('/assessments')) return 'Assessments';
  if (pathname.endsWith('/certificates')) return 'Certificates';
  if (pathname.endsWith('/feedback')) return 'Feedback';
  if (pathname.endsWith('/settings')) return 'Settings';
  return 'Dashboard';
}

export function TraineeDashboard() {
  const location = useLocation();
  const sectionTitle = getTraineeSectionTitle(location.pathname);

  return (
    <DashboardLayout role="trainee" sectionTitle={sectionTitle}>
      <Routes>
        <Route index element={<TraineeOverviewPage />} />
        <Route path="profile" element={<TraineeProfilePage />} />
        <Route path="skills" element={<TraineeSkillsPage />} />
        <Route path="skill-assessment" element={<TraineeSkillAssessmentPage />} />
        <Route path="skill-gap-report" element={<TraineeSkillGapReportPage />} />
        <Route path="training-courses" element={<TraineeTrainingCoursesPage />} />
        <Route path="enrolments" element={<TraineeEnrolmentsPage />} />
        <Route path="learning-resources" element={<TraineeLearningResourcesPage />} />
        <Route path="assessments" element={<TraineeAssessmentsPage />} />
        <Route path="certificates" element={<TraineeCertificatesPage />} />
        <Route path="feedback" element={<TraineeFeedbackPage />} />
        <Route path="settings" element={<TraineeSettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard/trainee" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
