// Pure naming and retention rules for auto backup, kept apart so they can be
// tested without Capacitor.

/** Marks a file as ours, so cleanup never touches the user's own files. */
export const AUTO_BACKUP_PREFIX = 'vibecheck-auto-';

/** How many daily backups to keep in the folder. */
export const AUTO_BACKUP_KEEP = 7;

/** One file per local day: later saves on the same day overwrite it. */
export const autoBackupFileName = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${AUTO_BACKUP_PREFIX}${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
};

/** The auto backups to delete so only the newest `keep` remain. */
export const selectStaleBackups = (names: string[], keep = AUTO_BACKUP_KEEP): string[] => {
    const ours = names.filter(n => n.startsWith(AUTO_BACKUP_PREFIX) && n.endsWith('.json')).sort();
    return ours.slice(0, Math.max(0, ours.length - keep));
};
