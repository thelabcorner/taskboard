import pako from 'pako';
import { BoardState } from '../types';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface RecoveryDB extends DBSchema {
  backup: {
    key: string;
    value: {
      data: string; // base64 encoded compressed JSON
      timestamp: number;
      hash: string; // checksum for validation
    };
  };
}

const RECOVERY_DB_NAME = 'taskboard-recovery-db';
const RECOVERY_DB_VERSION = 1;
const RECOVERY_STORAGE_KEY = 'taskboard-recovery-backup';
const RECOVERY_COOKIE_KEY = 'taskboard-recovery-b64';
const RECOVERY_HASH_KEY = 'taskboard-recovery-hash';
const RECOVERY_TIMESTAMP_KEY = 'taskboard-recovery-timestamp';

/**
 * Get the recovery database
 */
async function getRecoveryDB(): Promise<IDBPDatabase<RecoveryDB>> {
  return openDB<RecoveryDB>(RECOVERY_DB_NAME, RECOVERY_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('backup')) {
        db.createObjectStore('backup');
      }
    },
  });
}

/**
 * Generate a simple hash checksum for validation
 */
function generateHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Verify hash of data
 */
function verifyHash(data: string, hash: string): boolean {
  return generateHash(data) === hash;
}

/**
 * Create redundant backups across all storage mechanisms
 */
export async function createRecoveryBackup(state: BoardState): Promise<boolean> {
  try {
    // Compress the state
    const json = JSON.stringify(state);
    const compressed = pako.gzip(json);

    // Convert to base64
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(compressed) as any));

    // Generate hash for validation
    const hash = generateHash(base64);
    const timestamp = Date.now();

    const backupData = {
      data: base64,
      timestamp,
      hash,
    };

    let successCount = 0;

    // 1. Try to save to IndexedDB (primary backup)
    try {
      const db = await getRecoveryDB();
      await db.put('backup', backupData, 'state');
      successCount++;
      console.log('[Recovery] Backup saved to IndexedDB');
    } catch (error) {
      console.warn('[Recovery] Failed to save to IndexedDB:', error);
    }

    // 2. Try to save to localStorage (secondary backup)
    try {
      // Check if it will fit (rough estimate: base64 is ~33% larger, add metadata)
      const storageEstimate = JSON.stringify(backupData).length;
      if (storageEstimate < 4 * 1024 * 1024) { // 4MB limit for safety
        localStorage.setItem(RECOVERY_STORAGE_KEY, base64);
        localStorage.setItem(RECOVERY_HASH_KEY, hash);
        localStorage.setItem(RECOVERY_TIMESTAMP_KEY, timestamp.toString());
        successCount++;
        console.log('[Recovery] Backup saved to localStorage');
      } else {
        console.warn('[Recovery] Backup too large for localStorage');
      }
    } catch (error) {
      console.warn('[Recovery] Failed to save to localStorage:', error);
    }

    // 3. Try to save to cookies (tertiary backup, limited)
    try {
      // Cookies have size limits, so only store if reasonably small
      if (base64.length < 3000) {
        // Set cookie with 30-day expiry
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        const cookieValue = `${base64};path=/;expires=${expiryDate.toUTCString()}`;
        document.cookie = `${RECOVERY_COOKIE_KEY}=${cookieValue}`;
        document.cookie = `${RECOVERY_HASH_KEY}=${hash};path=/;expires=${expiryDate.toUTCString()}`;
        successCount++;
        console.log('[Recovery] Backup saved to cookies');
      } else {
        console.log('[Recovery] Backup too large for cookies, skipping');
      }
    } catch (error) {
      console.warn('[Recovery] Failed to save to cookies:', error);
    }

    // Consider it a success if at least one storage mechanism worked
    return successCount > 0;
  } catch (error) {
    console.error('[Recovery] Failed to create recovery backup:', error);
    return false;
  }
}

/**
 * Attempt to recover from available backups
 */
export async function attemptRecovery(): Promise<{
  recovered: boolean;
  state: BoardState | null;
  source: 'indexeddb' | 'localstorage' | 'cookies' | null;
} > {
  try {
    // Try IndexedDB first (most reliable)
    try {
      const db = await getRecoveryDB();
      const backup = await db.get('backup', 'state');
      if (backup && verifyHash(backup.data, backup.hash)) {
        const recovered = decompressBackup(backup.data);
        if (recovered) {
          console.log('[Recovery] Successfully recovered from IndexedDB');
          return { recovered: true, state: recovered, source: 'indexeddb' };
        }
      }
    } catch (error) {
      console.warn('[Recovery] IndexedDB recovery failed:', error);
    }

    // Try localStorage (secondary)
    try {
      const base64 = localStorage.getItem(RECOVERY_STORAGE_KEY);
      const storedHash = localStorage.getItem(RECOVERY_HASH_KEY);
      if (base64 && storedHash && verifyHash(base64, storedHash)) {
        const recovered = decompressBackup(base64);
        if (recovered) {
          console.log('[Recovery] Successfully recovered from localStorage');
          return { recovered: true, state: recovered, source: 'localstorage' };
        }
      }
    } catch (error) {
      console.warn('[Recovery] localStorage recovery failed:', error);
    }

    // Try cookies (tertiary)
    try {
      const cookieValue = getCookieValue(RECOVERY_COOKIE_KEY);
      const cookieHash = getCookieValue(RECOVERY_HASH_KEY);
      if (cookieValue && cookieHash && verifyHash(cookieValue, cookieHash)) {
        const recovered = decompressBackup(cookieValue);
        if (recovered) {
          console.log('[Recovery] Successfully recovered from cookies');
          return { recovered: true, state: recovered, source: 'cookies' };
        }
      }
    } catch (error) {
      console.warn('[Recovery] Cookies recovery failed:', error);
    }

    return { recovered: false, state: null, source: null };
  } catch (error) {
    console.error('[Recovery] Unexpected error during recovery:', error);
    return { recovered: false, state: null, source: null };
  }
}

/**
 * Decompress a base64-encoded gzipped backup
 */
function decompressBackup(base64: string): BoardState | null {
  try {
    // Convert base64 back to binary string
    const binaryString = atob(base64);

    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decompress
    const decompressed = pako.ungzip(bytes);

    // Convert to JSON
    const json = new TextDecoder().decode(decompressed);
    const state = JSON.parse(json) as BoardState;

    // Validate structure
    if (!state.columns || !state.tasks || !state.tags) {
      throw new Error('Invalid backup structure');
    }

    return state;
  } catch (error) {
    console.error('[Recovery] Failed to decompress backup:', error);
    return null;
  }
}

/**
 * Get cookie value by name
 */
function getCookieValue(name: string): string | null {
  const nameEQ = name + '=';
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.startsWith(nameEQ)) {
      return decodeURIComponent(cookie.substring(nameEQ.length));
    }
  }
  return null;
}

/**
 * Clear all recovery backups (e.g., when user manually imports/exports)
 */
export async function clearRecoveryBackups(): Promise<void> {
  try {
    // Clear IndexedDB
    try {
      const db = await getRecoveryDB();
      await db.delete('backup', 'state');
    } catch (error) {
      console.warn('[Recovery] Failed to clear IndexedDB backup:', error);
    }

    // Clear localStorage
    localStorage.removeItem(RECOVERY_STORAGE_KEY);
    localStorage.removeItem(RECOVERY_HASH_KEY);
    localStorage.removeItem(RECOVERY_TIMESTAMP_KEY);

    // Clear cookies
    document.cookie = `${RECOVERY_COOKIE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
    document.cookie = `${RECOVERY_HASH_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;

    console.log('[Recovery] All recovery backups cleared');
  } catch (error) {
    console.error('[Recovery] Error clearing recovery backups:', error);
  }
}

/**
 * Get recovery backup metadata
 */
export async function getRecoveryBackupMetadata(): Promise<{
  hasIndexedDBBackup: boolean;
  hasLocalStorageBackup: boolean;
  hasCookieBackup: boolean;
  timestamp: number | null;
} > {
  const metadata = {
    hasIndexedDBBackup: false,
    hasLocalStorageBackup: false,
    hasCookieBackup: false,
    timestamp: null,
  };

  try {
    const db = await getRecoveryDB();
    const backup = await db.get('backup', 'state');
    if (backup) {
      metadata.hasIndexedDBBackup = true;
      metadata.timestamp = backup.timestamp;
    }
  } catch (error) {
    // Silent fail
  }

  if (localStorage.getItem(RECOVERY_STORAGE_KEY)) {
    metadata.hasLocalStorageBackup = true;
    const timestamp = localStorage.getItem(RECOVERY_TIMESTAMP_KEY);
    if (timestamp) {
      metadata.timestamp = parseInt(timestamp, 10);
    }
  }

  if (getCookieValue(RECOVERY_COOKIE_KEY)) {
    metadata.hasCookieBackup = true;
  }

  return metadata;
}

