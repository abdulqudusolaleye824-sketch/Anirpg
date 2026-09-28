// ═══════════════════════════════════════════════════════════════
// /recycle — PRO material recycler (Push #89)
//   /recycle                       → needed materials (buttons)
//   /recycle <material>            → plan + confirm buttons
//   /recycle <material> confirm [n]→ do it
// ═══════════════════════════════════════════════════════════════
const UI = require('../../rpg/utils/UI');
const Recycler = require('../../rpg/utils/Recycler');
const Buttons = (() => { try { return require('../../utils/buttons'); } catch (e) { return null; } })();

async function reply(sock, chatId, msg, text, btnPairs) {
  if (Buttons && btnPairs && btnPairs.length) {
    try { return await Buttons.sendButtons(sock, chatId, { text, buttons: Buttons.quickReplies(btnPairs) }, msg); } catch (e) {}
  }
  return sock.sendMessage(chatId, { text }, { quoted: msg });
}

module.exports = {
  name: 'recycle',
  aliases: ['recycler', 'salvagemats'],
  description: '♻️ PRO: convert unwanted same-rank materials into one you need (costs Nexus)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    if (!pro) {
      return sock.sendMessage(chatId, { text: [FRAME, `♻️ *MATERIAL RECYCLER* — 💎 PRO`, FRAME, ``, `Turn ${Recycler.RATIO} unwanted materials of the same gate rank into *1 material you need* for a scroll recipe (costs Nexus).`, ``, `This is a PRO workbench.`, UI.upsell()].join('\n') }, { quoted: msg });
    }

    const raw = args.join(' ').trim();
    const m = raw.match(/^(.*?)(?:\s+confirm(?:\s+(\d+|max))?)?$/i);
    const target = (m && m[1] || '').trim();
    const confirm = /\sconfirm(\s|$)/i.test(' ' + raw + ' ');
    const countArg = m && m[2] ? m[2] : '1';

    // ── overview: what do you need? ──
    if (!target) {
      const need = Recycler.needed(player);
      if (!need.length) {
        const hold = Recycler.holdings(player);
        return sock.sendMessage(chatId, { text: [UI.PRO_BAR, `♻️ *MATERIAL RECYCLER* 💎`, UI.PRO_BAR, ``, `You are not missing any material for your scrolls.`, `📜 Read a recipe scroll first (/scroll) — then come back and I will show what can be recycled into it.`, ``, `🎒 Materials held: ${hold.reduce((a, h) => a + h.count, 0)} across ${hold.length} kinds.`, UI.PRO_BAR].join('\n') }, { quoted: msg });
      }
      const lines = [UI.PRO_BAR, `♻️ *MATERIAL RECYCLER* 💎`, UI.PRO_BAR, ``, `Ratio: *${Recycler.RATIO} unwanted → 1 needed* (same gate rank) + Nexus per output`, `Cost/unit: ${Object.entries(Recycler.NEXUS_COST).map(([r, c]) => `${r} ${c.toLocaleString()}`).join(' · ')}`, ``, `🧪 *YOU STILL NEED:*`];
      for (const n of need.slice(0, 10)) {
        const p = Recycler.plan(player, n.name, n.missing);
        lines.push(`• *${n.name}* ×${n.missing} (${n.rank || '?'}-rank) — for ${n.for.join(', ')}${p.ok ? ` · can make *${p.maxOut}* now` : ` · ${p.pool || 0} unwanted ${n.rank || ''} mats`}`);
      }
      lines.push(``, `Tap a material to plan a recycle:`, UI.PRO_BAR);
      const btns = need.slice(0, 6).map(n => [`♻️ ${n.name}`.slice(0, 20), `/recycle ${n.name}`]);
      return reply(sock, chatId, msg, lines.join('\n'), btns);
    }

    // ── execute ──
    if (confirm) {
      const want = countArg === 'max' ? 999 : parseInt(countArg, 10) || 1;
      const r = Recycler.execute(player, target, want);
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      saveDatabase();
      const text = [UI.PRO_BAR, `♻️ *RECYCLED!* 💎`, UI.PRO_BAR, ``, `Fed: ${r.feed.map(f => `${f.name} ×${f.take}`).join(', ')}`, `💠 −${r.cost.toLocaleString()} Nexus`, ``, `➡️ *+${r.n}× ${r.name}* (${r.rank}-rank) — you now have *${r.have}*`, ``, `💰 Nexus left: ${(player.gold || 0).toLocaleString()}`, UI.PRO_BAR].join('\n');
      return reply(sock, chatId, msg, text, [[`♻️ Recycle more`, `/recycle`], [`⚒️ My scrolls`, `/scroll`]]);
    }

    // ── plan + confirm ──
    const p = Recycler.plan(player, target, 1);
    if (!p.ok) {
      const hint = p.unwanted && p.unwanted.length ? `\n\nUnwanted ${p.rank}-rank you hold: ${p.unwanted.map(h => `${h.name} ×${h.count}`).join(', ')}` : '';
      return sock.sendMessage(chatId, { text: `❌ ${p.error}${hint}` }, { quoted: msg });
    }
    const pm = Recycler.plan(player, target, p.maxOut);
    const text = [UI.PRO_BAR, `♻️ *RECYCLE → ${p.name}* 💎`, UI.PRO_BAR, ``, `Rank: *${p.rank}* · Ratio ${Recycler.RATIO}:1 · 💠 ${(Recycler.NEXUS_COST[p.rank] || 1000).toLocaleString()} per unit`, ``, `🗑️ Unwanted ${p.rank}-rank pool: ${p.unwanted.map(h => `${h.name} ×${h.count}`).join(', ')} (${p.pool})`, ``, `• 1 unit → feeds ${p.feed.map(f => `${f.name} ×${f.take}`).join(', ')} · 💠 ${p.cost.toLocaleString()}`, `• Max (${p.maxOut}) → 💠 ${pm.ok ? pm.cost.toLocaleString() : '-'}`, ``, `Nexus: ${(player.gold || 0).toLocaleString()}`, UI.PRO_BAR].join('\n');
    const btns = [[`♻️ Make 1`, `/recycle ${p.name} confirm 1`]];
    if (p.maxOut > 1) btns.push([`♻️ Make max (${p.maxOut})`, `/recycle ${p.name} confirm max`]);
    btns.push([`❌ Cancel`, `/recycle`]);
    return reply(sock, chatId, msg, text, btns);
  },
};
