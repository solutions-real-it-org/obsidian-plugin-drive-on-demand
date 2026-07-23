import type { HttpFn } from '../http';
import type { TokenStore } from './token-store';

interface RefreshResponse { access_token: string; expires_in: number }

export interface DriveAuthOptions {
  http: HttpFn;
  store: TokenStore;
  brokerBase: string;
}

/** Fournit un access token Google valide. Le refresh (et donc le client_secret)
 *  est délégué au broker srv0 : le plugin n'échange jamais directement avec Google. */
export class ObsidianDriveAuth {
  private cached: { value: string; exp: number } | null = null;

  constructor(private opts: DriveAuthOptions) {}

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cached && this.cached.exp - 60_000 > now) return this.cached.value;

    const refresh = await this.opts.store.getRefresh();
    if (!refresh) throw new Error('NEED_INTERACTIVE_AUTH');

    const res = await this.opts.http({
      url: `${this.opts.brokerBase}/refresh`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (res.status !== 200) {
      // Refresh invalide/révoqué → on force une nouvelle auth interactive.
      await this.opts.store.clear();
      this.cached = null;
      throw new Error('NEED_INTERACTIVE_AUTH');
    }
    const j = res.json<RefreshResponse>();
    this.cached = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
    return j.access_token;
  }

  async setRefreshFromClaim(refreshToken: string): Promise<void> {
    await this.opts.store.setRefresh(refreshToken);
    this.cached = null;
  }
}
