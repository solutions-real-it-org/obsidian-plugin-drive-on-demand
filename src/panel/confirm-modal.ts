import { App, Modal } from 'obsidian';
import { t } from '../i18n';

/** Petite modale de confirmation (oui/non). Préférée à window.confirm, qui est peu
 *  fiable sur mobile (iOS/Capacitor) — cible principale de ce plugin. Résout `true`
 *  si l'utilisateur confirme, `false` sinon (annulation ou fermeture). */
export function confirmModal(app: App, message: string, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    let decided = false;
    const modal = new Modal(app);
    modal.contentEl.createEl('p', { text: message });
    const footer = modal.contentEl.createDiv({ cls: 'gdrive-fod-picker-footer' });
    const yes = footer.createEl('button', { text: confirmLabel, cls: 'mod-warning' });
    yes.onclick = () => { decided = true; resolve(true); modal.close(); };
    const no = footer.createEl('button', { text: t('picker.cancel') });
    no.onclick = () => { decided = true; resolve(false); modal.close(); };
    modal.onClose = () => { if (!decided) resolve(false); };
    modal.open();
  });
}
