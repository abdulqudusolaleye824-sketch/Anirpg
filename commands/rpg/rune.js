// Push #103b — /rune : class skills are learned from RUNE STONES.
//   /rune               → your unused rune stones (+ what is still coming)
//   /rune use <name|#>  → learn that skill (stone is consumed)
//   /rune use all       → learn every usable stone in the bag
'use strict';
module.exports = {
  name: 'rune', aliases: ['runes', 'runestone', 'runestones'],
  description: '🪨 Learn class skills from rune stones',
  usage: '/rune  ·  /rune use <skill>  ·  /rune use all',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first with /register.' }, { quoted: msg });
    if (!player.class) return sock.sendMessage(chatId, { text: '🪨 Rune stones answer to a class — awaken first (keep leveling).' }, { quoted: msg });
    const SR = require('../../rpg/utils/SkillRunes');
    const SC = require('../../rpg/utils/SkillCatalog');
    const sub = String(args[0] || '').toLowerCase();

    if (sub === 'use' || sub === 'learn' || sub === 'read') {
      const q = args.slice(1).join(' ').trim();
      if (!q) return sock.sendMessage(chatId, { text: '🪨 `/rune use <skill name>` or `/rune use all`.' }, { quoted: msg });
      if (/^all$/i.test(q)) {
        const r = SR.useAll(player);
        if (saveDatabase) saveDatabase();
        const L = [`🪨 *RUNES USED — ${player.name || 'Hunter'}*`];
        if (r.learned.length) { L.push(`✨ Learned ${r.learned.length}:`); for (const e of r.learned) L.push(`  • ${e.emoji || '🔮'} *${e.name}*${e.rankReq ? ` (${e.rankReq}-Rank)` : ''}`); }
        if (r.skipped.length) { L.push(`⏸ Still dormant ${r.skipped.length}:`); for (const sk of r.skipped) L.push(`  • ${sk.stone.skill} — ${String(sk.why || '').replace(/\*/g, '').slice(0, 90)}`); }
        if (!r.learned.length && !r.skipped.length) L.push('No class rune stones in your bag.');
        L.push('', '📖 /skills to see your bar · /skill <name> for details');
        return sock.sendMessage(chatId, { text: L.join('\n') }, { quoted: msg });
      }
      const r = SR.useStone(player, q);
      if (saveDatabase) saveDatabase();
      if (!r.ok) return sock.sendMessage(chatId, { text: r.error }, { quoted: msg });
      const e = r.entry;
      const where = (player.skills?.active || []).some(s => s && s.name === e.name) ? 'equipped on your bar' : e.isPassive ? 'active as a passive' : 'parked in your library (/skills equip)';
      const L = [
        `🪨 *${r.stone.name}* crumbles to light…`,
        '',
        `✨ *${e.emoji || '🔮'} ${e.name}* learned — ${where}.`,
        `${String(e.description || '').split(' Mechanics:')[0].slice(0, 420)}`, // Push #103c: lore + 📝 spec
        `🏷️ ${(() => { try { const SL = require('../../rpg/data/SkillLore'); return SL.TAG[SL.kindOf(e)]; } catch (x) { return ''; } })()}`,
        `⚡ ${e.isPassive ? 'Passive' : `${e.energyCost} energy`}${e.rankReq ? ` · ${e.rankReq}-Rank skill (locks again if your rank drops)` : ''}`,
      ];
      return sock.sendMessage(chatId, { text: L.join('\n') }, { quoted: msg });
    }

    // list
    SR.syncRank(player);
    const stones = SR.stonesOf(player);
    const roster = SC.getRoster(player);
    const learned = roster.filter(e => SR.isLearned(player, e.name));
    const rank = SR.rankOf(player);
    const L = [`🪨 *RUNE STONES — ${player.name || 'Hunter'}* · ${rank}-Rank`];
    if (stones.length) {
      L.push(`\n*In your bag (${stones.length}):*`);
      stones.forEach((st, i) => {
        const e = SR.entryByName(player, st.skill);
        const tag = !e ? 'other class' : e.rankReq ? (SR.rankMeets(player, e.rankReq) ? `${e.rankReq}-Rank ✅` : `${e.rankReq}-Rank 🔒 (you are ${rank})`) : `Lv.${e.unlocksAtLevel}`;
        const kt = (() => { try { const SL = require('../../rpg/data/SkillLore'); return e ? ` · ${SL.TAG[SL.kindOf(e)]}` : ''; } catch (x) { return ''; } })(); // Push #103c
        L.push(`${i + 1}. ${e && e.emoji ? e.emoji : '🪨'} *${st.skill}* — ${tag}${kt}`);
      });
      L.push('➜ `/rune use <name>` · `/rune use all`');
    } else L.push('\nNo unused rune stones. A new one drops every 5 levels (from Lv.15 there is a chance at a bonus pair), and rank skills arrive the moment your Hunter Rank reaches them.');
    const coming = roster.filter(e => !SR.isLearned(player, e.name) && !SR.hasStone(player, e.name));
    const nextLv = coming.filter(e => !e.rankReq).sort((a, b) => a.unlocksAtLevel - b.unlocksAtLevel)[0];
    const nextRank = coming.filter(e => e.rankReq).sort((a, b) => SR.rankIdx(a.rankReq) - SR.rankIdx(b.rankReq))[0];
    L.push(`\n📚 Learned ${learned.length}/${roster.length}`);
    if (nextLv) L.push(`⏭ Next level rune: *${nextLv.name}* at Lv.${nextLv.unlocksAtLevel}`);
    if (nextRank) L.push(`🏅 Next rank rune: *${nextRank.name}* at ${nextRank.rankReq}-Rank`);
    if (saveDatabase) saveDatabase();
    return sock.sendMessage(chatId, { text: L.join('\n') }, { quoted: msg });
  },
};
