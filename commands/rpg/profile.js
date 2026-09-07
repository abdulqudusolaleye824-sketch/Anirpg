// ═══════════════════════════════════════════════════════════════
// PROFILE — Astra Hunter Profile
// Clean card format — no battle stats
// Shows: Name, Rank, Level, DOB, Skills, Money, Pro, Banned, etc.
// ═══════════════════════════════════════════════════════════════

const { AWAKENING_RANKS, calculatePowerRating, getPowerLabel } = require('../../rpg/utils/SoloLevelingCore');
const { getQualityLabel } = require('../../rpg/utils/ClassSystem');

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
  // player.pets = full collection array (includes active pet)
  // player.pet  = reference to active pet (already in pets array)
  // Count only the collection array to avoid double-counting
  if (Array.isArray(player.pets) && player.pets.length > 0) return player.pets.length;
  // Legacy: no pets array but has active pet
  return player.pet ? 1 : 0;
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

    // ── Profile lock check ─────────────────────────────────────────────────
    if (!isOwnProfile && player.profileLocked) {
      const ownerNum    = (process.env.OWNER_JID   || '').split('@')[0];
      const coOwnerNum  = (process.env.COOWNER_JID || '').split('@')[0];
      const senderNum   = sender.split('@')[0].split(':')[0];
      const isAdmin     = senderNum === ownerNum
                       || senderNum === coOwnerNum
                       || (db.botMods || []).some(a => a.split('@')[0] === senderNum);
      if (!isAdmin) {
        return sock.sendMessage(chatId, {
          text: `🔒 That hunter's profile is set to private.`,
        }, { quoted: msg });
      }
    }

    // ── Data ───────────────────────────────────────────────────────────────
    const rank     = player.awakenRank || 'E';
    const rankData = AWAKENING_RANKS[rank] || { emoji: '⬜', label: `${rank}-Rank` };

    const rankDisplay = player.awakenTier && player.awakenTier > 0
      ? `${rankData.label} ✨ Tier ${player.awakenTier} Awakened`
      : rankData.label;
    let powerLabel = { emoji: '⚪', label: 'Unknown' };
    try {
      power      = calculatePowerRating(player.stats || {}, Object.values(player.equipped || {}).filter(Boolean), player.pet) || 0;
      powerLabel = getPowerLabel(power) || powerLabel;
    } catch(e) {}

    const cls          = player.evolvedClass || player.class;
    const classBase    = player.classBase || (typeof cls === 'string' ? cls : null);
    const classQuality  = player.classQuality || 0;
    const qualLabel     = classBase && classQuality > 0 ? ' — ' + getQualityLabel(classQuality) : '';
    const variantLore   = player.monsterVariant?.lore || null;
    const classDisplay  = cls
      ? player.evolvedClass ? cls + ' *(Evolved)*' : cls + qualLabel
      : 'Not assigned';

    const skillsTotal = getSkillsCount(player);
    const petsTotal   = getPetsCount(player);

    const proLabel   = getProLabel(player);
    const isBanned   = !!(player.banned || db.bannedUsers?.[targetId]);

    // Nexus + mana stones
    const gold        = (player.gold        || 0).toLocaleString();
    const manaStones  = (player.manaCrystals || 0).toLocaleString();

    const employmentStatus = player.guild ? `Employed 💼 *(${player.guild})*` : `Unemployed 😴`;

    // Active pet
    const petDisplay = player.pet
      ? `${player.pet.emoji || '🐾'} ${player.pet.name || 'Unnamed'} Lv.${player.pet.level || 1}`
      : 'None';

    // Skills equipped
    const skills = player.skills || {};
    const activeSkills = Array.isArray(skills.active) ? skills.active : [];
    const skillLines = activeSkills.length
      ? activeSkills.map((s, i) => `  ${i+1}. *${s.name}* Lv${s.level || 1}`)
      : ['  None equipped'];

    // Titles
    const equippedTitle = player.equippedTitle || 'None';
    const titlesOwned   = (player.titles || []).length;

    // Registered date (WAT)
    const regDate = player.registeredAtWAT
      ? player.registeredAtWAT.slice(0, 10)
      : player.registeredAt
        ? new Date(player.registeredAt + 3600000).toISOString().slice(0, 10)
        : 'Unknown';

    const lines = [
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
      `🏢 *Status:* ${employmentStatus}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💠 *WEALTH*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💠 Nexus: *${gold}*`,
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

    return sock.sendMessage(chatId, { text: lines }, { quoted: msg });
  },
};
