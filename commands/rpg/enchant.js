// /enchant — Enhance your weapon (+1 to +10) with success rates
// Higher enhancement = lower success chance, risk of downgrade or break

const ENHANCE_DATA = [
  { level:1,  cost:5000,   crystals:0,  rate:95, fail:'nothing',   breakChance:0 },
  { level:2,  cost:10000,  crystals:0,  rate:90, fail:'nothing',   breakChance:0 },
  { level:3,  cost:20000,  crystals:0,  rate:85, fail:'nothing',   breakChance:0 },
  { level:4,  cost:35000,  crystals:5,  rate:75, fail:'nothing',   breakChance:0 },
  { level:5,  cost:60000,  crystals:10, rate:65, fail:'downgrade', breakChance:0 },
  { level:6,  cost:100000, crystals:20, rate:55, fail:'downgrade', breakChance:0 },
  { level:7,  cost:150000, crystals:30, rate:45, fail:'downgrade', breakChance:5 },
  { level:8,  cost:250000, crystals:50, rate:35, fail:'downgrade', breakChance:10 },
  { level:9,  cost:400000, crystals:80, rate:25, fail:'downgrade', breakChance:15 },
  { level:10, cost:600000, crystals:150,rate:15, fail:'downgrade', breakChance:20 },
];

const ATK_PER_ENHANCE = 8; // each +1 adds 8 ATK

function getEnhanceLevel(player) { return player.weapon?.enhancement || 0; }

module.exports = {
  name: 'enchant',
  aliases: ['enhance', 'upgrade_weapon', '+weapon'],
  description: '✨ Enhance your weapon (+1→+10) for more ATK power',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered!' }, { quoted: msg });
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const sub = (args[0] || '').toLowerCase();
    const curLevel = getEnhanceLevel(player);

    if (!player.weapon?.name) {
      return sock.sendMessage(chatId, { text: '❌ You have no weapon!\nGet one from /shop or /summon' }, { quoted: msg });
    }

    // ── /enchant (menu) ────────────────────────────────────────
    if (!sub || sub === 'info') {
      const next = ENHANCE_DATA[curLevel];
      let txt = pro ? `${UI.PRO_BAR}\n✨ *WEAPON ENCHANTING* 💎\n${UI.PRO_BAR}\n` : `✨ *WEAPON ENCHANTING*\n${UI.FREE_BAR}\n`;
      txt += `⚔️ *${player.weapon.name}*\n`;
      txt += `Enhancement: *+${curLevel}* ${curLevel > 0 ? `(+${curLevel * ATK_PER_ENHANCE} bonus ATK from enhancement)` : ''}\n`;
      txt += `Base ATK bonus: *+${player.weapon.bonus||0}*\n\n`;
      if (curLevel >= 10) {
        txt += `🌟 *MAX ENHANCEMENT (+10) REACHED!*\nYour weapon gleams with unrivaled power.\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO FORGE* — +10 MAX · +${curLevel * ATK_PER_ENHANCE} ATK banked` : `\n${UI.upsell()}`);
        return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
      }
      txt += `${FRAME}\n⬆️ *NEXT ENHANCEMENT: +${curLevel+1}*\n${FRAME}\n`;
      txt += `✅ Success rate: *${next.rate}%*\n`;
      txt += `❌ On fail: *${next.fail === 'downgrade' ? 'Drops back to +'+(curLevel-1) : 'Nothing happens'}*\n`;
      if (next.breakChance > 0) txt += `💀 Break chance: *${next.breakChance}%* (weapon destroyed!)\n`;
      txt += `\n💠 Cost: *${next.cost.toLocaleString()}g*${next.crystals > 0 ? ` + *${next.crystals}💎*` : ''}\n`;
      txt += `📈 Reward: *+${ATK_PER_ENHANCE} ATK* (permanent)\n\n`;
      txt += `/enchant confirm — proceed with enhancement\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO FORGE* — +${curLevel}→+${curLevel+1} at ${next.rate}%` : `\n${UI.upsell()}`);
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /enchant confirm ───────────────────────────────────────
    if (sub === 'confirm' || sub === 'go') {
      if (curLevel >= 10) return sock.sendMessage(chatId, { text: '🌟 Already at max enhancement (+10)!' }, { quoted: msg });

      const data = ENHANCE_DATA[curLevel];
      if ((player.gold||0) < data.cost) return sock.sendMessage(chatId, { text: `❌ Need ${data.cost.toLocaleString()} 💠 | Have ${(player.gold||0).toLocaleString()} 💠` }, { quoted: msg });
      if (data.crystals > 0 && (player.manaCrystals||0) < data.crystals) return sock.sendMessage(chatId, { text: `❌ Need ${data.crystals}💎 | Have ${player.manaCrystals||0}💎` }, { quoted: msg });

      player.gold -= data.cost;
      if (data.crystals > 0) player.manaCrystals -= data.crystals;

      const roll = Math.random() * 100;

      // Break check first
      if (data.breakChance > 0 && roll < data.breakChance) {
        // Weapon breaks — reset to enhancement 0 and lose half ATK bonus
        const lostAtk = Math.floor((player.weapon.bonus||0) * 0.3);
        player.weapon.bonus = Math.max(0, (player.weapon.bonus||0) - lostAtk);
        player.weapon.enhancement = 0;
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: (pro ? `${UI.PRO_BAR}\n💀 *WEAPON DAMAGED!* 💎\n${UI.PRO_BAR}\n\n⚔️` : `💀 *WEAPON DAMAGED!*\n${UI.FREE_BAR}\n\n⚔️`)+` *${player.weapon.name}*\nThe enhancement failed catastrophically!\n\nEnhancement reset to *+0*\nWeapon ATK reduced by ${lostAtk}\n\n💡 Use /enchant to try again from +1\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO FORGE* — minus ${lostAtk} ATK · reforge from +1` : `\n${UI.upsell()}`)
        }, { quoted: msg });
      }

      // Success check
      if (roll < data.rate) {
        player.weapon.enhancement = curLevel + 1;
        player.weapon.bonus = (player.weapon.bonus||0) + ATK_PER_ENHANCE;
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: (pro ? `${UI.PRO_BAR}\n✨ *ENHANCEMENT SUCCESS!* 💎\n${UI.PRO_BAR}\n\n⚔️` : `✨ *ENHANCEMENT SUCCESS!*\n${UI.FREE_BAR}\n\n⚔️`)+` *${player.weapon.name}* → *+${player.weapon.enhancement}*\n\n💥 ATK Bonus: *+${player.weapon.bonus}* (+${ATK_PER_ENHANCE} from enhance)\n\n${player.weapon.enhancement===10?'🌟 *MAX ENHANCEMENT REACHED!*':'💡 /enchant to go higher!'}\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO FORGE* — +${player.weapon.enhancement} · +${player.weapon.bonus} ATK total` : `\n${UI.upsell()}`)
        }, { quoted: msg });
      }

      // Fail — downgrade or nothing
      if (data.fail === 'downgrade' && curLevel > 0) {
        const lostEnhAtk = ATK_PER_ENHANCE;
        player.weapon.enhancement = curLevel - 1;
        player.weapon.bonus = Math.max(0, (player.weapon.bonus||0) - lostEnhAtk);
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: (pro ? `${UI.PRO_BAR}\n❌ *ENHANCEMENT FAILED!* 💎\n${UI.PRO_BAR}\n\n⚔️` : `❌ *ENHANCEMENT FAILED!*\n${UI.FREE_BAR}\n\n⚔️`)+` *${player.weapon.name}* dropped to *+${player.weapon.enhancement}*\n(-${lostEnhAtk} ATK)\n\n💡 Try again with /enchant confirm\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO FORGE* — +${player.weapon.enhancement} · push again` : `\n${UI.upsell()}`)
        }, { quoted: msg });
      }

      // Nothing happens
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n😤 *ENHANCEMENT FAILED* 💎\n${UI.PRO_BAR}\n\n⚔️` : `😤 *ENHANCEMENT FAILED*\n${UI.FREE_BAR}\n\n⚔️`)+` *${player.weapon.name}* stays at *+${curLevel}*\nNo change. Try again!\n\n💡 /enchant confirm to retry\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO FORGE* — +${curLevel} held · retry` : `\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, { text: '❌ Use /enchant to view your weapon, or /enchant confirm to proceed.' }, { quoted: msg });
  }
};
