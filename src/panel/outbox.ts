import type { PersistAdapter } from '../auth/token-store';

/** Livret persistant des fichiers dont le push local → Drive n'a pas (encore) abouti
 *  (typiquement : modifiés hors-ligne). Survit au redémarrage. Le planificateur le vide
 *  au retour en ligne / à chaque tick. Garantit qu'aucune modif locale n'est perdue. */
export class OutboxStore {
  private pending = new Set<string>();

  constructor(private adapter: PersistAdapter) {}

  async load(): Promise<void> {
    const d = await this.adapter.load();
    const p = d.pending;
    this.pending = new Set(Array.isArray(p) ? (p as string[]) : []);
  }

  private async persist(): Promise<void> {
    const d = await this.adapter.load();
    d.pending = [...this.pending];
    await this.adapter.save({ ...d });
  }

  all(): string[] {
    return [...this.pending];
  }
  has(path: string): boolean {
    return this.pending.has(path);
  }

  async add(path: string): Promise<void> {
    if (!this.pending.has(path)) {
      this.pending.add(path);
      await this.persist();
    }
  }
  async remove(path: string): Promise<void> {
    if (this.pending.has(path)) {
      this.pending.delete(path);
      await this.persist();
    }
  }
}
