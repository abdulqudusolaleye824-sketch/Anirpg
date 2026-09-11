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
const UI = require('../../rpg/utils/UI');

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

  const pro = UI.isPro(player);
  const rows = [
    equippedTitle !== 'None' ? `🎖️ "${equippedTitle}"` : null,
    `${rankData.emoji} *Rank:* ${rankDisplay}`,
    `⭐ *Level:* ${player.level || 1}`,
    `⚡ *Power:* ${power.toLocaleString()} ${powerLabel.emoji} ${powerLabel.label}`,
    `🎭 *Class:* ${classDisplay}`,
    variantLore ? `_${variantLore}_` : null,
    `🏰 *Guild:* ${guildDisplay}`,
    `🏢 *Status:* ${employmentStatus}`,
    ``,
    UI.section('WEALTH', '💠', pro),
    `💠 Nexus: *${Nexus}*`,
    `💎 Mana Stones: *${manaStones}*`,
    ``,
    UI.section(`SKILLS (${skillsTotal} total)`, '⚡', pro),
    ...skillLines,
    ``,
    UI.section('HUNTER INFO', '📋', pro),
    player.dateOfBirth ? `📅 D.O.B: *${player.dateOfBirth}*` : null,
    `🐾 Pets Owned: *${petsTotal}*`,
    petDisplay !== 'None' ? `🐾 Active Pet: ${petDisplay}` : null,
    `🎖️ Titles: *${titlesOwned}* | Equipped: *${equippedTitle}*`,
    `⭐ Pro Status: *${proLabel}*`,
    isBanned ? `🚫 Banned: *True*` : null,
    `📆 Joined: *${regDate}*`,
  ].filter(l => l !== null);
  const nextXp = UI.xpForLevel(player.level);
  const elo = player.pvpElo || 1000;
  const pw = player.pvpWins || 0, pl = player.pvpLosses || 0;
  const proLines = [
    `💎 *PRO INSIGHT*`,
    `⚔️ PvP: *${UI.num(elo)}* ELO (${pw}W/${pl}L${(pw + pl) > 0 ? `, ${Math.round((pw / (pw + pl)) * 100)}%` : ''})`,
    `📊 XP: ${UI.bar(player.xp, nextXp, 10, true)} (${UI.num(player.xp)}/${UI.num(nextXp)})`,
    `🔥 Power: *${UI.num(power)}* ${powerLabel.emoji}`,
  ];
  return UI.card(player, {
    icon: '👤', title: player.name, lines: rows, proLines,
    tip: isOwnProfile ? '/stats for battle detail' : `Viewing ${player.name}'s journey`,
  });
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

    // ── LOCKED PROFILE: /lockprofile is Pro-only. Only locked profiles go to DM (owner + staff). ──
    // Normal /profile in GC sends to GC. Locked in GC → DM via serf (completely gated).
    if (player.profileLocked && chatId.endsWith('@g.us')) {
      const Perms = require('../../utils/permissions');
      const isStaffViewer = Perms.isBotOwner(db, sender) || Perms.isBotMod(db, sender);

      // Privacy: locked profile only visible to owner and bot staff
      if (!isOwnProfile && !isStaffViewer) {
        return sock.sendMessage(chatId, { text: `🔒 *${player.name}'s profile is locked.* Only the owner and bot staff can view it.` }, { quoted: msg });
      }

      // Build card for the locked player (targetId)
      const caption = buildCard(player, db, targetId, mentionedId, isOwnProfile);
      let imageBuffer;
      if (player.profileImage) {
        try { imageBuffer = Buffer.from(player.profileImage, 'base64'); } catch (e) { imageBuffer = null; }
      }
      if (!imageBuffer || imageBuffer.length === 0) {
        try { imageBuffer = fs.readFileSync(DEFAULT_PROFILE_IMG); } catch (e) { imageBuffer = null; }
      }

      const isProLocked = (()=>{ try { return !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now()); } catch{ return false; } })();
      // 1st chat message — keep pro wording for pro users as requested
      const firstMsg = isProLocked
        ? `⏳ *Player is pro — sending profile...*`
        : `⏳ *Profile is locked — sending to DM...*`;
      await sock.sendMessage(chatId, { text: firstMsg }, { quoted: msg });

      // DM is completely gated by serfs — no fallback to anySocket
      let MSM = null;
      try { MSM = require('../../bots/MultiSocketManager'); } catch (e) {}
      const SerfManager = require('../../rpg/utils/SerfManager');
      const serf = SerfManager.getSerf(db, sender);
      const serfSock = serf?.botKey && MSM ? MSM.getSocket(serf.botKey) : null;

      if (!serf || !serfSock || !serfSock.user?.id) {
        const reason = !serf
          ? `❌ No serf set. Please set your serf with */setserf @bot* and ask a mod to approve.`
          : `❌ Your serf *${serf.botKey}* is offline/unavailable. Try again when it's online.`;
        return sock.sendMessage(chatId, { text: reason + `\n\n💡 DM is completely gated by serfs.` }, { quoted: msg });
      }

      try {
        // FIX: Use sender JID directly (lid) for DM, not converted s.whatsapp.net — ensures delivery to correct lid
        // Also use safeSendDM logic: try serfSock directly, fallback to MSM.safeSendDM
        let dmResult;
        try {
          if (imageBuffer && imageBuffer.length > 0) {
            dmResult = await serfSock.sendMessage(sender, { image: imageBuffer, caption });
          } else {
            dmResult = await serfSock.sendMessage(sender, { text: caption });
          }
        } catch (directErr) {
          console.error('Direct serf DM failed, trying safeSendDM:', directErr.message);
          try {
            const MSM2 = require('../../bots/MultiSocketManager');
            dmResult = await MSM2.safeSendDM(serfSock, sender, imageBuffer && imageBuffer.length > 0 ? { image: imageBuffer, caption } : { text: caption }, { getDatabase });
            if(dmResult && dmResult.dropped) throw new Error(dmResult.reason || 'DM dropped');
          } catch (e2) {
            throw directErr;
          }
        }
        // Staff copy (best effort) — locked profiles always mirrored to botStaffGroup
        if (db.botStaffGroup) {
          try {
            if (imageBuffer) {
              await sock.sendMessage(db.botStaffGroup, { image: imageBuffer, caption: `🔒 [STAFF COPY - LOCKED PROFILE] ${player.name}\n` + caption });
            } else {
              await sock.sendMessage(db.botStaffGroup, { text: `🔒 [STAFF COPY - LOCKED PROFILE] ${player.name}\n` + caption });
            }
          } catch {}
        }
        // 2nd chat message — ONLY after DM actually succeeds (fixes premature success)
        return sock.sendMessage(chatId, { text: `✅ *Profile successfully sent to your DM!*` }, { quoted: msg });
      } catch (e) {
        console.error('Locked profile DM failed:', e.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to send profile to DM: ${e.message}\n\nPlease ensure your serf is set and online. Use */setserf @bot*` }, { quoted: msg });
      }
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
