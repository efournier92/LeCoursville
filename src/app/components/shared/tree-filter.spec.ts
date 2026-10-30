import { matchesName, subtreeMatches, treeContainsId, unitMatcher } from './tree-filter';

interface Node {
  id: string;
  spouseIds?: string[];
  children: Node[];
}

interface UnitNode {
  person: { id: string; name: string };
  spouses: { id: string; name: string }[];
  children: UnitNode[];
}

function unit(id: string, name: string, spouses: { id: string; name: string }[] = [], children: UnitNode[] = []): UnitNode {
  return { person: { id, name }, spouses, children };
}

const nameOf = (person: { name: string }): string => person.name;

describe('tree-filter', () => {
  it('matches names case-insensitively and trims the query', () => {
    expect(matchesName('Florence Firth', '  firth ')).toBe(true);
    expect(matchesName('Florence Firth', 'FARON')).toBe(false);
    expect(matchesName('Florence Firth', '   ')).toBe(true);
  });

  it('matches a whole subtree recursively', () => {
    const tree: Node = {
      id: 'a',
      children: [
        { id: 'b', children: [{ id: 'c', children: [] }] },
        { id: 'd', children: [] },
      ],
    };
    expect(subtreeMatches(tree, node => node.id === 'a')).toBe(true);
    expect(subtreeMatches(tree, node => node.id === 'c')).toBe(true);
    expect(subtreeMatches(tree, node => node.id === 'missing')).toBe(false);
  });

  it('finds ids on the node or its spouses', () => {
    const tree: Node = {
      id: 'a',
      spouseIds: ['a-s'],
      children: [{ id: 'b', spouseIds: ['b-s'], children: [] }],
    };
    const idOf = (node: Node): string => node.id;
    const spouseIdsOf = (node: Node): string[] => node.spouseIds || [];
    expect(treeContainsId(tree, 'b', idOf, spouseIdsOf)).toBe(true);
    expect(treeContainsId(tree, 'b-s', idOf, spouseIdsOf)).toBe(true);
    expect(treeContainsId(tree, 'nope', idOf, spouseIdsOf)).toBe(false);
  });

  it('unitMatcher matches on the blood person', () => {
    const tree = unit('a', 'Ferdinand Fern', [unit('b', 'Fabienne Fern').person]);
    expect(unitMatcher('ferdinand', nameOf)(tree)).toBe(true);
    expect(unitMatcher('zzz', nameOf)(tree)).toBe(false);
  });

  it('unitMatcher matches on a spouse only', () => {
    const tree = unit('a', 'Ferdinand Fern', [{ id: 's', name: 'Florence Firth' }]);
    expect(unitMatcher('firth', nameOf)(tree)).toBe(true);
  });

  it('unitMatcher matches on a descendant', () => {
    const tree = unit('a', 'Ferdinand Fern', [], [unit('c', 'Cora Fern', [], [unit('d', 'Drew Fern')])]);
    expect(unitMatcher('drew', nameOf)(tree)).toBe(true);
  });

  it('unitMatcher matches every node on an empty search', () => {
    const tree = unit('a', 'Ferdinand Fern');
    expect(unitMatcher('', nameOf)(tree)).toBe(true);
    expect(unitMatcher('   ', nameOf)(tree)).toBe(true);
  });
});
