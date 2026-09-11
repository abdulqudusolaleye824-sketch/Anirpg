// ═══════════════════════════════════════════════════════════════
// GATES — Full gate system with keys, dungeon GCs, affiliates
// ═══════════════════════════════════════════════════════════════

'use strict';

const fs                           = require('fs');
const { GateManager, GATE_RANKS }  = require('../../rpg/dungeons/GateManager');
const { AWAKENING_RANKS }          = require('../../rpg/utils/SoloLevelingCore');
const GKM                          = require('../../rpg/dungeons/GateKeyManager');
const UI = require('../../rpg/utils/UI');
const SerfManager                  = require('../../rpg/utils/SerfManager');

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
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    GateManager.checkGateBreaks(chatId, sock);

    const sub = (args[0] || 'list').toLowerCase();
    const sub2 = (args[1] || '').toLowerCase();

    // ── /gate key list / /gate keys ───────────────────────────────────────────
    if (sub === 'keys' || sub === 'keylist' || (sub === 'key' && (sub2 === 'list' || sub2 === 'ls' || !sub2))) {
      const allKeys = Object.entries(db.gateKeys || {}).filter(([, k]) => {
        return normaliseJid(k.ownedBy) === normaliseJid(sender)
            && !k.expired
            && !k.raidComplete
            && Date.now() < k.expiresAt;
      });

      if (allKeys.length === 0) {
        return sock.sendMessage(chatId, {
          text: [
            ...(pro ? [UI.PRO_BAR, `🔑 *YOUR UNUSED GATE KEYS* 💎`, UI.PRO_BAR] : [`🔑 *YOUR UNUSED GATE KEYS*`, UI.FREE_BAR]),
            ``,
            `❌ You have no active unused gate keys.`,
            `Buy a gate using */gate buy* when a gate spawns!`,
            ...(pro ? [FRAME] : [FRAME, UI.upsell()]),
          ].join('\n'),
        }, { quoted: msg });
      }

      const lines = [
        ...(pro ? [UI.PRO_BAR, `🔑 *YOUR UNUSED GATE KEYS (${allKeys.length})* 💎`, UI.PRO_BAR] : [`🔑 *YOUR UNUSED GATE KEYS (${allKeys.length})*`, UI.FREE_BAR]),
        ``,
      ];

      allKeys.forEach(([key, k], i) => {
        const rd = GATE_RANKS[k.gateRank] || { emoji: '🚪', label: `${k.gateRank}-Rank` };
        const timeLeft = GKM.formatStability(Math.max(0, k.expiresAt - Date.now()));
        const boughtAt = k.purchasedAt ? new Date(k.purchasedAt).toUTCString().replace(' GMT', ' WAT') : 'Unknown';
        const expiresAtStr = k.expiresAt ? new Date(k.expiresAt).toUTCString().replace(' GMT', ' WAT') : 'Unknown';
        lines.push(`${i + 1}. ${rd.emoji} *${rd.label}*`);
        lines.push(`   🔑 Code: \`${key}\``);
        lines.push(`   🏰 Guild: *${k.guildName || 'Solo/Affiliate'}*`);
        lines.push(`   🕒 Bought: *${boughtAt}*`);
        lines.push(`   ⏳ Expires: *${expiresAtStr}*`);
        lines.push(`   ⏱️ Time left: *${timeLeft}*`);
        lines.push(``);
      });

      lines.push(FRAME);
      lines.push(`📌 *How to use:*`);
      lines.push(`Go to a registered dungeon GC and run:`);
      lines.push(`/party create --<CODE>`);
      if (pro) {
        const soonest = Math.min(...allKeys.map(([, k]) => k.expiresAt || Infinity));
        lines.push(FRAME, UI.PRO_MINI, `💎 *PRO KEYRING* — ${allKeys.length} keys · soonest lapses in ${soonest === Infinity ? '?' : GKM.formatStability(Math.max(0, soonest - Date.now()))}`);
      } else lines.push(FRAME, UI.upsell());

      const fullText = lines.join('\n');
      // FIX: also DM the list to user's serf (user requested DM copy)
      try {
        const MSM = require('../../bots/MultiSocketManager');
        const serf = SerfManager.getSerf(db, sender);
        const serfSock = serf?.botKey ? MSM.getSocket(serf.botKey) : null;
        const dmSock = serfSock || sock;
        // Only DM if chat is a group (avoid duplicate in DM)
        if (chatId.endsWith('@g.us') && dmSock) {
          await dmSock.sendMessage(sender, { text: fullText }).catch(()=>{});
        }
      } catch (e) {}

      return sock.sendMessage(chatId, { text: fullText }, { quoted: msg });
    }

    // ── /gate (list) ──────────────────────────────────────────────────────────
    if (sub === 'list' || sub === 'gates' || !args[0]) {
      const active = GateManager.getActiveGatesForChat(chatId);

      if (active.length === 0) {
        return sock.sendMessage(chatId, {
          text: [
            ...(pro ? [UI.PRO_BAR, `「System」 *NO ACTIVE GATES* 💎`, UI.PRO_BAR] : [`「System」 *NO ACTIVE GATES*`, UI.FREE_BAR]),
            ``,
            `No dimensional rifts detected in this area.`,
            `Gates spawn periodically. Stay alert, hunter.`,
            ...(pro ? [FRAME] : [FRAME, UI.upsell()]),
          ].join('\n'),
        }, { quoted: msg });
      }

      const rankData = AWAKENING_RANKS[player.awakenRank || 'E'];
      let txt = pro ? `${UI.PRO_BAR}\n「System」 *ACTIVE GATES* 💎\n${UI.PRO_BAR}\n\n` : `「System」 *ACTIVE GATES*\n${UI.FREE_BAR}\n\n`;
      txt += `${rankData.emoji} Your rank: *${rankData.label}*\n`;
      txt += `🚪 Gates can be purchased by Guild Officers or Granted Affiliates.\n\n`;

      for (const g of active) {
        txt += GateManager.formatGate(g) + `\n${FRAME}\n`;
      }

      txt += `\n📌 Reply to a gate announcement with */gate buy* to purchase.`;
      txt += pro ? `\n${FRAME}\n${UI.PRO_MINI}\n💎 *PRO SENSE* — best rift: ${['S','A','B','C','D','E'].find(r => active.some(g => g.rank === r)) || '?'}-Rank` : `\n${FRAME}\n${UI.upsell()}`;

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
      gateObj.breakTime   = result.keyData.expiresAt; // FIX: sync gate break with key expiry (fixes "no longer active" before key expires)

      const rd          = GATE_RANKS[gateObj.rank];
      const stability   = GKM.formatStability(result.stabilityMs);
      const paidFrom    = result.keyData.paymentSource === 'guild' ? `*${result.keyData.guildName}* guild treasury` : 'your personal balance';

      // GC Output: Do NOT reveal the gate key in public!
      await sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `🔑 *GATE PURCHASED!* 💎`, UI.PRO_BAR] : [`🔑 *GATE PURCHASED!*`, UI.FREE_BAR]),
          `${rd.emoji} Gate: *${rd.label}* [${gateId}]`,
          `💠 Paid from: ${paidFrom}`,
          `⏳ Gate stable for: *${stability}*`,
          ``,
          `📬 *Your gate key has been sent privately to your DM via your serf bot!*`,
          ...(pro ? [FRAME, UI.PRO_MINI, `💎 *PRO CLAIM* — ${rd.label} · stable ${stability}`] : [FRAME, UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });

      const expiresDate = new Date(result.keyData.expiresAt).toUTCString().replace(' GMT', ' WAT');
      
      const keyDmText = [
        ...(pro ? [UI.PRO_BAR, `🔑 *YOUR GATE KEY* 💎`, UI.PRO_BAR] : [`🔑 *YOUR GATE KEY*`, UI.FREE_BAR]),
        `${rd.emoji} Gate: *${rd.label}*`,
        `🆔 Gate ID: \`${gateId}\``,
        ``,
        `🔑 *Key: \`${result.key}\`*`,
        ``,
        `⏳ Stable until: *${expiresDate}* (${stability})`,
        `${FRAME}`,
        `📌 *HOW TO RAID:*`,
        `1. Go to your registered dungeon GC`,
        `2. Create party: /party create --${result.key}`,
        `3. Members join: /party join ${result.key}`,
        `4. Members ready: /party ready`,
        `5. Launch raid: /party raid`,
        ...(pro ? [FRAME] : [FRAME, UI.upsell()]),
      ].join('\n');

      try {
        const MultiSocketManager = require('../../bots/MultiSocketManager');
        const serfSock = serf.botKey ? MultiSocketManager.getSocket(serf.botKey) : sock;
        if (serfSock) {
          await serfSock.sendMessage(sender, { text: keyDmText }).catch(() => {});
        }
      } catch (e) {}

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
          ...(pro ? [UI.PRO_BAR, `🔑 *KEY STATUS* 💎`, UI.PRO_BAR] : [`🔑 *KEY STATUS*`, UI.FREE_BAR]),
          `${rd.emoji || '🚪'} Gate: *${rd.label || keyData.gateRank}*`,
          `Key: \`${keyArg}\``,
          `Owner: *${owner?.name || 'Unknown'}*`,
          `Guild: *${keyData.guildName || 'Affiliate/Solo'}*`,
          `⏳ Time remaining: *${timeLeft}*`,
          `📊 Status: ${status}`,
          `👥 Party: ${keyData.raidParty?.length || 0} hunters`,
          ...(pro ? [FRAME] : [FRAME, UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── Fallback ──────────────────────────────────────────────────────────────
    return sock.sendMessage(chatId, {
      text: [
        ...(pro ? [UI.PRO_BAR, `🚪 *GATE COMMANDS* 💎`, UI.PRO_BAR] : [`🚪 *GATE COMMANDS*`, UI.FREE_BAR]),
        `/gate                — list active gates`,
        `/gate buy            — reply to gate spawn to buy`,
        `/party create --<KEY> — open party with gate key`,
        `/party join <KEY>    — join gate party`,
        `/party ready         — toggle ready status`,
        `/party raid          — launch raid once ready`,
        ...(pro ? [FRAME] : [FRAME, UI.upsell()]),
      ].join('\n'),
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
    const sdPro = UI.isPro(db.users?.[sender]);
    GKM.setDungeonGC(chatId, sender);
    if (!db.dungeonGCs) db.dungeonGCs = {};
    db.dungeonGCs[chatId] = { chatId, setBy: sender, setAt: Date.now(), activeKeyId: null };
    saveDatabase();

    return sock.sendMessage(chatId, {
      text: [
        ...(sdPro ? [UI.PRO_BAR, `✅ *DUNGEON GC REGISTERED* 💎`, UI.PRO_BAR] : [`✅ *DUNGEON GC REGISTERED*`, UI.FREE_BAR]),
        `This group is now a registered dungeon GC.`,
        `Gate parties can be opened here with:`,
        `/party create --<KEY>`,
        sdPro ? UI.PRO_BAR : UI.FREE_BAR,
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
    const dgPro = UI.isPro(getDatabase().users?.[sender]);

    if (!list.length) {
      return sock.sendMessage(chatId, { text: `No dungeon GCs registered yet.\nUse /setdungeon in the group you want to register.` }, { quoted: msg });
    }

    const lines = list.map((gc, i) => {
      const status = gc.activeKeyId ? `⚔️ Active raid` : `💤 Idle`;
      return `  ${i+1}. \`${gc.chatId.split('@')[0]}\` — ${status}`;
    });

    return sock.sendMessage(chatId, {
      text: [...(dgPro ? [UI.PRO_BAR, `🏰 *DUNGEON GCS (${list.length})* 💎`, UI.PRO_BAR] : [`🏰 *DUNGEON GCS (${list.length})*`, UI.FREE_BAR]), ``, ...lines, ``, dgPro ? UI.PRO_BAR : UI.FREE_BAR].join('\n'),
    }, { quoted: msg });
  },
};

module.exports = { gate, affiliate: affiliateCmd, setdungeon, removedungeon, dungeons };
