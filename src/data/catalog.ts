import heroCapacityImg from '../assets/images/hero_capacity_portal_1794335106615.jpg';
import aboutGovernanceImg from '../assets/images/about_governance_hall_1794335107388.jpg';
import { CompetencyStageSpec } from '../types/competency';

export const PORTAL_MEDIA = {
  heroAtrium: heroCapacityImg,
  governanceHall: aboutGovernanceImg,
};

export const COMPETENCY_LIFECYCLE_STAGES: CompetencyStageSpec[] = [
  {
    stepNumber: '01',
    key: 'required_competencies',
    title: 'Required Competencies',
    shortTitle: 'Required Competencies',
    ownerRole: 'Admin',
    summary:
      'Administrators define role-specific competency baselines across functional, technical, and regulatory domains, assigning target proficiency levels (Levels 1–5) for every organisational designation.',
    inputs: [
      'Organisational role taxonomy & designation matrix',
      'Departmental operational standards & compliance mandates',
    ],
    outputs: [
      'Versioned Competency Framework per job role',
      'Target proficiency benchmark for baseline comparison',
    ],
    databaseTable: 'role_requirements',
  },
  {
    stepNumber: '02',
    key: 'skill_assessment',
    title: 'Skill Assessment',
    shortTitle: 'Skill Assessment',
    ownerRole: 'Trainee',
    summary:
      'Trainees complete structured baseline diagnostics and practical task evaluations authored by subject-matter trainers to measure current operational proficiency objectively.',
    inputs: [
      'Role-mapped diagnostic assessment rubric',
      'Practical case verification & supervisory observations',
    ],
    outputs: [
      'Verified competency score per domain',
      'Timestamped baseline proficiency record',
    ],
    databaseTable: 'assessment_attempts',
  },
  {
    stepNumber: '03',
    key: 'skill_gap_analysis',
    title: 'Skill Gap Analysis',
    shortTitle: 'Skill Gap Analysis',
    ownerRole: 'System & Trainer',
    summary:
      'Observed assessment proficiency is compared directly against role-required benchmarks to surface quantifiable deficits, severity priority, and prerequisite dependencies.',
    inputs: [
      'Required role competency baseline (Stage 01)',
      'Measured skill assessment results (Stage 02)',
    ],
    outputs: [
      'Prioritised Skill Gap Profile per trainee',
      'Department-level competency deficit register',
    ],
    databaseTable: 'progress_history',
  },
  {
    stepNumber: '04',
    key: 'training_assignment',
    title: 'Training Assignment',
    shortTitle: 'Training Assignment',
    ownerRole: 'Trainer',
    summary:
      'Targeted training programmes and applied workshops are assigned specifically to close verified skill gaps, eliminating generic blanket enrolment across teams.',
    inputs: [
      'Identified skill gap deficits & priority ranking',
      'Accredited curriculum modules & trainer cohort capacity',
    ],
    outputs: [
      'Targeted Training Assignment plan with completion milestones',
      'Trainer-guided cohort schedule & applied exercises',
    ],
    databaseTable: 'enrollments',
  },
  {
    stepNumber: '05',
    key: 'reassessment',
    title: 'Reassessment',
    shortTitle: 'Reassessment',
    ownerRole: 'Trainer',
    summary:
      'Upon programme completion, trainees undergo structured reassessment to verify whether measured proficiency now meets or exceeds the organisational role benchmark.',
    inputs: [
      'Completed training milestones & practical submissions',
      'Post-training verification rubric',
    ],
    outputs: [
      'Updated proficiency ledger & gap closure status',
      'Verified certificate and readiness history record',
    ],
    databaseTable: 'certificates',
  },
];
