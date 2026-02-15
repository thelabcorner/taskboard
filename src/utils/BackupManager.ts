import pako from 'pako';
import { BoardState } from '../types';

const BACKUP_TIME_KEY = 'taskboard-last-backup-time';

/**
 * Export the board state as a compressed JSON file
 */
export function exportBoard(state: BoardState, filename: string = 'taskboard-backup') {
  try {
    // Convert state to JSON
    const json = JSON.stringify(state, null, 2);

    // Compress with gzip
    const compressed = pako.gzip(json);

    // Create blob
    const blob = new Blob([compressed], { type: 'application/octet-stream' });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.json.gz`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Update last backup time
    setLastBackupTime();

    return true;
  } catch (error) {
    console.error('Failed to export board:', error);
    return false;
  }
}

/**
 * Import a compressed board file
 */
export async function importBoard(file: File): Promise<BoardState | null> {
  try {
    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();

    // Decompress
    const decompressed = pako.ungzip(new Uint8Array(buffer));

    // Convert to string
    const json = new TextDecoder().decode(decompressed);

    // Parse JSON
    const state = JSON.parse(json) as BoardState;

    // Validate structure
    if (!state.columns || !state.tasks || !state.tags) {
      throw new Error('Invalid taskboard file format');
    }

    return state;
  } catch (error) {
    console.error('Failed to import board:', error);
    return null;
  }
}

/**
 * Get the last backup time timestamp
 */
export function getLastBackupTime(): number | null {
  const saved = localStorage.getItem(BACKUP_TIME_KEY);
  return saved ? parseInt(saved, 10) : null;
}

/**
 * Set the last backup time to now
 */
export function setLastBackupTime(): void {
  localStorage.setItem(BACKUP_TIME_KEY, Date.now().toString());
}

/**
 * Check if a backup reminder should be shown (24+ hours since last backup)
 */
export function shouldShowBackupReminder(): boolean {
  const lastBackup = getLastBackupTime();
  if (!lastBackup) return true; // Show reminder if never backed up

  const hoursSinceBackup = (Date.now() - lastBackup) / (1000 * 60 * 60);
  return hoursSinceBackup >= 24;
}

/**
 * Get formatted string of when the last backup was
 */
export function getLastBackupText(): string {
  const lastBackup = getLastBackupTime();
  if (!lastBackup) return 'Never backed up';

  const diff = Date.now() - lastBackup;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  return 'Just now';
}

