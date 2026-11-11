import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { ResilientImage } from '../../components/ui/ResilientImage';
import { PORTAL_MEDIA } from '../../data/catalog';

const PRINCIPLES = [
  {
    index: '01.',
    title: 'Role-Anchored Competency Baselines',
    description:
      'Every designation inside an organisation requires measurable operational capabilities. Rather than letting personnel browse arbitrary courses, administrators establish explicit target levels across domain competencies.',
  },
  {
    index: '02.',
    title: 'Diagnostic Assessment Before Enrolment',
    description:
      'Training resources are allocated only after objective skill assessment reveals where existing proficiency sits relative to role requirements.',
  },
  {
    index: '03.',
    title: 'Targeted Remediation & Trainer Oversight',
    description:
      'Identified skill gaps drive specific training assignments led by verified subject-matter trainers using applied case exercises and practical rubrics.',
  },
  {
    index: '04.',
    title: 'Verified Reassessment & Audit Readiness',
    description:
      'Programme completion alone does not close a competency gap. Structured reassessment verifies operational proficiency improvement before updating organisational readiness records.',
  },
];

export function AboutPage() {
  return (
    <div className="bg-white">
      {/* Page Header & Institutional Context */}
      <section className="border-b border-slate-200 py-14 lg:py-18">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
              <p className="font-mono text-xs font-medium text-[#0F766E]">
                About CAPACITY CONNECT · SIH26075
              </p>
              <h1
                className="font-display text-3xl sm:text-4xl font-bold text-[#0B1F3A] tracking-tight leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Built for measurable institutional capacity building, not passive video consumption.
              </h1>
              <p className="text-base text-slate-600 leading-relaxed">
                Public-sector departments and enterprise divisions frequently invest heavily in
                training catalogues without knowing whether personnel actually close operational skill
                deficits. CAPACITY CONNECT bridges the gap between workforce planning and learning
                execution.
              </p>
              <p className="text-base text-slate-600 leading-relaxed">
                By connecting role-specific competency requirements with structured diagnostics,
                automated gap analysis, targeted curriculum assignment, and post-training
                reassessment, every training hour serves a documented organisational requirement.
              </p>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[300px] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                <ResilientImage
                  src={PORTAL_MEDIA.governanceHall}
                  alt="Public-sector executive capacity building workshop seminar room"
                  fallbackTitle="Organisational Training & Governance Workshop"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Structural Comparison */}
      <section className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-2xl space-y-2">
            <p className="font-mono text-xs font-medium text-[#0F766E]">Architectural Distinction</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A]">
              How organisational competency development differs from standard course portals
            </h2>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
              <div className="px-6 py-3.5">Dimension</div>
              <div className="px-6 py-3.5 border-t md:border-t-0 md:border-l border-slate-200">
                Ordinary Course Website
              </div>
              <div className="px-6 py-3.5 border-t md:border-t-0 md:border-l border-slate-200 text-[#0B1F3A]">
                CAPACITY CONNECT Portal
              </div>
            </div>
            <div className="divide-y divide-slate-200 text-sm">
              {[
                [
                  'Starting Point',
                  'Self-selected browsing through generic video playlists',
                  'Role-mapped Required Competencies defined by department administrators',
                ],
                [
                  'Training Allocation',
                  'Uniform enrolment regardless of existing employee expertise',
                  'Evidence-based Training Assignment triggered by measured Skill Gap Analysis',
                ],
                [
                  'Completion Criterion',
                  'Video watch-time percentage or attendance certificate',
                  'Trainer-verified Reassessment proving competency benchmark closure',
                ],
                [
                  'Access Governance',
                  'Single student/instructor split with minimal auditability',
                  'Strict RBAC across Trainee, Trainer, and Admin PostgreSQL policies',
                ],
              ].map(([dimension, standard, portal]) => (
                <div key={dimension} className="grid grid-cols-1 md:grid-cols-3">
                  <div className="px-6 py-4 font-medium text-slate-900">{dimension}</div>
                  <div className="px-6 py-4 text-slate-600 border-t md:border-t-0 md:border-l border-slate-100">
                    {standard}
                  </div>
                  <div className="px-6 py-4 text-slate-900 font-medium border-t md:border-t-0 md:border-l border-slate-100 bg-teal-50/30">
                    {portal}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Governance Principles */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-2">
            <p className="font-mono text-xs font-medium text-[#0F766E]">Design Principles</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A]">
              Core operational pillars
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PRINCIPLES.map((item) => (
              <Card key={item.index} className="p-6 space-y-3">
                <p className="font-mono text-xs font-medium text-[#0F766E]">{item.index}</p>
                <h3 className="font-display text-lg font-semibold text-[#0B1F3A]">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
              </Card>
            ))}
          </div>

          <div className="pt-4">
            <Link
              to="/how-it-works"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B1F3A] hover:text-[#0F766E] transition-colors"
            >
              <span>Examine the 5-Stage Competency Workflow</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
