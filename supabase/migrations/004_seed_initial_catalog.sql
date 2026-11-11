-- CAPACITY CONNECT (SIH26075)
-- Migration 004: Reference Competency & Course Catalog Seed (Idempotent)
-- Populates initial non-user organisational reference records so the portal catalogue is immediately functional.

insert into public.competencies (code, title, domain, description, max_level)
values
  ('COMP-FIN-01', 'Budget Variance & GFR Compliance', 'Public Finance & Audit', 'Analyze expenditure sanctions and maintain statutory compliance under General Financial Rules.', 5),
  ('COMP-SEC-01', 'Identity & CERT-In Incident Governance', 'Cybersecurity & Resilience', 'Enforce least-privilege access controls and execute timely incident reporting protocols.', 5),
  ('COMP-INF-01', 'Relational Schema & RBAC Architecture', 'Digital Infrastructure', 'Model normalized PostgreSQL schemas and enforce row-level security policies.', 5),
  ('COMP-PRC-01', 'Tender Specification & GeM SLA Control', 'Procurement & Operations', 'Draft unambiguous technical specifications and audit vendor milestone SLAs.', 5),
  ('COMP-REG-01', 'Statutory Notice & Record Retention', 'Regulatory & Record Governance', 'Manage RTI timelines, reasoned order drafting, and digital archival schedules.', 5),
  ('COMP-EVL-01', 'Outcome Indicator & Field Data Auditing', 'Policy & Programme Evaluation', 'Design measurable performance baselines and verify longitudinal impact datasets.', 5)
on conflict (code) do nothing;

insert into public.job_roles (code, title, department, grade_level, description)
values
  ('ROLE-FIN-OFF', 'Departmental Accounts Officer', 'Finance & Audit Directorate', 'Officer Grade II', 'Oversees departmental budget utilization, sanction scrutiny, and audit readiness.'),
  ('ROLE-SYS-ARC', 'Enterprise Systems Officer', 'Enterprise Technology Division', 'Technical Lead', 'Maintains digital public infrastructure APIs, databases, and access governance.'),
  ('ROLE-PRC-OFF', 'Procurement Operations Specialist', 'Operations & Procurement Directorate', 'Executive Grade I', 'Executes compliant digital procurement tenders and vendor contract milestones.')
on conflict (code) do nothing;

insert into public.role_requirements (job_role_id, competency_id, required_level, required_score, priority)
select jr.id, c.id, 4, 80, 'core'
from public.job_roles jr, public.competencies c
where jr.code = 'ROLE-FIN-OFF' and c.code = 'COMP-FIN-01'
on conflict (job_role_id, competency_id) do nothing;

insert into public.role_requirements (job_role_id, competency_id, required_level, required_score, priority)
select jr.id, c.id, 4, 80, 'core'
from public.job_roles jr, public.competencies c
where jr.code = 'ROLE-SYS-ARC' and c.code = 'COMP-INF-01'
on conflict (job_role_id, competency_id) do nothing;

insert into public.role_requirements (job_role_id, competency_id, required_level, required_score, priority)
select jr.id, c.id, 4, 75, 'core'
from public.job_roles jr, public.competencies c
where jr.code = 'ROLE-SYS-ARC' and c.code = 'COMP-SEC-01'
on conflict (job_role_id, competency_id) do nothing;

insert into public.role_requirements (job_role_id, competency_id, required_level, required_score, priority)
select jr.id, c.id, 3, 75, 'core'
from public.job_roles jr, public.competencies c
where jr.code = 'ROLE-PRC-OFF' and c.code = 'COMP-PRC-01'
on conflict (job_role_id, competency_id) do nothing;

insert into public.role_requirements (job_role_id, competency_id, required_level, required_score, priority)
select jr.id, c.id, 3, 70, 'core'
from public.job_roles jr, public.competencies c
where jr.code = 'ROLE-PRC-OFF' and c.code = 'COMP-REG-01'
on conflict (job_role_id, competency_id) do nothing;

insert into public.courses (code, title, domain, delivery_mode, target_level, duration_hours, summary, prerequisites, assessment_method, lead_department, is_published)
values
  ('CC-FIN-201', 'Public Financial Management & GFR Compliance', 'Public Finance & Audit', 'Blended', 'Intermediate', 24, 'Structured operational training on budget formulation, expenditure sanction workflows, General Financial Rules compliance, and audit trail verification.', 'Foundation Departmental Accounting (Level 2)', 'Case-based voucher audit and practical compliance simulation', 'Finance & Audit Directorate', true),
  ('CC-SEC-304', 'Cybersecurity & CERT-In Incident Governance', 'Cybersecurity & Resilience', 'Applied Workshop', 'Advanced', 32, 'Hands-on governance and technical response curriculum covering access control hardening, mandatory incident reporting windows, vulnerability triage, and continuity playbooks.', 'Enterprise Network & Systems Fundamentals (Level 3)', 'Tabletop incident containment exercise and technical audit', 'Digital Security & Infrastructure Wing', true),
  ('CC-INF-210', 'E-Governance Digital Infrastructure Architecture', 'Digital Infrastructure', 'Instructor-Led', 'Intermediate', 28, 'Architectural guidelines for interoperable service APIs, PostgreSQL data modelling, role-based access enforcement, and zero-downtime service delivery.', 'Foundational Systems Administration (Level 2)', 'Architecture review evaluation and schema design test', 'Enterprise Technology Division', true),
  ('CC-PRC-108', 'Procurement Lifecycle & GeM Contract Operations', 'Procurement & Operations', 'Blended', 'Foundation', 18, 'End-to-end vendor specification drafting, tender evaluation transparency, SLA enforcement, and milestone billing verification under institutional procurement rules.', 'None — Entry Competency Track', 'Structured tender evaluation scoring exercise', 'Operations & Procurement Directorate', true),
  ('CC-REG-215', 'Administrative Law, RTI & Digital Record Governance', 'Regulatory & Record Governance', 'Instructor-Led', 'Intermediate', 16, 'Practical framework for statutory notice compliance, citizen disclosure workflows, archival retention schedules, and administrative decision records.', 'Organisational Induction Track (Level 1)', 'Written statutory compliance review and case disposition', 'Legal & Compliance Cell', true),
  ('CC-EVL-312', 'Data-Driven Programme Evaluation & Outcome Auditing', 'Policy & Programme Evaluation', 'Applied Workshop', 'Advanced', 22, 'Quantitative methods for baseline indicator specification, longitudinal outcome measurement, field data validation, and corrective intervention design.', 'Programme Monitoring Essentials (Level 2)', 'Evaluative dataset audit and outcome review presentation', 'Planning & Evaluation Division', true)
on conflict (code) do nothing;

insert into public.course_competencies (course_id, competency_id, target_level_gain)
select cr.id, cp.id, 1
from public.courses cr
join public.competencies cp on (
  (cr.code = 'CC-FIN-201' and cp.code = 'COMP-FIN-01') or
  (cr.code = 'CC-SEC-304' and cp.code = 'COMP-SEC-01') or
  (cr.code = 'CC-INF-210' and cp.code = 'COMP-INF-01') or
  (cr.code = 'CC-PRC-108' and cp.code = 'COMP-PRC-01') or
  (cr.code = 'CC-REG-215' and cp.code = 'COMP-REG-01') or
  (cr.code = 'CC-EVL-312' and cp.code = 'COMP-EVL-01')
)
on conflict (course_id, competency_id) do nothing;
