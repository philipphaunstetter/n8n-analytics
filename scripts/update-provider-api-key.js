#!/usr/bin/env node

/**
 * Script to update the n8n provider with a valid API key
 * 
 * Usage: node scripts/update-provider-api-key.js <your-api-key>
 */

const Database = require('sqlite3').Database;
const crypto = require('crypto');
const path = require('path');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'elova-default-encryption-key-change-me';
const ALGORITHM = 'aes-256-gcm';

function encryptApiKey(apiKey) {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

async function updateProviderApiKey(apiKey) {
    const dbPath = path.join(process.cwd(), 'data', 'elova.db');
    const db = new Database(dbPath);

    console.log('🔐 Encrypting API key...');
    const encryptedKey = encryptApiKey(apiKey);

    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE providers SET api_key_encrypted = ? WHERE id = ?',
            [encryptedKey, 'n8n-default'],
            function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                if (this.changes === 0) {
                    console.log('⚠️  No provider found with id "n8n-default"');
                    console.log('📝 Creating default provider...');

                    db.run(
                        `INSERT INTO providers (id, user_id, name, base_url, api_key_encrypted, is_connected, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        ['n8n-default', 'system', 'Default n8n Instance', 'http://localhost:5678', encryptedKey, 1, 'healthy'],
                        function (insertErr) {
                            db.close();
                            if (insertErr) {
                                reject(insertErr);
                            } else {
                                console.log('✅ Provider created successfully!');
                                resolve();
                            }
                        }
                    );
                } else {
                    db.close();
                    console.log('✅ API key updated successfully!');
                    console.log(`   Updated ${this.changes} provider(s)`);
                    resolve();
                }
            }
        );
    });
}

// Main execution
const apiKey = process.argv[2];

if (!apiKey || apiKey === 'your-n8n-api-key-here') {
    console.error('❌ Error: Please provide a valid n8n API key');
    console.error('');
    console.error('Usage: node scripts/update-provider-api-key.js <your-api-key>');
    console.error('');
    console.error('To get your n8n API key:');
    console.error('1. Open your n8n instance');
    console.error('2. Go to Settings > API');
    console.error('3. Create a new API key');
    console.error('4. Copy the key and run this script');
    process.exit(1);
}

console.log('🚀 Updating n8n provider API key...');
console.log('');

updateProviderApiKey(apiKey)
    .then(() => {
        console.log('');
        console.log('🎉 Done! Your n8n provider is now configured.');
        console.log('');
        console.log('Next steps:');
        console.log('1. Restart your development server (npm run dev)');
        console.log('2. The background sync will automatically start fetching executions');
        console.log('3. Check the /executions page to see new data');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Failed to update API key:', error);
        process.exit(1);
    });
