import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { BackupData, exportAllData, restoreAllData } from './DatabaseService';

function backupFileName(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `forge-sauvegarde-${y}-${m}-${day}.json`;
}

/**
 * Exporte toutes les données locales (séances, routines, mesures, réglages) dans
 * un fichier JSON et ouvre la feuille de partage native pour que l'utilisateur
 * puisse l'enregistrer (Drive, Fichiers, email...). C'est le seul filet de
 * sécurité contre une perte de données : l'app est strictement hors ligne.
 */
export const exportAndShareBackup = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    throw new Error("L'export n'est disponible que sur l'app mobile.");
  }

  const data = await exportAllData();
  const file = new File(Paths.cache, backupFileName());
  file.create({ overwrite: true });
  file.write(JSON.stringify(data));

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Le partage de fichiers n\'est pas disponible sur cet appareil.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Exporter mes données Forge',
  });
};

export type PickedBackupResult =
  | { canceled: true }
  | { canceled: false; data: BackupData; workoutCount: number };

/**
 * Ouvre le sélecteur de fichiers et lit/valide un fichier de sauvegarde JSON.
 * N'écrit rien en base — la restauration effective se fait via `restoreBackup`
 * une fois que l'utilisateur a confirmé (l'opération remplace toutes les données).
 */
export const pickBackupFile = async (): Promise<PickedBackupResult> => {
  if (Platform.OS === 'web') {
    throw new Error("L'import n'est disponible que sur l'app mobile.");
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return { canceled: true };

  const file = new File(result.assets[0].uri);
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new Error('Impossible de lire ce fichier.');
  }

  let data: BackupData;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Ce fichier n\'est pas une sauvegarde JSON valide.');
  }
  if (!data || typeof data !== 'object' || !data.tables || typeof data.version !== 'number') {
    throw new Error('Ce fichier ne semble pas être une sauvegarde Forge.');
  }

  const workoutCount = Array.isArray(data.tables.workouts) ? data.tables.workouts.length : 0;
  return { canceled: false, data, workoutCount };
};

/** Remplace toutes les données locales par le contenu d'une sauvegarde. Destructif. */
export const restoreBackup = async (data: BackupData): Promise<void> => {
  await restoreAllData(data);
};
