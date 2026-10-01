// ═══════════════════════════════════════════════════════════════════
// /teampvp — Push #96: TEAM BATTLES (up to 5 v 5, fought one-on-one)
//   /teampvp create        open a lobby (you lead Team A)
//   /teampvp join a|b      join a side
//   /teampvp start         leader starts the battle
//   /teampvp switch <n>    OPTIONAL: swap in bench hunter #n (uses your side's turn)
//   /teampvp status        lobby / battle board
//   /teampvp leave         leave the lobby · /teampvp cancel (leader)
//   /teampvp forfeit       give up the battle for your team
//   /teampvp record        your cumulative team wins / losses
// Fighting itself uses the normal duel commands: /pvp attack · /pvp skill <name>
// ═══════════════════════════════════════════════════════════════════
const TP = require('../../rpg/utils/TeamPvp');

module.exports = {
  name: 'teampvp',
  aliases: ['teambattle', 'tpvp'],
  description: '🤝 Team PvP — up to 5 v 5, one-on-one bouts, optional switching, cumulative team record',
  usage: '/teampvp <create|join a|b|start|handicap on|off|switch n|status|leave|cancel|forfeit|record>',
  subcommands: ['create', 'join a|b', 'start', 'handicap on|off', 'switch <n>', 'status', 'leave', 'cancel', 'forfeit', 'record'],

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const sub = String(args[0] || '').toLowerCase();
    const say = (text, mentions) => sock.sendMessage(chatId, mentions ? { text, mentions } : { text }, { quoted: msg });

    if (sub === 'record' || sub === 'stats') return say(TP.recordText(player));

    if (!chatId || !String(chatId).endsWith('@g.us')) return say('❌ Team battles happen in a group chat.');

    if (!sub || sub === 'help') {
      const st = TP.status(chatId, db);
      return say([`🤝 *TEAM PVP* — up to ${TP.MAX_PER_TEAM} v ${TP.MAX_PER_TEAM}, fought one-on-one`, ``, `/teampvp create — open a lobby (Team A)`, `/teampvp join a|b — pick a side`, `/teampvp start — leader starts (equal teams)`, `/teampvp handicap on|off — leader allows uneven teams (1 v 3, 2 v 5…), no stat boosts`, `/pvp attack · /pvp skill <name> — the active hunters fight`, `/teampvp switch <n> — (optional) swap in bench hunter #n; it uses your side's turn`, `/teampvp status · leave · cancel · forfeit · record`, ``, `When a hunter falls, the next one on that side steps in. Last team standing wins — every member's team record is updated.`, ...(st ? [``, st.text] : [])].join('\n'));
    }

    if (sub === 'create' || sub === 'new') {
      if (player.pvpBattle) return say('❌ Finish your current duel first.');
      const r = TP.create(chatId, sender);
      if (!r.ok) return say(`❌ ${r.error}`);
      saveDatabase();
      return say([`🤝 *TEAM BATTLE LOBBY OPEN!*`, `👑 Leader: *${player.name}* (Team A)`, ``, TP.lobbyText(r.lobby, db), ``, `Join with */teampvp join a* or */teampvp join b* (max ${TP.MAX_PER_TEAM} each).`, `Leader starts with */teampvp start*.`].join('\n'));
    }

    if (sub === 'join') {
      if (player.pvpBattle) return say('❌ Finish your current duel first.');
      if ((player.stats?.hp || 0) <= 0) return say('❌ You have no HP — heal before joining.');
      const r = TP.join(chatId, sender, args[1]);
      if (!r.ok) return say(`❌ ${r.error}`);
      return say([`✅ *${player.name}* joined *Team ${r.side}*!`, ``, TP.lobbyText(r.lobby, db)].join('\n'));
    }

    if (sub === 'leave') {
      const r = TP.leave(chatId, sender);
      if (!r.ok) return say(`❌ ${r.error}`);
      return say(r.lobby ? [`👋 *${player.name}* left the lobby.`, ``, TP.lobbyText(r.lobby, db)].join('\n') : '👋 Lobby closed — nobody left.');
    }

    if (sub === 'handicap' || sub === 'uneven') {
      const v = String(args[1] || '').toLowerCase(); const on = v === 'on' || v === 'yes' || v === 'true' || v === '1' || (v === '' ? true : false);
      const r = TP.setHandicap(chatId, sender, v === 'off' || v === 'no' || v === 'false' || v === '0' ? false : on);
      if (!r.ok) return say(`❌ ${r.error}`);
      return say([r.lobby.handicap ? `⚖️ *HANDICAP MATCH ENABLED* — uneven teams allowed (e.g. 1 v 3, 2 v 5). No stat boosts — the outnumbered side fights as they are.` : `⚖️ Handicap disabled — teams must be equal to start.`, ``, TP.lobbyText(r.lobby, db)].join('\n'));
    }

    if (sub === 'cancel') {
      const l = TP.lobbyOf(chatId);
      if (!l) return say('❌ No open lobby.');
      if (l.leader !== sender) return say('❌ Only the lobby leader can cancel.');
      TP.cancel(chatId);
      return say('🚫 Team battle lobby cancelled.');
    }

    if (sub === 'start' || sub === 'begin') {
      const r = TP.start(chatId, sender, db);
      if (!r.ok) return say(`❌ ${r.error}`);
      saveDatabase();
      const b = r.battle; const a = db.users[b.A.active], c = db.users[b.B.active];
      return say([`━━━━━━━━━━━━━━━━━━━━━━━━━━━`, `🤝 *TEAM BATTLE BEGINS!*`, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, TP.battleText(b, db), ``, `⚔️ *${a.name}* (A) vs *${c.name}* (B)`, `@${b.A.active.split('@')[0]} @${b.B.active.split('@')[0]} — lock in with */pvp attack* or */pvp skill <name>* (20s per turn).`, `Teammates may swap in any turn: */teampvp switch <n>*.`].join('\n'), [b.A.active, b.B.active]);
    }

    if (sub === 'switch' || sub === 'swap' || sub === 'tag') {
      const r = TP.switchActive(chatId, sender, args[1] || '1', db);
      if (!r.ok) return say(`❌ ${r.error}`);
      saveDatabase();
      await say([`🔁 *TAG!* Team ${r.side} swaps *${r.prev ? r.prev.name : '?'}* out — *${r.next.name}* steps in!`, `❤️ ${r.next.stats.hp}/${r.next.stats.maxHp} HP vs *${r.opp ? r.opp.name : '?'}*`, `⏳ Switching used Team ${r.side}'s action this turn.`].join('\n'), [r.nextJid, r.oppJid]);
      if (r.oppLocked) {
        try { const pvp = require('./pvp'); if (pvp._resolveTurn) await pvp._resolveTurn(sock, chatId, r.opp, r.next, db, saveDatabase); } catch (e) { console.error('[teampvp switch resolve]', e.message); }
      } else {
        await sock.sendMessage(chatId, { text: `@${r.oppJid.split('@')[0]} — your move: /pvp attack or /pvp skill <name> (20s).`, mentions: [r.oppJid] });
        // Opponent clock: same 20s rule as a duel.
        const turn = r.next.pvpBattle && r.next.pvpBattle.turn; const oppId = r.oppJid, meId = r.nextJid;
        setTimeout(async () => {
          try {
            const me = db.users[meId], them = db.users[oppId];
            if (!me?.pvpBattle || !them?.pvpBattle || me.pvpBattle.turn !== turn || them.pvpBattle.turn !== turn) return;
            if (them.pvpBattle.pendingAction || !me.pvpBattle.pendingAction) return;
            them.pvpBattle.pendingAction = { type: 'attack', arg: null, _timedOut: true, _skip: true };
            const pvp = require('./pvp'); if (pvp._resolveTurn) await pvp._resolveTurn(sock, chatId, me, them, db, saveDatabase);
          } catch (e) {}
        }, 20000);
      }
      return;
    }

    if (sub === 'status' || sub === 'board') {
      const st = TP.status(chatId, db);
      return say(st ? st.text : '❌ No team lobby or battle here — /teampvp create.');
    }

    if (sub === 'forfeit' || sub === 'surrender') {
      const r = await TP.abandon(sock, chatId, sender, db, saveDatabase);
      if (!r.ok) return say(`❌ ${r.error}`);
      return;
    }

    return say('❓ /teampvp <create|join a|b|start|handicap on|off|switch n|status|leave|cancel|forfeit|record>');
  },
};
