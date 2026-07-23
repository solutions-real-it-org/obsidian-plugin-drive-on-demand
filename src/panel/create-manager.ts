import type { MirrorIndex, MirrorEntry } from '../mirror/mirror-index';
import type { DriveClient } from '../drive/drive-client';
import type { VaultOps } from '../mirror/tree-mirror';
import type { SelectiveSyncState } from './selective-sync-state';
import { isIgnored } from '../mirror/tree-mirror';
import { hashContent } from '../util/content-hash';
import { isFolder as isDriveFolder } from '../drive/drive-client';
import { guessMimeType } from '../util/mime';

export type CreateResult = 'created' | 'skipped';

export interface CreateManagerOptions {
  index: MirrorIndex;
  drive: DriveClient;
  vault: VaultOps;
  state: SelectiveSyncState;
  wasPluginCreated?: (path: string) => boolean;
}

const FOLDER_ENTRY = (driveId: string): MirrorEntry => ({
  driveId, mimeType: 'application/vnd.google-apps.folder', isFolder: true, hydrated: true, pinned: true,
});

const TEXT_EXT = new Set(['md', 'markdown', 'txt', 'csv', 'json', 'xml', 'yaml', 'yml', 'html', 'css', 'js', 'ts', 'org', 'tex']);
function isTextName(name: string): boolean {
  const dot = name.lastIndexOf('.');
  return TEXT_EXT.has(dot >= 0 ? name.slice(dot + 1).toLowerCase() : '');
}

export class CreateManager {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private opts: CreateManagerOptions) {}

  handleCreate(path: string, isFolder: boolean): Promise<CreateResult> {
    // sérialise les créations pour éviter les courses (dossiers intermédiaires dupliqués)
    const run = this.queue.then(() => this.process(path, isFolder), () => this.process(path, isFolder));
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Enfant Drive d'un dossier par nom (dédup ; évite les doublons de dossiers/fichiers). */
  private async childId(parentDriveId: string, name: string, wantFolder: boolean): Promise<string | undefined> {
    const kids = await this.opts.drive.children(parentDriveId);
    return kids.find((k) => k.name === name && isDriveFolder(k.mimeType) === wantFolder)?.id;
  }

  private async process(path: string, isFolder: boolean): Promise<CreateResult> {
    if (this.opts.wasPluginCreated?.(path)) return 'skipped';
    if (isIgnored(path) || this.opts.index.get(path)) return 'skipped';
    const parts = path.split('/');
    const name = parts[parts.length - 1];

    const ancestors: string[] = [];
    for (let i = parts.length - 1; i > 0; i--) ancestors.push(parts.slice(0, i).join('/'));
    let baseIdx = -1;
    let parentDriveId = '';
    for (let i = 0; i < ancestors.length; i++) {
      const e = this.opts.index.get(ancestors[i]);
      if (e && e.isFolder && e.driveId) { baseIdx = i; parentDriveId = e.driveId; break; }
    }
    if (baseIdx < 0) return 'skipped'; // hors zone synchronisée

    // créer (ou réutiliser) les dossiers intermédiaires manquants, du plus haut au plus bas
    const missing = ancestors.slice(0, baseIdx).reverse();
    for (const folderPath of missing) {
      const fname = folderPath.split('/').pop() as string;
      let id = await this.childId(parentDriveId, fname, true);
      if (!id) id = (await this.opts.drive.createDriveFolder(parentDriveId, fname)).id;
      await this.opts.index.set(folderPath, FOLDER_ENTRY(id));
      parentDriveId = id;
    }

    if (isFolder) {
      let id = await this.childId(parentDriveId, name, true);
      if (!id) id = (await this.opts.drive.createDriveFolder(parentDriveId, name)).id;
      await this.opts.index.set(path, FOLDER_ENTRY(id));
      return 'created';
    }
    // fichier : si un fichier du même nom existe déjà sur Drive → ne pas dupliquer/écraser
    if (await this.childId(parentDriveId, name, false)) return 'skipped';

    if (isTextName(name)) {
      const content = await this.opts.vault.readText(path);
      const { id, headRevisionId } = await this.opts.drive.createFile(parentDriveId, name, content);
      await this.opts.index.set(path, {
        driveId: id, mimeType: 'text/markdown', isFolder: false, hydrated: true, pinned: true,
        headRevisionId, syncedHash: hashContent(content),
      });
    } else {
      const buffer = await this.opts.vault.readBinary(path);
      const mimeType = guessMimeType(name);
      const { id, headRevisionId } = await this.opts.drive.createBinaryFile(parentDriveId, name, buffer, mimeType);
      await this.opts.index.set(path, {
        driveId: id, mimeType, isFolder: false, hydrated: true, pinned: true, headRevisionId,
      });
    }
    await this.opts.state.setFileSynced(path, true);
    return 'created';
  }
}
