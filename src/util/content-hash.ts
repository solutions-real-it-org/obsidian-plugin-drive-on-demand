/** Hash déterministe léger (djb2 XOR) + longueur — suffisant pour détecter
 *  un changement de contenu, pas cryptographique. */
export function hashContent(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36) + ':' + s.length;
}
