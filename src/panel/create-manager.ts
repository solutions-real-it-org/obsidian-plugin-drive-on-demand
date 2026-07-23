import type { MirrorIndex, MirrorEntry } from '../mirror/mirror-index';
import type { DriveClient } from '../drive/drive-client';
import type { VaultOps } from '../mirror/tree-mirror';
import type { SelectiveSyncState } from './selective-sync-state';
import { isIgnored } from '../mirror/tree-mirror';
import { hashContent } from '../util/content-hash';
import { isFolder as isDriveFolder } from '../drive/drive-client';
import { guessMimeType } from '../util/mime';
import { toNfc } from '../util/nfc';

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

  /** Déplacement/renommage local (événement `rename` d'Obsidian). Sérialisé comme les créations. */
  handleRename(oldPath: string, newPath: string, isFolder: boolean): Promise<CreateResult> {
    const run = this.queue.then(
      () => this.processRename(oldPath, newPath, isFolder),
      () => this.processRename(oldPath, newPath, isFolder),
    );
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Téléverse un fichier/dossier LOCAL (grisé dans le panneau) sous un dossier Drive
   *  DÉJÀ connu (celui en cours d'exploration). Contrairement à handleCreate, ne dépend
   *  pas d'un ancêtre déjà suivi : le parent Drive est fourni explicitement. */
  uploadLocal(path: string, isFolder: boolean, parentDriveId: string): Promise<CreateResult> {
    const run = this.queue.then(
      () => this.createUnder(toNfc(path), isFolder, parentDriveId),
      () => this.createUnder(toNfc(path), isFolder, parentDriveId),
    );
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Enfant Drive d'un dossier par nom (dédup ; évite les doublons de dossiers/fichiers). */
  private async childId(parentDriveId: string, name: string, wantFolder: boolean): Promise<string | undefined> {
    const kids = await this.opts.drive.children(parentDriveId);
    return kids.find((k) => k.name === name && isDriveFolder(k.mimeType) === wantFolder)?.id;
  }

  /** driveId du dossier parent de `path` (crée les dossiers intermédiaires manquants),
   *  ou null si `path` n'est sous aucune zone synchronisée. */
  private async resolveParentDriveId(path: string): Promise<string | null> {
    const parts = path.split('/');
    const ancestors: string[] = [];
    for (let i = parts.length - 1; i > 0; i--) ancestors.push(parts.slice(0, i).join('/'));
    let baseIdx = -1;
    let parentDriveId = '';
    for (let i = 0; i < ancestors.length; i++) {
      const e = this.opts.index.get(ancestors[i]);
      if (e && e.isFolder && e.driveId) { baseIdx = i; parentDriveId = e.driveId; break; }
    }
    if (baseIdx < 0) return null; // hors zone synchronisée
    // créer (ou réutiliser) les dossiers intermédiaires manquants, du plus haut au plus bas
    const missing = ancestors.slice(0, baseIdx).reverse();
    for (const folderPath of missing) {
      const fname = folderPath.split('/').pop() as string;
      let id = await this.childId(parentDriveId, fname, true);
      if (!id) id = (await this.opts.drive.createDriveFolder(parentDriveId, fname)).id;
      await this.opts.index.set(folderPath, FOLDER_ENTRY(id));
      parentDriveId = id;
    }
    return parentDriveId;
  }

  /** Cesse de suivre `path` et tout son sous-arbre (retire de l'index et de l'état).
   *  Le fichier reste sur Drive — on ne le supprime jamais côté distant. */
  private async untrack(path: string): Promise<void> {
    for (const p of this.opts.index.paths()) {
      if (p === path || p.startsWith(path + '/')) {
        await this.opts.index.delete(p);
        await this.opts.state.setFileSynced(p, false);
      }
    }
  }

  /** Déplace les clés index/état de `oldPath` (et descendants) vers `newPath`. */
  private async reindex(oldPath: string, newPath: string): Promise<void> {
    const affected = this.opts.index.paths().filter((p) => p === oldPath || p.startsWith(oldPath + '/'));
    for (const p of affected) {
      const entry = this.opts.index.get(p);
      if (!entry) continue;
      const np = newPath + p.slice(oldPath.length);
      const wasSynced = this.opts.state.isSynced(p);
      await this.opts.index.delete(p);
      await this.opts.index.set(np, entry);
      if (wasSynced) {
        await this.opts.state.setFileSynced(p, false);
        await this.opts.state.setFileSynced(np, true);
      }
    }
  }

  private async processRename(oldPath: string, newPath: string, isFolder: boolean): Promise<CreateResult> {
    oldPath = toNfc(oldPath);
    newPath = toNfc(newPath);
    const oldEntry = this.opts.index.get(oldPath);
    if (!oldEntry) {
      // pas (encore) suivi → si newPath tombe sous une zone synchronisée, on le crée sur Drive
      return this.process(newPath, isFolder);
    }
    // déjà suivi : déplacé/renommé
    if (isIgnored(newPath)) { await this.untrack(oldPath); return 'skipped'; }
    const newParent = await this.resolveParentDriveId(newPath);
    if (newParent === null) {
      await this.untrack(oldPath); // sorti de la zone synchronisée → on cesse de suivre
      return 'skipped';
    }
    const newName = newPath.split('/').pop() as string;
    await this.opts.drive.moveFile(oldEntry.driveId, { name: newName, addParentId: newParent });
    await this.reindex(oldPath, newPath);
    return 'created';
  }

  private async process(path: string, isFolder: boolean): Promise<CreateResult> {
    if (this.opts.wasPluginCreated?.(path)) return 'skipped';
    if (isIgnored(path) || this.opts.index.get(path)) return 'skipped';
    const parentDriveId = await this.resolveParentDriveId(path);
    if (parentDriveId === null) return 'skipped'; // hors zone synchronisée
    return this.createUnder(path, isFolder, parentDriveId);
  }

  /** Crée `path` (fichier ou dossier) sur Drive sous `parentDriveId`. Pour un dossier,
   *  crée aussi récursivement son contenu LOCAL (fichiers créés/déposés dedans). */
  private async createUnder(path: string, isFolder: boolean, parentDriveId: string): Promise<CreateResult> {
    if (isIgnored(path)) return 'skipped';
    const name = path.split('/').pop() as string;

    if (isFolder) {
      let id = await this.childId(parentDriveId, name, true);
      if (!id) id = (await this.opts.drive.createDriveFolder(parentDriveId, name)).id;
      await this.opts.index.set(path, FOLDER_ENTRY(id));
      // téléverse le contenu local du dossier (récursif)
      for (const child of this.opts.vault.listChildren(path)) {
        await this.createUnder(`${path}/${child.name}`, child.isFolder, id);
      }
      // marque le dossier « plein » → nouveaux fichiers dedans synchronisés automatiquement
      await this.opts.state.setFolderFull(path, [], [], true);
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
