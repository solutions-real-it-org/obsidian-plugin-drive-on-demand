/** Insère « (conflit label) » avant l'extension. `dir/note.md` → `dir/note (conflit label).md`. */
export function conflictName(path: string, label: string): string {
  const slash = path.lastIndexOf('/');
  const dir = slash < 0 ? '' : path.slice(0, slash + 1);
  const name = slash < 0 ? path : path.slice(slash + 1);
  const dot = name.lastIndexOf('.');
  const base = dot <= 0 ? name : name.slice(0, dot);
  const ext = dot <= 0 ? '' : name.slice(dot);
  return `${dir}${base} (conflit ${label})${ext}`;
}

/** Libellé de conflit horodaté, filesafe (pas de « : »), résolution seconde. */
export function defaultConflictLabel(d: Date = new Date()): string {
  return d.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
}
