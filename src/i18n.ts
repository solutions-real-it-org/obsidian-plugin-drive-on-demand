export type Lang = 'fr' | 'en';

function readObsidianLanguage(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('language');
    }
  } catch {
    /* environnement sans accès à window/localStorage (ex. tests) */
  }
  return null;
}

function readBrowserLanguage(): string | null {
  try {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language;
    }
  } catch {
    /* environnement sans window/navigator (ex. tests Node) */
  }
  return null;
}

/** Langue d'Obsidian (réglages > Général > Langue), repli navigateur, puis anglais par défaut. */
export function detectLang(): Lang {
  const raw = readObsidianLanguage() ?? readBrowserLanguage() ?? 'en';
  return raw.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

let currentLang: Lang = detectLang();

export function setLang(lang: Lang): void {
  currentLang = lang;
}

export function getLang(): Lang {
  return currentLang;
}

type Dict = Record<string, string>;

const FR: Dict = {
  'cmd.openPanel': "Drive on Demand : ouvrir le panneau Drive",
  'cmd.connect': "Drive on Demand : connecter mon compte",
  'cmd.listRoot': "Drive on Demand : lister la racine (console)",
  'cmd.refreshSynced': "Drive on Demand : rafraîchir les fichiers synchronisés",
  'ribbon.googleDrive': "Drive on Demand",
  'panel.title': "Drive on Demand",
  'panel.refreshButton': "Rafraîchir",
  'panel.notConnected': "Non connecté — lance « connecter mon compte ».",
  'panel.error': "Erreur : {error}",
  'panel.cancelAria': "Annuler",
  'panel.errorSync': "Erreur sync : {error}",
  'panel.someFilesFailed': "{count} fichier(s) n'ont pas pu être synchronisé(s) — réessaie plus tard.",
  'panel.pickFolderAria': "Choisir le dossier de travail",
  'panel.uploadAria': "Téléverser vers Drive",
  'status.online': "En ligne",
  'status.offline': "Hors ligne",
  'status.syncing': "Synchronisation…",
  'panel.workingRootChanged': "Dossier de travail : {name}",
  'panel.workingRootReset': "Dossier de travail : racine du Drive",
  'picker.title': "Choisir le dossier de travail",
  'picker.driveRoot': "Racine du Drive",
  'picker.chooseThisFolder': "Choisir ce dossier",
  'picker.cancel': "Annuler",
  'picker.loading': "Chargement…",
  'picker.noSubfolder': "Aucun sous-dossier ici.",
  'picker.error': "Erreur : {error}",
  'picker.offline': "Hors ligne — impossible de parcourir les dossiers pour l'instant. Reconnecte-toi à Internet et réessaie.",
  'picker.notConnected': "Non connecté — lance « connecter mon compte » d'abord.",
  'picker.switchConfirm': "{count} fichier(s) synchronisé(s) depuis le dossier actuel seront retirés du vault (ils restent sur Drive). Changer de dossier de travail ?",
  'main.conflict': "Conflit sur « {path} » — version distante gardée dans « {conflictPath} »",
  'main.pushError': "Échec sync « {path} » : {error}",
  'main.createError': "Erreur création Drive : {error}",
  'main.authCancelled': "Connexion Google annulée : {error}",
  'main.invalidCallback': "Callback OAuth invalide (state).",
  'main.tokenFetchFailed': "Échec récupération du token.",
  'main.claimError': "Erreur claim : {error}",
  'main.rootListed': "Racine Drive : {count} éléments (voir console)",
  'main.notConnectedFirst': "Non connecté — lance « connecter mon compte » d’abord.",
  'main.genericError': "Erreur : {error}",
  'main.refreshSummary': "Rafraîchi : {pulled} mis à jour, {conflicts} conflit(s).",
  'main.refreshError': "Erreur refresh : {error}",
  'main.googleNative': "Fichier Google natif (Docs/Sheets/Slides) — ouvrez la note-lien .md pour y accéder.",
  'main.hydrationError': "Erreur hydratation : {error}",
};

const EN: Dict = {
  'cmd.openPanel': "Drive on Demand: open Drive panel",
  'cmd.connect': "Drive on Demand: connect my account",
  'cmd.listRoot': "Drive on Demand: list root (console)",
  'cmd.refreshSynced': "Drive on Demand: refresh synced files",
  'ribbon.googleDrive': "Drive on Demand",
  'panel.title': "Drive on Demand",
  'panel.refreshButton': "Refresh",
  'panel.notConnected': 'Not connected — run "connect my account" first.',
  'panel.error': "Error: {error}",
  'panel.cancelAria': "Cancel",
  'panel.errorSync': "Sync error: {error}",
  'panel.someFilesFailed': "{count} file(s) could not be synced — try again later.",
  'panel.pickFolderAria': "Choose working folder",
  'panel.uploadAria': "Upload to Drive",
  'status.online': "Online",
  'status.offline': "Offline",
  'status.syncing': "Syncing…",
  'panel.workingRootChanged': "Working folder: {name}",
  'panel.workingRootReset': "Working folder: Drive root",
  'picker.title': "Choose working folder",
  'picker.driveRoot': "Drive root",
  'picker.chooseThisFolder': "Choose this folder",
  'picker.cancel': "Cancel",
  'picker.loading': "Loading…",
  'picker.noSubfolder': "No subfolder here.",
  'picker.error': "Error: {error}",
  'picker.offline': "Offline — can't browse folders right now. Reconnect to the internet and try again.",
  'picker.notConnected': 'Not connected — run "connect my account" first.',
  'picker.switchConfirm': "{count} file(s) synced from the current folder will be removed from the vault (they remain on Drive). Change working folder?",
  'main.conflict': 'Conflict on "{path}" — remote version kept in "{conflictPath}"',
  'main.pushError': 'Sync failed "{path}": {error}',
  'main.createError': "Drive creation error: {error}",
  'main.authCancelled': "Google connection cancelled: {error}",
  'main.invalidCallback': "Invalid OAuth callback (state).",
  'main.tokenFetchFailed': "Failed to retrieve token.",
  'main.claimError': "Claim error: {error}",
  'main.rootListed': "Drive root: {count} items (see console)",
  'main.notConnectedFirst': 'Not connected — run "connect my account" first.',
  'main.genericError': "Error: {error}",
  'main.refreshSummary': "Refreshed: {pulled} updated, {conflicts} conflict(s).",
  'main.refreshError': "Refresh error: {error}",
  'main.googleNative': "Native Google file (Docs/Sheets/Slides) — open the .md link note to access it.",
  'main.hydrationError': "Hydration error: {error}",
};

/** Traduit `key` selon la langue courante, interpole `{param}` avec `params`. Retombe sur `key` si absent. */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = currentLang === 'fr' ? FR : EN;
  let s = dict[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}
