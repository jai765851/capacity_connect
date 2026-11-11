import React from 'react';
import { Search } from 'lucide-react';

interface WorkspaceFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  rightSlot?: React.ReactNode;
}

export function WorkspaceFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  rightSlot,
}: WorkspaceFilterBarProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="relative flex-1 max-w-md">
        <Search
          className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full min-h-[40px] pl-10 pr-3.5 py-2 text-sm rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
        />
      </div>
      {rightSlot && <div className="flex flex-wrap items-center gap-2 shrink-0">{rightSlot}</div>}
    </div>
  );
}
