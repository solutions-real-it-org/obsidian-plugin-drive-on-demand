import { describe, it, expect, vi } from 'vitest';
import { CreateManager } from './create-manager';
import { MirrorIndex, type MirrorEntry } from '../mirror/mirror-index';
import { SelectiveSyncState } from './selective-sync-state';
import { DriveClient } from '../drive/drive-client';
import type { VaultOps } from '../mirror/tree-mirror';
import type { PersistAdapter } from '../auth/token-store';
import type { HttpFn, HttpResponse } from '../http';

function ad() { const raw: Record<string, unknown> = {}; const a: PersistAdapter = { async load() { return raw; }, async save(d) { Object.keys(raw).forEach((k) => delete raw[k]); Object.assign(raw, d); } }; return a; }
function driveObj() {
  const http = vi.fn(async () => ({ status: 200, text: '{}', json: <T>() => ({}) as T }) as HttpResponse) as unknown as HttpFn;
  return new DriveClient(http, async () => 'AT');
}
function vaultObj(local = 'contenu') {
  const vault: VaultOps = { exists: async () => true, createFolder: async () => {}, createStub: async () => {}, writeText: async () => {}, writeBinary: async () => {}, readText: async () => local, readBinary: async () => new ArrayBuffer(0), remove: async () => {}, isEmptyFolder: () => false };
  return vault;
}
const folderEntry = (driveId: string): MirrorEntry => ({ driveId, mimeType: 'application/vnd.google-apps.folder', isFolder: true, hydrated: true, pinned: true });

describe('CreateManager.handleCreate', () => {
  it('crée sur Drive un fichier créé sous un dossier synchronisé', async () => {
    const index = new MirrorIndex(ad()); await index.load();
    await index.set('dir', folderEntry('DIR_DRIVE'));
    const state = new SelectiveSyncState(ad()); await state.load();
    const drive = driveObj();
    vi.spyOn(drive, 'createFile').mockResolvedValue({ id: 'NEWFILE', headRevisionId: 'r1' });
    const cm = new CreateManager({ index, drive, vault: vaultObj('# hello'), state });
    expect(await cm.handleCreate('dir/note.md', false)).toBe('created');
    expect(drive.createFile).toHaveBeenCalledWith('DIR_DRIVE', 'note.md', '# hello');
    expect(index.get('dir/note.md')?.driveId).toBe('NEWFILE');
    expect(state.fileState('dir/note.md')).toBe('checked');
  });

  it('skip un fichier hors zone synchronisée', async () => {
    const index = new MirrorIndex(ad()); await index.load();
    const state = new SelectiveSyncState(ad()); await state.load();
    const drive = driveObj(); const spy = vi.spyOn(drive, 'createFile');
    const cm = new CreateManager({ index, drive, vault: vaultObj(), state });
    expect(await cm.handleCreate('ailleurs/note.md', false)).toBe('skipped');
    expect(spy).not.toHaveBeenCalled();
  });

  it('skip ce que le plugin vient de créer (suppression)', async () => {
    const index = new MirrorIndex(ad()); await index.load();
    await index.set('dir', folderEntry('DIR_DRIVE'));
    const state = new SelectiveSyncState(ad()); await state.load();
    const drive = driveObj(); const spy = vi.spyOn(drive, 'createFile');
    const cm = new CreateManager({ index, drive, vault: vaultObj(), state, wasPluginCreated: (p) => p === 'dir/note.md' });
    expect(await cm.handleCreate('dir/note.md', false)).toBe('skipped');
    expect(spy).not.toHaveBeenCalled();
  });

  it('crée les dossiers Drive intermédiaires manquants', async () => {
    const index = new MirrorIndex(ad()); await index.load();
    await index.set('dir', folderEntry('DIR_DRIVE'));
    const state = new SelectiveSyncState(ad()); await state.load();
    const drive = driveObj();
    vi.spyOn(drive, 'createDriveFolder').mockResolvedValue({ id: 'SUB_DRIVE' });
    vi.spyOn(drive, 'createFile').mockResolvedValue({ id: 'NEWFILE', headRevisionId: 'r1' });
    const cm = new CreateManager({ index, drive, vault: vaultObj('x'), state });
    // 'dir/nuovo/note.md' : 'dir' est tracké, 'dir/nuovo' manquant
    expect(await cm.handleCreate('dir/nuovo/note.md', false)).toBe('created');
    expect(drive.createDriveFolder).toHaveBeenCalledWith('DIR_DRIVE', 'nuovo');
    expect(drive.createFile).toHaveBeenCalledWith('SUB_DRIVE', 'note.md', 'x');
    expect(index.get('dir/nuovo')?.driveId).toBe('SUB_DRIVE');
  });

  it('crée un DOSSIER sur Drive quand on crée un dossier sous une zone synchronisée', async () => {
    const index = new MirrorIndex(ad()); await index.load();
    await index.set('dir', folderEntry('DIR_DRIVE'));
    const state = new SelectiveSyncState(ad()); await state.load();
    const drive = driveObj();
    vi.spyOn(drive, 'createDriveFolder').mockResolvedValue({ id: 'NEWDIR' });
    const cm = new CreateManager({ index, drive, vault: vaultObj(), state });
    expect(await cm.handleCreate('dir/nouveau', true)).toBe('created');
    expect(drive.createDriveFolder).toHaveBeenCalledWith('DIR_DRIVE', 'nouveau');
    expect(index.get('dir/nouveau')?.driveId).toBe('NEWDIR');
    expect(index.get('dir/nouveau')?.isFolder).toBe(true);
  });

  it('skip un chemin déjà indexé', async () => {
    const index = new MirrorIndex(ad()); await index.load();
    await index.set('dir', folderEntry('DIR_DRIVE'));
    await index.set('dir/note.md', { driveId: 'X', mimeType: 'text/markdown', isFolder: false, hydrated: true, pinned: true });
    const state = new SelectiveSyncState(ad()); await state.load();
    const drive = driveObj();
    const spy = vi.spyOn(drive, 'createFile');
    const cm = new CreateManager({ index, drive, vault: vaultObj(), state });
    expect(await cm.handleCreate('dir/note.md', false)).toBe('skipped');
    expect(spy).not.toHaveBeenCalled();
  });

  it('crée un fichier BINAIRE sur Drive quand on crée une image sous une zone synchronisée', async () => {
    const index = new MirrorIndex(ad()); await index.load();
    await index.set('dir', folderEntry('DIR_DRIVE'));
    const state = new SelectiveSyncState(ad()); await state.load();
    const drive = driveObj();
    const buf = new Uint8Array([1, 2, 3]).buffer;
    const vault = vaultObj();
    vi.spyOn(vault, 'readBinary').mockResolvedValue(buf);
    vi.spyOn(drive, 'createBinaryFile').mockResolvedValue({ id: 'NEWIMG', headRevisionId: 'r1' });
    const cm = new CreateManager({ index, drive, vault, state });
    expect(await cm.handleCreate('dir/photo.png', false)).toBe('created');
    expect(drive.createBinaryFile).toHaveBeenCalledWith('DIR_DRIVE', 'photo.png', buf, 'image/png');
    expect(index.get('dir/photo.png')?.driveId).toBe('NEWIMG');
    expect(index.get('dir/photo.png')?.mimeType).toBe('image/png');
    expect(state.fileState('dir/photo.png')).toBe('checked');
  });

  it('réutilise un dossier Drive existant au lieu d en créer un doublon', async () => {
    const index = new MirrorIndex(ad()); await index.load();
    await index.set('dir', folderEntry('DIR_DRIVE'));
    const state = new SelectiveSyncState(ad()); await state.load();
    const drive = driveObj();
    vi.spyOn(drive, 'children').mockResolvedValue([{ id: 'EXISTING_SUB', name: 'sub', mimeType: 'application/vnd.google-apps.folder', modifiedTime: 't' }]);
    const createSpy = vi.spyOn(drive, 'createDriveFolder');
    const cm = new CreateManager({ index, drive, vault: vaultObj(), state });
    expect(await cm.handleCreate('dir/sub', true)).toBe('created');
    expect(createSpy).not.toHaveBeenCalled();
    expect(index.get('dir/sub')?.driveId).toBe('EXISTING_SUB');
  });
});
