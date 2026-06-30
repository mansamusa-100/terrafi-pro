import React from 'react';
import { cn } from '../lib/utils';

interface DataTableProps {
  children: React.ReactNode;
  minWidth?: string;
  className?: string;
}

/** Horizontal scroll wrapper for wide row/column grids on small screens. */
export function DataTable({
  children,
  minWidth = '640px',
  className
}: DataTableProps) {
  return (
    <div className={cn('data-table-scroll', className)}>
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}
