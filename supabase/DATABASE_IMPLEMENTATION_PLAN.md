# CAPACITY CONNECT — Supabase & PostgreSQL Database Implementation Plan

## 1. Current Structure Inspection Summary
Prior to database integration, CAPACITY CONNECT implemented:
- **Public Portal**: `Home`, `About`, `How It Works`, `Training Programmes`, `Trainers`, `Contact`, `Login`, and `Register`.
- **Role Dashboards**:
  - **Trainee (12 pages)**: `Dashboard`, `Profile`, `My Skills`, `Skill Assessment`, `Skill Gap Report`, `Training Courses`, `Enrolments`, `Learning Resources`, `Assessments`, `Certificates`, `Feedback`, `Settings`.
  - **Trainer (10 pages)**: `Dashboard`, `Profile`, `Expertise`, `My Trainees`, `My Courses`, `Create Course`, `Upload Materials`, `Create Assessment`, `Questionnaires`, `Performance`.
  - **Admin (12 pages)**: `Dashboard`, `User Management`, `Trainer Approval`, `Competency Management`, `Job Roles`, `Courses`, `Enrolments`, `Assessments`, `Certificates`, `Reports`, `Announcements`, `Settings`.
- **Previous State Handling**: Temporary `window.sessionStorage` role preview switching (`AuthContext`) and local React preview state (`PreviewWorkspaceContext`) plus static arrays (`src/data/catalog.ts`).

## 2. Target 17-Table PostgreSQL Schema (No Duplicate Tables)
1. `profiles` — Linked 1:1 to `auth.users(id)`, storing `role` (`trainee` | `trainer` | `admin`), `approval_status` (`pending` | `approved` | `rejected`), `account_status` (`active` | `suspended`), `job_role_id`, `department`, `designation`, and `notification_prefs`.
2. `job_roles` — Organisational designations (`code`, `title`, `department`, `grade_level`).
3. `competencies` — Standard institutional competency definitions (`code`, `title`, `domain`, `description`, `max_level`).
4. `role_requirements` — Maps `job_roles` to `competencies` with `required_score` (0–100), derived `required_level` (1–5), and `priority`.
5. `trainer_expertise` — Subject-matter specializations, optional `competency_id`, and Admin-verified credentials per trainer (`trainer_id`).
6. `courses` — Accredited training courses (`code`, `title`, `domain`, `delivery_mode`, `target_level`, `duration_hours`, `learning_objectives`, `approval_status`, `is_published`).
7. `course_competencies` — Maps `courses` to `competencies` addressed.
8. `trainer_assignments` — Assigns approved trainers to courses/cohorts (`trainer_id`, `course_id`, `cohort_code`).
9. `enrollments` — Maps trainees to assigned courses, optional `mapped_competency_id`, `progress_percent`, and `status`.
10. `assessments` — Diagnostic Baseline, Course Assessment, and Reassessment Verification blueprints with `passing_score_percent` and `due_at` deadlines.
11. `assessment_questions` — Structured questions (`Multiple Choice`, `Scenario Response`, `Practical Checklist`) linked to `assessments`.
12. `assessment_attempts` — Trainee submissions, server-scored MCQ totals, achieved levels, and pass/fail verification.
13. `learning_resources` — Course PDF manuals, presentation decks, and video lectures stored privately in Supabase Storage (`learning-resources` bucket).
14. `progress_history` — Unified chronological ledger storing `recorded_score` (0–100), `recorded_level` (1–5), `target_score`, `assessed_by` trainer reference, diagnostic baselines, and post-training reassessments (migration `005_competency_scoring_engine.sql`).
15. `certificates` — Verified certificates issued via reassessment evaluation, admin registry, or server-verified trainee completion claims (`certificates` private bucket).
16. `feedback` — Structured user feedback linked to `profiles` and optional `courses` (accessible to authoring/assigned Trainers for their courses).
17. `notifications` — Role-targeted announcements, individual notifications, and contact desk alerts.

## 3. Authentication, Approval & Security Architecture
- **Client Auth (`@supabase/supabase-js`)**: Uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Registration & Email Verification**: `supabase.auth.signUp()` includes profile metadata; database trigger `handle_new_user()` creates the `profiles` row automatically.
- **Trainer Approval Gate**: Public registrations selecting `trainer` are created with `role = 'trainer'` and `approval_status = 'pending'`. RLS policies block unapproved trainers from authoring courses, uploading storage files, or evaluating trainees until an Admin approves them.
- **Course Approval Workflow & Privilege Guard**: Trigger `enforce_course_approval_workflow()` ensures non-admin courses start `'pending'` and can only transition to `'approved'` / `'rejected'` via an Admin.
- **Privilege Escalation Prevention**:
  - `handle_new_user()` never grants `'admin'` from public client signup metadata.
  - `prevent_profile_privilege_escalation()` trigger blocks non-admin updates to `role`, `approval_status`, or `account_status`.
- **Secure Server Endpoints (`server.ts`)**: Uses `SUPABASE_SERVICE_ROLE_KEY` exclusively server-side for `/api/admin/bootstrap`, `/api/admin/create-user`, `/api/assessments/submit` (server-side MCQ scoring & deadline check), and `/api/certificates/claim` (completion & assessment verification).
- **Private Enrolment-Scoped Storage**: `learning-resources` and `certificates` buckets have `public = false` and enforce authenticated signed URLs (`createSignedUrl`) guarded by `can_access_course_resource()` and per-trainee RLS policies.
