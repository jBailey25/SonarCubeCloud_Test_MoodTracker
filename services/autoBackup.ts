import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { exportToJson } from './driveBackupService';
import { AUTO_BACKUP_KEY } from './storageKeys';
import { autoBackupFileName, selectStaleBackups } from './autoBackupRules';

/**
 * Auto backup: after every save or delete, write the same JSON that
 * "Export / Share Backup" makes into a folder the user picked once.
 * The folder handle is an Android SAF tree URI (see BackupFolderPlugin.java).
 */

interface BackupFolderPlugin {
    pickFolder(): Promise<{ cancelled: boolean; target?: string; label?: string }>;
    writeFile(options: { target: string; name: string; data: string }): Promise<void>;
    listFiles(options: { target: string }): Promise<{ names: string[] }>;
    deleteFile(options: { target: string; name: string }): Promise<void>;
    releaseFolder(options: { target: string }): Promise<void>;
}

const BackupFolder = registerPlugin<BackupFolderPlugin>('BackupFolder');

export interface AutoBackupState {
    target: string;
    label: string;
    lastRunAt?: number;
    lastError?: string;
}

export const isAutoBackupSupported = (): boolean => Capacitor.getPlatform() === 'android';

export const getAutoBackupState = async (): Promise<AutoBackupState | null> => {
    const { value } = await Preferences.get({ key: AUTO_BACKUP_KEY });
    if (!value) return null;
    try {
        return JSON.parse(value) as AutoBackupState;
    } catch {
        return null;
    }
};

const saveState = (state: AutoBackupState) =>
    Preferences.set({ key: AUTO_BACKUP_KEY, value: JSON.stringify(state) });

/** Opens the system folder picker. Returns null if the user cancelled. */
export const chooseAutoBackupFolder = async (): Promise<AutoBackupState | null> => {
    const picked = await BackupFolder.pickFolder();
    if (picked.cancelled || !picked.target) return null;

    const previous = await getAutoBackupState();
    if (previous && previous.target !== picked.target) {
        await BackupFolder.releaseFolder({ target: previous.target });
    }
    const state: AutoBackupState = { target: picked.target, label: picked.label || 'Selected folder' };
    await saveState(state);
    return state;
};

export const turnOffAutoBackup = async (): Promise<void> => {
    const state = await getAutoBackupState();
    if (state) await BackupFolder.releaseFolder({ target: state.target });
    await Preferences.remove({ key: AUTO_BACKUP_KEY });
};

const runOnce = async (): Promise<void> => {
    const state = await getAutoBackupState();
    if (!state) return;

    let outcome: Partial<AutoBackupState>;
    try {
        await BackupFolder.writeFile({
            target: state.target,
            name: autoBackupFileName(new Date()),
            data: await exportToJson(),
        });
        // Best effort: the new backup is already written, so a cleanup
        // failure must not turn this run into a reported failure.
        try {
            const { names } = await BackupFolder.listFiles({ target: state.target });
            for (const name of selectStaleBackups(names)) {
                await BackupFolder.deleteFile({ target: state.target, name });
            }
        } catch (e) {
            console.warn('Auto backup cleanup failed', e);
        }
        outcome = { lastRunAt: Date.now(), lastError: undefined };
    } catch (e) {
        console.error('Auto backup failed', e);
        outcome = { lastError: e instanceof Error ? e.message : String(e) };
    }

    // The user may have turned auto backup off or changed folder while this ran.
    const current = await getAutoBackupState();
    if (current?.target === state.target) await saveState({ ...current, ...outcome });
};

// Runs one at a time, so two quick saves never write the same file at once.
let queue: Promise<void> = Promise.resolve();

/** Writes a backup if auto backup is on. Safe to call without awaiting. */
export const runAutoBackup = (): Promise<void> => {
    if (!isAutoBackupSupported()) return Promise.resolve();
    queue = queue.then(runOnce, runOnce);
    return queue;
};
