// ═══════════════════════════════════════════════════════════════
// /weapons              — list your weapons (equipped + in bag)
// /weapon equip <#|name>   — equip a weapon from your bag
// /weapon unequip          — unequip the current weapon (back to bag)
// /weapon info             — details on the equipped weapon
// Push #84. Durability: −1 per landed hit (UnifiedCombat → Armory.wearWeapon),
// breaks at 0, 🛠️ Mending Stone restores to 100%.
// ═══════════════════════════════════════════════════════════════
'use strict';

const UI = require('../../rpg/utils/UI');
const Armory = require('../../rpg/utils/ArmoryStore');

function durBar(cur, max) {
  if (max == null) return '∞';
  const pct = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
  const filled = Math.round(pct * 10);
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${cur}/${max}`;
}

function bagWeapons(player) {
  return (player.inventory?.items || []).filter(i => i && i.isWeapon);
}

function render(player) {
  const pro = UI.isPro(player);
  const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
  const w = player.weapon;
  const bag = bagWeapons(player);
  const lines = [
    ...(pro ? [UI.PRO_BAR, `⚔️ *YOUR WEAPONS* 💎`, UI.PRO_BAR] : [`⚔️ *YOUR WEAPONS*`, UI.FREE_BAR]),
    ``,
    `🗡️ *EQUIPPED*`,
  ];
  if (w && w.name) {
    lines.push(`  ${w.emoji || '🗡️'} *${w.name}*${w.rank ? ` (${w.rank}-rank${w.weaponType ? ' ' + w.weaponType : ''})` : ' (class weapon)'}`);
    lines.push(`  ⚔️ +${w.bonus || w.attack || 0} ATK${w.crit ? ` · 🎯 +${w.crit}% crit` : ''}`);
    if (w.maxDurability != null) lines.push(`  🔧 ${durBar(w.durability || 0, w.maxDurability)}`);
    if (w.passive?.name) lines.push(`  ⚡ ${w.passive.name} — ${w.passive.desc || ''}`);
    if (Array.isArray(w.effects) && w.effects.length) lines.push(`  ✨ On-hit: ${w.effects.map(e => `${e.type || e}${e.chance ? ` ${e.chance}%` : ''}`).join(', ')}`);
  } else {
    lines.push(`  _No weapon equipped_`);
  }
  lines.push(``, `🎒 *IN BAG* (${bag.length})`);
  if (!bag.length) lines.push(`  _No spare weapons — buy some in /store_`);
  bag.forEach((b, i) => {
    lines.push(`  ${i + 1}. ${b.emoji || '🗡️'} *${b.name}* (${b.rank || '?'}-rank) ⚔️ +${b.attack || b.bonus || 0}  🔧 ${b.durability ?? '?'}/${b.maxDurability ?? '?'}`);
  });
  lines.push(``, FRAME,
    `💡 /weapon equip <#|name> · /weapon unequip · /weapon info`,
    `🔧 −1 durability per landed hit · breaks at 0 · 🛠️ Mending Stone = 100%`,
    ...(pro ? [] : [UI.upsell()]));
  return lines.join('\n');
}

module.exports = {
  name: 'weapon',
  aliases: ['weapons', 'wpn'],
  description: '⚔️ Manage weapons — /weapons, /weapon equip <#|name>, /weapon unequip',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ You are not registered! Use /register [name].' }, { quoted: msg });

    const sub = (args[0] || 'list').toLowerCase();

    if (sub === 'list' || sub === 'ls' || sub === 'show') {
      return sock.sendMessage(chatId, { text: render(player) }, { quoted: msg });
    }

    if (sub === 'info' || sub === 'status') {
      const w = player.weapon;
      if (!w || !w.name) return sock.sendMessage(chatId, { text: '❌ No weapon equipped. /weapons to see your bag.' }, { quoted: msg });
      const pro = UI.isPro(player);
      return sock.sendMessage(chatId, { text: [
        pro ? `${UI.PRO_BAR}\n🗡️ *${w.name}* 💎\n${UI.PRO_BAR}` : `🗡️ *${w.name}*\n${UI.FREE_BAR}`,
        w.rank ? `🏷️ ${w.rank}-rank ${w.weaponType || ''}` : `🏷️ Class weapon`,
        `⚔️ +${w.bonus || w.attack || 0} ATK${w.crit ? ` · 🎯 +${w.crit}% crit` : ''}${w.hp ? ` · ❤️ +${w.hp} HP` : ''}`,
        w.maxDurability != null ? `🔧 ${durBar(w.durability || 0, w.maxDurability)}` : `🔧 Unbreakable (class weapon)`,
        w.passive?.name ? `⚡ ${w.passive.name} — ${w.passive.desc || ''}` : '',
        w.lore ? `📖 _${w.lore}_` : '',
      ].filter(Boolean).join('\n') }, { quoted: msg });
    }

    if (sub === 'equip' || sub === 'use' || sub === 'wield') {
      const bag = bagWeapons(player);
      if (!bag.length) return sock.sendMessage(chatId, { text: '❌ No weapons in your bag. Buy one in /store.' }, { quoted: msg });
      const q = args.slice(1).join(' ').trim().toLowerCase();
      if (!q) return sock.sendMessage(chatId, { text: '❌ Which one?\nUsage: /weapon equip <#|name>\n\n' + render(player) }, { quoted: msg });
      let target = null;
      if (/^\d+$/.test(q)) target = bag[parseInt(q, 10) - 1] || null;
      if (!target) target = bag.find(b => String(b.name || '').toLowerCase() === q) || bag.find(b => String(b.name || '').toLowerCase().includes(q)) || null;
      if (!target) return sock.sendMessage(chatId, { text: `❌ No weapon matching *${q}* in your bag.\n\n` + render(player) }, { quoted: msg });
      if ((target.durability ?? 1) <= 0) return sock.sendMessage(chatId, { text: `💥 *${target.name}* is broken (0 durability). Use a 🛠️ Mending Stone first.` }, { quoted: msg });
      const r = Armory.equipWeapon(player, target);
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      saveDatabase();
      const w = player.weapon;
      return sock.sendMessage(chatId, { text: [
        `⚔️ *WEAPON EQUIPPED!*`, ``,
        `${w.emoji || '🗡️'} *${w.name}* (${w.rank}-rank ${w.weaponType || ''})`,
        `⚔️ +${w.attack || w.bonus} ATK · 🔧 ${durBar(w.durability, w.maxDurability)}`,
        r.old ? `↩️ *${r.old.name}* went back to your bag.` : '',
      ].filter(Boolean).join('\n') }, { quoted: msg });
    }

    if (sub === 'unequip' || sub === 'remove' || sub === 'sheathe') {
      const w = player.weapon;
      if (!w || !w.name) return sock.sendMessage(chatId, { text: '❌ No weapon equipped.' }, { quoted: msg });
      // Optional name arg — must match what is equipped.
      const q = args.slice(1).join(' ').trim().toLowerCase();
      if (q && !String(w.name).toLowerCase().includes(q)) {
        return sock.sendMessage(chatId, { text: `❌ You have *${w.name}* equipped, not "${q}".` }, { quoted: msg });
      }
      if (!w.fromStore && !w.id) {
        return sock.sendMessage(chatId, { text: `❌ *${w.name}* is your class weapon — it can't be unequipped, only replaced by a store weapon (/weapon equip).` }, { quoted: msg });
      }
      const r = Armory.unequipWeapon(player);
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      // Fall back to the class weapon so the hunter is never bare-handed.
      try {
        const PM = require('../../rpg/player/PlayerManager');
        const cn = typeof player.class === 'string' ? player.class : player.class?.name;
        const def = PM.classDefinitions?.[cn];
        if (def) {
          const eligible = (def.levelWeapons || []).filter(x => x.level <= (player.level || 1));
          const best = eligible.length ? eligible[eligible.length - 1] : def.weapon;
          if (best) player.weapon = { name: best.name, bonus: best.bonus };
        }
      } catch (e) {}
      saveDatabase();
      return sock.sendMessage(chatId, { text: `↩️ *${r.weapon.name}* unequipped and returned to your bag.${player.weapon?.name ? `\n🗡️ Now wielding your class weapon: *${player.weapon.name}* (+${player.weapon.bonus} ATK)` : ''}` }, { quoted: msg });
    }

    return sock.sendMessage(chatId, { text: render(player) }, { quoted: msg });
  },
};
