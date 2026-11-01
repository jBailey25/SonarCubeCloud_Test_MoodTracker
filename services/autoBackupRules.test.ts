import { test, describe } from 'node:test';
import assert from 'node:assert';
import { autoBackupFileName, selectStaleBackups } from './autoBackupRules.ts';

describe('autoBackupRules', () => {
    test('names the file by local date with zero padding', () => {
        assert.strictEqual(autoBackupFileName(new Date(2026, 0, 5, 23, 59)), 'vibecheck-auto-2026-01-05.json');
    });

    test('keeps the newest files and only ever deletes our own', () => {
        const names = [
            'vibecheck-auto-2026-01-03.json',
            'my-notes.json',
            'vibecheck-auto-2026-01-01.json',
            'vibecheck-backup-2026-01-01.json',
            'vibecheck-auto-2026-01-02.json',
        ];
        assert.deepStrictEqual(selectStaleBackups(names, 2), ['vibecheck-auto-2026-01-01.json']);
    });

    test('deletes nothing when under the limit', () => {
        assert.deepStrictEqual(selectStaleBackups(['vibecheck-auto-2026-01-01.json'], 7), []);
    });
});
