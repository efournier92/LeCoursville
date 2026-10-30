import { firstName, fullName } from './person-name';

describe('person-name', () => {
  it('prefers an explicit name', () => {
    expect(fullName({ name: 'Joan Rivers', given: 'Joan', surname: 'Rivers', id: 'x' })).toBe('Joan Rivers');
  });

  it('joins given and surname', () => {
    expect(fullName({ given: 'Joan', surname: 'Rivers' })).toBe('Joan Rivers');
  });

  it('appends the suffix after given and surname', () => {
    expect(fullName({ given: 'Dean', surname: 'Ribaudo', suffix: 'Jr.' })).toBe('Dean Ribaudo Jr.');
  });

  it('prefers an explicit name over parts even when a suffix is present', () => {
    expect(fullName({ name: 'Dean Ribaudo Jr.', given: 'Dean', surname: 'Ribaudo', suffix: 'Jr.' }))
      .toBe('Dean Ribaudo Jr.');
  });

  it('handles partial names', () => {
    expect(fullName({ given: 'Joan' })).toBe('Joan');
    expect(fullName({ surname: 'Rivers' })).toBe('Rivers');
    expect(fullName({ given: null, surname: null, name: null })).toBe('');
  });

  it('falls back to the id when no name parts exist', () => {
    expect(fullName({ id: 'fa-1' })).toBe('fa-1');
    expect(fullName({ given: '', surname: null, id: 'fa-2' })).toBe('fa-2');
  });

  it('takes the first whitespace token for labels', () => {
    expect(firstName({ given: 'Joan Marie', surname: 'Rivers' })).toBe('Joan');
    expect(firstName({ id: 'fa-1' })).toBe('fa-1');
  });
});
