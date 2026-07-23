import type { HttpFn } from './http';

const API = 'https://www.googleapis.com/drive/v3';

export interface DriveFile { id: string; name: string; mimeType: string }

/** Enfants directs de la racine ("root") du Drive de l'utilisateur. */
export async function listRootFiles(http: HttpFn, accessToken: string): Promise<DriveFile[]> {
  // encodeURIComponent ne pourcent-encode pas l'apostrophe (RFC3986 "unreserved"),
  // on la force manuellement pour un querystring propre.
  const q = encodeURIComponent(`'root' in parents and trashed=false`).replace(/'/g, '%27');
  const res = await http({
    url: `${API}/files?q=${q}&fields=files(id,name,mimeType)&pageSize=1000`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const j = res.json<{ files?: DriveFile[] }>();
  return j.files ?? [];
}
