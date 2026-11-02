// Module-level persistence for which parent nav rows (Operations / Management)
// are expanded. Layout remounts on every route change, so we stash the Set here
// (like savedSidebarScrollTop) so a manually-expanded parent stays expanded when
// navigating between pages. Each component still owns its own React state, but
// it initializes from / writes back to this shared snapshot.
let expanded: Set<string> = new Set();

export const snapshotExpandedParents = (): Set<string> => new Set(expanded);

export const persistExpandedParents = (next: Set<string>): void => {
  expanded = new Set(next);
};

export const ensureParentExpanded = (parentPath: string): void => {
  if (!expanded.has(parentPath)) {
    expanded.add(parentPath);
  }
};
