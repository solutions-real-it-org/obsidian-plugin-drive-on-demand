import type { PersistAdapter } from '../auth/token-store';

export interface WorkingRoot {
  id: string;
  name: string;
}

/** Dossier de travail : point de départ du panneau et racine effective du vault.
 *  `null` = racine réelle du Drive (défaut). Persisté sous la clé `workingRoot`.
 *  Quand un dossier de travail est défini, tout se fait relativement à lui : ses
 *  enfants apparaissent à la racine du vault (ex. « Projets/notes.md » → « notes.md »). */
export class WorkingRootStore {
  private current: WorkingRoot | null = null;

  constructor(private adapter: PersistAdapter) {}

  async load(): Promise<void> {
    const d = await this.adapter.load();
    const w = d.workingRoot;
    if (w && typeof w === 'object' && !Array.isArray(w)) {
      const { id, name } = w as Record<string, unknown>;
      if (typeof id === 'string' && id && typeof name === 'string') {
        this.current = { id, name };
        return;
      }
    }
    this.current = null;
  }

  private async persist(): Promise<void> {
    const d = await this.adapter.load();
    if (this.current) d.workingRoot = { ...this.current };
    else delete d.workingRoot;
    await this.adapter.save({ ...d });
  }

  /** Le dossier de travail, ou null si racine du Drive. */
  get(): WorkingRoot | null {
    return this.current;
  }

  /** Vrai si un sous-dossier de travail est défini (pas la racine du Drive). */
  isCustom(): boolean {
    return this.current !== null;
  }

  /** Identifiant Drive à utiliser comme point de départ (id du dossier, ou « root »). */
  rootId(): string {
    return this.current?.id ?? 'root';
  }

  async set(id: string, name: string): Promise<void> {
    this.current = { id, name };
    await this.persist();
  }

  async reset(): Promise<void> {
    this.current = null;
    await this.persist();
  }
}
