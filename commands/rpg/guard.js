// ═══════════════════════════════════════════════════════════════
// /guard [@teammate]  — Push #84
// Declare that you will intercept the next monster/boss hit aimed at a
// teammate (or at anyone in the party if no one is tagged). The hit is
// re-rolled against YOUR defence and applied to YOU. No mitigation: if you
// can't survive it, you die.
// ═══════════════════════════════════════════════════════════════
'use strict';
const GR = require('../../rpg/dungeons/GateRaid');
const UI = require('../../rpg/utils/UI');

function findMyActiveGate(sender) {
  const sN = GR.GKM.normaliseJid(sender);
  for (const g of Object.values(GR.GateManager.activeGates || {})) {
    const r = g && g.raid;
    if (!r || r.status !== 'active') continue;
    if ((r.members || []).some(m => m.id === sender || GR.GKM.normaliseJid(m.id) === sN)) return g;
  }
  return null;
}

module.exports = {
  name: 'guard',
  aliases: ['protect', 'cover'],
  description: '🛡️ Intercept the next hit aimed at a teammate — resolved against YOUR stats',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first.' }, { quoted: msg });

    const gate = findMyActiveGate(sender);
    if (!gate) return sock.sendMessage(chatId, { text: '❌ You are not in an active raid.' }, { quoted: msg });
    if ((gate.raid.mode || 'party') === 'solo') return sock.sendMessage(chatId, { text: '❌ Guard needs a party — there is nobody to protect in a solo raid.' }, { quoted: msg });

    const sub = (args[0] || '').toLowerCase();
    if (sub === 'off' || sub === 'cancel' || sub === 'stop') {
      const gs = gate.raid.guards || {};
      let n = 0;
      for (const k of Object.keys(gs)) if (GR.GKM.normaliseJid(gs[k].by) === GR.GKM.normaliseJid(sender)) { delete gs[k]; n++; }
      return sock.sendMessage(chatId, { text: n ? '🛡️ Guard cancelled.' : '❌ You have no active guard.' }, { quoted: msg });
    }

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const targetJid = ctx?.mentionedJid?.[0] || ctx?.participant || null;
    const r = GR.setGuard(gate, sender, targetJid);
    if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
    try { GR.saveGateState(db, gate); } catch (e) {}
    saveDatabase();

    const pro = UI.isPro(player);
    const def = player.stats?.def || 0, hp = player.stats?.hp || 0, maxHp = player.stats?.maxHp || 0;
    const who = r.target ? `*${r.target.name}*` : '*any teammate*';
    return sock.sendMessage(chatId, { text: [
      ...(pro ? [UI.PRO_BAR, `🛡️ *GUARD RAISED* 💎`, UI.PRO_BAR] : [`🛡️ *GUARD RAISED*`, UI.FREE_BAR]),
      ``,
      `*${player.name}* will take the next monster/boss hit aimed at ${who}.`,
      `❤️ ${hp}/${maxHp} · 🛡️ DEF ${def}`,
      ``,
      `⚠️ The hit is resolved against *your* stats — no damage reduction. If it's too strong, *you* fall.`,
      `⏱️ Lasts 3 min or until a hit is taken · /guard off to cancel`,
    ].join('\n'), mentions: r.target ? [r.target.id] : [] }, { quoted: msg });
  },
};
