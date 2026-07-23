import type { VaultOps } from './tree-mirror';
import type { MirrorIndex } from './mirror-index';
import { DriveClient, isGoogleNative } from '../drive/drive-client';
import { hashContent } from '../util/content-hash';

export type HydrateResult =
  | 'hydrated' | 'already' | 'not-mirrored' | 'folder' | 'google-native';

const TEXT_EXT = new Set(['md', 'markdown', 'txt', 'csv', 'json', 'xml', 'yaml', 'yml', 'html', 'css', 'js', 'ts', 'org', 'tex']);
export function isText(mime: string, path: string): boolean {
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml') return true;
  const dot = path.lastIndexOf('.');
  const ext = dot >= 0 ? path.slice(dot + 1).toLowerCase() : '';
  return TEXT_EXT.has(ext);
}

export class Hydrator {
  constructor(
    private vault: VaultOps,
    private index: MirrorIndex,
    private drive: DriveClient,
  ) {}

  async hydrate(path: string): Promise<HydrateResult> {
    const e = this.index.get(path);
    if (!e) return 'not-mirrored';
    if (e.isFolder) return 'folder';
    if (e.hydrated) return 'already';
    if (isGoogleNative(e.mimeType)) return 'google-native';

    if (isText(e.mimeType, path)) {
      const content = await this.drive.readText(e.driveId);
      await this.vault.writeText(path, content);
      await this.index.setSyncedHash(path, hashContent(content));
    } else {
      // binaire (PDF, image, etc.) : téléchargé tel quel, jamais poussé en retour
      // (pas d'édition binaire depuis Obsidian) — donc pas de syncedHash à poser.
      const buffer = await this.drive.readBinary(e.driveId);
      await this.vault.writeBinary(path, buffer);
    }
    await this.index.markHydrated(path);
    return 'hydrated';
  }
}
