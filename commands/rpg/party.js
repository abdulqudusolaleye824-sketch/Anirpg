// ═══════════════════════════════════════════════════════════════
// PARTY COMMAND — Unified Gate Party Creation & Management Flow
// Flow: /party create --<key> -> /party join/ready -> /party raid
//
// Commands:
//   /party create --<KEY>      — open a gate party with a gate key
//   /party                     — view active party status & ready states
//   /party ready               — mark yourself ready for the raid
//   /party raid (or start)     — leader launches raid once everyone is ready
//   /party join <KEY>          — join an active party
//   /party leave               — leave current party
//   /party kick @user          — leader kicks a member from party
// ═══════════════════════════════════════════════════════════════

'use strict';

const GR = require('../../rpg/dungeons/GateRaid');
const GKM = require('../../rpg/dungeons/GateKeyManager');
const { GATE_RANKS } = require('../../rpg/dungeons/GateManager');
const TextMenu = (()=>{ try { return require('../../utils/textMenu'); } catch(e){ return null; } })();
const Buttons = (()=>{ try { return require('../../utils/buttons'); } catch(e){ return null; } })();

function normaliseJid(jid) {
  return GKM.normaliseJid(jid);
}

module.exports = {
  name: 'party',
  aliases: ['praid', 'raidparty'],
  description: '👥 Gate party manager — create, join, ready & launch raid',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const player = db.users?.[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered! Use /register' }, { quoted: msg });
    }
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const action = (args[0] || 'status').toLowerCase();
    // Gate-key parse: scan ALL args for an 8-char token, stripping every
    // dash variant WhatsApp autocorrect produces (hyphen, en/em-dash) plus
    // any formatting. `/party create --KEY`, `--KEY`, `-KEY` all resolve.
    const _stripKey = (v) => String(v || '').toUpperCase().replace(/^[-\s\u2013\u2014\u2015\u2212]+/, '').replace(/[^A-Z0-9]/g, '');
    let rawKey = '';
    for (const _a of args) { const _t = _stripKey(_a); if (_t.length === 8) { rawKey = _t; break; } }
    const _bare0 = _stripKey(args[0]);

    // ── Find active gate in current chat ──────────────────────────
    const gc = GKM.getDungeonGC(chatId);
    let activeKey = gc?.activeKeyId || null;

    if (!activeKey && rawKey && rawKey.length === 8) {
      activeKey = rawKey;
    }

    // ═══════════════════════════════════════════════════════════════
    // /party create --<KEY>
    // ═══════════════════════════════════════════════════════════════
    if (action === 'create' || action === 'open' || _bare0.length === 8) {
      const key = rawKey || _bare0;
      if (!key || key.length !== 8) {
        return sock.sendMessage(chatId, {
          text: '❌ Usage: /party create --<gate key>\nExample: /party create --2K7SN2N8'
        }, { quoted: msg });
      }

      // One party per dungeon GC: refuse while a DIFFERENT key is live here.
      // (Stale keys whose raid is gone/finished are freed automatically.)
      if (activeKey && activeKey !== key) {
        let _stale = true;
        try {
          const { GateManager: _GM } = require('../../rpg/dungeons/GateManager');
          const _kd = GKM.getKey(activeKey) || db.gateKeys?.[activeKey];
          const _g = _kd ? _GM.getGate(_kd.gateId) : null;
          if (_g?.raid && ['recruiting', 'active'].includes(_g.raid.status)) _stale = false;
        } catch(e){}
        if (!_stale) {
          return sock.sendMessage(chatId, {
            text: `❌ A party is already active in this chat! [\`${activeKey}\`]\nFinish or leave it first — one party per dungeon chat.`
          }, { quoted: msg });
        }
      }

      const resolved = GR.resolveCode(key, db);
      if (!resolved.ok) return sock.sendMessage(chatId, { text: resolved.error }, { quoted: msg });
      const { gate, keyData } = resolved;

      const playerGuild = player.guild || null;
      const affData     = GKM.getAffiliateData(sender, db);
      const isAffiliate = !!affData;

      // Ensure dungeon GC registration
      if (!GKM.isDungeonGC(chatId)) {
        GKM.setDungeonGC(chatId, sender);
      }
      const activeGc = GKM.getDungeonGC(chatId);

      // ── SCENARIO A: Solo Hunter (No Guild & Not an Affiliate) ─────
      if (!playerGuild && !isAffiliate) {
        const enterRes = GR.enter(sender, player.name, key, keyData, gate, db);
        activeGc.activeKeyId = key;
        keyData.dungeonChatId = chatId;
        keyData.raidStarted = true;

        saveDatabase();

        const rd = GATE_RANKS[keyData.gateRank] || GATE_RANKS['E'];
        return sock.sendMessage(chatId, {
          text: [
            ...(pro ? [UI.PRO_BAR, `${rd.emoji} *SOLO GATE RAID LAUNCHED!* 💎`, UI.PRO_BAR] : [`${rd.emoji} *SOLO GATE RAID LAUNCHED!*`, UI.FREE_BAR]),
            `🆔 Key: \`${key}\` (${rd.label})`,
            `👤 Hunter: *${player.name}* (Solo)`,
            `🗺️ Floor: 1/${gate.totalFloors}`,
            `${FRAME}`,
            `💡 Since you are not in a guild or an affiliate, party setup is skipped and you enter solo!`,
            `${FRAME}`,
            `⚔️ *COMBAT (auto-routed):*`,
            `/attack — attack the monster`,
            `/skill <name> — use a class skill`,
            ...(pro ? [FRAME, UI.PRO_MINI, `💎 *PRO DELVE* — ${rd.label} gate · ${gate.totalFloors} floors`] : [FRAME, UI.upsell()]),
          ].join('\n'),
        }, { quoted: msg });
      }

      // ── SCENARIO B: Affiliate User ───────────────────────────────
      if (isAffiliate) {
        keyData.isAffiliate = true;
        keyData.guildName   = affData.guildName;
        keyData.dungeonChatId = chatId;
        activeGc.activeKeyId  = key;

        const raid = GR.raidOf(gate, key, keyData);
        raid.mode      = 'party';
        raid.partyType = 'affiliate';
        raid.guildName = affData.guildName;
        raid.leader    = sender;
        raid.status    = 'recruiting';
        raid.members   = [];
        GR.ensureMember(gate, sender, db);

        saveDatabase();

        const rd = GATE_RANKS[keyData.gateRank] || GATE_RANKS['E'];
        const affText = [
            ...(pro ? [UI.PRO_BAR, `👥 *AFFILIATE PARTY CREATED!* 💎`, UI.PRO_BAR] : [`👥 *AFFILIATE PARTY CREATED!*`, UI.FREE_BAR]),
            `🆔 Gate: *${rd.label}* [\`${key}\`]`,
            `👑 Leader: *${player.name}* (Granted Affiliate)`,
            `🏰 Guild: *${affData.guildName}*`,
            ``,
            `📌 *PARTY ACCESS RULE:*`,
            `• Hunters WITHOUT guilds (solo) can join — tap Join below!`,
            `• Hunters in guilds CANNOT join affiliate-led parties.`,
            `${FRAME}`,
            `📌 Run */party ready* when ready. Leader uses */party raid* to launch!`,
            ...(pro ? [FRAME, UI.PRO_MINI, `💎 *PRO MUSTER* — recruiting up to ${GR.MAX_PARTY} hunters`] : [FRAME, UI.upsell()]),
          ].join('\n');
        try {
          if (Buttons?.sendButtons) {
            await Buttons.sendButtons(sock, chatId, {
              text: affText,
              footer: `Affiliate Party • ${key}`,
              buttons: Buttons.quickReplies([[`✅ Join Party`, `/party join ${key}`], [`📊 Party Status`, `/party status`]]),
            }, msg);
            return;
          }
          if (TextMenu?.sendMenu) {
            await TextMenu.sendMenu(sock, chatId, {
              body: affText,
              options: [
                { label: `✅ Join Party`, command: `/party join ${key}` },
                { label: `📊 Party Status`, command: `/party status` },
              ],
              footer: `Affiliate Party • ${key}`,
            }, msg);
            return;
          }
        } catch(e){ console.error('Party menu error:', e.message); }
        return sock.sendMessage(chatId, { text: affText }, { quoted: msg });
      }

      // ── SCENARIO C: Guild Member User ─────────────────────────────
      keyData.isAffiliate = false;
      keyData.guildName   = playerGuild;
      keyData.dungeonChatId = chatId;
      activeGc.activeKeyId  = key;

      const raid = GR.raidOf(gate, key, keyData);
      raid.mode      = 'party';
      raid.partyType = 'guild';
      raid.guildName = playerGuild;
      raid.leader    = sender;
      raid.status    = 'recruiting';
      raid.members   = [];
      GR.ensureMember(gate, sender, db);

      saveDatabase();

      const rd = GATE_RANKS[keyData.gateRank] || GATE_RANKS['E'];
      const guildText = [
          ...(pro ? [UI.PRO_BAR, `👥 *GUILD PARTY CREATED!* 💎`, UI.PRO_BAR] : [`👥 *GUILD PARTY CREATED!*`, UI.FREE_BAR]),
          `🆔 Gate: *${rd.label}* [\`${key}\`]`,
          `👑 Leader: *${player.name}*`,
          `🏰 Guild: *${playerGuild}*`,
          ``,
          `📌 *PARTY ACCESS RULE:*`,
          `• Members of *${playerGuild}* or assigned affiliates — tap Join below!`,
          `${FRAME}`,
          `📌 Run */party ready* when ready. Leader uses */party raid* to launch!`,
          ...(pro ? [FRAME, UI.PRO_MINI, `💎 *PRO MUSTER* — recruiting up to ${GR.MAX_PARTY} hunters`] : [FRAME, UI.upsell()]),
        ].join('\n');
      try {
        if (Buttons?.sendButtons) {
          await Buttons.sendButtons(sock, chatId, {
            text: guildText,
            footer: `Guild Party • ${key} • ${playerGuild}`,
            buttons: Buttons.quickReplies([[`✅ Join Party`, `/party join ${key}`], [`📊 Party Status`, `/party status`]]),
          }, msg);
          return;
        }
        if (TextMenu?.sendMenu) {
          await TextMenu.sendMenu(sock, chatId, {
            body: guildText,
            options: [
              { label: `✅ Join Party`, command: `/party join ${key}` },
              { label: `📊 Party Status`, command: `/party status` },
            ],
            footer: `Guild Party • ${key} • ${playerGuild}`,
          }, msg);
          return;
        }
      } catch(e){ console.error('Party menu error:', e.message); }
      return sock.sendMessage(chatId, { text: guildText }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // /party (status)
    // ═══════════════════════════════════════════════════════════════
    if (action === 'status' || action === 'info' || action === 'list') {
      if (!activeKey) {
        return sock.sendMessage(chatId, {
          text: [
            ...(pro ? [UI.PRO_BAR, `👥 *GATE PARTY MANAGER* 💎`, UI.PRO_BAR] : [`👥 *GATE PARTY MANAGER*`, UI.FREE_BAR]),
            `📌 *COMMANDS:*`,
            `/party create --<KEY>   — create a party with a gate key`,
            `/party ready            — toggle ready state`,
            `/party raid             — launch raid (leader only)`,
            `/party join <KEY>       — join an active party`,
            `/party leave            — leave current party`,
            `/party kick @user       — kick member (leader only)`,
            `/affiliate hire 60|40   — hire affiliate for party`,
            `/affiliate grant 60|40  — grant guild affiliate status`,
            ...(pro ? [FRAME] : [FRAME, UI.upsell()]),
          ].join('\n'),
        }, { quoted: msg });
      }

      const keyData = GKM.getKey(activeKey) || db.gateKeys?.[activeKey];
      if (!keyData) return sock.sendMessage(chatId, { text: '❌ Gate party not found.' }, { quoted: msg });

      const resolved = GR.resolveCode(activeKey);
      if (!resolved.ok) return sock.sendMessage(chatId, { text: resolved.error }, { quoted: msg });
      const { gate } = resolved;

      const raid = GR.raidOf(gate, activeKey, keyData);
      const rd   = GATE_RANKS[keyData.gateRank] || GATE_RANKS['E'];
      const owner = db.users?.[keyData.ownedBy];

      const membersList = (raid.members || []).map((m, i) => {
        const p = db.users?.[m.id];
        const isLeader = m.id === raid.leader;
        const readyIcon = m.ready ? '✅ Ready' : '⏳ Not Ready';
        return `  ${i+1}. ${isLeader ? '👑' : '⚔️'} *${m.name}* (Lv.${p?.level || 1}) — ${readyIcon}`;
      });

      const totalReady = (raid.members || []).filter(m => m.ready).length;
      const totalMembers = (raid.members || []).length;
      const allReady = totalMembers > 0 && totalReady === totalMembers;

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `${rd.emoji} *GATE RAID PARTY STATUS* 💎`, UI.PRO_BAR] : [`${rd.emoji} *GATE RAID PARTY STATUS*`, UI.FREE_BAR]),
          `🆔 Gate: *${rd.label}* [\`${activeKey}\`]`,
          `👑 Leader: *${owner?.name || keyData.ownedBy.split('@')[0]}*`,
          `🏰 Type: *${raid.partyType === 'affiliate' ? 'Affiliate Party' : 'Guild Party'}* (${keyData.guildName || 'Guild'})`,
          `📊 Status: *${raid.status.toUpperCase()}*`,
          ``,
          `👥 *HUNTERS IN PARTY (${totalMembers}/${GR.MAX_PARTY}):*`,
          ...(membersList.length ? membersList : ['  _(No members in party yet)_']),
          ``,
          `${FRAME}`,
          allReady && totalMembers >= 1
            ? `🎉 *ALL MEMBERS READY!* Leader can run */party raid*`
            : `⏰ *Ready Count:* ${totalReady}/${totalMembers} ready. Members run */party ready*`,
          ...(pro ? [FRAME, UI.PRO_MINI, `💎 *PRO MUSTER* — ready ${UI.bar(totalReady, totalMembers, 8, true)} ${totalReady}/${totalMembers}`] : [FRAME, UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // /party join <KEY>
    // ═══════════════════════════════════════════════════════════════
    if (action === 'join') {
      const code = rawKey || (args[1] || '').toUpperCase().replace(/^--/, '').trim();
      if (!code) {
        return sock.sendMessage(chatId, { text: '❌ Usage: /party join <KEY>\nExample: /party join 2K7SN2N8' }, { quoted: msg });
      }

      const resolved = GR.resolveCode(code);
      if (!resolved.ok) return sock.sendMessage(chatId, { text: resolved.error }, { quoted: msg });
      const { gate, keyData } = resolved;

      const raid = gate.raid;
      if (!raid) return sock.sendMessage(chatId, { text: '❌ No active party for this key.' }, { quoted: msg });

      const joinerGuild = player.guild || null;

      // Access Check: Affiliate-led Party vs Guild Party
      if (raid.partyType === 'affiliate') {
        if (joinerGuild) {
          return sock.sendMessage(chatId, {
            text: '❌ *Access Denied!* Hunters in guilds cannot join affiliate-led parties. Only solo hunters without guilds can join.'
          }, { quoted: msg });
        }
      } else if (raid.partyType === 'guild') {
        const isSameGuild = joinerGuild && joinerGuild === raid.guildName;
        const isAssignedAff = GKM.getAffiliateData(sender, db)?.guildName === raid.guildName;
        const isHired = keyData.contracts && keyData.contracts[sender];

        if (!isSameGuild && !isAssignedAff && !isHired) {
          return sock.sendMessage(chatId, {
            text: `❌ *Access Denied!* Only members or assigned affiliates of *${raid.guildName}* can join this party.`
          }, { quoted: msg });
        }
      }

      const res = GR.join(sender, player.name, gate, db);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `✅ *${player.name}* joined the party!\n🔑 Key: \`${code}\`\n👥 Members: ${res.raid.members.length}\n\n📌 Run */party ready* when ready.`,
        mentions: [sender],
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // /party ready
    // ═══════════════════════════════════════════════════════════════
    if (action === 'ready') {
      if (!activeKey) return sock.sendMessage(chatId, { text: '❌ No active party in this chat.' }, { quoted: msg });

      const resolved = GR.resolveCode(activeKey);
      if (!resolved.ok) return sock.sendMessage(chatId, { text: resolved.error }, { quoted: msg });
      const { gate } = resolved;

      const res = GR.ready(sender, gate);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });

      saveDatabase();

      const raid = gate.raid;
      const totalReady = raid.members.filter(m => m.ready).length;
      const totalMembers = raid.members.length;

      let responseText = `✅ *${player.name}* is now **READY**! (${totalReady}/${totalMembers} ready)`;
      if (res.allReadied) {
        responseText += `\n\n🎉 *ALL MEMBERS ARE READY!* Leader can run */party raid* to launch!`;
      }

      return sock.sendMessage(chatId, {
        text: responseText,
        mentions: [sender]
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // /party raid (or start)
    // ═══════════════════════════════════════════════════════════════
    if (action === 'raid' || action === 'start') {
      if (!activeKey) return sock.sendMessage(chatId, { text: '❌ No active party in this chat.' }, { quoted: msg });

      const keyData = GKM.getKey(activeKey) || db.gateKeys?.[activeKey];
      if (!keyData) return sock.sendMessage(chatId, { text: '❌ Gate party not found.' }, { quoted: msg });

      const resolved = GR.resolveCode(activeKey);
      if (!resolved.ok) return sock.sendMessage(chatId, { text: resolved.error }, { quoted: msg });
      const { gate } = resolved;

      const raid = gate.raid;
      if (!raid) return sock.sendMessage(chatId, { text: '❌ No raid in progress.' }, { quoted: msg });
      if (raid.leader !== sender && normaliseJid(keyData.ownedBy) !== normaliseJid(sender)) {
        return sock.sendMessage(chatId, { text: '❌ Only the party leader can launch the raid!' }, { quoted: msg });
      }

      const notReady = raid.members.filter(m => !m.ready);
      if (notReady.length > 0) {
        const names = notReady.map(m => m.name).join(', ');
        return sock.sendMessage(chatId, {
          text: `❌ *Cannot start raid!* The following members are not ready:\n⚠️ ${names}\n\nAll members must run */party ready* before launching!`
        }, { quoted: msg });
      }

      const res = GR.start(sender, keyData, gate, db);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });

      saveDatabase();

      const rd = GATE_RANKS[keyData.gateRank] || GATE_RANKS['E'];
      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `${rd.emoji} *DUNGEON RAID LAUNCHED!* 💎`, UI.PRO_BAR] : [`${rd.emoji} *DUNGEON RAID LAUNCHED!*`, UI.FREE_BAR]),
          `📍 Gate: *${rd.label}* [\`${activeKey}\`]`,
          `🗺️ Entering Floor 1/${gate.totalFloors}`,
          ``,
          `👥 *RAID TEAM (${raid.members.length}):*`,
          ...raid.members.map(m => `  ${m.id === raid.leader ? '👑' : '⚔️'} ${m.name}`),
          ``,
          `⚔️ *COMBAT (auto-routed):*`,
          `/attack — attack the monster`,
          `/skill <name> — use a class skill`,
          `/gateraid ${activeKey} status — floor status`,
          ...(pro ? [FRAME, UI.PRO_MINI, `💎 *PRO BREACH* — floor 1/${gate.totalFloors} · ${raid.members.length} hunters`] : [FRAME, UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // /party leave
    // ═══════════════════════════════════════════════════════════════
    if (action === 'leave') {
      if (!activeKey) return sock.sendMessage(chatId, { text: '❌ No active party in this chat.' }, { quoted: msg });

      const resolved = GR.resolveCode(activeKey);
      if (!resolved.ok) return sock.sendMessage(chatId, { text: resolved.error }, { quoted: msg });
      const { gate } = resolved;

      const raid = gate.raid;
      if (!raid) return sock.sendMessage(chatId, { text: '❌ No active party.' }, { quoted: msg });

      raid.members = (raid.members || []).filter(m => m.id !== sender);
      gate.raiders = (gate.raiders || []).filter(r => r !== sender);

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `✅ *${player.name}* left the party.\nRemaining members: ${raid.members.length}`
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // /party kick @user
    // ═══════════════════════════════════════════════════════════════
    if (action === 'kick') {
      if (!activeKey) return sock.sendMessage(chatId, { text: '❌ No active party.' }, { quoted: msg });

      const targetJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (!targetJid) return sock.sendMessage(chatId, { text: '❌ Usage: /party kick @user' }, { quoted: msg });

      const resolved = GR.resolveCode(activeKey);
      if (!resolved.ok) return sock.sendMessage(chatId, { text: resolved.error }, { quoted: msg });
      const { gate, keyData } = resolved;

      const raid = gate.raid;
      if (!raid) return sock.sendMessage(chatId, { text: '❌ No active party.' }, { quoted: msg });

      if (raid.leader !== sender && normaliseJid(keyData.ownedBy) !== normaliseJid(sender)) {
        return sock.sendMessage(chatId, { text: '❌ Only the party leader can kick members!' }, { quoted: msg });
      }

      raid.members = (raid.members || []).filter(m => m.id !== targetJid);
      gate.raiders = (gate.raiders || []).filter(r => r !== targetJid);

      saveDatabase();

      const targetPlayer = db.users?.[targetJid];
      return sock.sendMessage(chatId, {
        text: `🪓 *${targetPlayer?.name || targetJid.split('@')[0]}* was kicked from the party by leader.`
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: '❌ Usage: /party [create|ready|raid|join|leave|kick]'
    }, { quoted: msg });
  }
};
