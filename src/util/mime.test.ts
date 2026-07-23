import { describe, it, expect } from 'vitest';
import { guessMimeType } from './mime';

describe('guessMimeType', () => {
  it('reconnaît les extensions courantes', () => {
    expect(guessMimeType('photo.PNG')).toBe('image/png'); // insensible à la casse
    expect(guessMimeType('doc.pdf')).toBe('application/pdf');
    expect(guessMimeType('clip.mp4')).toBe('video/mp4');
  });
  it('retombe sur application/octet-stream pour une extension inconnue ou absente', () => {
    expect(guessMimeType('fichier.xyz')).toBe('application/octet-stream');
    expect(guessMimeType('sansextension')).toBe('application/octet-stream');
  });
});
