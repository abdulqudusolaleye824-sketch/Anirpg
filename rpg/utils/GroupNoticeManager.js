// ═══════════════════════════════════════════════════════════════
// Astra — Group Notice Manager (Welcome & Goodbye System)
//
// 30 Solo Leveling / Astra style welcome & goodbye system messages.
// Default for both is ON for all groups. Togglable via /welcome and /goodbye.
// ═══════════════════════════════════════════════════════════════

'use strict';

const WELCOME_MESSAGES = [
  "[ SYSTEM ] A new hunter has entered the domain. Welcome, @user. Your journey begins now.",
  "[ SYSTEM ] The gates have recognized a new presence. Welcome to Astra, @user.",
  "[ SYSTEM ] A new player has awakened. @user, your potential remains unknown.",
  "[ SYSTEM ] ⚡ Hunter detected. Welcome, @user. May your rank rise with every battle.",
  "[ SYSTEM ] The Shadow Realm acknowledges your arrival, @user. Do not disappoint us.",
  "[ SYSTEM ] A new soul has crossed the threshold. Welcome to the world of Astra, @user.",
  "[ SYSTEM ] 📜 STATUS WINDOW UPDATED: New hunter registered — @user.",
  "[ SYSTEM ] The dungeon gates tremble as @user enters the battlefield.",
  "[ SYSTEM ] Welcome, @user. Your story has just been added to the records of Astra.",
  "[ SYSTEM ] 🔮 An unknown mana signature has appeared. Welcome, @user.",
  "[ SYSTEM ] @user has entered the guild hall. May your adventures be legendary.",
  "[ SYSTEM ] Another hunter joins the ranks. Welcome, @user. Survival is not guaranteed.",
  "[ SYSTEM ] ⚔️ NEW HUNTER DETECTED. Welcome to Astra, @user.",
  "[ SYSTEM ] The gates have opened once more. @user has arrived.",
  "[ SYSTEM ] Your presence has been acknowledged, @user. Welcome to the awakened world.",
  "[ SYSTEM ] ✦ The System has registered a new player: @user.",
  "[ SYSTEM ] A faint aura has entered the guild. Welcome, @user. Grow stronger.",
  "[ SYSTEM ] @user has awakened. The System awaits their next command.",
  "[ SYSTEM ] Welcome, hunter @user. There are countless dungeons waiting for you.",
  "[ SYSTEM ] ⚠️ UNKNOWN ENTITY DETECTED. Identification complete: @user. Welcome.",
  "[ SYSTEM ] Another contender has entered Astra. Welcome, @user.",
  "[ SYSTEM ] The balance shifts slightly. @user has entered the domain.",
  "[ SYSTEM ] 🗡️ Your weapon awaits. Your enemies await. Welcome, @user.",
  "[ SYSTEM ] @user, your awakening has been recorded. Welcome to Astra.",
  "[ SYSTEM ] A new hunter stands before the gates. Welcome, @user. Enter at your own risk.",
  "[ SYSTEM ] Mana fluctuation detected. New hunter @user has joined the guild.",
  "[ SYSTEM ] The System welcomes @user. May your EXP never reach zero.",
  "[ SYSTEM ] 🌑 From the shadows, a new hunter emerges. Welcome, @user.",
  "[ SYSTEM ] WELCOME, HUNTER. @user has officially entered the Astra system.",
  "[ SYSTEM ] ✦ AWAKENING COMPLETE. Welcome, @user. Your legend starts here."
];

const GOODBYE_MESSAGES = [
  "[ SYSTEM ] Hunter @user has left the domain. Their presence has been erased from the guild.",
  "[ SYSTEM ] The gates close behind @user. Farewell, hunter.",
  "[ SYSTEM ] ⚠️ HUNTER DEPARTURE DETECTED. @user has abandoned the battlefield.",
  "[ SYSTEM ] @user has vanished from Astra. Whether they return remains unknown.",
  "[ SYSTEM ] The System has recorded the departure of @user. Until we meet again.",
  "[ SYSTEM ] A presence fades from the guild. Farewell, @user.",
  "[ SYSTEM ] @user has exited the domain. Their journey continues elsewhere.",
  "[ SYSTEM ] The dungeon grows quieter. @user has departed.",
  "[ SYSTEM ] 🗡️ Hunter @user has sheathed their weapon and left the guild.",
  "[ SYSTEM ] The gates have closed. @user is no longer among the awakened.",
  "[ SYSTEM ] @user has disappeared beyond the System's detection range.",
  "[ SYSTEM ] Another hunter leaves the ranks. Farewell, @user.",
  "[ SYSTEM ] 🌑 @user has returned to the shadows.",
  "[ SYSTEM ] The System bids farewell to @user. Your records remain.",
  "[ SYSTEM ] @user has left Astra. May fortune follow your path.",
  "[ SYSTEM ] Mana signature lost. Hunter @user has departed.",
  "[ SYSTEM ] The guild has lost another hunter. Goodbye, @user.",
  "[ SYSTEM ] DEPARTURE CONFIRMED. @user has left the domain.",
  "[ SYSTEM ] The battlefield awaits your return, @user. Until then.",
  "[ SYSTEM ] @user has stepped beyond the gates. Their next destination is unknown.",
  "[ SYSTEM ] ✦ Hunter @user has disconnected from the Astra system.",
  "[ SYSTEM ] Your presence has faded, @user. The System will remember.",
  "[ SYSTEM ] The guild hall falls silent as @user departs.",
  "[ SYSTEM ] @user has left the awakened world. Perhaps their journey will bring them back.",
  "[ SYSTEM ] The System has detected the departure of @user. Goodbye, hunter.",
  "[ SYSTEM ] ⚔️ Another warrior leaves the battlefield. Farewell, @user.",
  "[ SYSTEM ] @user has vanished through the gates. Their next awakening remains uncertain.",
  "[ SYSTEM ] The shadows swallow @user once more. Farewell.",
  "[ SYSTEM ] ✦ HUNTER REMOVED FROM DOMAIN. @user, until your next awakening.",
  "[ SYSTEM ] FAREWELL, HUNTER. @user has left Astra. The System awaits your return."
];

function cleanBare(jid) {
  return String(jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

/**
 * Check if welcome messages are enabled for a group (Default: TRUE)
 */
function isWelcomeEnabled(db, chatId) {
  const gs = db?.groupSettings?.[chatId];
  if (!gs) return true;
  return gs.welcome !== false; // Default is ON (true)
}

/**
 * Check if goodbye messages are enabled for a group (Default: TRUE)
 */
function isGoodbyeEnabled(db, chatId) {
  const gs = db?.groupSettings?.[chatId];
  if (!gs) return true;
  return gs.goodbye !== false; // Default is ON (true)
}

/**
 * Handle group participant join / leave updates
 */
async function handleParticipantUpdate(sock, chatId, participants, action, db) {
  if (!Array.isArray(participants) || participants.length === 0) return;

  if (action === 'add') {
    if (!isWelcomeEnabled(db, chatId)) return;

    for (const jid of participants) {
      const bareNum = cleanBare(jid);
      if (!bareNum) continue;

      const template = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
      const text = template.replace(/@user/g, `@${bareNum}`);
      const cleanJid = `${bareNum}@s.whatsapp.net`;

      try {
        await sock.sendMessage(chatId, {
          text,
          mentions: [cleanJid],
        });
      } catch (e) {
        console.error('Welcome message dispatch error:', e.message);
      }
    }
  } else if (action === 'remove') {
    if (!isGoodbyeEnabled(db, chatId)) return;

    for (const jid of participants) {
      const bareNum = cleanBare(jid);
      if (!bareNum) continue;

      const template = GOODBYE_MESSAGES[Math.floor(Math.random() * GOODBYE_MESSAGES.length)];
      const text = template.replace(/@user/g, `@${bareNum}`);
      const cleanJid = `${bareNum}@s.whatsapp.net`;

      try {
        await sock.sendMessage(chatId, {
          text,
          mentions: [cleanJid],
        });
      } catch (e) {
        console.error('Goodbye message dispatch error:', e.message);
      }
    }
  }
}

module.exports = {
  WELCOME_MESSAGES,
  GOODBYE_MESSAGES,
  isWelcomeEnabled,
  isGoodbyeEnabled,
  handleParticipantUpdate,
};
