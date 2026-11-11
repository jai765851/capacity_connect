import React from 'react';

interface BrandMarkProps {
  inverted?: boolean;
  showSublabel?: boolean;
}

export function BrandMark({ inverted = false, showSublabel = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          x="1"
          y="1"
          width="30"
          height="30"
          rx="4"
          className={inverted ? 'fill-white/10 stroke-white/25' : 'fill-[#0B1F3A] stroke-[#0B1F3A]'}
          strokeWidth="1.5"
        />
        <path
          d="M9 11.5H23M9 16H19M9 20.5H15"
          stroke={inverted ? '#FFFFFF' : '#FFFFFF'}
          strokeWidth="2"
          strokeLinecap="square"
        />
        <rect x="20" y="18.5" width="4" height="4" fill="#0D9488" />
      </svg>
      <div className="min-w-0">
        <span
          className={`font-display block text-sm font-bold tracking-tight whitespace-nowrap ${
            inverted ? 'text-white' : 'text-[#0B1F3A]'
          }`}
        >
          CAPACITY CONNECT
        </span>
        {showSublabel && (
          <span
            className={`block text-[11px] font-medium whitespace-nowrap ${
              inverted ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            SIH26075 Competency Portal
          </span>
        )}
      </div>
    </div>
  );
}
