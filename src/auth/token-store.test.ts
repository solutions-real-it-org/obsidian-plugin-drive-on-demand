import { describe, it, expect } from 'vitest';
import { TokenStore, type PersistAdapter } from './token-store';

function memoryAdapter(): PersistAdapter & { raw: Record<string, unknown> } {
  const state: { raw: Record<string, unknown> } = { raw: {} };
  return {
    raw: state.raw,
    async load() { return state.raw; },
    async save(data: Record<string, unknown>) { const copy = Object.assign({}, data); Object.keys(state.raw).forEach((k) => delete state.raw[k]); Object.assign(state.raw, copy); },
    get: () => state.raw,
  } as unknown as PersistAdapter & { raw: Record<string, unknown> };
}

describe('TokenStore', () => {
  it('retourne null quand rien n est stocké', async () => {
    const store = new TokenStore(memoryAdapter());
    expect(await store.getRefresh()).toBeNull();
  });

  it('persiste et relit le refresh token', async () => {
    const adapter = memoryAdapter();
    const store = new TokenStore(adapter);
    await store.setRefresh('1//refresh-secret');
    expect(await store.getRefresh()).toBe('1//refresh-secret');
  });

  it('n écrit pas le token en clair dans les données brutes', async () => {
    const adapter = memoryAdapter();
    const store = new TokenStore(adapter);
    await store.setRefresh('1//refresh-secret');
    expect(JSON.stringify(adapter.raw)).not.toContain('1//refresh-secret');
  });

  it('clear efface le token', async () => {
    const store = new TokenStore(memoryAdapter());
    await store.setRefresh('x');
    await store.clear();
    expect(await store.getRefresh()).toBeNull();
  });
});
