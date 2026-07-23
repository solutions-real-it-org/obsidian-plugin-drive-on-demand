import { describe, it, expect, vi } from 'vitest';
import { ObsidianDriveAuth } from './drive-auth';
import { TokenStore, type PersistAdapter } from './token-store';
import type { HttpFn, HttpResponse } from '../http';

function memoryStore(refresh?: string): TokenStore {
  const raw: Record<string, unknown> = {};
  const adapter: PersistAdapter = {
    async load() { return raw; },
    async save(d) { Object.assign(raw, d); },
  };
  const store = new TokenStore(adapter);
  if (refresh) void store.setRefresh(refresh);
  return store;
}

function jsonResponse(status: number, body: unknown): HttpResponse {
  const text = JSON.stringify(body);
  return { status, text, json: <T>() => JSON.parse(text) as T };
}

describe('ObsidianDriveAuth', () => {
  it('throw NEED_INTERACTIVE_AUTH sans refresh token', async () => {
    const auth = new ObsidianDriveAuth({
      http: vi.fn() as unknown as HttpFn,
      store: memoryStore(),
      brokerBase: 'https://broker',
    });
    await expect(auth.getAccessToken()).rejects.toThrow('NEED_INTERACTIVE_AUTH');
  });

  it('échange le refresh token contre un access token via le broker', async () => {
    const store = memoryStore();
    await store.setRefresh('1//rt');
    const http = vi.fn(async () => jsonResponse(200, { access_token: 'AT', expires_in: 3599 })) as unknown as HttpFn;
    const auth = new ObsidianDriveAuth({ http, store, brokerBase: 'https://broker' });

    const token = await auth.getAccessToken();
    expect(token).toBe('AT');
    expect(http).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://broker/refresh',
      method: 'POST',
      body: JSON.stringify({ refresh_token: '1//rt' }),
    }));
  });

  it('met en cache l access token et ne rappelle pas le broker avant expiration', async () => {
    const store = memoryStore();
    await store.setRefresh('1//rt');
    const http = vi.fn(async () => jsonResponse(200, { access_token: 'AT', expires_in: 3599 })) as unknown as HttpFn;
    const auth = new ObsidianDriveAuth({ http, store, brokerBase: 'https://broker' });

    await auth.getAccessToken();
    await auth.getAccessToken();
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('clear le refresh et throw NEED_INTERACTIVE_AUTH si le broker répond non-200', async () => {
    const store = memoryStore();
    await store.setRefresh('1//rt');
    const http = vi.fn(async () => jsonResponse(500, { error: 'boom' })) as unknown as HttpFn;
    const auth = new ObsidianDriveAuth({ http, store, brokerBase: 'https://broker' });

    await expect(auth.getAccessToken()).rejects.toThrow('NEED_INTERACTIVE_AUTH');
    expect(await store.getRefresh()).toBeNull();
    // un second appel throw encore (cache bien réinitialisé, pas de token résiduel)
    await expect(auth.getAccessToken()).rejects.toThrow('NEED_INTERACTIVE_AUTH');
  });

  it('setRefreshFromClaim persiste le token', async () => {
    const store = memoryStore();
    const auth = new ObsidianDriveAuth({ http: vi.fn() as unknown as HttpFn, store, brokerBase: 'https://broker' });
    await auth.setRefreshFromClaim('1//claimed');
    expect(await store.getRefresh()).toBe('1//claimed');
  });
});
