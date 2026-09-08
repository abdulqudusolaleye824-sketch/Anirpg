// ═══════════════════════════════════════════════════════════════
// /spawnstatus — Check gate spawn status (Mods/Owners)
//
// In GC: Displays last spawn, current active spawn, and spawn status.
// In DM: Displays all group chats where spawn is set to true & their status.
// ═══════════════════════════════════════════════════════════════

'use strict';

const Perms = require('../../utils/permissions');
const { GateManager } = require('../../rpg/dungeons/GateManager');

function formatAgo(timestamp) {
  if (!timestamp) return 'None recorded';
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return 'Just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  const rMins = mins % 60;
  return `${hrs}h ${rMins}m ago`;
}

module.exports = {
  name: 'spawnstatus',
  aliases: ['spawnsstatus', 'spawnstate', 'gcspawn'],
  description: '📡 Check gate spawn status for group chats (Mod/Owner)',
  usage: '/spawnstatus',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot mods and owners can use /spawnstatus.'
      }, { quoted: msg });
    }

    const isGroup = chatId.endsWith('@g.us');

    if (!db.gateSpawnMeta) db.gateSpawnMeta = {};

    if (isGroup) {
      const meta = db.gateSpawnMeta[chatId] || {};
      const activeGates = GateManager.getActiveGatesForChat(chatId) || [];
      const activeGateTxt = activeGates.length
        ? activeGates.map(g => `${g.rank}-Rank [${g.id}]`).join(', ')
        : 'None';

      const lastSpawnTxt = formatAgo(meta.lastUnboughtSpawnAt || meta.lastSpawnTime);
      const isEnabled = meta.disabled ? '🔴 DISABLED' : '🟢 ENABLED (True)';

      const text = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📡 *GROUP SPAWN STATUS*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `⚙️ Gate Spawning: *${isEnabled}*`,
        `🕒 Last Spawn: *${lastSpawnTxt}*`,
        `⚡ Active Gate(s): *${activeGateTxt}*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n');

      return sock.sendMessage(chatId, { text }, { quoted: msg });
    }

    // ── In DM: Show all groups with active spawn status ─────────────────────
    const knownGroups = new Set([
      ...Object.keys(db.gateSpawnMeta || {}),
      ...Object.keys(db.groupSettings || {}),
      ...Object.keys(db.astralGroups || {}),
      ...Object.keys(GateManager.gatesByChat || {}),
    ].filter(id => id && id.endsWith('@g.us')));

    if (knownGroups.size === 0) {
      return sock.sendMessage(chatId, {
        text: 'ℹ️ No group chats recorded in database yet.'
      }, { quoted: msg });
    }

    const lines = [];
    let idx = 1;

    for (const gId of knownGroups) {
      const meta = db.gateSpawnMeta[gId] || {};
      const isEnabled = !meta.disabled;
      const activeGates = GateManager.getActiveGatesForChat(gId) || [];
      const activeTxt = activeGates.length ? activeGates.map(g => `${g.rank} [${g.id}]`).join(', ') : 'None';
      const lastTxt = formatAgo(meta.lastUnboughtSpawnAt || meta.lastSpawnTime);

      lines.push(`${idx++}. 📍 *GC:* \`...${gId.slice(-12)}\``);
      lines.push(`   ⚙️ Spawn: ${isEnabled ? '🟢 TRUE' : '🔴 FALSE'}`);
      lines.push(`   🕒 Last Spawn: ${lastTxt}`);
      lines.push(`   ⚡ Active Gate: ${activeTxt}\n`);
    }

    const text = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🌐 *GLOBAL GROUP SPAWN STATUS (DM)*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Total Group Chats: *${knownGroups.size}*`,
      ``,
      ...lines,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');

    return sock.sendMessage(chatId, { text }, { quoted: msg });
  },
};
