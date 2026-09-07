// ═══════════════════════════════════════════════════════════════
// /set — Bot configuration flags
//
//   /set --mod @user --true     — promote user to mod
//   /set --mod @user --false    — demote mod
//   /set --maintenance --true   — toggle maintenance mode
//   /set --title @user <id>     — grant any title (owner-only)
//
// Owners are HARDCODED (Senku + Naruto) and CANNOT be modified.
// Only owners can /set --mod and /set --title. Mods can use other /set flags.
// ═══════════════════════════════════════════════════════════════

const Perms = require('../../utils/permissions');
const { stripDevice, OWNER_JID, COOWNER_JID } = require('../../utils/constants');
const Mod = require('../../rpg/utils/ModerationUtils');
module.exports = {
  name: 'set',
  aliases: ['config', 'toggle'],
  description: '⚙️ Set bot flags (mod/maintenance/title)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // Must be at least a mod to use /set
    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot mods/owners can use /set.'
      }, { quoted: msg });
    }

    // Parse flags. Accept both forms:
    //   /set --mod @user --true    (--flag [value] [--bool])
    //   /set spawn --true           (flag as a bare first word)
    const flags = {};
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (!a.startsWith('--')) continue;
      const key = a.slice(2).toLowerCase();
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true'; // bare --flag means toggle to true
      }
    }

    // If the flag was given as a bare first word (e.g. `/set spawn --true`),
    // use that as the requested flag instead of a `--spawn` token.
    let requestedFlag = (args[0] && !args[0].startsWith('--'))
      ? args[0].toLowerCase()
      : null;
    if (!requestedFlag) requestedFlag = Object.keys(flags)[0] || null;
    if (!requestedFlag) {
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ *SET COMMANDS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

⭐ *MOD MANAGEMENT* (owner-only)
\`/set --mod @user --true\`    promote
\`/set --mod @user --false\`   demote

👑 *OWNER MANAGEMENT*
_Owners (Senku + Naruto) are permanent and cannot be modified._

🎖️ *TITLE GRANT* (owner-only)
\`/set --title @user <titleId>\`  grant any title (incl. mythic)

🔧 *BOT FLAGS* (mod+)
\`/set --maintenance --true\`  ignore non-mod commands
\`/set --maintenance --false\` resume normal
\`/set spawn --true\`        allow gates to spawn in THIS group
\`/set spawn --false\`       stop gates spawning here

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── /set --mod @user --true/false ────────────────────────────
    if (requestedFlag === 'mod') {
      if (!Perms.isBotOwner(db, sender)) {
        return sock.sendMessage(chatId, {
          text: '❌ Only bot owners can add/remove mods.'
        }, { quoted: msg });
      }
      return await handleModFlag(sock, msg, db, saveDatabase, sender, args);
    }

    // ── /set --maintenance --true/false ─────────────────────────
    if (requestedFlag === 'maintenance') {
      if (!Array.isArray(db.botMods))   db.botMods   = [];
      if (!db.maintenance)              db.maintenance = false;
      const want = args.some(a => /^--true$/i.test(a))  ? true
                 : args.some(a => /^--false$/i.test(a)) ? false
                 : null;
      if (want === null) {
        return sock.sendMessage(chatId, {
          text: '❌ Usage: `--maintenance --true` or `--false`'
        }, { quoted: msg });
      }
      db.maintenance = want;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔧 *MAINTENANCE MODE: ${want ? 'ON' : 'OFF'}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${want
  ? '🚧 Non-mod commands will be silently ignored.\nMods/owners can still use all commands.'
  : '✅ Bot is back to normal. Everyone can use commands.'}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── /set spawn --true/--false (mod+) — allow gates to spawn in THIS group ──
    if (requestedFlag === 'spawn') {
      if (!Perms.isBotMod(db, sender)) {
        return sock.sendMessage(chatId, { text: '❌ Only bot mods/owners can toggle gate spawns.' }, { quoted: msg });
      }
      if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ Run this in the group you want gates to spawn in.' }, { quoted: msg });
      }
      const want = args.some(a => /^--true$/i.test(a))  ? true
                 : args.some(a => /^--false$/i.test(a)) ? false
                 : null;
      if (want === null) {
        return sock.sendMessage(chatId, { text: '❌ Usage: `/set spawn --true` or `--false`' }, { quoted: msg });
      }
      if (!db.gateSpawns) db.gateSpawns = {};
      db.gateSpawns[chatId] = want;
      // If enabling, kick off the spawner for this chat (idempotent — won't double-schedule).
      if (want) {
        try {
          const GateSpawner = require('../../handlers/gateSpawner');
          GateSpawner.initialize(sock, chatId, getDatabase);
        } catch (e) { console.error('GateSpawner init error:', e.message); }
      } else {
        try {
          const GateSpawner = require('../../handlers/gateSpawner');
          GateSpawner.stop(chatId);
        } catch (e) {}
      }
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚪 *GATE SPAWNING: ${want ? 'ON' : 'OFF'}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${want
          ? '✅ Gates will now spawn in this group. Players can buy them and raid.\nFirst gate in a few minutes.'
          : '🛑 Gates will no longer spawn in this group.'}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── /set --title <@user> <titleId> (owner-only) ───────────
    if (requestedFlag === 'title') {
      if (!Perms.isBotOwner(db, sender)) {
        return sock.sendMessage(chatId, {
          text: '❌ Only bot owners can grant titles.'
        }, { quoted: msg });
      }
      return await handleTitleGrant(sock, msg, db, saveDatabase, sender, args.slice(1));
    }

    return sock.sendMessage(chatId, {
      text: `❌ Unknown flag: \`--${requestedFlag}\`\n\nRun \`/set\` to see available flags.`
    }, { quoted: msg });
  }
};

// ── Handlers ────────────────────────────────────────────────

async function handleModFlag(sock, msg, db, saveDatabase, sender, rawArgs) {
  const chatId = msg.key.remoteJid;
  const args   = rawArgs || [];

  // Determine the boolean from an explicit --true / --false token.
  // (The generic flag parser consumes a mentioned @user as --mod's value, so we
  //  must look for the boolean token separately, not read flags.mod.)
  let value = true; // default: promote
  if (args.some(a => /^--true$/i.test(a)))       value = true;
  else if (args.some(a => /^--false$/i.test(a))) value = false;

  const target = extractTarget(msg)            // mention OR reply
    || args.find(a => /^@/.test(a))            // raw @mention in text
    || null;

  if (!target) {
    return sock.sendMessage(chatId, {
      text: '❌ Tag a user or reply to their message:\n`/set --mod @user --true`'
    }, { quoted: msg });
  }

  const cleanTarget = stripDevice(target);
  const targetBare = Mod.bare(target);
  if (Mod.bare(cleanTarget) === Mod.bare(OWNER_JID) || Mod.bare(cleanTarget) === Mod.bare(COOWNER_JID)) {
    return sock.sendMessage(chatId, {
      text: '❌ Owner and Co-Owner cannot be (de)modded — they are above mods.'
    }, { quoted: msg });
  }

  if (!Array.isArray(db.botMods)) db.botMods = [];
  const alreadyMod = db.botMods.some(j => Mod.bare(j) === targetBare);

  if (value) {
    if (alreadyMod) {
      return sock.sendMessage(chatId, { text: '⚠️ That user is already a mod.' }, { quoted: msg });
    }
    db.botMods.push(targetBare);   // store bare number (matches Mod/Perms checks)
    saveDatabase();
    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⭐ *MOD PROMOTED*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 @${targetBare} is now a mod.\n\nThey can now use: /ban, /mute, /kick, /tagall, /set, /mods\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [target, sender]
    }, { quoted: msg });
  } else {
    if (!alreadyMod) {
      return sock.sendMessage(chatId, { text: '⚠️ That user is not a mod.' }, { quoted: msg });
    }
    db.botMods = db.botMods.filter(j => Mod.bare(j) !== targetBare);
    saveDatabase();
    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ *MOD DEMOTED*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 @${targetBare} is no longer a mod.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [target, sender]
    }, { quoted: msg });
  }
}

// ── helpers ─────────────────────────────────────────────────

function parseBool(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).toLowerCase();
  if (['true', '1', 'yes', 'on', 'enable'].includes(s))  return true;
  if (['false', '0', 'no', 'off', 'disable'].includes(s)) return false;
  return null;
}

function extractTarget(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      || msg.message?.extendedTextMessage?.contextInfo?.participant
      || null;
}

// ── Title grant handler (owner-only) ────────────────────────
async function handleTitleGrant(sock, msg, db, saveDatabase, sender, args) {
  const chatId = msg.key.remoteJid;
  const { TITLES, RARITIES } = require('../../rpg/utils/TitleSystem');

  const userToken = args.find(a => a.startsWith('@') || a.includes('@s.whatsapp.net') || a.includes('@lid'));
  const titleId   = args.find(a => !a.startsWith('@') && !a.includes('@'));

  if (!userToken || !titleId) {
    return sock.sendMessage(chatId, {
      text: `❌ Usage: \`/set --title @user <titleId>\`\n\nExample: \`/set --title @user World Savior\`\n\nRun \`/title all\` to see all title IDs.`
    }, { quoted: msg });
  }

  let targetId = null;
  if (userToken.startsWith('@')) {
    targetId = extractTarget(msg);
  } else {
    targetId = userToken;
  }
  if (!targetId) {
    return sock.sendMessage(chatId, {
      text: '❌ Could not resolve user. Tag them or reply to their message.'
    }, { quoted: msg });
  }
  const targetPlayer = db.users[targetId];
  if (!targetPlayer) {
    return sock.sendMessage(chatId, {
      text: '❌ That user is not registered in the bot.'
    }, { quoted: msg });
  }
  const match = Object.keys(TITLES).find(id =>
    id.toLowerCase() === titleId.toLowerCase() ||
    TITLES[id].display.toLowerCase().includes(titleId.toLowerCase())
  );
  if (!match) {
    return sock.sendMessage(chatId, {
      text: `❌ Title \`${titleId}\` not found.\nUse \`/title all\` to see all titles.`
    }, { quoted: msg });
  }
  if (!Array.isArray(targetPlayer.titles)) targetPlayer.titles = [];
  if (targetPlayer.titles.includes(match)) {
    return sock.sendMessage(chatId, {
      text: `⚠️ @${targetId.split('@')[0]} already has *${TITLES[match].display}*.`,
      mentions: [targetId]
    }, { quoted: msg });
  }
  targetPlayer.titles.push(match);
  saveDatabase();
  const def = TITLES[match];
  const rarity = RARITIES[def.rarity] || RARITIES.common;
  return sock.sendMessage(chatId, {
    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👑 *TITLE GRANTED*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${rarity.code} *${def.display}*\n\n👤 Granted to: @${targetId.split('@')[0]}\n⚡ Stat Boost: ${def.boostDesc}\n\nUse \`/title equip ${match}\` to equip it.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    mentions: [targetId, sender]
  }, { quoted: msg });
}
