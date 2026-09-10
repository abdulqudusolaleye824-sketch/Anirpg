'use strict';

const fs = require('fs');
const path = require('path');

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const BACKUP_FILE = path.join(__dirname, '..', '..', 'database', 'offline_backup.json');

let isBackupInProgress = false;
let backupStartedAt = 0;

class OfflineBackupManager {
  static isLockdown() {
    return isBackupInProgress;
  }

  static getBackupDurationStr() {
    if (!backupStartedAt) return '0s';
    const elapsedSec = Math.floor((Date.now() - backupStartedAt) / 1000);
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  static getLockdownMessage() {
    const duration = OfflineBackupManager.getBackupDurationStr();
    return [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🔒 *DATABASE BACKUP IN PROGRESS* 🔒`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚠️ The system is currently performing an offline 3-day database backup.`,
      ``,
      `🚫 *ABSOLUTELY ALL COMMANDS ARE DISABLED* during backup.`,
      `⏱️ *Backup duration so far:* ${duration}`,
      ``,
      `Please wait a moment and try again shortly once the backup completes!`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    ].join('\n');
  }

  static async performOfflineBackup(getDatabase, saveDatabase) {
    if (isBackupInProgress) return;

    isBackupInProgress = true;
    backupStartedAt = Date.now();
    console.log('🔒 [OFFLINE BACKUP] Starting 3-day offline database backup lockdown...');

    try {
      const db = typeof getDatabase === 'function' ? getDatabase() : getDatabase;
      if (db) {
        if (!db.system) db.system = {};
        db.system.lastOfflineBackupAt = Date.now();
        if (typeof saveDatabase === 'function') saveDatabase();

        // Clone database object safely
        const dbClone = JSON.parse(JSON.stringify(db));

        // Ensure parent folder exists
        fs.mkdirSync(path.dirname(BACKUP_FILE), { recursive: true });

        // Write to offline_backup.json synchronously
        const jsonStr = JSON.stringify(dbClone, null, 2);
        fs.writeFileSync(BACKUP_FILE, jsonStr, 'utf8');

        console.log(`✅ [OFFLINE BACKUP] Offline JSON database backup created successfully: ${BACKUP_FILE} (${Math.round(jsonStr.length / 1024)} KB)`);
      }
    } catch (err) {
      console.error('❌ [OFFLINE BACKUP] Backup error:', err.message);
    } finally {
      await new Promise(r => setTimeout(r, 1000));
      isBackupInProgress = false;
      backupStartedAt = 0;
      console.log('🔓 [OFFLINE BACKUP] Backup complete. Command lockdown lifted.');
    }
  }

  static startScheduler(getDatabase, saveDatabase) {
    // Check every 10 minutes for the 3-day interval
    setInterval(() => {
      OfflineBackupManager.checkAndRunBackup(getDatabase, saveDatabase);
    }, 10 * 60 * 1000);

    // Also check 30s after bot startup
    setTimeout(() => {
      OfflineBackupManager.checkAndRunBackup(getDatabase, saveDatabase);
    }, 30 * 1000);
  }

  static checkAndRunBackup(getDatabase, saveDatabase) {
    try {
      const db = typeof getDatabase === 'function' ? getDatabase() : getDatabase;
      if (!db) return;
      if (!db.system) db.system = {};

      const now = Date.now();
      const last = db.system.lastOfflineBackupAt || 0;

      if (now - last >= THREE_DAYS_MS) {
        OfflineBackupManager.performOfflineBackup(getDatabase, saveDatabase);
      }
    } catch (e) {
      console.error('[OFFLINE BACKUP] Check failed:', e.message);
    }
  }
}

module.exports = OfflineBackupManager;
