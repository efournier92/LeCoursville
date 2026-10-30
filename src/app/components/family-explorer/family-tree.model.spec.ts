import { FamilyPerson } from 'src/app/services/family-explorer.service';
import {
  BRANCH_TINTS,
  buildBranches,
  findFoundingCouple,
  findRoots,
  archiveGenerationCount,
  generationCount,
  personCount,
  personName,
  TreeNode,
  yearsOf,
} from './family-tree.model';

function person(overrides: Partial<FamilyPerson> & { id: string }): FamilyPerson {
  return { given: overrides.id, surname: 'Fern', ...overrides };
}

function samplePeople(): FamilyPerson[] {
  return [
    person({ id: 'a', given: 'Adam', sex: 'M', birthDate: '1900', spouseIds: ['b'] }),
    person({ id: 'b', given: 'Beth', sex: 'F', birthDate: '1902', spouseIds: ['a'] }),
    person({ id: 'c1', given: 'Carl', birthDate: '1920', fatherId: 'a', motherId: 'b', spouseIds: ['x'] }),
    person({ id: 'x', given: 'Xena', birthDate: '1922', spouseIds: ['c1'] }),
    person({ id: 'd1', given: 'Dora', birthDate: '1945', fatherId: 'c1' }),
    person({ id: 'd2', given: 'Dean', birthDate: '1948', fatherId: 'c1' }),
    person({ id: 'c2', given: 'Cora', birthDate: '1930', fatherId: 'a', motherId: 'b' }),
    person({ id: 'd3', given: 'Drew', birthDate: '1955', fatherId: 'c2' }),
    person({ id: 'e', given: 'Eve', surname: 'Oak', birthDate: '1910', spouseIds: ['s'] }),
    person({ id: 's', given: 'Sam', surname: 'Oak', birthDate: '1911', spouseIds: ['e'] }),
  ];
}

describe('family-tree model', () => {
  it('exposes the shared name and year helpers', () => {
    expect(personName({ given: 'Adam', surname: 'Fern' })).toBe('Adam Fern');
    expect(yearsOf({ birthDate: '1900', deathDate: '1970' })).toBe('1900\u20131970');
  });

  it('finds roots alphabetically and the founding couple by largest subtree', () => {
    const people = samplePeople();
    expect(findRoots(people).map(root => root.id)).toEqual(['a', 'b', 'e', 's', 'x']);
    expect(findFoundingCouple(people).map(member => member.id)).toEqual(['a', 'b']);
  });

  it('orders branches by head birth year and numbers them in that order', () => {
    const branches = buildBranches(samplePeople());
    expect(branches.map(branch => branch.root.id)).toEqual(['e', 'c1', 'c2']);
    expect(branches.map(branch => branch.numeral)).toEqual([1, 2, 3]);
  });

  it('assigns tints by member-count weight, largest line first', () => {
    const branches = buildBranches(samplePeople());
    const byRoot = new Map(branches.map(branch => [branch.root.id, branch]));
    // c1 line: c1 + spouse x + d1 + d2 = 4, the largest.
    expect(byRoot.get('c1')!.personCount).toBe(4);
    expect(byRoot.get('c1')!.color).toBe(BRANCH_TINTS[0]);
    // e and c2 tie at 2 members; the older head (e, 1910) takes the next tint.
    expect(byRoot.get('e')!.personCount).toBe(2);
    expect(byRoot.get('e')!.color).toBe(BRANCH_TINTS[1]);
    expect(byRoot.get('c2')!.color).toBe(BRANCH_TINTS[2]);
  });

  it('counts generations and people per branch', () => {
    const branches = buildBranches(samplePeople());
    const byRoot = new Map(branches.map(branch => [branch.root.id, branch]));
    expect(byRoot.get('c1')!.generationCount).toBe(2);
    expect(byRoot.get('c2')!.generationCount).toBe(2);
    expect(byRoot.get('e')!.generationCount).toBe(1);
  });

  it('keeps parentless spouses on their root branch instead of a new one', () => {
    const branches = buildBranches(samplePeople());
    const eveBranch = branches.find(branch => branch.root.id === 'e')!;
    expect(eveBranch.rootSpouses.map(spouse => spouse.id)).toEqual(['s']);
    expect(branches.some(branch => branch.root.id === 's')).toBe(false);
    // x is a spouse of a couple-child, so it never heads its own branch.
    expect(branches.some(branch => branch.root.id === 'x')).toBe(false);
  });

  it('counts a bare node as one generation and one person', () => {
    const leaf: TreeNode = { person: person({ id: 'leaf' }), spouses: [], children: [] };
    expect(generationCount(leaf)).toBe(1);
    expect(personCount(leaf)).toBe(1);
  });

  it('drops a self spouse and duplicate spouse ids from the founding couple', () => {
    const people = [
      person({ id: 'a', given: 'Adam', sex: 'M', spouseIds: ['a', 'b', 'b'] }),
      person({ id: 'b', given: 'Beth', sex: 'F', spouseIds: ['a'] }),
    ];
    expect(findFoundingCouple(people).map(member => member.id)).toEqual(['a', 'b']);
  });

  it('returns no branches for empty input', () => {
    expect(buildBranches([])).toEqual([]);
  });

  it('renders one branch for a childless founding couple', () => {
    const people = [
      person({ id: 'a', given: 'Adam', sex: 'M', spouseIds: ['b'] }),
      person({ id: 'b', given: 'Beth', sex: 'F', spouseIds: ['a'] }),
    ];
    const branches = buildBranches(people);
    expect(branches).toHaveLength(1);
    expect(branches[0].root.id).toBe('a');
    expect(branches[0].rootSpouses.map(spouse => spouse.id)).toEqual(['b']);
  });

  it('renders a cycle-only archive without hanging', () => {
    const people = [
      person({ id: 'a', given: 'Adam', fatherId: 'b' }),
      person({ id: 'b', given: 'Beth', fatherId: 'a' }),
    ];
    const branches = buildBranches(people);
    expect(branches).toHaveLength(1);
    expect(branches[0].root.id).toBe('a');
  });

  it('branches a couple child linked only via childIds, not backrefs', () => {
    const people = [
      person({ id: 'fa-1', given: 'Frank', sex: 'M', spouseIds: ['fa-2'], childIds: ['c'] }),
      person({ id: 'fa-2', given: 'Fay', sex: 'F', spouseIds: ['fa-1'] }),
      person({ id: 'c', given: 'Cyr', surname: 'Fern' }),
    ];
    const branches = buildBranches(people);
    expect(branches).toHaveLength(1);
    expect(branches[0].root.id).toBe('c');
    expect(branches[0].family).toBe('Fern');
  });

  it('orders the founding couple husband-first with lowercase sex codes', () => {
    const people = [
      person({ id: 'w', given: 'Willa', sex: 'F', spouseIds: ['h'] }),
      person({ id: 'h', given: 'Hank', sex: 'm', spouseIds: ['w'] }),
    ];
    expect(findFoundingCouple(people).map(member => member.id)).toEqual(['h', 'w']);
  });

  it('counts the founders row as generation 1 of the archive', () => {
    const ferland = [
      person({ id: 'fa-1', given: 'Fred', sex: 'M', spouseIds: ['fa-2'], childIds: ['fa-3'] }),
      person({ id: 'fa-2', given: 'Flo', sex: 'F', spouseIds: ['fa-1'] }),
      person({ id: 'fa-3', given: 'Gail', fatherId: 'fa-1', motherId: 'fa-2', childIds: ['fa-4'] }),
      person({ id: 'fa-4', given: 'Hana', fatherId: 'fa-3', childIds: ['fa-5'] }),
      person({ id: 'fa-5', given: 'Ivo', fatherId: 'fa-4' }),
    ];
    expect(archiveGenerationCount(ferland)).toBe(4);
    expect(archiveGenerationCount([person({ id: 'solo', given: 'Sole' })])).toBe(1);
  });

  it('renders one spouse for duplicate spouseIds on a branch node', () => {
    const people = [
      person({ id: 'a', given: 'Adam', sex: 'M', spouseIds: ['b'] }),
      person({ id: 'b', given: 'Beth', spouseIds: ['a'] }),
      person({ id: 'c', given: 'Cora', fatherId: 'a', motherId: 'b', spouseIds: ['s', 's'] }),
      person({ id: 's', given: 'Sol', spouseIds: ['c'] }),
    ];
    const branches = buildBranches(people);
    const branch = branches.find(candidate => candidate.root.id === 'c')!;
    expect(branch.tree.spouses.map(spouse => spouse.id)).toEqual(['s']);
    expect(branch.personCount).toBe(2);
  });

  it('ignores a dangling spouse id', () => {
    const people = [
      person({ id: 'a', given: 'Adam', sex: 'M', spouseIds: ['b'] }),
      person({ id: 'b', given: 'Beth', spouseIds: ['a'] }),
      person({ id: 'c', given: 'Cora', fatherId: 'a', motherId: 'b', spouseIds: ['ghost'] }),
    ];
    const branch = buildBranches(people).find(candidate => candidate.root.id === 'c')!;
    expect(branch.tree.spouses).toEqual([]);
    expect(branch.personCount).toBe(1);
  });

  it('yields exactly one fallback branch for a lone single founder', () => {
    const branches = buildBranches([person({ id: 'solo', given: 'Sole', sex: 'F' })]);
    expect(branches).toHaveLength(1);
    expect(branches[0].root.id).toBe('solo');
    expect(branches[0].personCount).toBe(1);
    expect(branches[0].generationCount).toBe(1);
  });
});
