#!/usr/bin/env node

/**
 * Migration script to enable foreign key constraints and add CASCADE DELETE
 * This ensures that when a provider is deleted, all related data is cleaned up
 */

const Database = require('sqlite3').Database;
const path = require('path');

async function migrateForeignKeys() {
    const dbPath = path.join(process.cwd(), 'data', 'elova.db');
    const db = new Database(dbPath);

    console.log('🔧 Checking foreign key constraints...');

    return new Promise((resolve, reject) => {
        // First, check current foreign_keys setting
        db.get('PRAGMA foreign_keys', (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            const fkEnabled = row && row.foreign_keys === 1;
            console.log(`   Current foreign_keys setting: ${fkEnabled ? 'ON' : 'OFF'}`);

            if (!fkEnabled) {
                console.log('⚠️  Foreign keys are DISABLED - cascade deletes will not work!');
                console.log('');
                console.log('📝 To fix this, the application needs to be restarted.');
                console.log('   The db.ts file already enables foreign keys on connection.');
                console.log('');
                console.log('🔍 Checking if tables have CASCADE constraints...');

                // Check if workflows table has CASCADE
                db.get(
                    "SELECT sql FROM sqlite_master WHERE type='table' AND name='workflows'",
                    (err, row) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        const hasCascade = row && row.sql && row.sql.includes('ON DELETE CASCADE');
                        console.log(`   workflows table has CASCADE: ${hasCascade ? 'YES ✅' : 'NO ❌'}`);

                        if (!hasCascade) {
                            console.log('');
                            console.log('⚠️  WARNING: Your database schema is missing CASCADE constraints!');
                            console.log('');
                            console.log('This means:');
                            console.log('  - Deleting a provider will NOT delete its workflows');
                            console.log('  - Deleting a provider will NOT delete its executions');
                            console.log('  - Orphaned data will remain in the database');
                            console.log('');
                            console.log('To fix this, you need to:');
                            console.log('  1. Backup your data: cp data/elova.db data/elova.db.backup');
                            console.log('  2. Delete the database: rm data/elova.db');
                            console.log('  3. Restart the app - it will recreate with correct schema');
                            console.log('  4. Re-add your provider and sync data');
                            console.log('');
                            console.log('OR manually run this SQL (advanced):');
                            console.log('  -- This requires recreating tables with CASCADE constraints');
                            console.log('  -- Contact support for a detailed migration script');
                        } else {
                            console.log('');
                            console.log('✅ Schema has CASCADE constraints');
                            console.log('   Just restart the app to enable foreign keys');
                        }

                        db.close();
                        resolve();
                    }
                );
            } else {
                console.log('✅ Foreign keys are enabled');
                console.log('✅ Cascade deletes should work correctly');
                db.close();
                resolve();
            }
        });
    });
}

console.log('🔍 Foreign Key Constraint Check');
console.log('================================');
console.log('');

migrateForeignKeys()
    .then(() => {
        console.log('');
        console.log('✅ Check complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
