import { describe, it, expect } from 'vitest';
import { MirrorIndex, type MirrorEntry } from './mirror-index';
import type { PersistAdapter } from '../auth/token-store';

function memAdapter() {
  const raw: Record<string, unknown> = {};
  const adapter: PersistAdapter = {
    async load() { return raw; },
    async save(d) { Object.keys(raw).forEach((k) => delete raw[k]); Object.assign(raw, d); },
  };
  return { adapter, raw };
}
const entry = (over: Partial<MirrorEntry> = {}): MirrorEntry => ({
  driveId: 'id', mimeType: 'text/markdown', isFolder: false, hydrated: false, pinned: false, ...over,
});

describe('MirrorIndex', () => {
  it('set/get/has round-trip et persiste', async () => {
    const { adapter, raw } = memAdapter();
    const idx = new MirrorIndex(adapter);
    await idx.load();
    await idx.set('a/b.md', entry({ driveId: 'X' }));
    expect(idx.get('a/b.md')?.driveId).toBe('X');
    expect(idx.has('a/b.md')).toBe(true);
    expect(idx.has('nope')).toBe(false);
    // persisté sous entries
    expect((raw.entries as Record<string, unknown>)['a/b.md']).toBeDefined();
  });

  it('markHydrated passe hydrated à true', async () => {
    const { adapter } = memAdapter();
    const idx = new MirrorIndex(adapter);
    await idx.load();
    await idx.set('n.md', entry({ hydrated: false }));
    await idx.markHydrated('n.md');
    expect(idx.get('n.md')?.hydrated).toBe(true);
  });

  it('load relit l état persisté', async () => {
    const { adapter } = memAdapter();
    const a = new MirrorIndex(adapter);
    await a.load();
    await a.set('p', entry({ isFolder: true }));
    const b = new MirrorIndex(adapter);
    await b.load();
    expect(b.get('p')?.isFolder).toBe(true);
    expect(b.paths()).toEqual(['p']);
  });
});
