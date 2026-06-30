import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
  className?: string;
}

export function Pagination({
  total,
  limit,
  offset,
  onPageChange,
  className
}: PaginationProps) {
  if (total <= limit) return null;

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const from = offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100',
        className
      )}>
      <p className="text-xs text-slate-500">
        Showing {from.toLocaleString()}–{to.toLocaleString()} of{' '}
        {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 disabled:opacity-40 disabled:pointer-events-none">
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>
        <span className="text-xs text-slate-500 tabular-nums px-1">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={offset + limit >= total}
          onClick={() => onPageChange(offset + limit)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 disabled:opacity-40 disabled:pointer-events-none">
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
