import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TrainerApprovalGate } from '../../../components/auth/TrainerApprovalGate';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { TrainerCoursesPage } from './TrainerCoursesPage';
import { TrainerCreateAssessmentPage } from './TrainerCreateAssessmentPage';
import { TrainerCreateCoursePage } from './TrainerCreateCoursePage';
import { TrainerExpertisePage } from './TrainerExpertisePage';
import { TrainerFeedbackPage } from './TrainerFeedbackPage';
import { TrainerOverviewPage } from './TrainerOverviewPage';
import { TrainerPerformancePage } from './TrainerPerformancePage';
import { TrainerProfilePage } from './TrainerProfilePage';
import { TrainerQuestionnairesPage } from './TrainerQuestionnairesPage';
import { TrainerTraineesPage } from './TrainerTraineesPage';
import { TrainerUploadMaterialsPage } from './TrainerUploadMaterialsPage';

function getTrainerSectionTitle(pathname: string): string {
  if (pathname.endsWith('/profile')) return 'Profile';
  if (pathname.endsWith('/expertise')) return 'Expertise';
  if (pathname.endsWith('/trainees')) return 'My Trainees';
  if (pathname.endsWith('/courses')) return 'My Courses';
  if (pathname.endsWith('/create-course')) return 'Create Course';
  if (pathname.endsWith('/upload-materials')) return 'Upload Materials';
  if (pathname.endsWith('/create-assessment')) return 'Create Assessment';
  if (pathname.endsWith('/questionnaires')) return 'Questionnaires';
  if (pathname.endsWith('/performance')) return 'Performance';
  if (pathname.endsWith('/feedback')) return 'Trainee Feedback';
  return 'Dashboard';
}

export function TrainerDashboard() {
  const location = useLocation();
  const sectionTitle = getTrainerSectionTitle(location.pathname);

  return (
    <DashboardLayout role="trainer" sectionTitle={sectionTitle}>
      <Routes>
        <Route index element={<TrainerOverviewPage />} />
        <Route path="profile" element={<TrainerProfilePage />} />
        <Route path="expertise" element={<TrainerExpertisePage />} />
        <Route
          path="trainees"
          element={
            <TrainerApprovalGate>
              <TrainerTraineesPage />
            </TrainerApprovalGate>
          }
        />
        <Route
          path="courses"
          element={
            <TrainerApprovalGate>
              <TrainerCoursesPage />
            </TrainerApprovalGate>
          }
        />
        <Route
          path="create-course"
          element={
            <TrainerApprovalGate>
              <TrainerCreateCoursePage />
            </TrainerApprovalGate>
          }
        />
        <Route
          path="upload-materials"
          element={
            <TrainerApprovalGate>
              <TrainerUploadMaterialsPage />
            </TrainerApprovalGate>
          }
        />
        <Route
          path="create-assessment"
          element={
            <TrainerApprovalGate>
              <TrainerCreateAssessmentPage />
            </TrainerApprovalGate>
          }
        />
        <Route
          path="questionnaires"
          element={
            <TrainerApprovalGate>
              <TrainerQuestionnairesPage />
            </TrainerApprovalGate>
          }
        />
        <Route
          path="performance"
          element={
            <TrainerApprovalGate>
              <TrainerPerformancePage />
            </TrainerApprovalGate>
          }
        />
        <Route
          path="feedback"
          element={
            <TrainerApprovalGate>
              <TrainerFeedbackPage />
            </TrainerApprovalGate>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard/trainer" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
