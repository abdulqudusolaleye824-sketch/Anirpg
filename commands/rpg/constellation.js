// /constellation — View your sponsored constellations (ORV themed)
const { CONSTELLATIONS, DOMAINS, RARITY_EMOJI, getSponsorBonus, favBar } = require('../../rpg/utils/ConstellationSystem');

module.exports = {
  name: 'constellation',
  aliases: ['cons', 'sponsor', 'incarnation'],
  description: '🌌 View your constellation sponsorships — pulled from /summon',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered!' }, { quoted: msg });
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const sponsored = player.constellations || {};
    const sub = (args[0] || '').toLowerCase();

    // ── /constellation all ─────────────────────────────────────
    if (sub === 'all' || sub === 'list') {
      const cats = { legendary: [], epic: [], rare: [] };
      for (const [id, con] of Object.entries(CONSTELLATIONS)) {
        const have = !!sponsored[id];
        const fav  = sponsored[id]?.favorability || 0;
        const dom  = DOMAINS[con.domain];
        cats[con.rarity]?.push(
          `${have ? '✅' : '🔒'} ${RARITY_EMOJI[con.rarity]} ${dom?.emoji||''} *${con.name}*${con.limited ? ' ⏰' : ''}${have ? ` Fav.${fav}` : ''}`
        );
      }
      let txt = pro ? `${UI.PRO_BAR}\n🌌 *ALL CONSTELLATIONS* 💎\n${UI.PRO_BAR}\n✅=Sponsored | 🔒=Unknown | ⏰=Limited\n\n` : `🌌 *ALL CONSTELLATIONS*\n${UI.FREE_BAR}\n✅=Sponsored | 🔒=Unknown | ⏰=Limited\n\n`;
      txt += `🟡 *ABSOLUTE / MYTH TIER*\n${cats.legendary.join('\n')}\n\n`;
      txt += `🟣 *HIGHEST TIER*\n${cats.epic.join('\n')}\n\n`;
      txt += `🔵 *ADVANCED TIER*\n${cats.rare.join('\n')}\n\n`;
      txt += `${FRAME}\n💡 Pull constellations with /summon\n/constellation [name] — view details` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO SPONSOR* — ${Object.keys(sponsored).length}/${Object.keys(CONSTELLATIONS).length} sponsored` : `\n${UI.upsell()}`);
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /constellation [name] — detail view ───────────────────
    if (sub && sub !== 'all') {
      const match = Object.values(CONSTELLATIONS).find(c =>
        c.name.toLowerCase().includes(sub) ||
        c.id.replace(/_/g,' ').includes(sub)
      );
      if (!match) return sock.sendMessage(chatId, { text: `❌ Constellation not found.\nUse /constellation all to browse.` }, { quoted: msg });

      const have = sponsored[match.id];
      const dom  = DOMAINS[match.domain];
      let txt = pro ? `${UI.PRO_BAR}\n${RARITY_EMOJI[match.rarity]} *${match.name}* 💎\n${UI.PRO_BAR}\n` : `${RARITY_EMOJI[match.rarity]} *${match.name}*\n${UI.FREE_BAR}\n`;
      txt += `${dom?.emoji||''} *Domain:* ${dom?.name||match.domain} | *Tier:* ${match.tier}\n`;
      txt += `💎 *Rarity:* ${match.rarity.toUpperCase()}${match.limited?' ⏰ LIMITED':''}\n\n`;
      txt += `📖 *Lore:*\n${match.lore}\n\n`;
      txt += `${FRAME}\n`;
      txt += `⚡ *SPONSOR SKILL: ${match.sponsorSkill.name}*\n${match.sponsorSkill.desc}\n\n`;
      txt += `📊 *BASE SPONSORSHIP BONUS*\n`;
      for (const [stat, val] of Object.entries(match.baseBonus)) txt += `  +${val} ${stat.toUpperCase()}\n`;
      txt += `\n💛 *Per Favorability Level:*\n`;
      for (const [stat, val] of Object.entries(match.favorabilityBonus||{})) txt += `  +${val} ${stat.toUpperCase()}\n`;
      if (have) {
        txt += `\n${FRAME}\n✅ *YOU ARE SPONSORED*\n`;
        txt += `${favBar(have.favorability)}\n`;
        const totalBonus = {};
        for (const [s,v] of Object.entries(match.baseBonus)) totalBonus[s]=(totalBonus[s]||0)+v;
        if (have.favorability>1 && match.favorabilityBonus) {
          for (const [s,v] of Object.entries(match.favorabilityBonus)) totalBonus[s]=(totalBonus[s]||0)+v*(have.favorability-1);
        }
        txt += `Current total bonus: `;
        txt += Object.entries(totalBonus).map(([s,v])=>`+${v} ${s.toUpperCase()}`).join(', ')+'\n';
      } else {
        txt += `\n${FRAME}\n🔒 *NOT YET SPONSORED*\nPull with /summon to earn their sponsorship!\n`;
      }
      txt += `${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO SPONSOR* — ${have ? `Fav.${have.favorability}` : 'unsponsored'}` : `\n${UI.upsell()}`);
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /constellation (your roster) ──────────────────────────
    if (!Object.keys(sponsored).length) {
      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n🌌 *YOUR SPONSORSHIPS* 💎\n${UI.PRO_BAR}\n\n📭 No constellations yet!` : `🌌 *YOUR SPONSORSHIPS*\n${UI.FREE_BAR}\n\n📭 No constellations yet!`)+`\n\nYou are a lone Incarnation — unsponsored.\nPull constellations from /summon to gain their power!\n\n/constellation all — see all constellations\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO SPONSOR* — unsponsored` : `\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    const totalBonus = getSponsorBonus(player);
    let txt = pro ? `${UI.PRO_BAR}\n🌌 *YOUR SPONSORSHIPS* (${Object.keys(sponsored).length}) 💎\n${UI.PRO_BAR}\n` : `🌌 *YOUR SPONSORSHIPS* (${Object.keys(sponsored).length})\n${UI.FREE_BAR}\n`;
    txt += `📊 *Total Sponsor Bonus:*\n`;
    for (const [stat, val] of Object.entries(totalBonus)) {
      if (val > 0) txt += `  +${val} ${stat.toUpperCase()}\n`;
    }
    txt += `\n`;

    // Sort by rarity
    const order = { legendary:0, epic:1, rare:2 };
    const sorted = Object.entries(sponsored).sort(([a],[b]) => {
      return (order[CONSTELLATIONS[a]?.rarity]||2)-(order[CONSTELLATIONS[b]?.rarity]||2);
    });

    for (const [id, data] of sorted) {
      const con = CONSTELLATIONS[id];
      if (!con) continue;
      const dom = DOMAINS[con.domain];
      txt += `${RARITY_EMOJI[con.rarity]} ${dom?.emoji||''} *${con.name}*\n`;
      txt += `   ${favBar(data.favorability)}\n`;
      txt += `   ⚡ ${con.sponsorSkill.name}\n\n`;
    }
    txt += `${FRAME}\n/constellation [name] — view details\n/constellation all    — all constellations\n/summon               — pull more` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO SPONSOR* — ${Object.keys(sponsored).length} sponsors` : `\n${UI.upsell()}`);
    return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
  }
};
