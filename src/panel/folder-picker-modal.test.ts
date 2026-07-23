import { describe, it, expect } from 'vitest';
import { friendlyPickerError } from './folder-picker-modal';
import { t } from '../i18n';

// On compare aux sorties de t() (indépendant de la langue résolue en test).
describe('friendlyPickerError', () => {
  it('problème d auth → message « non connecté » (pas « hors ligne »)', () => {
    expect(friendlyPickerError(new Error('NEED_INTERACTIVE_AUTH'), true)).toBe(t('picker.notConnected'));
  });

  it('erreur réseau (ERR_INTERNET_DISCONNECTED) → message hors-ligne friendly, jamais l erreur brute', () => {
    const msg = friendlyPickerError(new Error('net::ERR_INTERNET_DISCONNECTED'), true);
    expect(msg).toBe(t('picker.offline'));
    expect(msg).not.toContain('ERR_INTERNET_DISCONNECTED');
  });

  it('navigator hors-ligne → message hors-ligne même si l erreur est vague', () => {
    expect(friendlyPickerError(new Error('boom'), false)).toBe(t('picker.offline'));
  });

  it('erreur inattendue en ligne → message générique avec le détail', () => {
    const msg = friendlyPickerError(new Error('Drive children 500'), true);
    expect(msg).toBe(t('picker.error', { error: 'Error: Drive children 500' }));
    expect(msg).toContain('500');
  });
});
