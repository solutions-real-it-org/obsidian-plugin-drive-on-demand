import type { PersistAdapter } from '../auth/token-store';

// Interfaces étroites (testabilité) — satisfaites structurellement par DriveClient,
// PullManager, PushManager, MirrorIndex.
interface SchedulerDrive {
  getStartPageToken(): Promise<string>;
  listChanges(pageToken: string): Promise<{
    changed: string[];
    removed: string[];
    newStartPageToken?: string;
    nextPageToken?: string;
  }>;
}
interface SchedulerPull {
  refreshFile(path: string): Promise<unknown>;
}
interface SchedulerPush {
  flushPending(): Promise<void>;
}
interface SchedulerIndex {
  paths(): string[];
  get(path: string): { driveId: string; isFolder: boolean } | undefined;
}

export interface SyncSchedulerOptions {
  drive: SchedulerDrive;
  index: SchedulerIndex;
  pull: SchedulerPull;
  push: SchedulerPush;
  adapter: PersistAdapter; // persiste le jeton de page des changements
  isOnline: () => boolean;
  intervalMs?: number;
  onSyncing?: (busy: boolean) => void;
  onError?: (err: unknown) => void;
}

/** Réconciliation bidirectionnelle périodique (minuterie) :
 *  - local → Drive : re-pousse les modifs en attente (livret, cf. OutboxStore).
 *  - Drive → local : tire les fichiers changés à distance via l'API Changes (efficace :
 *    un jeton de page, seuls les fichiers réellement modifiés sont rafraîchis).
 *  Pausée hors-ligne ; rattrape tout au retour en ligne (tick immédiat + minuterie). */
export class SyncScheduler {
  private token: string | null = null;
  private running = false;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private opts: SyncSchedulerOptions) {}

  async load(): Promise<void> {
    const d = await this.opts.adapter.load();
    this.token = typeof d.changesToken === 'string' ? d.changesToken : null;
  }

  private async saveToken(tok: string): Promise<void> {
    this.token = tok;
    const d = await this.opts.adapter.load();
    d.changesToken = tok;
    await this.opts.adapter.save({ ...d });
  }

  /** Un cycle de réconciliation. No-op si hors-ligne ou si un cycle est déjà en cours. */
  async tick(): Promise<void> {
    if (this.running || !this.opts.isOnline()) return;
    this.running = true;
    this.opts.onSyncing?.(true);
    try {
      await this.opts.push.flushPending(); // local → Drive (rattrapage hors-ligne)
      await this.pullChanges(); // Drive → local
    } catch (e) {
      this.opts.onError?.(e); // ex. bascule hors-ligne en plein tick — le tick suivant réessaie
    } finally {
      this.running = false;
      this.opts.onSyncing?.(false);
    }
  }

  /** driveId → chemin local (fichiers seulement), pour mapper les changements distants. */
  private reverseIndex(): Map<string, string> {
    const m = new Map<string, string>();
    for (const p of this.opts.index.paths()) {
      const e = this.opts.index.get(p);
      if (e && !e.isFolder) m.set(e.driveId, p);
    }
    return m;
  }

  private async pullChanges(): Promise<void> {
    if (!this.token) {
      // Première exécution : on établit le point de référence « maintenant » (pas d'historique
      // antérieur à tirer — les fichiers déjà synchronisés le sont via le flux normal).
      await this.saveToken(await this.opts.drive.getStartPageToken());
      return;
    }
    const changed = new Set<string>();
    let pageToken: string | undefined = this.token;
    let newToken = this.token;
    while (pageToken) {
      const r = await this.opts.drive.listChanges(pageToken);
      r.changed.forEach((id) => changed.add(id));
      if (r.nextPageToken) pageToken = r.nextPageToken;
      else {
        newToken = r.newStartPageToken ?? newToken;
        pageToken = undefined;
      }
    }
    const byDriveId = this.reverseIndex();
    for (const id of changed) {
      const path = byDriveId.get(id);
      if (path) await this.opts.pull.refreshFile(path); // ne rafraîchit que nos fichiers synchronisés
    }
    // NB : les suppressions distantes (removed) ne sont PAS propagées en local (sécurité :
    // on n'efface jamais un fichier du vault sur la seule foi d'un changement Drive).
    if (newToken !== this.token) await this.saveToken(newToken);
  }

  /** Démarre la minuterie (+ un tick immédiat). */
  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.opts.intervalMs ?? 30000);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
