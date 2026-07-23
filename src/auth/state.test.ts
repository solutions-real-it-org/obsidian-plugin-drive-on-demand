import { describe, it, expect } from 'vitest';
import { genId } from './state';

describe('genId', () => {
  it('produit une chaîne base64url non vide', () => {
    const id = genId();
    expect(id.length).toBeGreaterThan(20);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produit des valeurs uniques', () => {
    const a = genId();
    const b = genId();
    expect(a).not.toBe(b);
  });

  it('respecte la taille demandée (plus d octets => plus long)', () => {
    expect(genId(64).length).toBeGreaterThan(genId(16).length);
  });
});
