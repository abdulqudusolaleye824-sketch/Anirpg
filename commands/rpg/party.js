// ═══════════════════════════════════════════════════════════════
// PARTY COMMAND — Revamped Gate Party System
// Flow: gate -> party -> dungeon
//
// Commands:
//   /party                     — view active party status & ready states
//   /party ready               — mark yourself ready for the raid
//   /party raid (or start)     — leader launches raid once everyone is ready
//   /party join <CODE>         — join a gate party (guild/affiliate only)
//   /party leave               — leave current party
//   /party kick @user          — leader kicks a member from party
// ═══════════════════════════════════════════════════════════════

'use strict';

const GR = require('../../rpg/dungeons/GateRaid');
const GKM = require('../../rpg/dungeons/GateKeyManager');
const { GATE_RANKS } = require('../../rpg/dungeons/GateManager');

function normaliseJid(jid) {
  return GKM.normaliseJid(jid);
}

module.exports = {
  name: 'party',
  aliases: ['praid', 'raidparty'],
  description: '👥 Gate raid party manager — view, ready, join & launch raid',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const player = db.users?.[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered! Use /register' }, { quoted: msg });
    }

    const action = (args[0] || 'status').toLowerCase();
    const subArg = (args[1] || '').toUpperCase().replace(/^--/, '').trim();

    // ── Find active gate in current chat ──────────────────────────
    const gc = GKM.getDungeonGC(chatId);
    let activeKey = gc?.activeKeyId || null;

    if (!activeKey && subArg && subArg.length === 8) {
      activeKey = subArg;
    }

    // ═══════════════════════════════════════════════════════════════
    // /party (status)
    // ═══════════════════════════════════════════════════════════════
    if (action === 'status' || action === 'info' || action === 'list' || (!args[0] && activeKey)) {
      if (!activeKey) {
        return sock.sendMessage(chatId, {
          text: [
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `👥 *GATE RAID PARTY MANAGER*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `Flow: *Gate → Party → Dungeon*`,
            ``,
            `📌 *COMMANDS:*`,
            `/party                 — view active party status`,
            `/party ready           — mark yourself ready for raid`,
            `/party raid            — leader launches raid (all ready required)`,
            `/party join <CODE>     — join gate party`,
            `/party leave           — leave current party`,
            `/party kick @user      — kick member (leader only)`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `💡 *Gate Access Rule:*`,
            `• Guild-led raids: Members of the party leader's guild only.`,
            `• Affiliate-led raids: Granted affiliates & guild members.`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
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
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${rd.emoji} *GATE RAID PARTY STATUS*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🆔 Gate: *${rd.label}* [${activeKey}]`,
          `👑 Leader: *${owner?.name || keyData.ownedBy.split('@')[0]}*`,
          `🏰 Guild: *${keyData.guildName || 'Affiliate'}*`,
          `📊 Status: *${raid.status.toUpperCase()}*`,
          ``,
          `👥 *HUNTERS IN PARTY (${totalMembers}/${GR.MAX_PARTY}):*`,
          ...(membersList.length ? membersList : ['  _(No members in party yet)_']),
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          allReady && totalMembers >= 1
            ? `🎉 *ALL MEMBERS READY!* Leader can run */party raid*`
            : `⏰ *Ready Count:* ${totalReady}/${totalMembers} ready. Members run */party ready*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📌 Leader: */party raid* to enter dungeon`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // /party ready
    // ═══════════════════════════════════════════════════════════════
    if (action === 'ready') {
      if (!activeKey) return sock.sendMessage(chatId, { text: '❌ No active gate party in this chat. Enter a gate code first with /gate enter --<CODE>' }, { quoted: msg });

      const resolved = GR.resolveCode(activeKey);
      if (!resolved.ok) return sock.sendMessage(chatId, { text: resolved.error }, { quoted: msg });
      const { gate } = resolved;

      const res = GR.ready(sender, gate);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });

      saveDatabase();

      const raid = gate.raid;
      const totalReady = raid.members.filter(m => m.ready).length;
      const totalMembers = raid.members.length;

      let responseText = `✅ *${player.name}* is now **READY** for the raid! (${totalReady}/${totalMembers} ready)`;
      if (res.allReadied) {
        responseText += `\n\n🎉 *ALL MEMBERS ARE READY!* Leader can run */party raid* to launch the raid!`;
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
      if (!activeKey) return sock.sendMessage(chatId, { text: '❌ No active gate party in this chat.' }, { quoted: msg });

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
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${rd.emoji} *DUNGEON RAID LAUNCHED!*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📍 Gate: *${rd.label}* [${activeKey}]`,
          `🗺️ Entering Floor 1/${gate.totalFloors}`,
          ``,
          `👥 *RAID TEAM (${raid.members.length}):*`,
          ...raid.members.map(m => `  ${m.id === raid.leader ? '👑' : '⚔️'} ${m.name}`),
          ``,
          `⚔️ *COMBAT COMMANDS:*`,
          `/gateraid ${activeKey} attack    — attack monster`,
          `/gateraid ${activeKey} skill <n> — use active skill`,
          `/gateraid ${activeKey} status   — view floor status`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // /party join <CODE>
    // ═══════════════════════════════════════════════════════════════
    if (action === 'join') {
      const code = subArg || (args[0] && args[0] !== 'join' ? args[0].toUpperCase() : '');
      if (!code) {
        return sock.sendMessage(chatId, { text: '❌ Usage: /party join <CODE>\nExample: /party join 2K7SN2N8' }, { quoted: msg });
      }

      const resolved = GR.resolveCode(code);
      if (!resolved.ok) return sock.sendMessage(chatId, { text: resolved.error }, { quoted: msg });
      const { gate, keyData } = resolved;

      // Access Check: Guild Officer Raid vs Affiliate-Led Raid
      if (!GKM.canUseKey(sender, keyData, db)) {
        return sock.sendMessage(chatId, {
          text: `❌ *Access Denied!* Only members of the party leader's guild (*${keyData.guildName || 'Guild'}*) or granted affiliates can join this party.`
        }, { quoted: msg });
      }

      const res = GR.join(sender, player.name, gate, db);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `✅ *${player.name}* joined the gate party!\n🔑 Gate Code: \`${code}\`\n👥 Members: ${res.raid.members.length}\n\n📌 Run */party ready* when ready.`,
        mentions: [sender],
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
      text: '❌ Usage: /party [ready|raid|join|leave|kick]'
    }, { quoted: msg });
  }
};
