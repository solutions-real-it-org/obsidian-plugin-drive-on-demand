// Stub minimal du module 'obsidian' pour les tests unitaires (le vrai module n'est
// disponible qu'à l'exécution dans Obsidian). Aliasé via vitest.config.ts. On n'expose
// que ce dont les fichiers sous test ont besoin ; les instances servent aux `instanceof`.
export class TFile {
  path: string;
  constructor(path = '') { this.path = path; }
}
export class TFolder {
  path: string;
  children: unknown[] = [];
  constructor(path = '') { this.path = path; }
}
export class Vault {}
export function normalizePath(p: string): string {
  return p;
}
export function setIcon(_el: unknown, _icon: string): void {
  // no-op en test
}
export class App {}
export class WorkspaceLeaf {}
export class Notice {
  constructor(_msg?: string) {}
}
export class Component {
  registerDomEvent(): void {}
  registerEvent(): void {}
  register(): void {}
}
export class ItemView extends Component {
  constructor(_leaf?: unknown) { super(); }
}
export class Modal {
  contentEl = { createEl() { return {}; }, createDiv() { return {}; }, empty() {} };
  titleEl = { setText() {} };
  modalEl = { addClass() {} };
  constructor(_app?: unknown) {}
  open(): void {}
  close(): void {}
  onClose(): void {}
}
