export interface ConsentUrlOptions {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
}

/** URL du consentement OAuth Google. `access_type=offline` + `prompt=consent`
 *  garantissent l'émission d'un refresh_token. */
export function buildConsentUrl(opts: ConsentUrlOptions): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: opts.scope,
    state: opts.state,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
