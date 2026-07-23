import { App, Modal, setIcon } from 'obsidian';
import { DriveClient, isFolder, type DriveMeta } from '../drive/drive-client';
import { isIgnored } from '../mirror/tree-mirror';
import type { WorkingRoot } from './working-root';
import { t } from '../i18n';

interface Crumb {
  id: string;
  name: string;
}

/** Message d'erreur convivial pour la modale, selon la nature de l'échec :
 *  non connecté (auth) vs hors-ligne (réseau) vs erreur inattendue. `online` = navigator.onLine. */
export function friendlyPickerError(err: unknown, online: boolean): string {
  const s = String(err);
  if (s.includes('NEED_INTERACTIVE_AUTH')) return t('picker.notConnected');
  if (!online || /ERR_INTERNET|ERR_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|Failed to fetch|NetworkError/i.test(s)) {
    return t('picker.offline');
  }
  return t('picker.error', { error: s });
}

/** Explorateur de dossiers en fenêtre modale : navigue le Drive (dossiers uniquement,
 *  chargement paresseux) et permet de choisir le dossier de travail. `onPick` reçoit le
 *  dossier choisi, ou `null` pour revenir à la racine réelle du Drive. */
export class FolderPickerModal extends Modal {
  private stack: Crumb[] = [{ id: 'root', name: t('picker.driveRoot') }];
  private listEl!: HTMLElement;
  private crumbEl!: HTMLElement;

  constructor(
    app: App,
    private drive: DriveClient,
    private onPick: (root: WorkingRoot | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass('gdrive-fod-picker');
    this.titleEl.setText(t('picker.title'));
    this.crumbEl = this.contentEl.createDiv({ cls: 'gdrive-fod-picker-crumbs' });
    this.listEl = this.contentEl.createDiv({ cls: 'gdrive-fod-picker-list' });

    const footer = this.contentEl.createDiv({ cls: 'gdrive-fod-picker-footer' });
    const chooseBtn = footer.createEl('button', { text: t('picker.chooseThisFolder'), cls: 'mod-cta' });
    chooseBtn.onclick = () => this.choose();
    const cancelBtn = footer.createEl('button', { text: t('picker.cancel') });
    cancelBtn.onclick = () => this.close();

    void this.renderLevel();
  }

  private get here(): Crumb {
    return this.stack[this.stack.length - 1];
  }

  private choose(): void {
    const here = this.here;
    // à la racine du Drive → pas de dossier de travail (null) ; sinon le dossier courant.
    this.onPick(here.id === 'root' ? null : { id: here.id, name: here.name });
    this.close();
  }

  private renderCrumbs(): void {
    this.crumbEl.empty();
    this.stack.forEach((c, i) => {
      if (i > 0) this.crumbEl.createSpan({ text: ' › ', cls: 'gdrive-fod-picker-sep' });
      const seg = this.crumbEl.createSpan({ text: c.name, cls: 'gdrive-fod-picker-crumb' });
      if (i < this.stack.length - 1) {
        seg.addClass('is-clickable');
        seg.onclick = () => {
          this.stack = this.stack.slice(0, i + 1);
          void this.renderLevel();
        };
      }
    });
  }

  private async renderLevel(): Promise<void> {
    this.renderCrumbs();
    this.listEl.empty();
    this.listEl.createDiv({ cls: 'gdrive-fod-picker-loading', text: t('picker.loading') });
    let folders: DriveMeta[];
    try {
      const kids = await this.drive.children(this.here.id);
      folders = kids
        .filter((k) => isFolder(k.mimeType) && !isIgnored(k.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    } catch (e) {
      this.listEl.empty();
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      this.listEl.createDiv({ cls: 'gdrive-fod-picker-empty', text: friendlyPickerError(e, online) });
      return;
    }
    this.listEl.empty();
    if (folders.length === 0) {
      this.listEl.createDiv({ cls: 'gdrive-fod-picker-empty', text: t('picker.noSubfolder') });
      return;
    }
    for (const f of folders) {
      const row = this.listEl.createDiv({ cls: 'gdrive-fod-picker-row' });
      const icon = row.createSpan({ cls: 'gdrive-fod-picker-icon' });
      setIcon(icon, 'folder');
      row.createSpan({ text: f.name, cls: 'gdrive-fod-picker-name' });
      const chevron = row.createSpan({ cls: 'gdrive-fod-picker-chevron' });
      setIcon(chevron, 'chevron-right');
      // taper une ligne = descendre dans le dossier (navigation)
      row.onclick = () => {
        this.stack.push({ id: f.id, name: f.name });
        void this.renderLevel();
      };
    }
  }
}
