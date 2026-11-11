import { UserRole } from '../types/auth';

export interface PublicNavItem {
  label: string;
  path: string;
}

export type SidebarIconName =
  | 'LayoutDashboard'
  | 'User'
  | 'Sparkles'
  | 'Target'
  | 'ClipboardCheck'
  | 'GitCompareArrows'
  | 'BookOpen'
  | 'BookmarkCheck'
  | 'FolderOpen'
  | 'Award'
  | 'MessageSquare'
  | 'Settings'
  | 'Briefcase'
  | 'Users'
  | 'PlusCircle'
  | 'Upload'
  | 'FilePlus2'
  | 'ListChecks'
  | 'TrendingUp'
  | 'UserCheck'
  | 'Layers'
  | 'BarChart3'
  | 'Megaphone'
  | 'ShieldCheck';

export interface SidebarNavItem {
  label: string;
  path: string;
  iconName: SidebarIconName;
}

export const PUBLIC_HEADER_NAV: PublicNavItem[] = [
  { label: 'About', path: '/about' },
  { label: 'How It Works', path: '/how-it-works' },
  { label: 'Programmes', path: '/programmes' },
  { label: 'Trainers', path: '/trainers' },
  { label: 'Contact', path: '/contact' },
];

export const PUBLIC_ALL_ROUTES: PublicNavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'How It Works', path: '/how-it-works' },
  { label: 'Training Programmes', path: '/programmes' },
  { label: 'Trainers', path: '/trainers' },
  { label: 'Contact', path: '/contact' },
  { label: 'Login', path: '/login' },
  { label: 'Register', path: '/register' },
];

export const ROLE_SIDEBAR_NAV: Record<UserRole, SidebarNavItem[]> = {
  trainee: [
    { label: 'Dashboard', path: '/dashboard/trainee', iconName: 'LayoutDashboard' },
    { label: 'Profile', path: '/dashboard/trainee/profile', iconName: 'User' },
    { label: 'My Skills', path: '/dashboard/trainee/skills', iconName: 'Target' },
    { label: 'Skill Assessment', path: '/dashboard/trainee/skill-assessment', iconName: 'ClipboardCheck' },
    { label: 'Skill Gap Report', path: '/dashboard/trainee/skill-gap-report', iconName: 'GitCompareArrows' },
    { label: 'Training Courses', path: '/dashboard/trainee/training-courses', iconName: 'BookOpen' },
    { label: 'Enrolments', path: '/dashboard/trainee/enrolments', iconName: 'BookmarkCheck' },
    { label: 'Learning Resources', path: '/dashboard/trainee/learning-resources', iconName: 'FolderOpen' },
    { label: 'Assessments', path: '/dashboard/trainee/assessments', iconName: 'ListChecks' },
    { label: 'Certificates', path: '/dashboard/trainee/certificates', iconName: 'Award' },
    { label: 'Feedback', path: '/dashboard/trainee/feedback', iconName: 'MessageSquare' },
    { label: 'Settings', path: '/dashboard/trainee/settings', iconName: 'Settings' },
  ],
  trainer: [
    { label: 'Dashboard', path: '/dashboard/trainer', iconName: 'LayoutDashboard' },
    { label: 'Profile', path: '/dashboard/trainer/profile', iconName: 'User' },
    { label: 'Expertise', path: '/dashboard/trainer/expertise', iconName: 'Briefcase' },
    { label: 'My Trainees', path: '/dashboard/trainer/trainees', iconName: 'Users' },
    { label: 'My Courses', path: '/dashboard/trainer/courses', iconName: 'BookOpen' },
    { label: 'Create Course', path: '/dashboard/trainer/create-course', iconName: 'PlusCircle' },
    { label: 'Upload Materials', path: '/dashboard/trainer/upload-materials', iconName: 'Upload' },
    { label: 'Create Assessment', path: '/dashboard/trainer/create-assessment', iconName: 'FilePlus2' },
    { label: 'Questionnaires', path: '/dashboard/trainer/questionnaires', iconName: 'ListChecks' },
    { label: 'Performance', path: '/dashboard/trainer/performance', iconName: 'TrendingUp' },
    { label: 'Trainee Feedback', path: '/dashboard/trainer/feedback', iconName: 'MessageSquare' },
  ],
  admin: [
    { label: 'Dashboard', path: '/dashboard/admin', iconName: 'LayoutDashboard' },
    { label: 'User Management', path: '/dashboard/admin/users', iconName: 'Users' },
    { label: 'Trainer Approval', path: '/dashboard/admin/trainer-approval', iconName: 'UserCheck' },
    { label: 'Competency Management', path: '/dashboard/admin/competencies', iconName: 'Layers' },
    { label: 'Job Roles', path: '/dashboard/admin/job-roles', iconName: 'Briefcase' },
    { label: 'Courses', path: '/dashboard/admin/courses', iconName: 'BookOpen' },
    { label: 'Enrolments', path: '/dashboard/admin/enrolments', iconName: 'BookmarkCheck' },
    { label: 'Assessments', path: '/dashboard/admin/assessments', iconName: 'ClipboardCheck' },
    { label: 'Certificates', path: '/dashboard/admin/certificates', iconName: 'Award' },
    { label: 'Reports', path: '/dashboard/admin/reports', iconName: 'BarChart3' },
    { label: 'Announcements', path: '/dashboard/admin/announcements', iconName: 'Megaphone' },
    { label: 'Settings', path: '/dashboard/admin/settings', iconName: 'Settings' },
  ],
};
