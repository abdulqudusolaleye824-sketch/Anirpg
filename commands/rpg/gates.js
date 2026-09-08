// ═══════════════════════════════════════════════════════════════
// GATES — Full gate system with keys, dungeon GCs, affiliates
// ═══════════════════════════════════════════════════════════════

'use strict';

const fs                           = require('fs');
const { GateManager, GATE_RANKS }  = require('../../rpg/dungeons/GateManager');
const { AWAKENING_RANKS }          = require('../../rpg/utils/SoloLevelingCore');
const GKM                          = require('../../rpg/dungeons/GateKeyManager');
const SerfManager                  = require('../../rpg/utils/SerfManager');
const MultiSocketManager           = require('../../bots/MultiSocketManager');

function normaliseJid(jid) {
  return jid?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '') || '';
}

function isOwnerOrCoOwner(sender) {
  const ownerNum   = normaliseJid(process.env.OWNER_JID   || '221951679328499@lid');
  const coOwnerNum = normaliseJid(process.env.COOWNER_JID || '194592469209292@lid');
  const sNum       = normaliseJid(sender);
  return sNum === ownerNum || sNum === coOwnerNum;
}

const gate = {
  name: 'gate',
  aliases: ['gates'],
  description: 'Gate system — list & buy gates',

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
      txt += `🚪 Anyone with an approved serf can buy gate keys.\n\n`;

      for (const g of active) {
        txt += GateManager.formatGate(g) + '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      }

      txt += `\n📌 Reply to a gate announcement with */gate buy* to purchase.`;

      const topGate = active.sort((a,b) => {
        const order = ['S','A','B','C','D','E'];
        return order.indexOf(a.rank) - order.indexOf(b.rank);
      })[0];

      const imagePath = GateManager.getGateImage(topGate?.rank || 'E');
      if (fs.existsSync(imagePath)) {
        return sock.sendMessage(chatId, {
          image: fs.readFileSync(imagePath),
          mimetype: 'image/jpeg',
          caption: txt
        }, { quoted: msg });
      }

      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /gate buy ─────────────────────────────────────────────────────────────
    if (sub === 'buy' || sub === 'purchase') {
      // 1. Serf Check Requirement
      const serf = SerfManager.getSerf(db, sender);
      if (!serf) {
        return sock.sendMessage(chatId, {
          text: `❌ No serf detected! Set a serf first using /setserf @bot so you can receive DM notifications.`
        }, { quoted: msg });
      }

      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quotedMsg = contextInfo?.quotedMessage;

      const quotedText =
        quotedMsg?.imageMessage?.caption ||
        quotedMsg?.conversation ||
        quotedMsg?.extendedTextMessage?.text ||
        quotedMsg?.videoMessage?.caption ||
        '';

      let gateId = null;

      if (quotedText) {
        const match = quotedText.match(/GATE\s*ID:\s*\*?([Gg]-[\w-]+)\*?/i)
                   || quotedText.match(/ID:\s*\*?([Gg]-[\w-]+)\*?/i)
                   || quotedText.match(/([Gg]-\d+-\d+)/i);
        if (match) {
          gateId = match[1];
        }
      }

      // Fallback: If no quote or no ID in quote, auto-select single active unbought gate in this GC
      if (!gateId) {
        const activeGates = GateManager.getActiveGatesForChat(chatId);
        const unboughtGates = activeGates.filter(g => g.active && !g.owned && !g.purchased && !g.cleared && !g.broken);
        if (unboughtGates.length === 1) {
          gateId = unboughtGates[0].id;
        } else if (unboughtGates.length > 1) {
          const gateList = unboughtGates.map(g => `${g.rank}-Rank [${g.id}]`).join(', ');
          return sock.sendMessage(chatId, {
            text: `❌ Multiple active gates detected in this chat: ${gateList}.\n\nReply directly to the gate image you want to buy with */gate buy*.`
          }, { quoted: msg });
        }
      }

      if (!gateId) {
        return sock.sendMessage(chatId, {
          text: `❌ Reply to a gate spawn announcement image with */gate buy* to purchase it.\n\n(No active unbought gate detected in this chat).`
        }, { quoted: msg });
      }

      GateManager.checkGateBreaks(chatId, sock);

      const gateObj = GateManager.getGate(gateId);
      if (!gateObj || gateObj.chatId !== chatId) {
        return sock.sendMessage(chatId, { text: '❌ That gate is no longer available in this chat.' }, { quoted: msg });
      }
      if (gateObj.cleared || gateObj.broken) {
        return sock.sendMessage(chatId, { text: '❌ That gate is no longer active.' }, { quoted: msg });
      }
      if (gateObj.purchased || gateObj.owned) {
        return sock.sendMessage(chatId, { text: `❌ This gate has already been purchased.` }, { quoted: msg });
      }

      const result = GKM.purchaseGateKey(sender, gateObj, db, saveDatabase);
      if (!result.success) {
        return sock.sendMessage(chatId, { text: result.error }, { quoted: msg });
      }

      gateObj.purchased   = true;
      gateObj.owned       = true;
      gateObj.purchasedBy = sender;
      gateObj.keyId       = result.key;

      const rd          = GATE_RANKS[gateObj.rank];
      const stability   = GKM.formatStability(result.stabilityMs);
      const paidFrom    = result.keyData.paymentSource === 'guild' ? `*${result.keyData.guildName}* guild treasury` : 'your personal balance';

      // GC Output: Do NOT reveal the gate key in public!
      await sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🔑 *GATE PURCHASED!*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${rd.emoji} Gate: *${rd.label}* [${gateId}]`,
          `💠 Paid from: ${paidFrom}`,
          `⏳ Gate stable for: *${stability}*`,
          ``,
          `📬 *Your gate key has been sent privately to your DM via your serf bot!*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });

      const expiresDate = new Date(result.keyData.expiresAt).toUTCString().replace(' GMT', ' WAT');
      
      const keyDmText = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🔑 *YOUR GATE KEY*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `${rd.emoji} Gate: *${rd.label}*`,
        `🆔 Gate ID: \`${gateId}\``,
        ``,
        `🔑 *Key: \`${result.key}\`*`,
        ``,
        `⏳ Stable until: *${expiresDate}* (${stability})`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📌 *HOW TO RAID:*`,
        `1. Go to your registered dungeon GC`,
        `2. Create party: /party create --${result.key}`,
        `3. Members join: /party join ${result.key}`,
        `4. Members ready: /party ready`,
        `5. Launch raid: /party raid`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n');

      const serfSock = serf.botKey ? MultiSocketManager.getSocket(serf.botKey) : sock;
      if (serfSock) {
        await serfSock.sendMessage(sender, { text: keyDmText }).catch(() => {});
      }

      return;
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
          `${rd.emoji || '🚪'} Gate: *${rd.label || keyData.gateRank}*`,
          `Key: \`${keyArg}\``,
          `Owner: *${owner?.name || 'Unknown'}*`,
          `Guild: *${keyData.guildName || 'Affiliate/Solo'}*`,
          `⏳ Time remaining: *${timeLeft}*`,
          `📊 Status: ${status}`,
          `👥 Party: ${keyData.raidParty?.length || 0} hunters`,
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
        `/gate                — list active gates`,
        `/gate buy            — reply to gate spawn to buy`,
        `/party create --<KEY> — open party with gate key`,
        `/party join <KEY>    — join gate party`,
        `/party ready         — toggle ready status`,
        `/party raid          — launch raid once ready`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  },
};

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

    const dc = GKM.getDungeonGC(chatId);
    if (!dc?.activeKeyId) {
      return sock.sendMessage(chatId, {
        text: `❌ No active party in this dungeon GC. Open a party first with /party create --<KEY>`,
      }, { quoted: msg });
    }

    const keyData = GKM.getKey(dc.activeKeyId) || db.gateKeys?.[dc.activeKeyId];
    if (!keyData) return sock.sendMessage(chatId, { text: '❌ Party key not found.' }, { quoted: msg });

    if (!keyData.contracts) keyData.contracts = {};
    keyData.contracts[targetJid] = percentArg;

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

const affiliateCmd = require('./affiliate');

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
        `This group is now a registered dungeon GC.`,
        `Gate parties can be opened here with:`,
        `/party create --<KEY>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  },
};

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

module.exports = { gate, contract, affiliate: affiliateCmd, setdungeon, removedungeon, dungeons };
