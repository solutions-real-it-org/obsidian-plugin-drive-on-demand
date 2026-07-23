import { describe, it, expect } from 'vitest';
import { googleNativeUrl, googleNativeLabel } from './sync-engine';

describe('googleNativeUrl', () => {
  it('construit les URLs Docs/Sheets/Slides correctement', () => {
    expect(googleNativeUrl('ID1', 'application/vnd.google-apps.document')).toBe('https://docs.google.com/document/d/ID1/edit');
    expect(googleNativeUrl('ID2', 'application/vnd.google-apps.spreadsheet')).toBe('https://docs.google.com/spreadsheets/d/ID2/edit');
    expect(googleNativeUrl('ID3', 'application/vnd.google-apps.presentation')).toBe('https://docs.google.com/presentation/d/ID3/edit');
  });
  it('retombe sur le lien Drive générique pour un type inconnu', () => {
    expect(googleNativeUrl('ID4', 'application/vnd.google-apps.form')).toBe('https://drive.google.com/open?id=ID4');
  });
});

describe('googleNativeLabel', () => {
  it('donne un libellé lisible par type', () => {
    expect(googleNativeLabel('application/vnd.google-apps.document')).toBe('Google Docs');
    expect(googleNativeLabel('application/vnd.google-apps.spreadsheet')).toBe('Google Sheets');
  });
});
