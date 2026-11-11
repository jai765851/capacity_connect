import React from 'react';
import { calculateSkillGap, clampScore } from '../../services/competencyEngine';

interface CompetencyProgressBarProps {
  currentScore: number | null;
  requiredScore: number;
  previousScore?: number | null;
  compact?: boolean;
}

export function CompetencyProgressBar({
  currentScore,
  requiredScore,
  previousScore = null,
  compact = false,
}: CompetencyProgressBarProps) {
  const safeRequired = clampScore(requiredScore);
  const safeCurrent = currentScore !== null ? clampScore(currentScore) : null;
  const safePrevious = previousScore !== null ? clampScore(previousScore) : null;

  const gap = safeCurrent !== null ? calculateSkillGap(safeRequired, safeCurrent) : safeRequired;
  const hasReassessmentGain =
    safeCurrent !== null && safePrevious !== null && safeCurrent >= safePrevious;
  const deltaPoints =
    safeCurrent !== null && safePrevious !== null ? safeCurrent - safePrevious : null;

  const activeFillColor =
    safeCurrent === null
      ? '#CBD5E1'
      : gap === 0
      ? '#0F766E'
      : gap <= 15
      ? '#B45309'
      : '#B91C1C';

  // Clamp marker slightly inward at edges so 0 and 100 remain crisp
  const markerX = Math.min(99.2, Math.max(0.8, safeRequired));

  const ariaLabel =
    safeCurrent === null
      ? `Unassessed against required target ${safeRequired} out of 100`
      : safePrevious !== null
      ? `Previous score ${safePrevious}, current score ${safeCurrent}, required score ${safeRequired}, gap ${gap}`
      : `Current score ${safeCurrent}, required score ${safeRequired}, gap ${gap}`;

  return (
    <div className="w-full min-w-[160px] space-y-1.5">
      <div className="w-full">
        <svg
          viewBox="0 0 100 12"
          preserveAspectRatio="none"
          className={compact ? 'w-full h-2.5 overflow-visible' : 'w-full h-3 overflow-visible'}
          role="img"
          aria-label={ariaLabel}
        >
          {/* Background scale rail (0 - 100) */}
          <rect x="0" y="3" width="100" height="6" rx="1.5" fill="#E2E8F0" />

          {/* Score bar rendering */}
          {safeCurrent !== null && hasReassessmentGain && safePrevious !== null ? (
            <>
              {/* Baseline segment */}
              <rect x="0" y="3" width={safePrevious} height="6" rx="1.5" fill="#94A3B8" />
              {/* Measured post-training gain segment */}
              <rect
                x={safePrevious}
                y="3"
                width={Math.max(0, safeCurrent - safePrevious)}
                height="6"
                rx="1"
                fill={gap === 0 ? '#0F766E' : '#0B1F3A'}
              />
            </>
          ) : safeCurrent !== null ? (
            <rect x="0" y="3" width={safeCurrent} height="6" rx="1.5" fill={activeFillColor} />
          ) : null}

          {/* Vertical Required Benchmark Threshold */}
          <line
            x1={markerX}
            y1="0.5"
            x2={markerX}
            y2="11.5"
            stroke="#0B1F3A"
            strokeWidth="1.2"
          />
        </svg>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-600">
        <span>
          {safeCurrent === null ? 'Pending' : `${safeCurrent}/100`}
          {deltaPoints !== null && (
            <span
              className={`ml-1.5 font-semibold ${
                deltaPoints > 0
                  ? 'text-[#0F766E]'
                  : deltaPoints < 0
                  ? 'text-red-700'
                  : 'text-slate-500'
              }`}
            >
              ({deltaPoints > 0 ? `+${deltaPoints}` : deltaPoints})
            </span>
          )}
        </span>
        <span className="text-slate-500">Req {safeRequired}</span>
      </div>
    </div>
  );
}
