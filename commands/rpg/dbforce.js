// Push #33: /dbforce — owner-only escape hatch for a diverged Mongo mirror.
// When Atlas holds MORE users than memory, mongo writes are refused (fail-closed).
// /dbforce confirm authorizes exactly ONE overwrite with the current memory DB.
'use strict';
const fs = require('fs');
const path = require('path');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'dbforce',
  aliases: ['dbforcearm', 'forcearm'],
  description: 'Owner: authorize the next Mongo write after a divergence refusal.',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, { text: '🔒 Owner only.' });
    }
    if (args[0] !== 'confirm') {
      return sock.sendMessage(chatId, {
        text: '⚠️ *MONGO FORCE-ARM* ⚠️\n\nThis authorizes ONE Atlas overwrite with the current in-memory DB.\nOnly do this if you are SURE memory holds the correct data — check /dbstatus and snapshots/ first.\n\nRun `/dbforce confirm` to proceed.',
      });
    }
    try {
      const roots = [];
      if (process.env.DATA_DIR) roots.push(path.join(process.env.DATA_DIR, 'database'));
      roots.push(path.join(__dirname, '..', '..', 'database'));
      let wrote = null;
      for (const r of roots) {
        try {
          fs.mkdirSync(r, { recursive: true });
          fs.writeFileSync(path.join(r, 'FORCE_ARM'), String(Date.now()));
          wrote = r;
          break;
        } catch {}
      }
      return sock.sendMessage(chatId, {
        text: wrote
          ? '✅ Force-arm written.\nThe next save will overwrite Atlas with the current memory DB.\n(Flag auto-deletes after one use.)'
          : '❌ Could not write the flag — check host logs.',
      });
    } catch (e) {
      return sock.sendMessage(chatId, { text: `❌ Force-arm failed: ${e.message}` });
    }
  },
};
