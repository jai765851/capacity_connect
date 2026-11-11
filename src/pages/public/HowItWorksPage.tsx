import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { CompetencyCycleDiagram } from '../../components/ui/CompetencyCycleDiagram';
import { COMPETENCY_LIFECYCLE_STAGES } from '../../data/catalog';

export function HowItWorksPage() {
  return (
    <div className="bg-white">
      <section className="border-b border-slate-200 py-14 lg:py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-3xl space-y-3">
            <p className="font-mono text-xs font-medium text-[#0F766E]">
              Operational Workflow · Closed-Loop Governance
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0B1F3A] tracking-tight">
              How CAPACITY CONNECT executes competency-driven learning
            </h1>
            <p className="text-base text-slate-600 leading-relaxed">
              Every department follows a standardized five-stage sequence linking required role
              competencies with diagnostic evaluation, gap analysis, targeted training assignment,
              and post-training reassessment.
            </p>
          </div>

          <CompetencyCycleDiagram />
        </div>
      </section>

      {/* Detailed Sequential Breakdown */}
      <section className="py-16 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-2xl space-y-2">
            <h2 className="font-display text-2xl font-bold text-[#0B1F3A]">
              Stage-by-Stage Architecture &amp; Data Flow
            </h2>
            <p className="text-sm text-slate-600">
              Each step maps cleanly to a dedicated relational record in the underlying database
              blueprint.
            </p>
          </div>

          <div className="space-y-4">
            {COMPETENCY_LIFECYCLE_STAGES.map((stage) => (
              <Card key={stage.key} className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-medium text-[#0F766E]">
                        Stage {stage.stepNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Owner: {stage.ownerRole}</span>
                    </div>
                    <h3 className="font-display text-xl font-semibold text-[#0B1F3A]">
                      {stage.title}
                    </h3>
                    <p className="font-mono text-xs text-slate-500 pt-1">
                      Table: {stage.databaseTable}
                    </p>
                  </div>

                  <div className="lg:col-span-4">
                    <p className="text-sm text-slate-600 leading-relaxed">{stage.summary}</p>
                  </div>

                  <div className="lg:col-span-4 space-y-2 text-xs text-slate-700">
                    <p className="font-semibold text-slate-900">Key Outputs</p>
                    <ul className="space-y-1.5 text-slate-600">
                      {stage.outputs.map((out) => (
                        <li key={out}>• {out}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Role Responsibility Matrix */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <h2 className="font-display text-2xl font-bold text-[#0B1F3A]">
                Role Responsibility Matrix
              </h2>
              <p className="text-sm text-slate-600">
                Clear separation of duties ensures objectivity between competency definition,
                training delivery, and evaluation.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F766E] hover:text-[#0B1F3A] whitespace-nowrap shrink-0"
            >
              <span>Inspect Role Dashboards</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                  <th className="px-5 py-3.5">Lifecycle Stage</th>
                  <th className="px-5 py-3.5">Trainee Action</th>
                  <th className="px-5 py-3.5">Trainer Action</th>
                  <th className="px-5 py-3.5">Admin Governance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                <tr>
                  <td className="px-5 py-4 font-semibold text-[#0B1F3A]">01. Required Competencies</td>
                  <td className="px-5 py-4">Reviews target competencies for assigned role</td>
                  <td className="px-5 py-4">Advises on domain proficiency rubrics</td>
                  <td className="px-5 py-4">Publishes role frameworks and target levels</td>
                </tr>
                <tr>
                  <td className="px-5 py-4 font-semibold text-[#0B1F3A]">02. Skill Assessment</td>
                  <td className="px-5 py-4">Completes diagnostic &amp; practical assessments</td>
                  <td className="px-5 py-4">Authors rubrics and scores submissions</td>
                  <td className="px-5 py-4">Monitors assessment window completion</td>
                </tr>
                <tr>
                  <td className="px-5 py-4 font-semibold text-[#0B1F3A]">03. Skill Gap Analysis</td>
                  <td className="px-5 py-4">Inspects personal gap deltas by domain</td>
                  <td className="px-5 py-4">Validates cohort-wide deficit patterns</td>
                  <td className="px-5 py-4">Sets severity thresholds and escalation rules</td>
                </tr>
                <tr>
                  <td className="px-5 py-4 font-semibold text-[#0B1F3A]">04. Training Assignment</td>
                  <td className="px-5 py-4">Completes assigned curriculum modules</td>
                  <td className="px-5 py-4">Delivers cohorts &amp; applied workshops</td>
                  <td className="px-5 py-4">Approves curriculum mapping &amp; capacity</td>
                </tr>
                <tr>
                  <td className="px-5 py-4 font-semibold text-[#0B1F3A]">05. Reassessment</td>
                  <td className="px-5 py-4">Undergoes post-training verification test</td>
                  <td className="px-5 py-4">Certifies competency closure or follow-up</td>
                  <td className="px-5 py-4">Audits organisational readiness records</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
