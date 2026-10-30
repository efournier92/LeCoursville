/** Case-insensitive, trimmed substring match; an empty query matches everything. */
export function matchesName(name: string, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) {
    return true;
  }
  return name.toLowerCase().includes(trimmed.toLowerCase());
}

/** Self or any descendant matches. Callers fold spouses into `matchesSelf`. */
export function subtreeMatches<T extends { children: T[] }>(
  node: T,
  matchesSelf: (node: T) => boolean,
): boolean {
  return matchesSelf(node) || node.children.some(child => subtreeMatches(child, matchesSelf));
}

/** Spouse-folding unit matcher shared by the chart and the tree nodes:
 *  a node matches when its blood person or any spouse matches by name. */
export function unitMatcher<TNode extends { person: TPerson; spouses: TPerson[]; children: TNode[] }, TPerson>(
  search: string,
  nameOf: (person: TPerson) => string,
): (node: TNode) => boolean {
  return node => subtreeMatches(node, current =>
    matchesName(nameOf(current.person), search)
    || current.spouses.some(spouse => matchesName(nameOf(spouse), search)));
}

/** Walks the tree looking for an id on the node itself or one of its spouses. */
export function treeContainsId<T extends { children: T[] }>(
  node: T,
  id: string,
  idOf: (node: T) => string,
  spouseIdsOf: (node: T) => string[] = () => [],
): boolean {
  return idOf(node) === id
    || spouseIdsOf(node).includes(id)
    || node.children.some(child => treeContainsId(child, id, idOf, spouseIdsOf));
}
