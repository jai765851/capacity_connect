export interface PostgresTableBlueprint {
  tableName: string;
  stageOwner: string;
  purpose: string;
  keyColumns: string[];
  rlsPolicySummary: string;
}

export interface ApiEndpointContract {
  method: 'GET' | 'POST';
  path: string;
  allowedRoles: ('Public' | 'Trainee' | 'Trainer' | 'Admin')[];
  responsibility: string;
}

export const POSTGRES_TABLES_BLUEPRINT: PostgresTableBlueprint[] = [
  {
    tableName: 'profiles',
    stageOwner: 'Auth & RBAC Core',
    purpose: 'User accounts, department, designation, trainer approval_status, and role.',
    keyColumns: ['id (auth.users FK)', 'email', 'role', 'approval_status', 'account_status', 'job_role_id'],
    rlsPolicySummary: 'Own read/update guarded by escalation trigger; Admin full read/update.',
  },
  {
    tableName: 'competencies',
    stageOwner: '01. Required Competencies',
    purpose: 'Master competency taxonomy across governance, finance, security, and infrastructure.',
    keyColumns: ['id', 'code', 'title', 'domain', 'max_level'],
    rlsPolicySummary: 'Public/authenticated select; Admin insert/update/delete.',
  },
  {
    tableName: 'job_roles',
    stageOwner: '01. Required Competencies',
    purpose: 'Organisational designations mapped to required competency frameworks.',
    keyColumns: ['id', 'code', 'title', 'department', 'grade_level'],
    rlsPolicySummary: 'Authenticated select; Admin manage.',
  },
  {
    tableName: 'role_requirements',
    stageOwner: '01. Required Competencies',
    purpose: 'Required competency threshold (0–100 benchmark & L1–L5) for each job_role and competency pair.',
    keyColumns: ['id', 'job_role_id', 'competency_id', 'required_score', 'required_level', 'priority'],
    rlsPolicySummary: 'Authenticated select; Admin manage.',
  },
  {
    tableName: 'trainer_expertise',
    stageOwner: 'Faculty Accreditation',
    purpose: 'Domain & competency credentials submitted by Trainers and verified by Admin.',
    keyColumns: ['id', 'trainer_id', 'competency_id', 'domain', 'credential', 'verified_by_admin'],
    rlsPolicySummary: 'Verified select by authenticated; Own insert/delete; Admin verify/manage.',
  },
  {
    tableName: 'courses',
    stageOwner: '04. Training Assignment',
    purpose: 'Accredited curriculum modules with structured learning objectives, Admin approval workflow, and competency links.',
    keyColumns: ['id', 'code', 'title', 'learning_objectives', 'approval_status', 'is_published'],
    rlsPolicySummary: 'Published & approved select by anon/authenticated; Approved Trainer/Admin manage with approval trigger.',
  },
  {
    tableName: 'course_competencies',
    stageOwner: '04. Training Assignment',
    purpose: 'Relational join linking courses to target competencies.',
    keyColumns: ['id', 'course_id', 'competency_id', 'target_level_gain'],
    rlsPolicySummary: 'Select all; Approved Trainer/Admin manage.',
  },
  {
    tableName: 'trainer_assignments',
    stageOwner: '04. Training Assignment',
    purpose: 'Assigns approved trainers to deliver specific courses and cohorts.',
    keyColumns: ['id', 'trainer_id', 'course_id', 'cohort_code', 'status'],
    rlsPolicySummary: 'Trainer reads own assignments; Admin manage.',
  },
  {
    tableName: 'enrollments',
    stageOwner: '04. Training Assignment',
    purpose: 'Tracks trainee course enrolment, targeted gap mapping, and completion progress.',
    keyColumns: ['id', 'trainee_id', 'course_id', 'mapped_competency_id', 'progress_percent', 'status'],
    rlsPolicySummary: 'Strict Trainee own isolation; Assigned/Course-Author Trainer & Admin manage.',
  },
  {
    tableName: 'assessments',
    stageOwner: '02 & 05. Assessment',
    purpose: 'Diagnostic baseline, course assessments, and post-training reassessment tests with deadlines and passing thresholds.',
    keyColumns: ['id', 'code', 'assessment_type', 'course_id', 'competency_id', 'passing_score_percent', 'due_at'],
    rlsPolicySummary: 'Enrolment-scoped published select for course exams; Approved Trainer/Admin create & manage.',
  },
  {
    tableName: 'assessment_questions',
    stageOwner: '02 & 05. Assessment',
    purpose: 'Multiple choice, scenario, and practical rubric items per assessment.',
    keyColumns: ['id', 'assessment_id', 'question_type', 'max_marks', 'order_index'],
    rlsPolicySummary: 'Scoped to published/authorised assessment; Owning Trainer/Admin manage.',
  },
  {
    tableName: 'assessment_attempts',
    stageOwner: '02 & 05. Assessment',
    purpose: 'Trainee submissions, computed scores, achieved proficiency levels, and trainer feedback.',
    keyColumns: ['id', 'assessment_id', 'trainee_id', 'score_percent', 'achieved_level', 'status'],
    rlsPolicySummary: 'Strict Trainee own read; Server-verified MCQ submission; Approved Trainer/Admin evaluate.',
  },
  {
    tableName: 'learning_resources',
    stageOwner: '04. Training Assignment',
    purpose: 'Course PDFs, presentations, and videos stored privately in Supabase Storage.',
    keyColumns: ['id', 'course_id', 'material_type', 'storage_bucket', 'storage_path', 'file_name'],
    rlsPolicySummary: 'Enrolment-scoped Storage & metadata select; Approved Trainer upload/delete own course files; Admin all.',
  },
  {
    tableName: 'progress_history',
    stageOwner: '03 & 05. Gap & Reassessment',
    purpose: 'Chronological ledger of self-declarations, baseline assessments, and post-training reassessments (0–100).',
    keyColumns: ['id', 'trainee_id', 'competency_id', 'stage', 'recorded_score', 'assessed_by', 'recorded_at'],
    rlsPolicySummary: 'Strict Trainee own read; Approved Trainer & Admin record/read.',
  },
  {
    tableName: 'certificates',
    stageOwner: '05. Reassessment',
    purpose: 'Verified completion certificates with verification codes and optional signed PDFs.',
    keyColumns: ['id', 'certificate_code', 'trainee_id', 'course_id', 'status', 'storage_path'],
    rlsPolicySummary: 'Trainee read own & claim eligible completion certificates; Approved Trainer/Admin issue & revoke.',
  },
  {
    tableName: 'feedback',
    stageOwner: 'Quality Governance',
    purpose: 'Structured feedback submitted by trainees on courses, rubrics, and delivery.',
    keyColumns: ['id', 'user_id', 'course_id', 'category', 'subject'],
    rlsPolicySummary: 'Own insert/read/delete; Course Trainer reads assigned/authored course feedback; Admin read all.',
  },
  {
    tableName: 'notifications',
    stageOwner: 'Communications & Audit',
    purpose: 'Role-scoped announcements, targeted notices, and public contact inquiries.',
    keyColumns: ['id', 'recipient_id', 'audience', 'priority', 'is_read'],
    rlsPolicySummary: 'Role/recipient scoped select; Admin manage; Recipient mark read.',
  },
];

export const API_ENDPOINTS_CONTRACT: ApiEndpointContract[] = [
  {
    method: 'GET',
    path: '/api/health',
    allowedRoles: ['Public'],
    responsibility: 'Reports boolean configuration readiness for Supabase Auth, Service Role, and Schema migrations.',
  },
  {
    method: 'POST',
    path: '/api/admin/bootstrap',
    allowedRoles: ['Public'],
    responsibility: 'One-time first-Admin creation guarded by ADMIN_BOOTSTRAP_SECRET and zero-admin DB check.',
  },
  {
    method: 'POST',
    path: '/api/admin/create-user',
    allowedRoles: ['Admin'],
    responsibility: 'Provisions verified Trainee, Trainer, or Admin accounts using server-side Supabase Admin SDK.',
  },
  {
    method: 'POST',
    path: '/api/assessments/submit',
    allowedRoles: ['Trainee'],
    responsibility: 'Enforces assessment deadlines and enrolment checks, grades MCQ items server-side, and updates progress_history.',
  },
  {
    method: 'POST',
    path: '/api/certificates/claim',
    allowedRoles: ['Trainee'],
    responsibility: 'Verifies 100% course completion and passing assessment status before issuing a verified completion certificate.',
  },
  {
    method: 'POST',
    path: '/api/contact',
    allowedRoles: ['Public'],
    responsibility: 'Persists institutional inquiries into notifications for administrative review.',
  },
];
