import { describe, it, expect, vi } from 'vitest';
import { SyncScheduler, type SyncSchedulerOptions } from './sync-scheduler';
import type { PersistAdapter } from '../auth/token-store';

function ad() {
  const raw: Record<string, unknown> = {};
  const a: PersistAdapter = {
    async load() { return raw; },
    async save(d) { Object.keys(raw).forEach((k) => delete raw[k]); Object.assign(raw, d); },
  };
  return { a, raw };
}

/** Fabrique un scheduler avec des dépendances mockées ; renvoie aussi les mocks. */
function make(over: Partial<SyncSchedulerOptions> = {}) {
  type Changes = { changed: string[]; removed: string[]; newStartPageToken?: string; nextPageToken?: string };
  const drive = {
    getStartPageToken: vi.fn(async () => 'START'),
    listChanges: vi.fn(async (): Promise<Changes> => ({ changed: [], removed: [], newStartPageToken: 'NEXT' })),
  };
  const pull = { refreshFile: vi.fn(async () => 'pulled') };
  const push = { flushPending: vi.fn(async () => {}) };
  const entries: Record<string, { driveId: string; isFolder: boolean }> = {};
  const index = {
    paths: () => Object.keys(entries),
    get: (p: string) => entries[p],
  };
  const { a } = ad();
  const opts: SyncSchedulerOptions = {
    drive, index, pull, push, adapter: a, isOnline: () => true, ...over,
  };
  return { scheduler: new SyncScheduler(opts), drive, pull, push, entries, adapter: a };
}

describe('SyncScheduler', () => {
  it('hors-ligne : ne fait rien', async () => {
    const { scheduler, drive, push } = make({ isOnline: () => false });
    await scheduler.tick();
    expect(push.flushPending).not.toHaveBeenCalled();
    expect(drive.getStartPageToken).not.toHaveBeenCalled();
  });

  it('premier tick sans jeton : établit le point de référence, ne tire rien', async () => {
    const { scheduler, drive, pull, adapter } = make();
    await scheduler.load();
    await scheduler.tick();
    expect(drive.getStartPageToken).toHaveBeenCalledTimes(1);
    expect(drive.listChanges).not.toHaveBeenCalled();
    expect(pull.refreshFile).not.toHaveBeenCalled();
    expect((await adapter.load()).changesToken).toBe('START');
  });

  it('chaque tick re-pousse le livret (local → Drive)', async () => {
    const { scheduler, push } = make();
    await scheduler.load();
    await scheduler.tick();
    expect(push.flushPending).toHaveBeenCalledTimes(1);
  });

  it('tire uniquement nos fichiers synchronisés parmi les changements distants', async () => {
    const { scheduler, drive, pull, entries, adapter } = make();
    entries['dir/a.md'] = { driveId: 'DRIVE_A', isFolder: false };
    entries['dir'] = { driveId: 'DRIVE_DIR', isFolder: true }; // dossier : ignoré
    // jeton déjà présent → on passe directement à listChanges
    (await adapter.load()).changesToken = 'CUR';
    await scheduler.load();
    drive.listChanges.mockResolvedValueOnce({ changed: ['DRIVE_A', 'DRIVE_INCONNU'], removed: [], newStartPageToken: 'NEXT' });
    await scheduler.tick();
    expect(drive.listChanges).toHaveBeenCalledWith('CUR');
    expect(pull.refreshFile).toHaveBeenCalledTimes(1);
    expect(pull.refreshFile).toHaveBeenCalledWith('dir/a.md'); // DRIVE_INCONNU non synchronisé → ignoré
    expect((await adapter.load()).changesToken).toBe('NEXT'); // jeton avancé
  });

  it('pagine via nextPageToken puis garde le newStartPageToken final', async () => {
    const { scheduler, drive, pull, entries, adapter } = make();
    entries['a.md'] = { driveId: 'D1', isFolder: false };
    entries['b.md'] = { driveId: 'D2', isFolder: false };
    (await adapter.load()).changesToken = 'P1';
    await scheduler.load();
    drive.listChanges
      .mockResolvedValueOnce({ changed: ['D1'], removed: [], nextPageToken: 'P2' })
      .mockResolvedValueOnce({ changed: ['D2'], removed: [], newStartPageToken: 'FINAL' });
    await scheduler.tick();
    expect(drive.listChanges).toHaveBeenNthCalledWith(1, 'P1');
    expect(drive.listChanges).toHaveBeenNthCalledWith(2, 'P2');
    expect(pull.refreshFile).toHaveBeenCalledTimes(2);
    expect((await adapter.load()).changesToken).toBe('FINAL');
  });

  it('deux ticks concurrents : le second est ignoré (pas de chevauchement)', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const { scheduler, push } = make();
    (push.flushPending as ReturnType<typeof vi.fn>).mockImplementation(async () => { await gate; });
    await scheduler.load();
    const t1 = scheduler.tick();
    const t2 = scheduler.tick(); // doit sortir immédiatement (running)
    await t2;
    expect(push.flushPending).toHaveBeenCalledTimes(1);
    release();
    await t1;
  });

  it('une erreur en plein tick est capturée (onError), ne casse pas la minuterie', async () => {
    const errors: unknown[] = [];
    const { scheduler, push } = make({ onError: (e) => errors.push(e) });
    (push.flushPending as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline mid-tick'));
    await scheduler.load();
    await expect(scheduler.tick()).resolves.toBeUndefined();
    expect(errors.length).toBe(1);
  });
});
