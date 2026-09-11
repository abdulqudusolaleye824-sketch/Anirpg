// claim.js — Claim spawned daily items or group artifacts
const ArtifactSpawn = require('./artifactspawn');
const DailyItemSpawner = require('../../handlers/itemSpawner');

const RARITY_EMOJI = {
  common: '⚪',
  uncommon: '🟢',
  rare: '🔵',
  epic: '🟣'
};

module.exports = {
  name: 'claim',
  description: 'Claim a spawned item or group artifact',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = typeof getDatabase === 'function' ? getDatabase() : getDatabase;

    // Check if daily global item spawn is active in this chat
    const claimedItem = DailyItemSpawner.claimItem(chatId, sender, db, saveDatabase);
    if (claimedItem) {
      const emoji = RARITY_EMOJI[claimedItem.rarity] || '📦';
      const player = db.users[sender];
      const UI = require('../../rpg/utils/UI');
      const pro = UI.isPro(player || {});
      const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `🎉 *ITEM CLAIMED!* 🎉 💎`, UI.PRO_BAR] : [`🎉 *ITEM CLAIMED!* 🎉`, UI.FREE_BAR]),
          `👤 Hunter: @${sender.split('@')[0]}`,
          `📦 Item: *${claimedItem.name}* (${emoji} ${claimedItem.rarity.toUpperCase()})`,
          `📖 Description: _${claimedItem.description}_`,
          ``,
          `✨ Routed directly to your inventory!`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO LOOT* — ${claimedItem.name}`] : [UI.upsell()])
        ].join('\n'),
        mentions: [sender]
      }, { quoted: msg });
    }

    return ArtifactSpawn.handleClaim(sock, msg, args, getDatabase, saveDatabase, sender);
  }
};
