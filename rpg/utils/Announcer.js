// Announcer.js — Auto-announcement system
// Pings @everyone for artifact spawns, world boss availability,
// event starts, and other major happenings.

const ANNOUNCE_TYPES = {
  ARTIFACT_SPAWN:   'artifact_spawn',
  WORLD_BOSS:       'world_boss',
  EVENT_START:      'event_start',
  EVENT_END:        'event_end',
  GATE_SPAWN:       'gate_spawn',
  SERVER_MILESTONE: 'server_milestone',
};

// Tracks which chats have announcements enabled (default: all)
const announcementSettings = new Map(); // chatId → { artifact, worldboss, events, gates }

function getSettings(chatId) {
  if (!announcementSettings.has(chatId)) {
    announcementSettings.set(chatId, { artifact: true, worldboss: true, events: true, gates: true });
  }
  return announcementSettings.get(chatId);
}

// Core announcement sender — mentions all members
async function sendAnnouncement(sock, chatId, text, mentionAll = true) {
  try {
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text });
    }

    let mentions = [];
    if (mentionAll) {
      try {
        const meta = await sock.groupMetadata(chatId);
        mentions = meta.participants.map(p => p.id);
      } catch(e) {
        // Can't get members, send without mentions
      }
    }

    return sock.sendMessage(chatId, { text, mentions });
  } catch(e) {
    console.error('[Announcer] Failed to send:', e.message);
  }
}

class Announcer {

  // ── ARTIFACT SPAWN ──────────────────────────────────────────
  static async announceArtifactSpawn(sock, chatId, artifact) {
    const settings = getSettings(chatId);
    if (!settings.artifact) return;

    const rarityEmoji = { epic: '🟣', legendary: '🟠', mythic: '🔴' };
    const emoji = rarityEmoji[artifact.rarity] || '✨';
    const urgency = artifact.rarity === 'mythic' ? '🚨 MYTHIC!' : artifact.rarity === 'legendary' ? '🔥 LEGENDARY!' : '⚡ EPIC!';

    const text = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `${emoji} *${urgency} ARTIFACT SPAWNED!*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `${artifact.emoji} *${artifact.name}*`,
      `📊 ${Object.entries(artifact.bonus).map(([k,v]) => `${v>0?'+':''}${v} ${k.toUpperCase()}`).join(' | ')}`,
      ``,
      `⏰ *5 minutes* to claim!`,
      ``,
      `🎯 Type */claim* to grab it!`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');

    return sendAnnouncement(sock, chatId, text, true);
  }

  // ── WORLD BOSS AVAILABLE ────────────────────────────────────
  static async announceWorldBoss(sock, chatId, bossDef) {
    const settings = getSettings(chatId);
    if (!settings.worldboss) return;

    const text = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🌍 *WORLD BOSS AVAILABLE!*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `${bossDef.emoji} *${bossDef.name}*`,
      `💭 "${bossDef.description}"`,
      ``,
      `👥 Need: ${bossDef.minParty}-${bossDef.maxParty} hunters`,
      `⚠️ 3 phases — it gets stronger as HP drops!`,
      ``,
      `📋 *HOW TO JOIN:*`,
      `1. /worldboss create [#]`,
      `2. Friends: /worldboss join [ID]`,
      `3. All: /worldboss ready`,
      `4. Leader: /worldboss start`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `/worldboss list — see all bosses`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');

    return sendAnnouncement(sock, chatId, text, true);
  }

  // ── EVENT START ─────────────────────────────────────────────
  static async announceEventStart(sock, chatId, event) {
    const settings = getSettings(chatId);
    if (!settings.events) return;

    const text = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${event.spawnMsg}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 /event — see full details & bonuses`;
    return sendAnnouncement(sock, chatId, text, true);
  }

  // ── GATE SPAWN ──────────────────────────────────────────────
  static async announceGateSpawn(sock, chatId, gate) {
    const settings = getSettings(chatId);
    if (!settings.gates) return;
    // Gates already have their own announcements, this just adds the ping
    return sendAnnouncement(sock, chatId, null, true);
  }

  // ── SERVER MILESTONE ────────────────────────────────────────
  static async announceServerMilestone(sock, chatId, type, data) {
    const milestoneTexts = {
      player_100:  `🎉 *100 HUNTERS REGISTERED!*\nThe realm grows stronger! ${data?.name || 'A hunter'} was the 100th to join!`,
      player_500:  `🌟 *500 HUNTERS!*\nHalf a thousand warriors walk this world. Legendary.`,
      first_divine:`👑 *FIRST DIVINE CLASS PLAYER!*\n${data?.name || 'A hunter'} has obtained a DIVINE class! 🙏`,
      boss_first:  `🏆 *WORLD BOSS FIRST KILL!*\n${data?.name || 'A party'} has defeated *${data?.boss || 'a world boss'}* for the FIRST TIME!`,
    };
    const text = milestoneTexts[type];
    if (!text) return;
    return sendAnnouncement(sock, chatId, `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${text}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`, true);
  }

  // ── SETTINGS ────────────────────────────────────────────────
  static toggleSetting(chatId, type, value) {
    const s = getSettings(chatId);
    if (type in s) s[type] = value;
    return s;
  }

  static getSettingsText(chatId) {
    const s = getSettings(chatId);
    return [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📢 *ANNOUNCEMENT SETTINGS*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `${s.artifact  ? '✅' : '❌'} Artifact spawns`,
      `${s.worldboss ? '✅' : '❌'} World boss alerts`,
      `${s.events    ? '✅' : '❌'} Event start/end`,
      `${s.gates     ? '✅' : '❌'} Gate spawns`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Toggle: /announce [artifact/worldboss/events/gates]`,
    ].join('\n');
  }
}

module.exports = Announcer;
module.exports.ANNOUNCE_TYPES = ANNOUNCE_TYPES;
