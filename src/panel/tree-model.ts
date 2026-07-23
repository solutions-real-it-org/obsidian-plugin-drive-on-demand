import { DriveClient, isFolder, type DriveMeta } from '../drive/drive-client';
import { isIgnored } from '../mirror/tree-mirror';
import type { PersistAdapter } from '../auth/token-store';

export interface TreeNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  meta: DriveMeta;
}

/** Modèle de l'arbre Drive avec cache PERSISTANT (survit au redémarrage) et repli
 *  hors-ligne. Le cache stocke les métadonnées brutes (DriveMeta) par identifiant de
 *  dossier — indépendantes du chemin, donc valides quel que soit le dossier de travail ;
 *  les chemins sont recalculés à chaque `loadChildren` à partir de `parentPath`. */
export class DriveTreeModel {
  private cache = new Map<string, DriveMeta[]>();
  private stale = new Set<string>(); // dossiers à refetch (invalidés) sans perdre le cache offline
  private expanded = new Set<string>();
  private offline = false;

  constructor(
    private drive: DriveClient,
    private adapter?: PersistAdapter,
    private onStatus?: (offline: boolean) => void,
  ) {}

  /** Recharge le cache persisté (au démarrage). Sans adapter : no-op. */
  async load(): Promise<void> {
    if (!this.adapter) return;
    const d = await this.adapter.load();
    const folders = d.folders;
    if (folders && typeof folders === 'object' && !Array.isArray(folders)) {
      for (const [id, metas] of Object.entries(folders as Record<string, unknown>)) {
        if (Array.isArray(metas)) this.cache.set(id, metas as DriveMeta[]);
      }
    }
  }

  private async persist(): Promise<void> {
    if (!this.adapter) return;
    const folders: Record<string, DriveMeta[]> = {};
    for (const [id, metas] of this.cache) folders[id] = metas;
    const d = await this.adapter.load();
    d.folders = folders;
    await this.adapter.save({ ...d });
  }

  isOffline(): boolean {
    return this.offline;
  }

  private setOffline(v: boolean): void {
    if (this.offline !== v) {
      this.offline = v;
      this.onStatus?.(v);
    }
  }

  async loadChildren(folderId: string, parentPath: string): Promise<TreeNode[]> {
    const cached = this.cache.get(folderId);
    const needFetch = !cached || this.stale.has(folderId);
    if (needFetch) {
      try {
        const metas = await this.drive.children(folderId);
        this.cache.set(folderId, metas);
        this.stale.delete(folderId);
        this.setOffline(false);
        await this.persist();
        return this.buildNodes(metas, parentPath);
      } catch (e) {
        // Un problème d'AUTH (non connecté) n'est PAS du hors-ligne : on le laisse remonter.
        if (String(e).includes('NEED_INTERACTIVE_AUTH')) throw e;
        // Réseau/Drive injoignable : repli sur le cache si on en a un, sinon on remonte l'erreur.
        this.setOffline(true);
        if (cached) return this.buildNodes(cached, parentPath);
        throw e;
      }
    }
    return this.buildNodes(cached as DriveMeta[], parentPath);
  }

  private buildNodes(metas: DriveMeta[], parentPath: string): TreeNode[] {
    return metas
      .map((m) => ({
        id: m.id,
        name: m.name,
        path: parentPath ? `${parentPath}/${m.name}` : m.name,
        isFolder: isFolder(m.mimeType),
        meta: m,
      }))
      .filter((n) => !isIgnored(n.path))
      .sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
  }

  isExpanded(path: string): boolean {
    return this.expanded.has(path);
  }
  toggle(path: string): void {
    if (this.expanded.has(path)) this.expanded.delete(path);
    else this.expanded.add(path);
  }

  /** Force un refetch au prochain loadChildren SANS jeter le cache (préservé pour le
   *  repli hors-ligne si le refetch échoue). */
  invalidate(folderId: string): void {
    this.stale.add(folderId);
  }
}
