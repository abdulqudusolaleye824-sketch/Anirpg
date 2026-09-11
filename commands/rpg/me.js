// /me — instant stats snapshot
const TitleSys = (() => { try { return require('../../rpg/utils/TitleSystem'); } catch(e) { return null; } })();
module.exports = {
  name: 'me',
  description: '📊 Quick personal stats snapshot',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const p = db.users[sender];
    if (!p) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register [name]' }, { quoted: msg });
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(p);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const cls = p.class?.name || p.class || '?';
    const titleDisp = TitleSys ? TitleSys.getTitleDisplay(p) : '';
    const elo = p.pvpElo || 1000;
    const hpPct = Math.floor((p.stats.hp / p.stats.maxHp) * 100);
    const hpBar = UI.bar(p.stats.hp, p.stats.maxHp, 10, pro);
    const xpNeeded = Math.floor(200 * Math.pow(p.level, 1.8));
    const xpPct = Math.min(100, Math.floor((p.xp / xpNeeded) * 100));

    // Daily claim status
    const dailyCd = Math.max(0, ((p.dailyQuest?.lastClaimed || 0) + 24*60*60*1000) - Date.now());
    const dailyStatus = dailyCd === 0 ? '✅ Ready!' : `⏳ ${Math.ceil(dailyCd/3600000)}h`;

    // Active battle?
    const inBattle = p.pvpBattle ? `⚔️ In PvP vs ${db.users[p.pvpBattle.opponentId]?.name || '?'}` : '';

    return sock.sendMessage(chatId, {
      text: (pro ? `${UI.PRO_BAR}\n👤 *${p.name}*${titleDisp?' ['+titleDisp+']':''} [${cls} Lv.${p.level}] 💎\n${UI.PRO_BAR}\n` +
        `❤️ HP: ${hpBar} ${p.stats.hp}/${p.stats.maxHp}\n` : `👤 *${p.name}*${titleDisp?' ['+titleDisp+']':''} [${cls} Lv.${p.level}]\n${UI.FREE_BAR}\n` +
        `❤️ HP: ${hpBar} ${p.stats.hp}/${p.stats.maxHp}\n`) +
        `✨ XP: ${p.xp}/${xpNeeded} (${xpPct}%)\n` +
        `${FRAME}\n` +
        `⚔️ ATK: ${p.stats.atk} | 🛡️ DEF: ${p.stats.def} | 💨 SPD: ${p.stats.speed}\n` +
        `💠 Nexus: ${(p.gold||0).toLocaleString()} | 💎 Mana Stones: ${p.manaCrystals||0}\n` +
        `🏆 ELO: ${elo} | 📊 ${p.pvpWins||0}W/${p.pvpLosses||0}L\n` +
        `🔥 Daily Streak: ${p.dailyQuest?.streak||0} days | ${dailyStatus}\n` +
        `${inBattle ? inBattle+'\n' : ''}` +
        `${FRAME}\n` +
        `/stats — full profile | /daily — claim | /cooldowns — timers` +
        (pro ? `\n${UI.PRO_MINI}\n💎 *PRO SNAPSHOT* — ${p.dailyQuest?.streak||0}-day streak` : `\n${UI.upsell()}`)
    }, { quoted: msg });
  }
};