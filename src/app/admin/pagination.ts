export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
}

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize = 10,
): Page<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);
  const start = (current - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    page: current,
    pageCount,
  };
}
