import { paginate, pageRange } from './pagination';

const range = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

describe('paginate', () => {
  it('returns page 1 of an empty list', () => {
    expect(paginate([], 1)).toEqual({ items: [], total: 0, page: 1, pageCount: 1, pageSize: 10 });
    expect(paginate([], 4)).toEqual({ items: [], total: 0, page: 1, pageCount: 1, pageSize: 10 });
  });

  it('slices the first page and reports the total', () => {
    const result = paginate(range(25), 1, 10);

    expect(result.items).toEqual(range(10));
    expect(result.total).toBe(25);
    expect(result.page).toBe(1);
    expect(result.pageCount).toBe(3);
  });

  it('clamps a page below 1 and above the last page', () => {
    expect(paginate(range(25), 0, 10).page).toBe(1);
    expect(paginate(range(25), 99, 10).page).toBe(3);
    expect(paginate(range(25), 99, 10).items).toEqual([21, 22, 23, 24, 25]);
  });

  it('handles an exact page boundary without a trailing page', () => {
    const result = paginate(range(20), 2, 10);

    expect(result.pageCount).toBe(2);
    expect(result.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('returns the remainder on the last page', () => {
    const result = paginate(range(25), 3, 10);

    expect(result.items).toEqual([21, 22, 23, 24, 25]);
    expect(result.pageCount).toBe(3);
  });
});

describe('pageRange', () => {
  it('reports an empty page', () => {
    expect(pageRange(paginate([], 1))).toBe('Showing 0 of 0');
  });

  it('reports the first page and the remainder on the last page', () => {
    expect(pageRange(paginate(range(25), 1))).toBe('Showing 1-10 of 25');
    expect(pageRange(paginate(range(25), 3))).toBe('Showing 21-25 of 25');
  });
});
