import { describe, it, expect } from 'vitest';
import { toNfc } from './nfc';

describe('toNfc', () => {
  it('convertit un chemin NFD (macOS) en NFC (Drive) — même apparence, chaîne différente', () => {
    const base = '1-1 notes datees personnelles/20190408 phase.md'.replace('datees', 'datées');
    const nfd = base.normalize('NFD'); // forme macOS : e + accent combinant
    const nfc = base.normalize('NFC'); // forme Drive : é (U+00E9)
    expect(nfd).not.toBe(nfc); // pièce à conviction : chaînes différentes avant normalisation
    expect(toNfc(nfd)).toBe(nfc);
    expect(toNfc(nfc)).toBe(nfc); // idempotent
  });

  it('un Set de chemins NFC reconnaît un chemin NFD une fois normalisé', () => {
    const base = 'dossier/fichier é.md';
    const nfc = base.normalize('NFC');
    const nfd = base.normalize('NFD');
    const synced = new Set([nfc]);
    expect(synced.has(nfd)).toBe(false); // le bug
    expect(synced.has(toNfc(nfd))).toBe(true); // le fix
  });

  it('laisse intact un chemin ASCII', () => {
    expect(toNfc('folder/note.md')).toBe('folder/note.md');
  });
});
