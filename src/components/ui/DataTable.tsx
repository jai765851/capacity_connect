import React from 'react';
import { Database } from 'lucide-react';

export interface DataColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
  isLoading?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle,
  emptyDescription,
  emptyAction,
  isLoading = false,
}: DataTableProps<T>) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isLoading &&
              Array.from({ length: 3 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="h-[44px]">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-3.5 bg-slate-100 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}

            {!isLoading &&
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="hover:bg-slate-50/80 transition-colors min-h-[44px]"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-sm text-slate-700 ${
                        col.align === 'right' ? 'text-right tabular-nums' : 'text-left'
                      }`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!isLoading && rows.length === 0 && (
        <div className="px-6 py-12 text-center border-t border-slate-100">
          <div className="mx-auto w-10 h-10 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
            <Database className="w-5 h-5" strokeWidth={1.6} />
          </div>
          <h3 className="font-display text-sm font-semibold text-slate-900">{emptyTitle}</h3>
          <p className="text-sm text-slate-600 max-w-lg mx-auto mt-1.5 leading-relaxed">
            {emptyDescription}
          </p>
          {emptyAction && <div className="mt-5 flex justify-center">{emptyAction}</div>}
        </div>
      )}
    </div>
  );
}
