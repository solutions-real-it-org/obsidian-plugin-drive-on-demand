import { describe, it, expect, vi } from 'vitest';
import { Hydrator } from './hydrator';
import { MirrorIndex, type MirrorEntry } from './mirror-index';
import type { VaultOps } from './tree-mirror';
import type { PersistAdapter } from '../auth/token-store';
import { DriveClient } from '../drive/drive-client';
import type { HttpFn, HttpResponse } from '../http';

function idx() {
  const raw: Record<string, unknown> = {};
  const adapter: PersistAdapter = { async load() { return raw; }, async save(d) { Object.assign(raw, d); } };
  return new MirrorIndex(adapter);
}
function fakeVault() {
  const written: Record<string, string> = {};
  const vault: VaultOps = {
    exists: async () => true, createFolder: async () => {}, createStub: async () => {},
    writeText: async (p, d) => { written[p] = d; }, writeBinary: async () => {}, readText: async () => '',
    readBinary: async () => new ArrayBuffer(0),
    remove: async () => {},
    isEmptyFolder: () => false,
    rename: async () => {}, listChildren: () => [],
  };
  return { vault, written };
}
const entry = (o: Partial<MirrorEntry>): MirrorEntry => ({
  driveId: 'D', mimeType: 'text/markdown', isFolder: false, hydrated: false, pinned: false, ...o,
});
function driveReturning(text: string): DriveClient {
  const res: HttpResponse = { status: 200, text, json: <T>() => JSON.parse(text) as T };
  const http = vi.fn(async () => res) as unknown as HttpFn;
  return new DriveClient(http, async () => 'AT');
}

describe('Hydrator.hydrate', () => {
  it('télécharge le texte, écrit le fichier, marque hydraté', async () => {
    const index = idx(); await index.load();
    await index.set('n.md', entry({ driveId: 'D1' }));
    const { vault, written } = fakeVault();
    const h = new Hydrator(vault, index, driveReturning('# contenu'));
    expect(await h.hydrate('n.md')).toBe('hydrated');
    expect(written['n.md']).toBe('# contenu');
    expect(index.get('n.md')?.hydrated).toBe(true);
  });

  it('renvoie already si déjà hydraté', async () => {
    const index = idx(); await index.load();
    await index.set('n.md', entry({ hydrated: true }));
    const { vault } = fakeVault();
    expect(await new Hydrator(vault, index, driveReturning('x')).hydrate('n.md')).toBe('already');
  });

  it('classe folder / google-native / not-mirrored', async () => {
    const index = idx(); await index.load();
    await index.set('dir', entry({ isFolder: true, hydrated: true }));
    await index.set('doc', entry({ mimeType: 'application/vnd.google-apps.document' }));
    const { vault } = fakeVault();
    const h = new Hydrator(vault, index, driveReturning('x'));
    expect(await h.hydrate('dir')).toBe('folder');
    expect(await h.hydrate('doc')).toBe('google-native');
    expect(await h.hydrate('inconnu')).toBe('not-mirrored');
  });

  it('hydrate un fichier binaire via readBinary/writeBinary (pas readText)', async () => {
    const index = idx(); await index.load();
    await index.set('img.png', entry({ mimeType: 'image/png' }));
    const { vault } = fakeVault();
    const writeBinarySpy = vi.spyOn(vault, 'writeBinary');
    const drive = driveReturning('ignoré pour ce test'); // DriveClient réel, readText non pertinent ici
    const buf = new Uint8Array([1, 2, 3]).buffer;
    vi.spyOn(drive, 'readBinary').mockResolvedValue(buf);
    const readTextSpy = vi.spyOn(drive, 'readText');
    const h = new Hydrator(vault, index, drive);
    expect(await h.hydrate('img.png')).toBe('hydrated');
    expect(writeBinarySpy).toHaveBeenCalledWith('img.png', buf);
    expect(index.get('img.png')?.hydrated).toBe(true);
    expect(readTextSpy).not.toHaveBeenCalled();
  });

  it('hydrate un .md avec un MIME générique (application/octet-stream) via extension', async () => {
    const index = idx(); await index.load();
    await index.set('note.md', entry({ driveId: 'D1', mimeType: 'application/octet-stream' }));
    const { vault, written } = fakeVault();
    const h = new Hydrator(vault, index, driveReturning('# contenu md'));
    expect(await h.hydrate('note.md')).toBe('hydrated');
    expect(written['note.md']).toBe('# contenu md');
  });

  it('pose syncedHash après hydratation', async () => {
    const index = idx(); await index.load();
    await index.set('n.md', entry({ driveId: 'D1' }));
    const { vault } = fakeVault();
    const h = new Hydrator(vault, index, driveReturning('# contenu'));
    await h.hydrate('n.md');
    expect(index.get('n.md')?.syncedHash).toBeTruthy();
  });
});
