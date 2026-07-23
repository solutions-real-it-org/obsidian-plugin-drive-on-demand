import type { PersistAdapter } from './auth/token-store';

export class PluginDataStore {
  private blob: Record<string, unknown> = {};

  constructor(
    private loadFn: () => Promise<Record<string, unknown> | null>,
    private saveFn: (d: Record<string, unknown>) => Promise<void>,
  ) {}

  async init(): Promise<void> {
    this.blob = (await this.loadFn()) ?? {};
  }

  get(): Record<string, unknown> {
    return this.blob;
  }

  async persist(): Promise<void> {
    await this.saveFn(this.blob);
  }
}

/** Adaptateur PersistAdapter ciblant un sous-objet `key` du blob partagé. */
export function keyedAdapter(store: PluginDataStore, key: string): PersistAdapter {
  return {
    async load() {
      const blob = store.get();
      if (typeof blob[key] !== 'object' || blob[key] === null) blob[key] = {};
      return blob[key] as Record<string, unknown>;
    },
    async save(data) {
      store.get()[key] = data;
      await store.persist();
    },
  };
}
