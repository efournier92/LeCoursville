import { FamilyPerson } from 'src/app/services/family-explorer.service';
import { fullName as personName } from '../shared/person-name';
import { yearsOf } from '../shared/person-date';

export { personName, yearsOf };

export interface TreeNode {
  person: FamilyPerson;
  /** Spouses render as lines under the blood line, never as their own branch. */
  spouses: FamilyPerson[];
  children: TreeNode[];
}

export interface Branch {
  root: FamilyPerson;
  /** Root spouses that would otherwise be roots of their own branch. */
  rootSpouses: FamilyPerson[];
  family: string;
  numeral: number;
  tree: TreeNode;
  generationCount: number;
  personCount: number;
  color: string;
}

// Branch colors are assigned by WEIGHT, never by hand: branches are ranked by
// member count and draw tints from this palette in rank order, largest line
// first, so the most-membered families claim the strongest hues. The mapping
// is a pure function of the data — consistent across loads and uploads.
// Picks are Material Design palette shades (the same convention the families
// node already uses for hexColor), ordered to alternate warm and cool so
// adjacent ranks stay distinguishable. 600–800 shades keep the 2px bars and
// 8% washes visible on white.
export const BRANCH_TINTS = [
  '#2E7D32', // Material Green 800   — echoes the app's forest green
  '#3F51B5', // Material Indigo 500
  '#F4511E', // Material Deep Orange 600
  '#00897B', // Material Teal 600
  '#E91E63', // Material Pink 500
  '#1565C0', // Material Blue 800
  '#FFA000', // Material Amber 700
  '#9C27B0', // Material Purple 500
  '#0097A7', // Material Cyan 700
  '#673AB7', // Material Deep Purple 500
  '#689F38', // Material Light Green 700
  '#546E7A', // Material Blue Grey 600
  '#6D4C41', // Material Brown 600
  '#FB8C00', // Material Orange 600
];

/** Roots are people with no parent inside the archive. */
export function findRoots(people: FamilyPerson[]): FamilyPerson[] {
  const byId = new Map(people.map(person => [person.id, person]));
  return people
    .filter(person => !(person.fatherId && byId.has(person.fatherId)) && !(person.motherId && byId.has(person.motherId)))
    .sort((a, b) => personName(a).localeCompare(personName(b)));
}

export function childIdsFor(people: FamilyPerson[], byId: Map<string, FamilyPerson>, person: FamilyPerson, spouses: FamilyPerson[]): string[] {
  const ids = new Set<string>(person.childIds || []);
  for (const spouse of spouses) {
    for (const id of spouse.childIds || []) {
      ids.add(id);
    }
  }
  const parents = [person, ...spouses].map(member => member.id);
  for (const candidate of people) {
    if (parents.includes(candidate.fatherId || '') || parents.includes(candidate.motherId || '')) {
      ids.add(candidate.id);
    }
  }
  return [...ids];
}

/** The archive's founding couple: the parentless person whose subtree is largest,
 *  plus their parentless spouses. Ties keep the alphabetically first. */
export function findFoundingCouple(people: FamilyPerson[]): FamilyPerson[] {
  const byId = new Map(people.map(person => [person.id, person]));
  const roots = findRoots(people);
  const rootIds = new Set(roots.map(person => person.id));
  const sizeOf = (rootId: string): number => {
    const seen = new Set<string>();
    const walk = (id: string): void => {
      const person = byId.get(id);
      if (!person || seen.has(id)) return;
      seen.add(id);
      const spouses = (person.spouseIds || []).map(id2 => byId.get(id2)!).filter(Boolean);
      for (const childId of childIdsFor(people, byId, person, spouses)) walk(childId);
    };
    walk(rootId);
    return seen.size;
  };
  let best: FamilyPerson | null = null;
  let bestSize = -1;
  for (const root of roots) {
    const size = sizeOf(root.id);
    if (size > bestSize) { bestSize = size; best = root; }
  }
  if (!best) return [];
  const coupleIds = new Set<string>([best.id]);
  const spouseRoots: FamilyPerson[] = [];
  for (const id of best.spouseIds || []) {
    if (coupleIds.has(id)) continue;
    coupleIds.add(id);
    const spouse = byId.get(id);
    if (spouse && rootIds.has(spouse.id)) spouseRoots.push(spouse);
  }
  const couple = [best, ...spouseRoots];
  // Display order follows the GEDCOM families convention (husband first); the
  // subtree-size pick above can be either member when both roots tie.
  return couple.sort((a, b) => (a.sex?.toUpperCase() === 'M' ? 0 : 1) - (b.sex?.toUpperCase() === 'M' ? 0 : 1));
}

/**
 * The founding couple's children head the branches, grouped by surname because
 * the archive data has no explicit family field; leftover unattached lineages
 * follow as their own branches. A visited set keeps cycles and shared spouses
 * from rendering twice.
 */
export function buildBranches(people: FamilyPerson[]): Branch[] {
  const byId = new Map(people.map(person => [person.id, person]));
  const roots = findRoots(people);
  const rootIds = new Set(roots.map(person => person.id));
  const visited = new Set<string>();
  const branches: Branch[] = [];

  const buildNode = (person: FamilyPerson): TreeNode => {
    visited.add(person.id);
    const spouses: FamilyPerson[] = [];
    const seen = new Set<string>();
    for (const id of person.spouseIds || []) {
      const spouse = byId.get(id);
      if (!spouse || seen.has(spouse.id) || visited.has(spouse.id)) {
        continue;
      }
      seen.add(spouse.id);
      visited.add(spouse.id);
      spouses.push(spouse);
    }
    const children = childIdsFor(people, byId, person, spouses)
      .filter(id => byId.has(id) && !visited.has(id))
      .sort((a, b) => personName(byId.get(a)!).localeCompare(personName(byId.get(b)!)))
      .map(id => buildNode(byId.get(id)!));
    return { person, spouses, children };
  };

  const couple = findFoundingCouple(people);
  const coupleIds = new Set(couple.map(p => p.id));
  for (const member of couple) visited.add(member.id);
  const coupleChildIds = new Set<string>();
  for (const member of couple) {
    const spouses = (member.spouseIds || []).map(id => byId.get(id)!).filter(Boolean);
    for (const id of childIdsFor(people, byId, member, spouses)) {
      coupleChildIds.add(id);
    }
  }
  for (const id of coupleIds) {
    coupleChildIds.delete(id);
  }
  const coupleChildren = [...coupleChildIds]
    .map(id => byId.get(id)!)
    .filter(Boolean)
    .sort((a, b) => personName(a).localeCompare(personName(b)));
  for (const child of coupleChildren) {
    if (visited.has(child.id)) {
      continue;
    }
    const tree = buildNode(child);
    branches.push({
      root: child,
      rootSpouses: tree.spouses.filter(spouse => rootIds.has(spouse.id)),
      family: child.surname || 'Family',
      numeral: branches.length + 1,
      tree,
      generationCount: generationCount(tree),
      personCount: personCount(tree),
      color: '',
    });
  }

  for (const root of roots) {
    if (visited.has(root.id)) {
      continue;
    }
    const tree = buildNode(root);
    branches.push({
      root,
      rootSpouses: tree.spouses.filter(spouse => rootIds.has(spouse.id)),
      family: root.surname || 'Family',
      numeral: branches.length + 1,
      tree,
      generationCount: generationCount(tree),
      personCount: personCount(tree),
      color: '',
    });
  }

  // A childless founding couple or a cycle-only archive yields no branch above;
  // fall back to the founding couple (or any member) so the chart never blanks.
  const fallback = couple[0] ?? roots[0] ?? people[0];
  if (branches.length === 0 && fallback) {
    visited.clear();
    const tree = buildNode(fallback);
    branches.push({
      root: fallback,
      rootSpouses: tree.spouses.filter(spouse => rootIds.has(spouse.id)),
      family: fallback.surname || 'Family',
      numeral: 1,
      tree,
      generationCount: generationCount(tree),
      personCount: personCount(tree),
      color: '',
    });
  }

  // Cards run oldest branch member first: birth year of the branch head,
  // ascending; undated and same-year branches fall back to name order.
  const birthYear = (person: FamilyPerson): number => {
    const match = (person.birthDate || '').match(/\b(\d{4})\b/);
    return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
  };
  branches.sort((a, b) =>
    birthYear(a.root) - birthYear(b.root) || personName(a.root).localeCompare(personName(b.root)));
  branches.forEach((branch, index) => {
    branch.numeral = index + 1;
  });

  // Weight-ranked tints: the largest lines claim the palette's distinct hues
  // first (green for the biggest line, then honey, slate, ...). Deterministic
  // — the same data always maps to the same colors, no manual assignment.
  const byWeight = [...branches].sort((a, b) =>
    b.personCount - a.personCount
    || birthYear(a.root) - birthYear(b.root)
    || personName(a.root).localeCompare(personName(b.root)));
  byWeight.forEach((branch, index) => {
    branch.color = BRANCH_TINTS[index % BRANCH_TINTS.length];
  });
  return branches;
}

export function generationCount(node: TreeNode): number {
  if (node.children.length === 0) {
    return 1;
  }
  return 1 + Math.max(...node.children.map(generationCount));
}

export function personCount(node: TreeNode): number {
  return 1 + node.spouses.length + node.children.reduce((total, child) => total + personCount(child), 0);
}

/** Deepest generation path from any root; founders in the roots row count as generation 1. */
export function archiveGenerationCount(people: FamilyPerson[]): number {
  const byId = new Map(people.map(person => [person.id, person]));
  const depthOf = (person: FamilyPerson, seen: Set<string>): number => {
    if (seen.has(person.id)) {
      return 0;
    }
    seen.add(person.id);
    const spouses = (person.spouseIds || []).map(id => byId.get(id)).filter(Boolean) as FamilyPerson[];
    let deepest = 0;
    for (const id of childIdsFor(people, byId, person, spouses)) {
      const child = byId.get(id);
      if (child) {
        deepest = Math.max(deepest, depthOf(child, seen));
      }
    }
    return deepest + 1;
  };
  return findRoots(people).reduce((max, root) => Math.max(max, depthOf(root, new Set<string>())), 0);
}
