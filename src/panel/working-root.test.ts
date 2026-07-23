import { describe, it, expect } from 'vitest';
import { WorkingRootStore } from './working-root';
import type { PersistAdapter } from '../auth/token-store';

function ad() {
  const raw: Record<string, unknown> = {};
  const a: PersistAdapter = {
    async load() { return raw; },
    async save(d) { Object.keys(raw).forEach((k) => delete raw[k]); Object.assign(raw, d); },
  };
  return { a, raw };
}

describe('WorkingRootStore', () => {
  it('par défaut : racine du Drive (id "root", pas de dossier de travail)', async () => {
    const { a } = ad();
    const s = new WorkingRootStore(a);
    await s.load();
    expect(s.get()).toBeNull();
    expect(s.rootId()).toBe('root');
    expect(s.isCustom()).toBe(false);
  });

  it('set persiste le dossier de travail (id + nom) et le rend actif', async () => {
    const { a, raw } = ad();
    const s = new WorkingRootStore(a);
    await s.load();
    await s.set('FOLDER_ID', 'Projets');
    expect(s.get()).toEqual({ id: 'FOLDER_ID', name: 'Projets' });
    expect(s.rootId()).toBe('FOLDER_ID');
    expect(s.isCustom()).toBe(true);
    // persisté sous la clé workingRoot
    expect(raw.workingRoot).toEqual({ id: 'FOLDER_ID', name: 'Projets' });
  });

  it('reload relit le dossier de travail persisté', async () => {
    const { a } = ad();
    const s1 = new WorkingRootStore(a);
    await s1.load();
    await s1.set('F2', 'Docs');
    const s2 = new WorkingRootStore(a);
    await s2.load();
    expect(s2.get()).toEqual({ id: 'F2', name: 'Docs' });
    expect(s2.rootId()).toBe('F2');
  });

  it('reset revient à la racine du Drive', async () => {
    const { a, raw } = ad();
    const s = new WorkingRootStore(a);
    await s.load();
    await s.set('F3', 'Truc');
    await s.reset();
    expect(s.get()).toBeNull();
    expect(s.rootId()).toBe('root');
    expect(raw.workingRoot ?? null).toBeNull();
  });

  it('ignore une valeur persistée malformée (repli racine)', async () => {
    const { a, raw } = ad();
    raw.workingRoot = { id: 42 }; // malformé (id non-string, pas de name)
    const s = new WorkingRootStore(a);
    await s.load();
    expect(s.get()).toBeNull();
    expect(s.rootId()).toBe('root');
  });
});
