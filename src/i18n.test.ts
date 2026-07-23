import { describe, it, expect, afterEach } from 'vitest';
import { detectLang, setLang, getLang, t } from './i18n';

describe('detectLang', () => {
  it('retombe sur anglais sans window/navigator (environnement Node)', () => {
    expect(detectLang()).toBe('en');
  });
});

describe('setLang / getLang / t', () => {
  afterEach(() => setLang('fr'));

  it('bascule effectivement de dictionnaire', () => {
    setLang('fr');
    expect(t('panel.refreshButton')).toBe('Rafraîchir');
    setLang('en');
    expect(t('panel.refreshButton')).toBe('Refresh');
  });

  it('interpole les paramètres', () => {
    setLang('fr');
    expect(t('main.genericError', { error: 'boom' })).toBe('Erreur : boom');
    setLang('en');
    expect(t('main.genericError', { error: 'boom' })).toBe('Error: boom');
  });

  it('interpole plusieurs paramètres', () => {
    setLang('en');
    expect(t('main.refreshSummary', { pulled: 3, conflicts: 0 })).toBe('Refreshed: 3 updated, 0 conflict(s).');
  });

  it('retombe sur la clé si absente du dictionnaire', () => {
    expect(t('cle.inexistante')).toBe('cle.inexistante');
  });

  it('getLang reflète setLang', () => {
    setLang('en');
    expect(getLang()).toBe('en');
  });

  it('traduit le résumé des échecs de synchronisation', () => {
    setLang('fr');
    expect(t('panel.someFilesFailed', { count: 2 })).toContain('2 fichier');
    setLang('en');
    expect(t('panel.someFilesFailed', { count: 2 })).toContain('2 file');
  });
});
