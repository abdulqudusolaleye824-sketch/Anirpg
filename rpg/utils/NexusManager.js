/**
 * ═══════════════════════════════════════════════════════════════
 * Astra — NexusManager
 * -----------------------------------------------------------------
 * Single source of truth for Nexus (the bot's currency) updates is
 * `./GoldManager` (which exposes `updatePlayerNexus`). This module is a
 * thin compatibility layer so any file that historically did
 * `require('../../rpg/utils/NexusManager')` keeps working without edit.
 *
 * Consumers: send, casino, convert, rob, reset, shop, boss_original,
 * and rpg/utils/RamadanEvent all import `{ updatePlayerNexus }` from here.
 *
 * Key naming: players store their Nexus balance in `player.gold` (legacy
 * field). That stays as-is — only the label is "Nexus".
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

const { updatePlayerNexus } = require('./GoldManager');

module.exports = {
  updatePlayerNexus,
};
