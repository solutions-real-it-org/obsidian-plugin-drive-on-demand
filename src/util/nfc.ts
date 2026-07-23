/** Normalise un chemin en Unicode NFC (forme composée).
 *
 *  macOS/iOS renvoient les noms de fichiers en NFD (forme décomposée : « é » = « e » +
 *  accent combinant), alors que Google Drive — et donc tout ce que le plugin stocke
 *  (état de sync, index) — utilise NFC (« é » = un seul point de code). Visuellement
 *  identiques, mais chaînes JS DIFFÉRENTES → une comparaison (Set.has, clé d'objet)
 *  échoue silencieusement (ex. un fichier synchronisé n'est plus reconnu au save).
 *
 *  On normalise donc en NFC tout chemin issu d'un événement Obsidian (modify/create/
 *  file-open) avant de le comparer aux chemins stockés (NFC). */
export function toNfc(path: string): string {
  return path.normalize('NFC');
}
