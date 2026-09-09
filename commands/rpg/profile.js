// ═══════════════════════════════════════════════════════════════
// PROFILE — Astra Hunter Profile
// Clean card format — no battle stats
// Shows: Name, Rank, Level, DOB, Skills, Money, Pro, Banned, etc.
// Task 9: shipped as an IMAGE card (custom /seticon, default Astra logo).
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { AWAKENING_RANKS, calculatePowerRating, getPowerLabel } = require('../../rpg/utils/SoloLevelingCore');
const { getQualityLabel } = require('../../rpg/utils/ClassSystem');

// Default /profile image (WA0052 — Astra gold "A" logo).
const DEFAULT_PROFILE_IMG = path.join(__dirname, '..', '..', 'assets', 'profile_default.jpg');

// ── Nigerian Time (WAT = UTC+1) ───────────────────────────────────────────────
function getNigerianDate() {
  return new Date(Date.now() + 3600000)
    .toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── Pro status label ──────────────────────────────────────────────────────────
function getProLabel(player) {
  if (!player.proStatus || !player.proExpiresAt) return 'None';
  if (Date.now() > player.proExpiresAt) return 'Expired';
  const label = player.proStatus.charAt(0).toUpperCase() + player.proStatus.slice(1);
  const daysLeft = Math.ceil((player.proExpiresAt - Date.now()) / 86400000);
  return `${label} (${daysLeft}d left)`;
}

// ── Skills count ──────────────────────────────────────────────────────────────
function getSkillsCount(player) {
  const skills = player.skills || {};
  if (Array.isArray(skills)) return skills.length;
  const active  = Array.isArray(skills.active)  ? skills.active.length  : 0;
  const locked  = Array.isArray(skills.locked)  ? skills.locked.length  : 0;
  return active + locked;
}

// ── Pets count ────────────────────────────────────────────────────────────────
function getPetsCount(player) {
  if (Array.isArray(player.pets) && player.pets.length > 0) return player.pets.length;
  return player.pet ? 1 : 0;
}

// Build the text card (also used as the image caption).
function buildCard(player, db, targetId, mentionedId, isOwnProfile) {
  const rank     = player.awakenRank || 'E';
  const rankData = AWAKENING_RANKS[rank] || { emoji: '⬜', label: `${rank}-Rank` };

  const rankDisplay = player.awakenTier && player.awakenTier > 0
    ? `${rankData.label} ✨ Tier ${player.awakenTier} Awakened`
    : rankData.label;

  let power = 0, powerLabel = { emoji: '⚪', label: 'Unknown' };
  try {
    power = calculatePowerRating(player.stats || {}, Object.values(player.equipped || {}).filter(Boolean), player.pet) || 0;
    powerLabel = getPowerLabel(power) || powerLabel;
  } catch (e) {}

  const cls          = player.evolvedClass || player.class;
  const classBase    = player.classBase || (typeof cls === 'string' ? cls : null);
  const classQuality = player.classQuality || 0;
  const qualLabel    = classBase && classQuality > 0 ? ' — ' + getQualityLabel(classQuality) : '';
  const variantLore  = player.monsterVariant?.lore || null;
  const classDisplay = cls
    ? player.evolvedClass ? cls + ' *(Evolved)*' : cls + qualLabel
    : 'Not assigned';

  const skillsTotal = getSkillsCount(player);
  const petsTotal   = getPetsCount(player);
  const proLabel    = getProLabel(player);
  const isBanned    = !!(player.banned || db.bannedUsers?.[targetId]);
  const Nexus       = (player.gold || 0).toLocaleString();
  const manaStones  = (player.manaCrystals || 0).toLocaleString();
  const guildDisplay = player.guild ? `*${player.guild}*` : 'None';
  const employmentStatus = player.guild ? `Employed 💼 *(${player.guild})*` : `Self-Employed 💼`;

  const petDisplay = player.pet
    ? `${player.pet.emoji || '🐾'} ${player.pet.name || 'Unnamed'} Lv.${player.pet.level || 1}`
    : 'None';

  const skills = player.skills || {};
  const activeSkills = Array.isArray(skills.active) ? skills.active : [];
  const skillLines = activeSkills.length
    ? activeSkills.map((s, i) => `  ${i+1}. *${s.name}* Lv${s.level || 1}`)
    : ['  None equipped'];

  const equippedTitle = player.equippedTitle || 'None';
  const titlesOwned   = (player.titles || []).length;

  const regDate = player.registeredAtWAT
    ? player.registeredAtWAT.slice(0, 10)
    : player.registeredAt
      ? new Date(player.registeredAt + 3600000).toISOString().slice(0, 10)
      : 'Unknown';

  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *${player.name}*`,
    equippedTitle !== 'None' ? `🎖️ "${equippedTitle}"` : null,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `${rankData.emoji} *Rank:* ${rankDisplay}`,
    `⭐ *Level:* ${player.level || 1}`,
    `⚡ *Power:* ${power.toLocaleString()} ${powerLabel.emoji} ${powerLabel.label}`,
    `🎭 *Class:* ${classDisplay}`,
    variantLore ? `_${variantLore}_` : null,
    `🏰 *Guild:* ${guildDisplay}`,
    `🏢 *Status:* ${employmentStatus}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💠 *WEALTH*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💠 Nexus: *${Nexus}*`,
    `💎 Mana Stones: *${manaStones}*`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⚡ *SKILLS (${skillsTotal} total)*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ...skillLines,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 *HUNTER INFO*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    player.dateOfBirth ? `📅 D.O.B: *${player.dateOfBirth}*` : null,
    `🐾 Pets Owned: *${petsTotal}*`,
    petDisplay !== 'None' ? `🐾 Active Pet: ${petDisplay}` : null,
    `🎖️ Titles: *${titlesOwned}* | Equipped: *${equippedTitle}*`,
    `⭐ Pro Status: *${proLabel}*`,
    isBanned ? `🚫 Banned: *True*` : null,
    `📆 Joined: *${regDate}*`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].filter(l => l !== null).join('\n');
}

module.exports = {
  name: 'profile',
  aliases: ['p', 'me', 'hunter', 'card'],
  description: '📋 View your hunter profile',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();

    // Allow viewing another player's profile
    const mentionedId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const targetId    = mentionedId || sender;
    const isOwnProfile = targetId === sender;
    const player       = db.users[targetId];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: mentionedId
          ? `❌ That player is not registered.`
          : `❌ You are not registered! Use */register* to awaken.`,
      }, { quoted: msg });
    }

    if (player.profileLocked && chatId.endsWith('@g.us')) {
      const SerfManager = require('../../rpg/utils/SerfManager');
      const Perms = require('../../utils/permissions');
      const hasSerf = SerfManager.hasApprovedSerf(db, sender) || Perms.isBotOwner(db, sender) || Perms.isBotMod(db, sender);

      const dmJid = `${sender.split('@')[0]}@s.whatsapp.net`;
      const caption = buildCard(player, db, targetId, mentionedId, isOwnProfile);

      let imageBuffer;
      if (player.profileImage) {
        try { imageBuffer = Buffer.from(player.profileImage, 'base64'); } catch (e) { imageBuffer = null; }
      }
      if (!imageBuffer || imageBuffer.length === 0) {
        try { imageBuffer = fs.readFileSync(DEFAULT_PROFILE_IMG); } catch (e) { imageBuffer = null; }
      }

      // Route DM sending through Serf socket or MultiSocketManager fallback
      let MSM = null;
      try { MSM = require('../../bots/MultiSocketManager'); } catch (e) {}

      const serf = SerfManager.getSerf(db, sender);
      const serfSock = serf?.botKey && MSM ? MSM.getSocket(serf.botKey) : null;
      const targetSock = serfSock || (MSM ? MSM.getAnySocket() : null) || sock;

      // Send to player DM
      if (imageBuffer) {
        Promise.resolve(targetSock.sendMessage(dmJid, { image: imageBuffer, caption })).catch(() => {
          Promise.resolve(sock.sendMessage(dmJid, { image: imageBuffer, caption })).catch(() => {});
        });
      } else {
        Promise.resolve(targetSock.sendMessage(dmJid, { text: caption })).catch(() => {
          Promise.resolve(sock.sendMessage(dmJid, { text: caption })).catch(() => {});
        });
      }

      // Send to Bot Staff GC if configured
      if (db.botStaffGroup) {
        if (imageBuffer) {
          Promise.resolve(sock.sendMessage(db.botStaffGroup, { image: imageBuffer, caption: `🔒 [STAFF COPY - LOCKED PROFILE]\n` + caption })).catch(() => {});
        } else {
          Promise.resolve(sock.sendMessage(db.botStaffGroup, { text: `🔒 [STAFF COPY - LOCKED PROFILE]\n` + caption })).catch(() => {});
        }
      }

      return sock.sendMessage(chatId, { text: `🔒 *${player.name}'s profile is locked.* Sent directly to your DM!` }, { quoted: msg });
    }

    const caption = buildCard(player, db, targetId, mentionedId, isOwnProfile);

    // ── Task 9: profile is an IMAGE card ──────────────────────────────────
    // Custom /seticon image if set, otherwise the default Astra logo.
    let imageBuffer;
    if (player.profileImage) {
      try { imageBuffer = Buffer.from(player.profileImage, 'base64'); } catch (e) { imageBuffer = null; }
    }
    if (!imageBuffer || imageBuffer.length === 0) {
      try { imageBuffer = fs.readFileSync(DEFAULT_PROFILE_IMG); } catch (e) { imageBuffer = null; }
    }

    if (imageBuffer && imageBuffer.length > 0) {
      return sock.sendMessage(chatId, { image: imageBuffer, caption }, { quoted: msg });
    }
    return sock.sendMessage(chatId, { text: caption }, { quoted: msg });
  },
};
