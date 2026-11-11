import React from 'react';
import { TrendingUp } from 'lucide-react';
import { formatShortDate } from '../../lib/formatters';
import { SkillGapComputedRow } from '../../types/competency';
import { Card } from '../ui/Card';
import { CompetencyProgressBar } from './CompetencyProgressBar';

interface CompetencyImprovementSectionProps {
  rows: SkillGapComputedRow[];
  title?: string;
  subtitle?: string;
}

export function CompetencyImprovementSection({
  rows,
  title = 'Competency Reassessment & Improvement Report',
  subtitle = 'Chronological pre-training baseline vs. post-training reassessment comparison.',
}: CompetencyImprovementSectionProps) {
  const comparedRows = rows.filter(
    (r) => r.previousScore !== null && r.currentScore !== null && r.improvementPoints !== null
  );

  const avgGain =
    comparedRows.length > 0
      ? Math.round(
          comparedRows.reduce((sum, r) => sum + (r.improvementPoints ?? 0), 0) / comparedRows.length
        )
      : null;

  const totalGapReduced = comparedRows.reduce(
    (sum, r) => sum + Math.max(0, r.gapReducedPoints ?? 0),
    0
  );

  const closedBenchmarksCount = comparedRows.filter((r) => r.gapDelta === 0).length;

  return (
    <Card className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-start gap-2.5">
          <TrendingUp className="w-5 h-5 text-[#0F766E] shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display text-base font-semibold text-[#0B1F3A]">{title}</h2>
            <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {comparedRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500">Compared: </span>
              <span className="font-mono font-semibold text-[#0B1F3A] tabular-nums">
                {comparedRows.length}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Avg Change: </span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  (avgGain ?? 0) >= 0 ? 'text-[#0F766E]' : 'text-red-700'
                }`}
              >
                {avgGain !== null ? `${avgGain >= 0 ? `+${avgGain}` : avgGain} pts` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Gap Closed: </span>
              <span className="font-mono font-semibold text-[#0B1F3A] tabular-nums">
                {totalGapReduced} pts ({closedBenchmarksCount}/{comparedRows.length} benchmarks met)
              </span>
            </div>
          </div>
        )}
      </div>

      {comparedRows.length === 0 ? (
        <div className="py-6 text-center space-y-1.5 bg-slate-50 border border-slate-200 rounded-md px-4">
          <p className="text-sm font-medium text-slate-800">
            No pre-vs-post reassessment comparisons recorded yet
          </p>
          <p className="text-xs text-slate-500 max-w-2xl mx-auto">
            Once a competency has both a baseline score and a post-training reassessment in
            PostgreSQL (`progress_history`), exact previous vs. new score deltas and gap closure
            metrics compute here automatically.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                <th className="px-4 py-3">Competency</th>
                <th className="px-4 py-3 text-right">Required</th>
                <th className="px-4 py-3 text-right">Previous</th>
                <th className="px-4 py-3 text-right">New Score</th>
                <th className="px-4 py-3 min-w-[200px]">Before → After Trajectory</th>
                <th className="px-4 py-3 text-right">Improvement</th>
                <th className="px-4 py-3 text-right">Gap Reduction</th>
                <th className="px-4 py-3 text-right">Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {comparedRows.map((row) => {
                const gain = row.improvementPoints ?? 0;
                return (
                  <tr key={row.competencyId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <span className="font-mono text-[#0F766E]">{row.competencyCode}</span>
                      <p className="font-medium text-slate-900 mt-0.5">{row.competencyTitle}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-800">
                      {row.requiredScore}/100
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                      {row.previousScore}/100
                      <span className="block text-[10px] text-slate-400">
                        Gap {row.previousGap ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-[#0B1F3A]">
                      {row.currentScore}/100
                      <span className="block text-[10px] text-slate-400">
                        Gap {row.gapDelta}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <CompetencyProgressBar
                        currentScore={row.currentScore}
                        requiredScore={row.requiredScore}
                        previousScore={row.previousScore}
                        compact
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                      <span
                        className={
                          gain > 0 ? 'text-[#0F766E]' : gain < 0 ? 'text-red-700' : 'text-slate-600'
                        }
                      >
                        {gain > 0 ? `+${gain}` : gain} pts
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      <span className="text-slate-900 font-semibold">
                        {row.previousGap} → {row.gapDelta}
                      </span>
                      {row.gapClosurePercent !== null && (
                        <span className="block text-[11px] text-[#0F766E]">
                          {row.gapClosurePercent}% closed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500 whitespace-nowrap">
                      {row.lastAssessedAt ? formatShortDate(row.lastAssessedAt) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
