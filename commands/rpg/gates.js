// ═══════════════════════════════════════════════════════════════
// GATES — Full gate system with keys, dungeon GCs, affiliates
//
// Commands:
//   /gate                      — list active gates
//   /gate buy (reply to spawn) — buy gate, get key via DM
//   /gate enter --<KEY>        — enter gate in dungeon GC
//   /gate status <KEY>         — check key status
//   /gate apply <KEY>          — join a gate raid party
//   /gate party <KEY>          — view party members
//   /contract <percent%> @user — set payout contract
//   /affiliate grant @user     — guild master grants affiliate
//   /affiliate revoke @user    — guild master revokes affiliate
//   /setdungeon                — owner/coowner sets dungeon GC
//   /removedungeon             — owner/coowner removes dungeon GC
//   /dungeons                  — list all dungeon GCs
// ═══════════════════════════════════════════════════════════════

'use strict';

const { GateManager, GATE_RANKS } = require('../../rpg/dungeons/GateManager');
const { AWAKENING_RANKS }          = require('../../rpg/utils/SoloLevelingCore');
const GKM                          = require('../../rpg/dungeons/GateKeyManager');

// ── Permission helper ─────────────────────────────────────────────────────────
function normaliseJid(jid) {
  return jid?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '') || '';
}

function isOwnerOrCoOwner(sender) {
  const ownerNum   = normaliseJid(process.env.OWNER_JID   || '221951679328499@lid');
  const coOwnerNum = normaliseJid(process.env.COOWNER_JID || '194592469209292@lid');
  const sNum       = normaliseJid(sender);
  return sNum === ownerNum || sNum === coOwnerNum;
}

// ── /gate ─────────────────────────────────────────────────────────────────────
const gate = {
  name: 'gate',
  aliases: ['gates'],
  description: 'Gate system — spawn, buy, enter, raid',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const player = db.users?.[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    }

    GateManager.checkGateBreaks(chatId, sock);

    const sub = (args[0] || 'list').toLowerCase();

    // ── /gate (list) ──────────────────────────────────────────────────────────
    if (sub === 'list' || sub === 'gates' || !args[0]) {
      const active = GateManager.getActiveGatesForChat(chatId);

      if (active.length === 0) {
        return sock.sendMessage(chatId, {
          text: [
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `「System」 *NO ACTIVE GATES*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `No dimensional rifts detected in this area.`,
            `Gates spawn periodically. Stay alert, hunter.`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ].join('\n'),
        }, { quoted: msg });
      }

      const rankData = AWAKENING_RANKS[player.awakenRank || 'E'];
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n「System」 *ACTIVE GATES*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      txt += `${rankData.emoji} Your rank: *${rankData.label}*\n`;
      txt += `🚪 No rank restriction — any rank can raid any gate.\n\n`;

      for (const g of active) {
        txt += GateManager.formatGate(g) + '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      }

      txt += `\n📌 Reply to a gate announcement with */gate buy* to purchase.`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /gate buy ─────────────────────────────────────────────────────────────
    if (sub === 'buy' || sub === 'purchase') {
      // Must reply to gate spawn message
      const quotedText = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation
        || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text
        || '';

      // Extract gate ID from quoted message
      const gateIdMatch = quotedText.match(/ID:\s*\*?(G-[\w-]+)\*?/i)
        || quotedText.match(/(G-\d+-\d+)/);

      if (!gateIdMatch) {
        return sock.sendMessage(chatId, {
          text: `❌ Reply to a gate spawn announcement to buy it.\n\nExample: Reply to the gate message with */gate buy*`,
        }, { quoted: msg });
      }

      const gateId = gateIdMatch[1];
      GateManager.checkGateBreaks(chatId, sock);

      const gateObj = GateManager.getGate(gateId);
      if (!gateObj || gateObj.chatId !== chatId) {
        return sock.sendMessage(chatId, { text: '❌ That gate is no longer available in this chat.' }, { quoted: msg });
      }
      if (gateObj.cleared || gateObj.broken) {
        return sock.sendMessage(chatId, { text: '❌ That gate is no longer active.' }, { quoted: msg });
      }
      if (gateObj.purchased) {
        return sock.sendMessage(chatId, { text: `❌ This gate has already been purchased.` }, { quoted: msg });
      }

      const result = GKM.purchaseGateKey(sender, gateObj, db, saveDatabase);
      if (!result.success) {
        return sock.sendMessage(chatId, { text: `❌ ${result.error}` }, { quoted: msg });
      }

      // Mark gate as purchased
      gateObj.purchased   = true;
      gateObj.purchasedBy = sender;
      gateObj.keyId       = result.key;

      const rd          = GATE_RANKS[gateObj.rank];
      const stability   = GKM.formatStability(result.stabilityMs);
      const paidFrom    = result.keyData.isAffiliate ? 'your personal funds' : `*${result.keyData.guildName}* guild treasury`;

      // Confirm in chat (no key revealed publicly)
      await sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🔑 *GATE PURCHASED*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `${rd.emoji} *${rd.label}*`,
          `💠 Paid from: ${paidFrom}`,
          `⏳ Gate stable for: *${stability}*`,
          ``,
          `🔑 Key sent to your DM.`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });

      // DM the key privately
      const expiresDate = new Date(result.keyData.expiresAt).toUTCString().replace(' GMT', ' WAT');
      await sock.sendMessage(sender, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🔑 *YOUR GATE KEY*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `${rd.emoji} Gate: *${rd.label}*`,
          `🆔 Gate ID: \`${gateId}\``,
          ``,
          `🔑 *Key: \`${result.key}\`*`,
          ``,
          `⏳ Stable until: *${expiresDate}*`,
          `📅 Remaining: *${stability}*`,
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📌 *HOW TO USE:*`,
          `1. Go to your dungeon GC`,
          `2. Use: /gateraid ${result.key}`,
          `3. Guild members ride together (party).`,
          `   Outsiders raid solo.`,
          ``,
          `⚠️ Keep this code safe. If the gate expires`,
          `   before use, the purchase is non-refundable.`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      });

      return;
    }

    // ── /gate enter --<KEY> ───────────────────────────────────────────────────
    if (sub === 'enter') {
      const keyArg = (args[1] || '').replace(/^--/, '').toUpperCase().trim();
      if (!keyArg || keyArg.length !== 8) {
        return sock.sendMessage(chatId, {
          text: `❌ Usage: /gate enter --<KEY>\nExample: /gate enter --2K7SN2N8`,
        }, { quoted: msg });
      }

      if (!GKM.isDungeonGC(chatId)) {
        return sock.sendMessage(chatId, {
          text: [
            `❌ *This is not a registered dungeon GC.*`,
            ``,
            `Gate raids can only be started in designated dungeon groups.`,
            `Ask the bot owner to register this group with /setdungeon.`,
          ].join('\n'),
        }, { quoted: msg });
      }

      const result = GKM.enterGate(keyArg, sender, chatId, db);
      if (!result.success) {
        return sock.sendMessage(chatId, { text: `❌ ${result.error}` }, { quoted: msg });
      }

      saveDatabase();

      const keyData = result.keyData;
      const rd      = GATE_RANKS[keyData.gateRank] || GATE_RANKS['E'];
      const owner   = db.users?.[keyData.ownedBy];
      const timeLeft = GKM.formatStability(keyData.expiresAt - Date.now());

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${rd.emoji} *GATE OPENED*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `「System」 Dimensional rift confirmed.`,
          `Gate: *${rd.label}*`,
          `Key: \`${keyArg}\``,
          `Key Holder: *${owner?.name || 'Unknown'}*`,
          `⏳ Gate collapses in: *${timeLeft}*`,
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📌 *NEXT STEPS:*`,
          `/gate apply --${keyArg}  — add party members`,
          `/contract <x%> @hunter  — set payout deals`,
          `/gateraid ${keyArg}      — begin the raid`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💡 Use /gateraid ${keyArg} when your party is ready.`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── /gate apply --<KEY> ───────────────────────────────────────────────────
    if (sub === 'apply' || sub === 'join') {
      const keyArg = (args[1] || '').replace(/^--/, '').toUpperCase().trim();
      if (!keyArg) {
        return sock.sendMessage(chatId, { text: `❌ Usage: /gate apply --<KEY>` }, { quoted: msg });
      }

      const keyData = GKM.getKey(keyArg);
      if (!keyData) return sock.sendMessage(chatId, { text: `❌ Key not found.` }, { quoted: msg });
      if (keyData.expired) return sock.sendMessage(chatId, { text: `❌ This gate has expired.` }, { quoted: msg });

      if (!GKM.canUseKey(sender, keyData, db)) {
        return sock.sendMessage(chatId, {
          text: `❌ You are not authorized to join this raid.\n\nYou must be a guild member, affiliate, or have a contract.`,
        }, { quoted: msg });
      }

      if (!keyData.raidParty.includes(sender)) keyData.raidParty.push(sender);
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `✅ *${player.name}* joined the raid party!\n🔑 Key: \`${keyArg}\`\n👥 Party size: ${keyData.raidParty.length}`,
      }, { quoted: msg });
    }

    // ── /gate party --<KEY> ───────────────────────────────────────────────────
    if (sub === 'party') {
      const keyArg = (args[1] || '').replace(/^--/, '').toUpperCase().trim();
      if (!keyArg) return sock.sendMessage(chatId, { text: `❌ Usage: /gate party --<KEY>` }, { quoted: msg });

      const keyData = GKM.getKey(keyArg);
      if (!keyData) return sock.sendMessage(chatId, { text: `❌ Key not found.` }, { quoted: msg });

      const rd = GATE_RANKS[keyData.gateRank] || {};
      const partyLines = keyData.raidParty.map((jid, i) => {
        const p = db.users?.[jid];
        const isOwner = jid === keyData.ownedBy;
        const contractPct = keyData.contracts?.[jid];
        return `  ${i+1}. *${p?.name || jid.split('@')[0]}* ${isOwner ? '👑' : ''}${contractPct ? ` (${contractPct}% contract)` : ''}`;
      });

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `👥 *RAID PARTY*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${rd.emoji || '🚪'} ${rd.label || keyData.gateRank}-Rank Gate`,
          `Key: \`${keyArg}\``,
          ``,
          ...partyLines,
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── /gate status --<KEY> ──────────────────────────────────────────────────
    if (sub === 'status' || sub === 'info') {
      const keyArg = (args[1] || '').replace(/^--/, '').toUpperCase().trim();
      if (!keyArg) return sock.sendMessage(chatId, { text: `❌ Usage: /gate status --<KEY>` }, { quoted: msg });

      const keyData = GKM.getKey(keyArg) || db.gateKeys?.[keyArg];
      if (!keyData) return sock.sendMessage(chatId, { text: `❌ Key not found.` }, { quoted: msg });

      const rd       = GATE_RANKS[keyData.gateRank] || {};
      const owner    = db.users?.[keyData.ownedBy];
      const timeLeft = keyData.expired ? 'EXPIRED' : GKM.formatStability(Math.max(0, keyData.expiresAt - Date.now()));
      const status   = keyData.raidComplete ? '✅ Cleared'
        : keyData.expired ? '💀 Expired'
        : keyData.raidStarted ? '⚔️ Raid in progress'
        : keyData.dungeonChatId ? '🚪 Gate open'
        : '🔑 Key unused';

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🔑 *KEY STATUS*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `${rd.emoji || '🚪'} Gate: *${rd.label || keyData.gateRank}*`,
          `Key: \`${keyArg}\``,
          `Owner: *${owner?.name || 'Unknown'}*`,
          `Guild: *${keyData.guildName || 'Affiliate'}*`,
          `⏳ Time remaining: *${timeLeft}*`,
          `📊 Status: ${status}`,
          `👥 Party: ${keyData.raidParty?.length || 0} hunters`,
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── Fallback ──────────────────────────────────────────────────────────────
    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🚪 *GATE COMMANDS*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `/gate               — list active gates`,
        `/gate buy           — reply to spawn to buy`,
        `/gate enter --<KEY> — open gate in dungeon GC`,
        `/gate apply --<KEY> — join raid party`,
        `/gate party --<KEY> — view party`,
        `/gate status --<KEY>— key info`,
        ``,
        `/contract <x%> @user — set payout contract`,
        `/affiliate grant @user — grant affiliate`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  },
};

// ── /contract <percent> @user ─────────────────────────────────────────────────
const contract = {
  name: 'contract',
  description: 'Set a payout contract for a contracted hunter',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first!' }, { quoted: msg });

    const percentArg = parseFloat((args[0] || '').replace('%', ''));
    const targetJid  = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                    || msg.message?.extendedTextMessage?.contextInfo?.participant;

    if (isNaN(percentArg) || !targetJid) {
      return sock.sendMessage(chatId, {
        text: `❌ Usage: /contract <percent%> @hunter\nExample: /contract 20% @hunter`,
      }, { quoted: msg });
    }

    // Find the active key for this dungeon GC
    const dc = GKM.getDungeonGC(chatId);
    if (!dc?.activeKeyId) {
      return sock.sendMessage(chatId, {
        text: `❌ No active gate in this dungeon GC.\nEnter a gate first with /gate enter --<KEY>`,
      }, { quoted: msg });
    }

    const result = GKM.setContract(dc.activeKeyId, sender, targetJid, percentArg, db);
    if (!result.success) {
      return sock.sendMessage(chatId, { text: `❌ ${result.error}` }, { quoted: msg });
    }

    saveDatabase();

    const target = db.users?.[targetJid];
    return sock.sendMessage(chatId, {
      text: [
        `📋 *CONTRACT SET*`,
        ``,
        `Hunter: *${target?.name || targetJid.split('@')[0]}*`,
        `Cut: *${percentArg}%* of Nexus & crystals`,
        ``,
        `Paid out automatically after gate is cleared.`,
      ].join('\n'),
      mentions: [targetJid],
    }, { quoted: msg });
  },
};

// ── /affiliate grant|revoke @user ─────────────────────────────────────────────
const affiliate = {
  name: 'affiliate',
  description: 'Grant or revoke affiliate status',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first!' }, { quoted: msg });

    const sub       = (args[0] || '').toLowerCase();
    const targetJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    // Parse: /affiliate grant @user | 60  → pct after '|'
    const pipes = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const pctMatch = pipes.match(/\|\s*(\d{1,3})/i);
    const pct = pctMatch ? parseInt(pctMatch[1], 10) : NaN;

    if (!['grant', 'request', 'revoke', 'list'].includes(sub)) {
      return sock.sendMessage(chatId, {
        text: `❌ Usage:\n/affiliate grant @user | <pct>\n/affiliate request <CODE> @user | <pct>\n/affiliate revoke @user\n/affiliate list`,
      }, { quoted: msg });
    }

    if (sub === 'list') {
      const guildName = player.guild;
      if (!guildName) return sock.sendMessage(chatId, { text: `❌ You must be in a guild.` }, { quoted: msg });

      const affs = Object.values(db.affiliates || {}).filter(a => a.guildName === guildName);
      if (!affs.length) return sock.sendMessage(chatId, { text: `No affiliates for *${guildName}* yet.` }, { quoted: msg });

      const lines = affs.map((a, i) => {
        const p = db.users?.[a.jid];
        return `  ${i+1}. *${p?.name || a.jid.split('@')[0]}* — ${a.pct || 0}% loot share`;
      });

      return sock.sendMessage(chatId, {
        text: [`━━━━━━━━━━━━━━━━━━━━━━━━━━━`, `🤝 *${guildName} AFFILIATES*`, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, ``, ...lines, ``, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`].join('\n'),
      }, { quoted: msg });
    }

    if (!targetJid) {
      return sock.sendMessage(chatId, { text: `❌ Tag the hunter you want to ${sub}.` }, { quoted: msg });
    }

    const guildName = player.guild;
    if (!guildName) return sock.sendMessage(chatId, { text: `❌ You must be a guild master to manage affiliates.` }, { quoted: msg });

    const target = db.users?.[targetJid];
    if (!target) return sock.sendMessage(chatId, { text: `❌ That hunter is not registered.` }, { quoted: msg });

    if (sub === 'grant') {
      const result = GKM.grantAffiliate(sender, targetJid, guildName, pct, db, saveDatabase);
      if (!result.success) return sock.sendMessage(chatId, { text: `❌ ${result.error}` }, { quoted: msg });

      return sock.sendMessage(chatId, {
        text: [
          `🤝 *AFFILIATE GRANTED*`,
          ``,
          `*${target.name}* is now an affiliate of *${guildName}*.`,
          ``,
          `📊 Loot share: *${pct}%* of gate loot to the affiliate party`,
          `   (shared equally among participating affiliates)`,
          `💠 Guild treasury keeps the remaining *${100 - pct}%*.`,
          ``,
          `They can now:`,
          `• Buy gates using personal funds`,
          `• Participate in the affiliate party on guild raids`,
        ].join('\n'),
        mentions: [targetJid],
      }, { quoted: msg });
    }

    if (sub === 'request') {
      // /affiliate request <CODE> @user | <pct>  → one-off hire for that raid
      const gateCode = (args[1] || '').toUpperCase().replace(/^--/, '').trim();
      if (!gateCode || gateCode.length !== 8) {
        return sock.sendMessage(chatId, { text: `❌ Usage: /affiliate request <CODE> @user | <pct>\nExample: /affiliate request 2K7SN2N8 @user | 60` }, { quoted: msg });
      }
      if (!targetJid) {
        return sock.sendMessage(chatId, { text: `❌ Tag the hunter you want to recruit.` }, { quoted: msg });
      }
      const result = GKM.requestAffiliate(sender, targetJid, guildName, gateCode, pct, db, saveDatabase);
      if (!result.success) return sock.sendMessage(chatId, { text: `❌ ${result.error}` }, { quoted: msg });

      return sock.sendMessage(chatId, {
        text: [
          `🛡️ *AFFILIATE REQUESTED (one-off hire)*`,
          ``,
          `*${target.name}* has been recruited to help raid the gate.`,
          ``,
          `🎯 Gate: \`${gateCode}\``,
          `📊 Paid: *${pct}%* of that gate's loot (one-off)`,
          ``,
          `They can now join the raid with /gateraid ${gateCode} join.`,
        ].join('\n'),
        mentions: [targetJid],
      }, { quoted: msg });
    }

    if (sub === 'revoke') {
      const result = GKM.revokeAffiliate(sender, targetJid, guildName, db, saveDatabase);
      if (!result.success) return sock.sendMessage(chatId, { text: `❌ ${result.error}` }, { quoted: msg });

      return sock.sendMessage(chatId, {
        text: `🚫 *${target.name}* has been removed as an affiliate of *${guildName}*.`,
        mentions: [targetJid],
      }, { quoted: msg });
    }
  },
};

// ── /setdungeon ───────────────────────────────────────────────────────────────
const setdungeon = {
  name: 'setdungeon',
  description: 'Register this group as a dungeon GC (owner/coowner only)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ This command only works in group chats.' }, { quoted: msg });
    }
    if (!isOwnerOrCoOwner(sender)) {
      return sock.sendMessage(chatId, { text: '❌ Only the owner or co-owner can register dungeon GCs.' }, { quoted: msg });
    }

    const db = getDatabase();
    GKM.setDungeonGC(chatId, sender);
    if (!db.dungeonGCs) db.dungeonGCs = {};
    db.dungeonGCs[chatId] = { chatId, setBy: sender, setAt: Date.now(), activeKeyId: null };
    saveDatabase();

    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `✅ *DUNGEON GC REGISTERED*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `This group is now a registered dungeon GC.`,
        `Gate raids can be opened here with:`,
        `/gate enter --<KEY>`,
        ``,
        `One active gate at a time.`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  },
};

// ── /removedungeon ────────────────────────────────────────────────────────────
const removedungeon = {
  name: 'removedungeon',
  description: 'Unregister this group as a dungeon GC',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    if (!isOwnerOrCoOwner(sender)) {
      return sock.sendMessage(chatId, { text: '❌ Only the owner or co-owner can remove dungeon GCs.' }, { quoted: msg });
    }

    const db = getDatabase();
    GKM.removeDungeonGC(chatId);
    if (db.dungeonGCs?.[chatId]) delete db.dungeonGCs[chatId];
    saveDatabase();

    return sock.sendMessage(chatId, { text: `✅ This group has been removed as a dungeon GC.` }, { quoted: msg });
  },
};

// ── /dungeons ─────────────────────────────────────────────────────────────────
const dungeons = {
  name: 'dungeons',
  description: 'List all registered dungeon GCs (owner/coowner only)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    if (!isOwnerOrCoOwner(sender)) {
      return sock.sendMessage(chatId, { text: '❌ Owner/co-owner only.' }, { quoted: msg });
    }

    const all = GKM.getAllDungeonGCs();
    const list = Object.values(all);

    if (!list.length) {
      return sock.sendMessage(chatId, { text: `No dungeon GCs registered yet.\nUse /setdungeon in the group you want to register.` }, { quoted: msg });
    }

    const lines = list.map((gc, i) => {
      const status = gc.activeKeyId ? `⚔️ Active raid` : `💤 Idle`;
      return `  ${i+1}. \`${gc.chatId.split('@')[0]}\` — ${status}`;
    });

    return sock.sendMessage(chatId, {
      text: [`━━━━━━━━━━━━━━━━━━━━━━━━━━━`, `🏰 *DUNGEON GCS (${list.length})*`, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, ``, ...lines, ``, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`].join('\n'),
    }, { quoted: msg });
  },
};

module.exports = { gate, contract, affiliate, setdungeon, removedungeon, dungeons };
