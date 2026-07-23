import { describe, it, expect } from 'vitest';
import { OutboxStore } from './outbox';
import type { PersistAdapter } from '../auth/token-store';

function ad() {
  const raw: Record<string, unknown> = {};
  const a: PersistAdapter = {
    async load() { return raw; },
    async save(d) { Object.keys(raw).forEach((k) => delete raw[k]); Object.assign(raw, d); },
  };
  return { a, raw };
}

describe('OutboxStore', () => {
  it('add / remove / all, dédupliqué', async () => {
    const { a } = ad();
    const o = new OutboxStore(a);
    await o.load();
    await o.add('a.md');
    await o.add('a.md'); // dédup
    await o.add('b.md');
    expect(o.all().sort()).toEqual(['a.md', 'b.md']);
    expect(o.has('a.md')).toBe(true);
    await o.remove('a.md');
    expect(o.all()).toEqual(['b.md']);
  });

  it('persiste et relit au redémarrage (aucune modif en attente perdue)', async () => {
    const { a } = ad();
    const o1 = new OutboxStore(a);
    await o1.load();
    await o1.add('note.md');
    const o2 = new OutboxStore(a);
    await o2.load();
    expect(o2.all()).toEqual(['note.md']);
  });
});
