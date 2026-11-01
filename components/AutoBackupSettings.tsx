import React, { useEffect, useState } from 'react';
import { FolderSync } from 'lucide-react';
import {
    AutoBackupState,
    chooseAutoBackupFolder,
    getAutoBackupState,
    isAutoBackupSupported,
    runAutoBackup,
    turnOffAutoBackup,
} from '../services/autoBackup';

const formatTime = (ms: number) =>
    new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const smallButton =
    'flex-1 py-2 rounded-lg text-xs font-bold border border-warmGray-light/50 dark:border-navy-border text-warmGray-dark dark:text-nearWhite hover:bg-warmGray-light/50 dark:hover:bg-navy-light transition-colors active:scale-95';

const AutoBackupSettings: React.FC = () => {
    const [state, setState] = useState<AutoBackupState | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        getAutoBackupState().then(setState);
    }, []);

    if (!isAutoBackupSupported()) return null;

    const pickFolder = async () => {
        setBusy(true);
        try {
            const picked = await chooseAutoBackupFolder();
            if (picked) {
                // Write the first backup right away so the user sees it work.
                await runAutoBackup();
                setState(await getAutoBackupState());
            }
        } catch (e) {
            console.error('Choosing backup folder failed', e);
            alert('Could not use that folder. Please try another one.');
        } finally {
            setBusy(false);
        }
    };

    const turnOff = async () => {
        await turnOffAutoBackup();
        setState(null);
    };

    let status = 'Saves a backup to a folder on your phone every time you log.';
    if (state?.lastError) status = state.lastError;
    else if (state?.lastRunAt) status = `Last backup: ${formatTime(state.lastRunAt)}`;
    else if (state) status = 'No backup yet.';

    return (
        <div className="p-4 bg-warmGray-light/30 dark:bg-navy border border-warmGray-light/50 dark:border-navy-border rounded-xl space-y-3">
            <div className="flex items-start gap-3">
                <FolderSync size={18} className="text-brand shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-warmGray-dark dark:text-nearWhite">
                        Auto Backup {state && <span className="text-brand">· On</span>}
                    </p>
                    {state && (
                        <p className="text-xs text-warmGray-medium dark:text-warmGray-light/70 truncate">
                            Folder: {state.label}
                        </p>
                    )}
                    <p className={`text-xs ${state?.lastError ? 'text-red-500' : 'text-warmGray-medium dark:text-warmGray-light/70'}`}>
                        {status}
                    </p>
                </div>
            </div>
            {state ? (
                <div className="flex gap-2">
                    <button onClick={pickFolder} disabled={busy} className={smallButton}>Change folder</button>
                    <button onClick={turnOff} disabled={busy} className={smallButton}>Turn off</button>
                </div>
            ) : (
                <button
                    onClick={pickFolder}
                    disabled={busy}
                    className="w-full py-2.5 rounded-lg text-sm font-bold bg-brand text-white hover:opacity-90 transition-all active:scale-95 disabled:opacity-60"
                >
                    {busy ? 'Saving…' : 'Choose backup folder'}
                </button>
            )}
        </div>
    );
};

export default AutoBackupSettings;
