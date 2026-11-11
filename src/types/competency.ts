import { ApprovalStatus, AccountStatus, NotificationPreferences, UserRole } from './auth';

export type CompetencyStageKey =
  | 'required_competencies'
  | 'skill_assessment'
  | 'skill_gap_analysis'
  | 'training_assignment'
  | 'reassessment';

export interface CompetencyStageSpec {
  stepNumber: string;
  key: CompetencyStageKey;
  title: string;
  shortTitle: string;
  ownerRole: 'Admin' | 'Trainee' | 'Trainer' | 'System & Trainer';
  summary: string;
  inputs: string[];
  outputs: string[];
  databaseTable: string;
}

export type ProgrammeDomain =
  | 'Public Finance & Audit'
  | 'Digital Infrastructure'
  | 'Cybersecurity & Resilience'
  | 'Procurement & Operations'
  | 'Regulatory & Record Governance'
  | 'Policy & Programme Evaluation';

export const PROGRAMME_DOMAINS: ProgrammeDomain[] = [
  'Public Finance & Audit',
  'Digital Infrastructure',
  'Cybersecurity & Resilience',
  'Procurement & Operations',
  'Regulatory & Record Governance',
  'Policy & Programme Evaluation',
];

export type DeliveryMode = 'Blended' | 'Instructor-Led' | 'Applied Workshop';
export type CourseTargetLevel = 'Foundation' | 'Intermediate' | 'Advanced';

export interface ProfileRecord {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  approval_status: ApprovalStatus;
  account_status: AccountStatus;
  department: string;
  designation: string;
  office_location: string;
  phone_extension: string;
  job_role_id: string | null;
  notification_prefs: NotificationPreferences;
  created_at: string;
  updated_at: string;
  job_role?: { id: string; code: string; title: string } | null;
}

export interface CompetencyRecord {
  id: string;
  code: string;
  title: string;
  domain: string;
  description: string;
  max_level: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobRoleRecord {
  id: string;
  code: string;
  title: string;
  department: string;
  grade_level: string;
  description: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleRequirementRecord {
  id: string;
  job_role_id: string;
  competency_id: string;
  required_level: number;
  required_score: number;
  priority: 'core' | 'supporting';
  created_at: string;
  competency?: CompetencyRecord | null;
  job_role?: JobRoleRecord | null;
}

export interface TrainerExpertiseRecord {
  id: string;
  trainer_id: string;
  competency_id: string | null;
  domain: string;
  specialization: string;
  credential: string;
  years_experience: number;
  verified_by_admin: boolean;
  created_at: string;
  competency?: Pick<CompetencyRecord, 'id' | 'code' | 'title'> | null;
}

export interface PublicTrainerDirectoryItem {
  id: string;
  full_name: string;
  department: string;
  designation: string;
  office_location: string;
  expertise: Array<{
    competency_id?: string | null;
    domain: string;
    specialization: string;
    credential: string;
    years_experience: number;
    verified_by_admin?: boolean;
  }>;
}

export interface CourseCompetencyLink {
  id: string;
  course_id: string;
  competency_id: string;
  target_level_gain: number;
  competency?: CompetencyRecord | null;
}

export type CourseApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface CourseRecord {
  id: string;
  code: string;
  title: string;
  domain: string;
  delivery_mode: DeliveryMode;
  target_level: CourseTargetLevel;
  duration_hours: number;
  summary: string;
  learning_objectives?: string[];
  prerequisites: string;
  assessment_method: string;
  lead_department: string;
  created_by: string | null;
  is_published: boolean;
  approval_status?: CourseApprovalStatus;
  approval_notes?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  creator?: Pick<ProfileRecord, 'id' | 'full_name' | 'department'> | null;
  course_competencies?: CourseCompetencyLink[];
}

export interface TrainerAssignmentRecord {
  id: string;
  trainer_id: string;
  course_id: string;
  cohort_code: string;
  department: string;
  assigned_by: string | null;
  status: 'active' | 'completed' | 'archived';
  assigned_at: string;
  trainer?: Pick<ProfileRecord, 'id' | 'full_name' | 'email' | 'department'> | null;
  course?: Pick<CourseRecord, 'id' | 'code' | 'title' | 'domain'> | null;
}

export interface EnrollmentRecord {
  id: string;
  trainee_id: string;
  course_id: string;
  trainer_assignment_id: string | null;
  mapped_competency_id: string | null;
  assignment_reason: string;
  progress_percent: number;
  status: 'assigned' | 'in_progress' | 'completed' | 'withdrawn';
  assigned_by: string | null;
  enrolled_at: string;
  completed_at: string | null;
  trainee?: Pick<ProfileRecord, 'id' | 'full_name' | 'email' | 'department' | 'designation'> | null;
  course?: Pick<CourseRecord, 'id' | 'code' | 'title' | 'domain' | 'delivery_mode' | 'duration_hours'> | null;
  competency?: Pick<CompetencyRecord, 'id' | 'code' | 'title'> | null;
  trainer_assignment?: {
    id: string;
    cohort_code: string;
    trainer?: Pick<ProfileRecord, 'id' | 'full_name' | 'department'> | null;
  } | null;
}

export type AssessmentType =
  | 'Diagnostic Baseline'
  | 'Course Assessment'
  | 'Reassessment Verification';

export interface AssessmentRecord {
  id: string;
  code: string;
  title: string;
  domain: string;
  assessment_type: AssessmentType;
  course_id: string | null;
  competency_id: string | null;
  duration_minutes: number;
  passing_score_percent: number;
  due_at?: string | null;
  instructions: string;
  created_by: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  course?: Pick<CourseRecord, 'id' | 'code' | 'title'> | null;
  competency?: Pick<CompetencyRecord, 'id' | 'code' | 'title'> | null;
}

export type QuestionType = 'Multiple Choice' | 'Scenario Response' | 'Practical Checklist';

export interface AssessmentQuestionRecord {
  id: string;
  assessment_id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  correct_option: string | null;
  max_marks: number;
  order_index: number;
  created_at: string;
  assessment?: Pick<AssessmentRecord, 'id' | 'code' | 'title'> | null;
}

export interface QuestionSubmissionFeedback {
  questionId: string;
  questionText: string;
  selectedAnswer: string;
  correctOption: string | null;
  isCorrect: boolean | null;
  earnedMarks: number;
  maxMarks: number;
}

export interface AssessmentAttemptRecord {
  id: string;
  assessment_id: string;
  trainee_id: string;
  competency_id: string | null;
  answers: Record<string, string>;
  score_percent: number | null;
  achieved_level: number | null;
  passed: boolean | null;
  evaluated_by: string | null;
  evaluator_notes: string;
  status: 'in_progress' | 'submitted' | 'evaluated';
  started_at: string;
  submitted_at: string | null;
  evaluated_at: string | null;
  assessment?: Pick<
    AssessmentRecord,
    'id' | 'code' | 'title' | 'domain' | 'assessment_type' | 'passing_score_percent' | 'due_at' | 'course_id' | 'competency_id'
  > | null;
  trainee?: Pick<ProfileRecord, 'id' | 'full_name' | 'email' | 'department' | 'designation'> | null;
  competency?: Pick<CompetencyRecord, 'id' | 'code' | 'title'> | null;
}

export type LearningMaterialType =
  | 'Reference Manual'
  | 'Slide Deck'
  | 'Video Lecture'
  | 'Case Exercise'
  | 'Policy Document';

export interface LearningResourceRecord {
  id: string;
  course_id: string;
  title: string;
  material_type: LearningMaterialType;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
  course?: Pick<CourseRecord, 'id' | 'code' | 'title' | 'domain'> | null;
  uploader?: Pick<ProfileRecord, 'id' | 'full_name'> | null;
}

export type ProgressStage =
  | 'self_declaration'
  | 'skill_assessment'
  | 'skill_gap'
  | 'training_progress'
  | 'reassessment';

export interface ProgressHistoryRecord {
  id: string;
  trainee_id: string;
  competency_id: string | null;
  skill_code: string;
  skill_name: string;
  domain: string;
  stage: ProgressStage;
  recorded_level: number;
  recorded_score: number;
  target_level: number | null;
  target_score: number | null;
  assessed_by: string | null;
  notes: string;
  source_attempt_id: string | null;
  recorded_at: string;
  competency?: Pick<CompetencyRecord, 'id' | 'code' | 'title'> | null;
  assessor?: Pick<ProfileRecord, 'id' | 'full_name'> | null;
}

export interface CertificateRecord {
  id: string;
  certificate_code: string;
  trainee_id: string;
  course_id: string;
  assessment_attempt_id: string | null;
  verified_by: string | null;
  status: 'verified' | 'revoked';
  storage_path: string | null;
  issued_at: string;
  trainee?: Pick<ProfileRecord, 'id' | 'full_name' | 'email' | 'department' | 'designation'> | null;
  course?: Pick<CourseRecord, 'id' | 'code' | 'title' | 'domain' | 'duration_hours'> | null;
  verifier?: Pick<ProfileRecord, 'id' | 'full_name'> | null;
}

export interface CourseCertificateEligibility {
  enrollmentId: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  courseDomain: string;
  progressPercent: number;
  enrollmentStatus: EnrollmentRecord['status'];
  courseCompleted: boolean;
  requiredAssessmentsCount: number;
  passedAssessmentsCount: number;
  eligibleForClaim: boolean;
  alreadyIssuedCertificate: CertificateRecord | null;
  blockingReason: string | null;
}

export type FeedbackCategory =
  | 'Course Content'
  | 'Assessment Clarity'
  | 'Trainer Delivery'
  | 'Portal Experience';

export interface FeedbackRecord {
  id: string;
  user_id: string;
  course_id: string | null;
  category: FeedbackCategory;
  subject: string;
  comments: string;
  created_at: string;
  course?: Pick<CourseRecord, 'id' | 'code' | 'title'> | null;
  author?: Pick<ProfileRecord, 'id' | 'full_name' | 'department' | 'designation'> | null;
}

export type NotificationAudience =
  | 'User'
  | 'All Roles'
  | 'Trainees Only'
  | 'Trainers Only'
  | 'Admins Only';

export interface NotificationRecord {
  id: string;
  recipient_id: string | null;
  audience: NotificationAudience;
  priority: 'Standard' | 'Important';
  title: string;
  body: string;
  is_read: boolean;
  created_by: string | null;
  created_at: string;
}

export interface MatchedTrainerProfile {
  trainerId: string;
  fullName: string;
  department: string;
  designation: string;
  matchType: 'Competency Verified' | 'Domain Verified';
  specialization: string;
  credential: string;
  yearsExperience: number;
  activeAssignmentId?: string | null;
  cohortCode?: string | null;
}

export interface MatchedCourseRecommendation {
  id: string;
  code: string;
  title: string;
  domain: string;
  durationHours: number;
  deliveryMode: DeliveryMode;
  matchReason: 'Direct Competency Match' | 'Domain Curriculum Match';
  activeAssignmentId: string | null;
  cohortCode: string | null;
  matchedTrainers: MatchedTrainerProfile[];
}

export interface SkillGapComputedRow {
  competencyId: string;
  competencyCode: string;
  competencyTitle: string;
  domain: string;
  priority: 'core' | 'supporting';
  requiredLevel: number;
  requiredScore: number;
  measuredLevel: number | null;
  currentScore: number | null;
  baselineScore: number | null;
  previousScore: number | null;
  reassessmentScore: number | null;
  measuredSource: 'Reassessment' | 'Evaluated Assessment' | 'Self-Declaration' | 'Unassessed';
  gapDelta: number;
  previousGap: number | null;
  improvementPoints: number | null;
  gapReducedPoints: number | null;
  gapClosurePercent: number | null;
  status: 'Met / Exceeded' | 'Minor Gap' | 'Critical Gap' | 'Assessment Pending';
  lastAssessedAt: string | null;
  assessedByName: string | null;
  recommendedCourses: MatchedCourseRecommendation[];
  matchedTrainers: MatchedTrainerProfile[];
}

export interface CompetencyAnalysisSummary {
  totalRequired: number;
  assessedCount: number;
  metCount: number;
  openGapCount: number;
  averageRequiredScore: number;
  averageCurrentScore: number | null;
  averageGapPoints: number;
  readinessPercent: number;
  reassessedCount: number;
  averageImprovementPoints: number | null;
}

export type InquiryCategory =
  | 'Institutional Onboarding'
  | 'Competency Framework Design'
  | 'Trainer Nomination'
  | 'Technical Integration';
