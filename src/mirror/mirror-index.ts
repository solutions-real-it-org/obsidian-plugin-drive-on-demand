import type { PersistAdapter } from '../auth/token-store';
import { toNfc } from '../util/nfc';

export interface MirrorEntry {
  driveId: string;
  mimeType: string;
  isFolder: boolean;
  hydrated: boolean;
  pinned: boolean;
  headRevisionId?: string;
  modifiedTime?: string;
  md5Checksum?: string;
  syncedHash?: string;
}

export class MirrorIndex {
  private entries: Record<string, MirrorEntry> = {};

  constructor(private adapter: PersistAdapter) {}

  async load(): Promise<void> {
    const data = await this.adapter.load();
    const e = data.entries;
    // normalise NFC les clés au chargement (migre les chemins NFD historiques venant de
    // Drive/macOS), pour qu'elles matchent les chemins NFC d'Obsidian. Voir util/nfc.
    this.entries = {};
    if (e && typeof e === 'object') {
      for (const [k, v] of Object.entries(e as Record<string, MirrorEntry>)) {
        this.entries[toNfc(k)] = v;
      }
    }
  }

  private async persist(): Promise<void> {
    await this.adapter.save({ entries: this.entries });
  }

  get(path: string): MirrorEntry | undefined {
    return this.entries[toNfc(path)];
  }
  has(path: string): boolean {
    return toNfc(path) in this.entries;
  }
  paths(): string[] {
    return Object.keys(this.entries);
  }

  async set(path: string, entry: MirrorEntry): Promise<void> {
    this.entries[toNfc(path)] = entry;
    await this.persist();
  }

  async delete(path: string): Promise<void> {
    const np = toNfc(path);
    if (np in this.entries) {
      delete this.entries[np];
      await this.persist();
    }
  }

  /** Vide entièrement l'index (ex. changement de dossier de travail : les chemins
   *  étaient relatifs à l'ancienne racine, ils n'ont plus de sens). */
  async clear(): Promise<void> {
    this.entries = {};
    await this.persist();
  }

  async markHydrated(path: string): Promise<void> {
    const e = this.entries[toNfc(path)];
    if (!e) return;
    e.hydrated = true;
    await this.persist();
  }

  async setSyncedHash(path: string, hash: string): Promise<void> {
    const e = this.entries[toNfc(path)];
    if (!e) return;
    e.syncedHash = hash;
    await this.persist();
  }

  async setRevision(path: string, rev: string): Promise<void> {
    const e = this.entries[toNfc(path)];
    if (!e) return;
    e.headRevisionId = rev;
    await this.persist();
  }
}
