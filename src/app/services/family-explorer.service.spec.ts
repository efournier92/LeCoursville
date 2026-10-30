import { parseFamilyPeople } from './family-explorer.service';

const person = (id: string, extra: Record<string, unknown> = {}) => ({ id, given: 'A', ...extra });

describe('parseFamilyPeople', () => {
  it('accepts a bare array', () => {
    const result = parseFamilyPeople(JSON.stringify([person('a'), person('b')]));
    expect(result.count).toBe(2);
    expect(Object.keys(result.people)).toEqual(['a', 'b']);
  });

  it('accepts {people:[...]}', () => {
    const result = parseFamilyPeople(JSON.stringify({ people: [person('a'), person('b')] }));
    expect(result.count).toBe(2);
    expect(result.people['a'].given).toBe('A');
  });

  it('rejects fewer than 2 records', () => {
    expect(() => parseFamilyPeople(JSON.stringify([person('a')]))).toThrow('At least 2 person records are required.');
  });

  it('rejects a record without an id', () => {
    expect(() => parseFamilyPeople(JSON.stringify([person('a'), { given: 'B' }]))).toThrow('Every person record needs an id.');
  });

  it('rejects a duplicate id', () => {
    expect(() => parseFamilyPeople(JSON.stringify([person('a'), person('a')]))).toThrow('Duplicate person id: a.');
  });

  it('accepts an id named constructor', () => {
    const result = parseFamilyPeople(JSON.stringify([person('constructor'), person('b')]));
    expect(Object.prototype.hasOwnProperty.call(result.people, 'constructor')).toBe(true);
  });

  it('drops fields outside the whitelist', () => {
    const result = parseFamilyPeople(
      JSON.stringify([person('a', { photo: 'x', given: 'Ann' }), person('b')]),
    );
    expect(result.people['a']).not.toHaveProperty('photo');
    expect(result.people['a'].given).toBe('Ann');
  });
});
