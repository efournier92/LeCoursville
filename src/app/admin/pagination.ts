export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
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
    pageSize,
  };
}

export function pageRange(page: Page<unknown>): string {
  if (page.total === 0) {
    return 'Showing 0 of 0';
  }
  const start = (page.page - 1) * page.pageSize + 1;
  const end = start + page.items.length - 1;
  return `Showing ${start}-${end} of ${page.total}`;
}
