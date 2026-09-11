// ═══════════════════════════════════════════════════════════════
// AFFILIATE COMMANDS — Hire, Grant, Accept, Reject, List
//
// Commands:
//   /affiliate hire @user 60|40   — Party leader hires an affiliate with negotiated loot split
//   /affiliate grant @user 60|40  — Guildmaster/Vice grants official affiliate status
//   /affiliate accept             — Accept pending hire or grant offer
//   /affiliate reject             — Reject pending offer
//   /affiliate list               — List affiliates for your guild or your affiliate status
// ═══════════════════════════════════════════════════════════════

'use strict';

const GKM = require('../../rpg/dungeons/GateKeyManager');
const CM  = require('../../rpg/utils/GuildContractManager');

function normaliseJid(jid) {
  return GKM.normaliseJid(jid);
}

module.exports = {
  name: 'affiliate',
  aliases: ['aff'],
  description: '🤝 Manage guild affiliates & hire party affiliates',

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

    if (!db.affiliateOffers) db.affiliateOffers = {};
    if (!db.affiliates) db.affiliates = {};

    const sub = (args[0] || 'list').toLowerCase();

    // Helper: Parse mentioned user or reply
    function getTargetJid() {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (mentioned) return mentioned;
      const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (quotedSender) return quotedSender;
      return null;
    }

    // Helper: Parse percentages like "60|40", "60/40", "60 40", or "40"
    function parseSplit(strText) {
      const text = String(strText || '').trim();
      const parts = text.split(/[/| ]+/).map(p => parseInt(p, 10)).filter(n => !isNaN(n));
      if (parts.length === 2) {
        return { firstPct: parts[0], secondPct: parts[1] };
      }
      if (parts.length === 1 && parts[0] > 0 && parts[0] < 100) {
        return { firstPct: 100 - parts[0], secondPct: parts[0] };
      }
      return null;
    }

    // ═══════════════════════════════════════════════════════════════
    // /affiliate hire @user 60|40
    // ═══════════════════════════════════════════════════════════════
    if (sub === 'hire') {
      const gc = GKM.getDungeonGC(chatId);
      const activeKey = gc?.activeKeyId || null;
      if (!activeKey) {
        return sock.sendMessage(chatId, {
          text: '❌ No active gate party in this chat. Open a party with /party create --<key> first.'
        }, { quoted: msg });
      }

      const keyData = GKM.getKey(activeKey) || db.gateKeys?.[activeKey];
      const GR = require('../../rpg/dungeons/GateRaid');
      const resolved = GR.resolveCode(activeKey);
      if (!resolved.ok) return sock.sendMessage(chatId, { text: resolved.error }, { quoted: msg });

      const raid = resolved.gate.raid;
      if (!raid) return sock.sendMessage(chatId, { text: '❌ Party raid not active.' }, { quoted: msg });

      if (raid.leader !== sender && normaliseJid(keyData.ownedBy) !== normaliseJid(sender)) {
        return sock.sendMessage(chatId, { text: '❌ Only the party leader can hire affiliates!' }, { quoted: msg });
      }

      const targetJid = getTargetJid();
      if (!targetJid) {
        return sock.sendMessage(chatId, {
          text: '❌ Tag or reply to an affiliate. Usage: /affiliate hire @user 60|40'
        }, { quoted: msg });
      }

      if (targetJid === sender) {
        return sock.sendMessage(chatId, { text: '❌ You cannot hire yourself!' }, { quoted: msg });
      }

      // Join remainder text to find percentages
      const splitText = args.slice(1).join(' ').replace(/@[0-9]+/g, '').trim();
      const split = parseSplit(splitText);
      if (!split) {
        return sock.sendMessage(chatId, {
          text: '❌ Specify loot percentage split (e.g. 60|40 where 40 is affiliate cut).\nUsage: /affiliate hire @user 60|40'
        }, { quoted: msg });
      }

      const { firstPct: leaderPct, secondPct: affiliatePct } = split;

      db.affiliateOffers[targetJid] = {
        type: 'hire',
        from: sender,
        fromName: player.name,
        partyKey: activeKey,
        leaderPct,
        affiliatePct,
        createdAt: Date.now(),
      };

      saveDatabase();

      const targetPlayer = db.users?.[targetJid];
      const targetName   = targetPlayer?.name || targetJid.split('@')[0];

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `🤝 *AFFILIATE HIRE OFFER SENT* 💎`, UI.PRO_BAR] : [`🤝 *AFFILIATE HIRE OFFER SENT*`, UI.FREE_BAR]),
          `👑 Leader: *${player.name}*`,
          `👤 Target: *@${targetJid.split('@')[0]}*`,
          `🔑 Party Key: \`${activeKey}\``,
          ``,
          `📊 *LOOT SPLIT:*`,
          `• Party/Leader Cut: *${leaderPct}%*`,
          `• Affiliate Cut: *${affiliatePct}%*`,
          FRAME,
          `📩 *@${targetJid.split('@')[0]}*, type */affiliate accept* or */affiliate reject* to respond!`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO DEAL* — ${affiliatePct}% cut offered`] : [UI.upsell()]),
        ].join('\n'),
        mentions: [targetJid],
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // /affiliate grant @user 60|40
    // ═══════════════════════════════════════════════════════════════
    if (sub === 'grant') {
      const guildName = player.guild;
      if (!guildName) {
        return sock.sendMessage(chatId, { text: '❌ You must belong to a guild to grant affiliate status.' }, { quoted: msg });
      }

      if (!CM.isGuildMasterOrVice(db, guildName, sender)) {
        return sock.sendMessage(chatId, {
          text: '❌ Only the Guildmaster or Vice Guildmaster can grant official affiliate status.'
        }, { quoted: msg });
      }

      const targetJid = getTargetJid();
      if (!targetJid) {
        return sock.sendMessage(chatId, {
          text: '❌ Tag or reply to a hunter. Usage: /affiliate grant @user 60|40'
        }, { quoted: msg });
      }

      if (targetJid === sender) {
        return sock.sendMessage(chatId, { text: '❌ You cannot grant affiliate status to yourself!' }, { quoted: msg });
      }

      if (GKM.isGuildMember(targetJid, guildName, db)) {
        return sock.sendMessage(chatId, { text: '❌ That hunter is already a full member of your guild!' }, { quoted: msg });
      }

      const splitText = args.slice(1).join(' ').replace(/@[0-9]+/g, '').trim();
      const split = parseSplit(splitText);
      if (!split) {
        return sock.sendMessage(chatId, {
          text: '❌ Specify loot percentage split (e.g. 60|40 where 60 is Guild cut, 40 is Affiliate cut).\nUsage: /affiliate grant @user 60|40'
        }, { quoted: msg });
      }

      const { firstPct: guildPct, secondPct: affiliatePct } = split;

      db.affiliateOffers[targetJid] = {
        type: 'grant',
        from: sender,
        guildName,
        guildPct,
        affiliatePct,
        createdAt: Date.now(),
      };

      saveDatabase();

      const targetPlayer = db.users?.[targetJid];

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `📜 *GUILD AFFILIATE GRANT OFFER* 💎`, UI.PRO_BAR] : [`📜 *GUILD AFFILIATE GRANT OFFER*`, UI.FREE_BAR]),
          `🏰 Guild: *${guildName}*`,
          `👑 Offered by: *${player.name}*`,
          `👤 Target: *@${targetJid.split('@')[0]}*`,
          ``,
          `📊 *AGREED LOOT SPLIT:*`,
          `• Guild Treasury Cut: *${guildPct}%*`,
          `• Granted Affiliate Cut: *${affiliatePct}%*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💡 *How it works:* When you buy and clear gate keys under *${guildName}*'s name, ${guildPct}% of loot goes to the guild treasury and ${affiliatePct}% is yours!`,
          FRAME,
          `📩 *@${targetJid.split('@')[0]}*, type */affiliate accept* or */affiliate reject*!`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO DEAL* — ${affiliatePct}% affiliate cut`] : [UI.upsell()]),
        ].join('\n'),
        mentions: [targetJid],
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // /affiliate accept
    // ═══════════════════════════════════════════════════════════════
    if (sub === 'accept') {
      const offer = db.affiliateOffers[sender];
      if (!offer) {
        return sock.sendMessage(chatId, { text: '❌ You have no pending affiliate offers.' }, { quoted: msg });
      }

      if (offer.type === 'grant') {
        const affId = `aff_${normaliseJid(sender)}`;
        db.affiliates[affId] = {
          jid: sender,
          guildName: offer.guildName,
          guildPct: offer.guildPct,
          affiliatePct: offer.affiliatePct,
          grantedBy: offer.from,
          grantedAt: Date.now(),
        };

        delete db.affiliateOffers[sender];
        saveDatabase();

        return sock.sendMessage(chatId, {
          text: [
            ...(pro ? [UI.PRO_BAR, `🎉 *OFFER ACCEPTED — AFFILIATE GRANTED!* 💎`, UI.PRO_BAR] : [`🎉 *OFFER ACCEPTED — AFFILIATE GRANTED!*`, UI.FREE_BAR]),
            `👤 Hunter: *${player.name}*`,
            `🏰 Guild: *${offer.guildName}*`,
            `📊 Agreed Split: *${offer.guildPct}% Guild / ${offer.affiliatePct}% Affiliate*`,
            FRAME,
            `✅ You are now an official Granted Affiliate of *${offer.guildName}*!`,
            FRAME,
            ...(pro ? [UI.PRO_MINI, `💎 *PRO DEAL* — ${offer.affiliatePct}% cut secured`] : [UI.upsell()]),
          ].join('\n'),
        }, { quoted: msg });
      }

      if (offer.type === 'hire') {
        const keyData = GKM.getKey(offer.partyKey) || db.gateKeys?.[offer.partyKey];
        if (!keyData) {
          delete db.affiliateOffers[sender];
          saveDatabase();
          return sock.sendMessage(chatId, { text: '❌ The party gate key is no longer active.' }, { quoted: msg });
        }

        if (!keyData.contracts) keyData.contracts = {};
        keyData.contracts[sender] = offer.affiliatePct;

        const GR = require('../../rpg/dungeons/GateRaid');
        const resolved = GR.resolveCode(offer.partyKey);
        if (resolved.ok && resolved.gate.raid) {
          GR.ensureMember(resolved.gate, sender, db);
        }

        delete db.affiliateOffers[sender];
        saveDatabase();

        return sock.sendMessage(chatId, {
          text: [
            ...(pro ? [UI.PRO_BAR, `🤝 *HIRE OFFER ACCEPTED!* 💎`, UI.PRO_BAR] : [`🤝 *HIRE OFFER ACCEPTED!*`, UI.FREE_BAR]),
            `👤 Hunter: *${player.name}*`,
            `🔑 Party Key: \`${offer.partyKey}\``,
            `💰 Negotiated Loot Cut: *${offer.affiliatePct}%*`,
            FRAME,
            `✅ You joined the party as a hired affiliate! Run */party ready* when ready.`,
            FRAME,
            ...(pro ? [UI.PRO_MINI, `💎 *PRO DEAL* — ${offer.affiliatePct}% cut · /party ready`] : [UI.upsell()]),
          ].join('\n'),
        }, { quoted: msg });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // /affiliate reject
    // ═══════════════════════════════════════════════════════════════
    if (sub === 'reject' || sub === 'decline') {
      const offer = db.affiliateOffers[sender];
      if (!offer) {
        return sock.sendMessage(chatId, { text: '❌ You have no pending affiliate offers.' }, { quoted: msg });
      }

      delete db.affiliateOffers[sender];
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `🚫 *Affiliate offer rejected.*`
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // /affiliate list
    // ═══════════════════════════════════════════════════════════════
    if (sub === 'list' || sub === 'status') {
      const guildName = player.guild;
      const myAff = GKM.getAffiliateData(sender, db);

      const guildAffs = guildName
        ? Object.values(db.affiliates || {}).filter(a => a.guildName === guildName)
        : [];

      const lines = [
        ...(pro ? [UI.PRO_BAR, `🤝 *GUILD AFFILIATE SYSTEM* 💎`, UI.PRO_BAR] : [`🤝 *GUILD AFFILIATE SYSTEM*`, UI.FREE_BAR]),
      ];

      if (myAff) {
        lines.push(`👤 *YOUR AFFILIATE STATUS:*`);
        lines.push(`  🏰 Guild: *${myAff.guildName}*`);
        lines.push(`  📊 Agreed Split: *${myAff.guildPct || 60}% Guild / ${myAff.affiliatePct || 40}% You*`);
        lines.push(``);
      }

      if (guildName) {
        lines.push(`🏰 *AFFILIATES FOR ${guildName.toUpperCase()} (${guildAffs.length}):*`);
        if (guildAffs.length === 0) {
          lines.push(`  _(No granted affiliates yet)_`);
        } else {
          guildAffs.forEach((a, i) => {
            const p = db.users?.[a.jid];
            lines.push(`  ${i+1}. *${p?.name || a.jid.split('@')[0]}* — Split: ${a.guildPct || 60}% Guild / ${a.affiliatePct || 40}% Aff`);
          });
        }
        lines.push(``);
      }

      lines.push(`📌 *COMMANDS:*`);
      lines.push(`/affiliate hire @user 60|40  — Hire affiliate for party`);
      lines.push(`/affiliate grant @user 60|40 — Guildmaster/Vice grant affiliate`);
      lines.push(`/affiliate accept            — Accept pending offer`);
      lines.push(`/affiliate reject            — Reject pending offer`);
      lines.push(FRAME, ...(pro ? [UI.PRO_MINI, `💎 *PRO DEAL* — ${guildAffs.length} affiliates`] : [UI.upsell()]));

      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: '❌ Usage: /affiliate [hire|grant|accept|reject|list]'
    }, { quoted: msg });
  }
};
