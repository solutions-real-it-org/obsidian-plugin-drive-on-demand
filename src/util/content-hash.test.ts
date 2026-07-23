import { describe, it, expect } from 'vitest';
import { hashContent } from './content-hash';

describe('hashContent', () => {
  it('même contenu → même hash, contenu différent → hash différent', () => {
    expect(hashContent('abc')).toBe(hashContent('abc'));
    expect(hashContent('abc')).not.toBe(hashContent('abd'));
    expect(hashContent('abc')).not.toBe(hashContent('abc ')); // longueur différente
  });
});
