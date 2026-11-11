import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { COMPETENCY_LIFECYCLE_STAGES } from '../../data/catalog';
import { CompetencyStageKey } from '../../types/competency';

export function CompetencyCycleDiagram() {
  const [activeKey, setActiveKey] = useState<CompetencyStageKey>('required_competencies');

  const activeStage =
    COMPETENCY_LIFECYCLE_STAGES.find((stage) => stage.key === activeKey) ??
    COMPETENCY_LIFECYCLE_STAGES[0];

  return (
    <div className="space-y-6">
      <div
        className="grid grid-cols-1 md:grid-cols-5 gap-3"
        role="tablist"
        aria-label="Organisational Competency Development Stages"
      >
        {COMPETENCY_LIFECYCLE_STAGES.map((stage, index) => {
          const isSelected = stage.key === activeKey;
          return (
            <div key={stage.key} className="flex items-stretch gap-2">
              <button
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveKey(stage.key)}
                className={`w-full text-left rounded-lg border p-4 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] ${
                  isSelected
                    ? 'bg-[#0B1F3A] border-[#0B1F3A] text-white'
                    : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`font-mono text-xs font-medium tabular-nums ${
                      isSelected ? 'text-teal-300' : 'text-[#0F766E]'
                    }`}
                  >
                    Stage {stage.stepNumber}
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {stage.ownerRole}
                  </span>
                </div>
                <p className="font-display text-sm font-semibold leading-snug">
                  {stage.title}
                </p>
              </button>
              {index < COMPETENCY_LIFECYCLE_STAGES.length - 1 && (
                <div
                  className="hidden md:flex items-center justify-center text-slate-400 shrink-0"
                  aria-hidden="true"
                >
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        role="tabpanel"
        className="rounded-lg border border-slate-200 bg-white p-6 md:p-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono text-[#0F766E] font-medium">
                Stage {activeStage.stepNumber}
              </span>
              <span aria-hidden="true">·</span>
              <span>Primary Actor: {activeStage.ownerRole}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{activeStage.databaseTable}</span>
            </div>
            <h3 className="font-display text-2xl font-semibold text-[#0B1F3A]">
              {activeStage.title}
            </h3>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              {activeStage.summary}
            </p>
          </div>

          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 lg:pt-0 lg:border-l lg:border-slate-200 lg:pl-8">
            <div>
              <h4 className="text-xs font-semibold text-slate-900 mb-3">
                Stage Inputs
              </h4>
              <ul className="space-y-2.5 text-sm text-slate-600">
                {activeStage.inputs.map((item) => (
                  <li key={item} className="leading-relaxed border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 mb-3">
                Verified Outputs
              </h4>
              <ul className="space-y-2.5 text-sm text-slate-600">
                {activeStage.outputs.map((item) => (
                  <li key={item} className="leading-relaxed border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
