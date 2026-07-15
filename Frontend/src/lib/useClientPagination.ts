import { useEffect, useMemo, useState } from 'react';

export const PAGE_SIZE = {
  compact: 10,
  default: 25,
  cards: 12
} as const;

/**
 * Client-side pagination for already-loaded arrays.
 * Resets to the first page when the filtered list identity/length changes.
 */
export function useClientPagination<T>(
  items: T[],
  pageSize: number = PAGE_SIZE.default,
  resetKey?: string | number
) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(0);
  }, [resetKey, pageSize, items.length]);

  const pageItems = useMemo(
    () => items.slice(offset, offset + pageSize),
    [items, offset, pageSize]
  );

  return {
    pageItems,
    total: items.length,
    limit: pageSize,
    offset,
    setOffset,
    page: Math.floor(offset / pageSize) + 1,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize))
  };
}
