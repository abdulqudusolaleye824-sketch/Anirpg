// ═══════════════════════════════════════════════════════════════
// /labyrinth — Guild training labyrinth (Push #97)
//
//   /labyrinth              — status / help
//   /labyrinth buy          — guild master buys the weekly key
//   /labyrinth open         — open it in this dungeon GC (master/officer, key needed)
//   /labyrinth join | leave
//   /labyrinth attack [#] · /labyrinth skill <name> · /labyrinth heal
//   /labyrinth end          — leader closes it for everyone
// ═══════════════════════════════════════════════════════════════
'use strict';

const LAB = require('../../rpg/utils/Labyrinth');
const Buttons = (() => { try { return require('../../utils/buttons'); } catch (e) { return null; } })();

async function reply(sock, chatId, msg, text, btnPairs, pro, mentions) {
  if (pro && Buttons && btnPairs && btnPairs.length) {
    try { return await Buttons.sendButtons(sock, chatId, { text, buttons: Buttons.quickReplies(btnPairs), mentions }, msg); } catch (e) {}
  }
  if (btnPairs && btnPairs.length) text += `\n\n` + btnPairs.map(b => `▫️ ${b[0]} → ${b[1]}`).join('\n');
  return sock.sendMessage(chatId, { text, ...(mentions ? { mentions } : {}) }, { quoted: msg });
}

module.exports = {
  name: 'labyrinth',
  aliases: ['lab', 'laby'],
  description: '🧭 Guild training labyrinth — endless weak beasts, free heals, no loot (master buys 1 key/week)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register' }, { quoted: msg });
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    const sub = String(args[0] || '').toLowerCase();
    const isGroup = String(chatId).endsWith('@g.us');
    let guild = null; try { guild = require('../../rpg/utils/GuildContractManager').resolvePlayerGuild(db, sender, player); } catch (e) {}
    const here = LAB.get(db, chatId);
    const mine = LAB.findByMember(db, sender);
    const lab = here && here.active ? here : mine;
    const BTN_IN = [['⚔️ Attack', '/labyrinth attack'], ['💚 Heal', '/labyrinth heal'], ['🚪 Leave', '/labyrinth leave']];

    if (sub === 'buy') {
      const r = LAB.buyKey(db, guild, player, sender);
      if (!r.ok) return sock.sendMessage(chatId, { text: r.error }, { quoted: msg });
      saveDatabase();
      return reply(sock, chatId, msg, [FRAME, `🗝️ *LABYRINTH KEY*`, FRAME, r.line, FRAME].join('\n'), [['🧭 Open here', '/labyrinth open']], pro);
    }
    if (sub === 'open' || sub === 'start') {
      if (!isGroup) return sock.sendMessage(chatId, { text: '❌ Open the labyrinth inside a *dungeon GC*.' }, { quoted: msg });
      let gc = null; try { gc = require('../../rpg/dungeons/GateKeyManager').getDungeonGC(chatId); } catch (e) {}
      if (!gc) return sock.sendMessage(chatId, { text: '❌ This group is not a dungeon GC.' }, { quoted: msg });
      const r = LAB.open(db, guild, sender, chatId);
      if (!r.ok) return sock.sendMessage(chatId, { text: r.error }, { quoted: msg });
      const j = LAB.join(db, r.lab, player, sender); // the opener is inside by default
      saveDatabase();
      return reply(sock, chatId, msg, [FRAME, `🧭 *THE LABYRINTH OPENS* — ${guild.name}`, FRAME, `A training ground: endless waves of the weakest E-rank beasts. *Free unlimited heal & revive*, *negligible XP* (a Lv1 will not reach Lv2 here), *no loot*. Up to *${LAB.MAX_HUNTERS}* hunters.`, `While inside you are *not on this realm* — no raids, no duels, no tags. It stays open until the leader uses */labyrinth end*.`, ``, `👥 ${j.ok ? `*${player.name}* is inside (leader).` : ''} Join: */labyrinth join*`, `⚔️ /labyrinth attack [#] · /labyrinth skill <name> · 💚 /labyrinth heal`, FRAME].join('\n'), [['🚪 Join', '/labyrinth join'], ['📊 Status', '/labyrinth status']], pro);
    }
    if (sub === 'join') {
      if (!here || !here.active) return sock.sendMessage(chatId, { text: '❌ No labyrinth is open in this GC.' }, { quoted: msg });
      const r = LAB.join(db, here, player, sender);
      if (!r.ok) return sock.sendMessage(chatId, { text: r.error }, { quoted: msg });
      saveDatabase();
      return reply(sock, chatId, msg, `🧭 *${player.name}* enters the labyrinth (${r.count}/${LAB.MAX_HUNTERS}). You are now *not on this realm* until you leave.`, BTN_IN, pro);
    }
    if (sub === 'leave' || sub === 'exit') {
      const r = LAB.leave(db, mine, player, sender);
      saveDatabase();
      return reply(sock, chatId, msg, r.line, [['🧭 Status', '/labyrinth status']], pro);
    }
    if (sub === 'end' || sub === 'close') {
      const target = lab;
      const isOwner = (() => { try { return !!require('../../rpg/utils/ModerationUtils').isOwnerLike(db, sender); } catch (e) { return false; } })();
      const r = LAB.end(db, target, sender, { force: isOwner });
      if (!r.ok) return sock.sendMessage(chatId, { text: r.error }, { quoted: msg });
      saveDatabase();
      const out = [FRAME, ...r.lines, FRAME].join('\n');
      if (target.chatId !== chatId) { try { await sock.sendMessage(target.chatId, { text: out }); } catch (e) {} }
      return sock.sendMessage(chatId, { text: out }, { quoted: msg });
    }
    if (sub === 'heal' || sub === 'revive') {
      const r = LAB.heal(mine, player, sender);
      if (!r.ok) return sock.sendMessage(chatId, { text: r.error }, { quoted: msg });
      saveDatabase();
      return reply(sock, chatId, msg, r.line, BTN_IN, pro);
    }
    if (sub === 'attack' || sub === 'skill' || sub === 'hit') {
      if (!mine) return sock.sendMessage(chatId, { text: '❌ You are not inside a labyrinth. */labyrinth join* in the GC where one is open.' }, { quoted: msg });
      if (mine.chatId !== chatId) return sock.sendMessage(chatId, { text: '❌ Fight in the GC where the labyrinth is open.' }, { quoted: msg });
      try { const _lc = require('../../rpg/utils/BotLane').check(mine, { what: 'labyrinth' }); if (_lc && _lc.error) return sock.sendMessage(chatId, { text: _lc.error }, { quoted: msg }); } catch (e) {}
      const r = sub === 'skill' ? LAB.act(db, mine, player, sender, null, args.slice(1).join(' ')) : LAB.act(db, mine, player, sender, args[1] || null, null);
      if (!r.ok) return sock.sendMessage(chatId, { text: r.error }, { quoted: msg });
      saveDatabase();
      return reply(sock, chatId, msg, r.lines.join('\n'), BTN_IN, pro);
    }

    // status / help
    const st = lab ? LAB.status(db, lab) : null;
    const ks = guild ? LAB.keyState(guild) : null;
    const L = [FRAME, `🧭 *GUILD LABYRINTH*`, FRAME];
    if (st) L.push(st, ``);
    else L.push(`A guild *training* raid: endless waves of the weakest E-rank beasts, free unlimited heal/revive, negligible XP, no loot. Up to ${LAB.MAX_HUNTERS} hunters. Inside = *not on this realm*.`, ``);
    if (guild) L.push(`🗝️ ${guild.name}: ${ks.have ? 'key ready — */labyrinth open* in a dungeon GC' : ks.canBuy ? `no key — master: */labyrinth buy* (💠 ${LAB.KEY_COST_NEXUS.toLocaleString()}, 1/week)` : `key used — next in ${Math.ceil((ks.nextBuyAt - Date.now()) / 3600e3)}h`}`);
    else L.push(`🏰 Join a guild to use the labyrinth.`);
    L.push(``, `📌 /labyrinth buy · open · join · attack [#] · skill <name> · heal · leave · end`, FRAME);
    return reply(sock, chatId, msg, L.join('\n'), lab ? (mine ? BTN_IN : [['🚪 Join', '/labyrinth join']]) : (ks && ks.have ? [['🧭 Open', '/labyrinth open']] : []), pro);
  },
};
