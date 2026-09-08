/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         Astra — Class Command System                      ║
 * ║                                                            ║
 * ║  Each class gets one befitting custom command. The         ║
 * ║  command name is derived from the class's `cmdName`        ║
 * ║  field if set, or auto-generated from its `lore` field    ║
 * ║  if not.                                                    ║
 * ║                                                            ║
 * ║  Examples:                                                 ║
 * ║    Healer  → /heal                                       ║
 * ║    Mage    → /call   (then /call fireball, /call arc...) ║
 * ║    Berserker → /rage                                     ║
 * ║    Assassin → /strike                                   ║
 * ║    Paladin → /prayer                                    ║
 * ║                                                            ║
 * ║  To add a class-specific command:                         ║
 * ║    1. Add `cmdName: 'foo'` to the class file             ║
 * ║    2. Add a handler in commands/rpg/classcmd.js          ║
 * ║       (or extend the default handler)                     ║
 * ║                                                            ║
 * ║  If a class has no `cmdName` and no lore match,           ║
 * ║  the default is 'cast' (universal class skill trigger).   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

const CS = require('./ClassSystem');

// ── Manual cmdName mapping (override) ────────────────────────────────────────
// Classes can declare their own cmdName in the per-file module.
// This map serves as a fallback for classes that don't declare one,
// and as a documentation reference.
const DEFAULT_CMD_NAMES = {
  Healer:       'heal',     // /heal <skill|target> — pure support
  Mage:         'call',     // /call <skill> — arcane spells
  Berserker:    'rage',     // /rage <skill> — fury
  Assassin:     'strike',   // /strike <skill> — precision
  Paladin:      'prayer',   // /prayer <skill> — divine
  Necromancer:  'hex',      // /hex <skill> — dark
  Chronomancer: 'rewind',   // /rewind <skill> — time
  Shaman:       'chant',    // /chant <skill> — spirits
  Warlord:      'rally',    // /rally <skill> — leadership
  Phantom:      'veil',     // /veil <skill> — phase
  Devourer:     'feast',    // /feast <skill> — hunger
  DragonKnight: 'roar',     // /roar <skill> — dragon
  ShadowDancer: 'dance',    // /dance <skill> — shadow
  Summoner:     'summon',   // /summon <skill> — conjuration
  BloodKnight:  'drain',    // /drain <skill> — blood
  SpellBlade:   'slash',    // /slash <skill> — magic blade
  Elementalist: 'storm',    // /storm <skill> — elements
  Warrior:      'swing',    // /swing <skill>
  Archer:       'aim',      // /aim <skill>
  Rogue:        'sneak',    // /sneak <skill>
  Knight:       'shield',   // /shield <skill>
  Monk:         'meditate', // /meditate <skill>
  Ranger:       'hunt',     // /hunt <skill>
  Senku:        'science',  // /science <skill> — owner divine
};

/**
 * Get the class-specific command name for a class.
 * Priority: 1) class file's cmdName field, 2) DEFAULT_CMD_NAMES, 3) 'cast'
 */
function getClassCmdName(className) {
  if (!className) return 'cast';
  const data = CS.CLASS_DATA[className];
  if (data && data.cmdName) return data.cmdName;
  return DEFAULT_CMD_NAMES[className] || 'cast';
}

/**
 * Check if a command name matches a player's class command.
 * Used by the dispatcher to route /heal, /rage, /prayer, etc. to the right handler.
 */
function isClassCommand(player, commandName) {
  if (!player || !player.class) return null;
  const className = typeof player.class === 'string' ? player.class : (player.class?.name || '');
  const expected = getClassCmdName(className);
  return expected === commandName ? className : null;
}

module.exports = {
  getClassCmdName,
  isClassCommand,
  DEFAULT_CMD_NAMES,
};
