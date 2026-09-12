// dungeon.js — Tower Dungeon System v2
// Party of 2-5 → form first → choose dungeon type → 20 floors
// Boss every 5 floors. Advance or leave after each boss.
// 8 dungeon types, all with unique themes/monsters.

const DungeonManager    = require('../../rpg/dungeons/DungeonManager');
const BP = require('../../rpg/utils/BattlePass');
let TitleSystem; try { TitleSystem = require('../../rpg/utils/TitleSystem'); } catch(e) {}
let DC; try { DC = require('../../rpg/utils/DailyChallenges'); } catch(e) {}
const DungeonPartyManager = require('../../rpg/dungeons/DungeonPartyManager');
const ImprovedCombat    = require('../../rpg/utils/ImprovedCombat');
let BuffManager; try { BuffManager = require('../../rpg/utils/BuffManager'); } catch(e) {}
const StatusEffectManager = require('../../rpg/utils/StatusEffectManager');
const UI = require('../../rpg/utils/UI');
function statusSummary(entity){ if(!entity||!entity.statusEffects||!entity.statusEffects.length) return null; const m={burn:'🔥 Burn -15 HP', poison:'☠️ Poison -10 HP', bleed:'🩸 Bleed -12 HP', stun:'💫 Stun skip', freeze:'❄️ Freeze skip + -3% HP', paralyze:'⚡ Paralyze 70% skip', weaken:'💔 Weaken -30% ATK', curse:'👁️ Curse -15% DEF', fear:'😱 Fear -20% ATK', enfeeble:'🐢 Enfeeble -30% DEF', trueslow:'🐌 Slow -35% SPD', silence:'🤐 Silence', blind:'🌫️ Blind -50% ACC'}; return entity.statusEffects.map(s=>{ const k=(s.type||'').toLowerCase(); const desc=m[k]||k; const dur=s.duration||s.turns||'?'; return `${desc} (${dur}t)`; }).join(' | '); }
const BarSystem         = require('../../rpg/utils/BarSystem');
const LevelUpManager    = require('../../rpg/utils/LevelUpManager');
const ArtifactSystem    = require('../../rpg/utils/ArtifactSystem');
const PetManager        = require('../../rpg/utils/PetManager');
const AchievementManager = require('../../rpg/utils/AchievementManager');
const StatAllocationSystem = require('../../rpg/utils/StatAllocationSystem');
const SeasonManager = require('../../rpg/utils/SeasonManager');
const GuildWar = require('./guildwar');
const SkillDescriptions = require('../../rpg/utils/SkillDescriptions');
const { getPartyBonuses, formatBonusSummary } = require('../../rpg/utils/PartyRoleSystem');
const { tickDurability } = require('../../rpg/utils/GearSystem');

// ── Gate integration ──────────────────────────────────────────────────────────
const GateKeyManager = require('../../rpg/dungeons/GateKeyManager');
const { awardXP }    = require('../../rpg/utils/SilentXP');
const { GATE_RANKS } = require('../../rpg/dungeons/GateManager');

// ─── HELPERS ───────────────────────────────────────────────────
const SerfManager = require('../../rpg/utils/SerfManager');

async function notifyAchievements(sock, playerId, player, achievements) {
  if (!achievements?.length) return;
  const n = AchievementManager.buildNotification(achievements, player);
  if (n) {
    const targetJid = playerId.includes('@') ? playerId : `${playerId}@s.whatsapp.net`;
    try { await sock.sendMessage(targetJid, { text: n }); } catch(e) {}
  }
}
async function notifyQuestUpdates(sock, playerId, updates) {
  if (!updates?.length) return;
  const FRAME = UI.FREE_BAR; // neutral DM (no player ref here)
  const completed = updates.filter(u => u.type === 'completed');
  for (const u of completed) {
    const targetJid = playerId.includes('@') ? playerId : `${playerId}@s.whatsapp.net`;
    try {
      await sock.sendMessage(targetJid, {
        text: `${FRAME}\n🎯 QUEST COMPLETED!\n${FRAME}\n✅ *${u.questName}*\n\n💡 Use */quest complete ${u.questId}* to claim rewards!\n${FRAME}`
      });
    } catch(e) {}
  }
}

// ─── MONSTER DIALOGUE ──────────────────────────────────────────
const MONSTER_DIALOGUE = {
  default: ['*growls menacingly*', '*attacks!*', '*snarls*'],
  Goblin: ['Grrr! Human flesh!', 'Me smash you!', 'Shinies! Give shinies!'],
  Wolf: ['*GROWL*', 'AWOOOO!', '*snarls and bares fangs*'],
  Skeleton: ['*rattle* *rattle*', 'Your bones will join mine!', 'Join us in death...'],
  Slime: ['*blob* *blob*', 'Squish squish!', '*jiggles menacingly*'],
  Dragon: ['INSIGNIFICANT MORTAL!', 'I will turn you to ASH!', 'You DARE?!'],
  Demon: ['Your suffering delights me!', 'I will feast on your despair!', 'This realm is MINE!'],
};
function getDialogue(name) {
  const k = Object.keys(MONSTER_DIALOGUE).find(k => name.includes(k));
  const pool = k ? MONSTER_DIALOGUE[k] : MONSTER_DIALOGUE.default;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── MONSTER AI ────────────────────────────────────────────────
function executeMonsterAI(monster, player) {
  const mPro = UI.isPro(player);
  const FRAME = mPro ? UI.PRO_BAR : UI.FREE_BAR;
  const useSkill = Math.random() < 0.75 && monster.abilities?.length > 0;
  const ability  = useSkill ? monster.abilities[Math.floor(Math.random() * monster.abilities.length)] : null;
  const line     = getDialogue(monster.name);

  let atkMult = ability ? 1.5 : 1.0;
  const baseDmg  = Math.floor(monster.stats.atk * atkMult);
  let _gearDef0 = 0, _gearSpd0 = 0;
  try { const _gb = require('../../rpg/utils/GearSystem').getEquippedBonuses(player); _gearDef0 = _gb.def || 0; _gearSpd0 = _gb.speed || 0; } catch (e) {}
  const defReduc = Math.floor(((player.stats.def || 0) + _gearDef0) * 0.4);

  // Player dodge
  const speedDiff = ((player.stats.speed || 100) + _gearSpd0) - (monster.stats.speed || 80);
  const dodge     = Math.max(0, Math.min(0.30, speedDiff / 200));
  if (dodge > 0 && Math.random() < dodge) {
    return `\n${FRAME}\n🔄 ${monster.name.toUpperCase()}'S TURN${mPro ? ' 💎' : ''}\n${FRAME}\n${monster.emoji} ${monster.name} ${ability ? 'uses *' + ability + '*!' : 'attacks!'}\n💬 "${line}"\n💨 *DODGED!* You were too fast!\n❤️ Your HP: ${player.stats.hp}/${player.stats.maxHp}\n${FRAME}`;
  }

  const finalDmg = Math.max(8, baseDmg - defReduc);
  player.stats.hp = Math.max(0, player.stats.hp - finalDmg);

  let msg = `\n${FRAME}\n🔄 ${monster.name.toUpperCase()}'S TURN${mPro ? ' 💎' : ''}\n${FRAME}\n`;
  msg += `${monster.emoji} ${monster.name} ${ability ? 'uses *' + ability + '*!' : 'attacks!'}\n💬 "${line}"\n${FRAME}\n`;
  msg += `💥 You take *${finalDmg}* damage!\n❤️ Your HP: ${Math.max(0, player.stats.hp)}/${player.stats.maxHp}\n${FRAME}`;
  return msg;
}

// ─── FLOOR ADVANCE PROMPT ──────────────────────────────────────
function buildAdvancePrompt(dungeon, nextFloor, party) {
  const FRAME = UI.FREE_BAR; // legacy builder (no callers)
  const isBossNext = DungeonManager.isBossFloor(nextFloor);
  const aliveCount = party.members.length;
  let txt = `${FRAME}\n🏆 *FLOOR ${dungeon.currentFloor} CLEARED!*\n${FRAME}\n`;
  txt += `📊 Progress: Floor ${dungeon.currentFloor}/${dungeon.maxFloors}\n`;
  txt += `👥 Party alive: ${aliveCount}/${party.members.length}\n\n`;
  if (nextFloor > dungeon.maxFloors) {
    txt += `🏆 *DUNGEON COMPLETE!*\nUse /dungeon finish to claim rewards.\n`;
  } else {
    if (isBossNext) {
      txt += `⚠️ *NEXT: BOSS FLOOR ${nextFloor}!*\n💭 A powerful guardian awaits...\n💡 Tip: Use potions before the boss!\n\n`;
    } else {
      txt += `🔽 *Floor ${nextFloor} awaits...*\n`;
    }
    txt += `${FRAME}\n`;
    txt += `/dungeon advance — Press deeper\n`;
    txt += `/dungeon leave   — Exit & keep rewards\n`;
    txt += `${FRAME}`;
  }
  return txt;
}

// ─── MAIN MODULE ───────────────────────────────────────────────
module.exports = {
  name: 'dungeon',
  description: 'Tower Dungeon System — Party of 2-5, 20 floors, boss every 5 floors',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    if (!chatId) return;
    const db     = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const sub = args[0]?.toLowerCase();
    const OWNER_ID = '221951679328499@lid';
    const isOwner  = sender === OWNER_ID;

    // ── Dungeon GC redirect ────────────────────────────────────────────────────
    // If this is a gate-raid command and the GC is not a dungeon GC, redirect
    const gateRelatedSubs = ['gateraid', 'enter'];
    if (chatId.endsWith('@g.us') && gateRelatedSubs.includes(sub)) {
      const GKM = require('../../rpg/dungeons/GateKeyManager');
      if (!GKM.isDungeonGC(chatId)) {
        // Find the primary dungeon GC (first one registered)
        const allGCs = GKM.getAllDungeonGCs();
        const gcList = Object.values(allGCs);
        if (gcList.length > 0) {
          const primaryGC = gcList[0];
          return sock.sendMessage(chatId, {
            text: [
              `❌ *This is not a dungeon GC.*`,
              ``,
              `Gate raids must be started in a registered dungeon group.`,
              ``,
              `📌 Use this command in your dungeon GC instead.`,
              `Group ID: \`${primaryGC.chatId}\``,
            ].join('\n'),
          }, { quoted: msg });
        } else {
          return sock.sendMessage(chatId, {
            text: `❌ No dungeon GC is registered yet.\nAsk the owner to set one up with */set dungeon --true*`,
          }, { quoted: msg });
        }
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    // Dead players can only use items
    if (!isOwner && player.stats.hp <= 0 && !['item','help','status'].includes(sub)) {
      const party = DungeonPartyManager.getPartyByPlayer(sender);
      if (party?.status === 'active') {
        return sock.sendMessage(chatId, { text: `💀 *You are dead!*\nUse */dungeon item revive* if you have a Revive Token.\nOr wait for the dungeon to end.` }, { quoted: msg });
      }
    }

    // ── HELP & DEFAULT DISPLAY ────────────────────────────────
    if (!sub || sub === 'help' || sub === 'solo') {
      return sock.sendMessage(chatId, { text: [
        ...(pro ? [UI.PRO_BAR, `🏰 *GATE RAID SYSTEM ACTIVE* 💎`, UI.PRO_BAR] : [`🏰 *GATE RAID SYSTEM ACTIVE*`, UI.FREE_BAR]),
        `🚫 */dungeon solo* has been removed in favor of the new Gate Raid flow!`,
        ``,
        `All dungeons and gate battles now use our code-driven gate raid flow:`,
        ``,
        `📋 *GATE RAID COMMANDS:*`,
        `⚔️ */party create <CODE>* — Form/Join a party for a gate raid`,
        `⚔️ */gateraid <CODE>*     — Enter the gate raid`,
        `🔑 */gate buy*            — Buy a gate when a gate spawns`,
        `🔑 */gate key list*       — View your unused gate keys`,
        ``,
        `💡 *How to play:*`,
        `1. Buy a gate in your group when one spawns using */gate buy*.`,
        `2. Check your Gate Code with */gate key list*.`,
        `3. Run */party create --<CODE>* in your dungeon GC to recruit party members.`,
        `4. Run */gateraid <CODE>* to enter the raid!`,
        ...(pro ? [FRAME] : [FRAME, UI.upsell()]),
      ].join('\n') }, { quoted: msg });
    }

    // ── TYPES ─────────────────────────────────────────────────
    if (sub === 'types' || sub === 'list') {
      const available = DungeonManager.getAvailableTypes(player.level);
      const all       = DungeonManager.getAllTypes();
      let txt = pro ? `${UI.PRO_BAR}\n🏰 *DUNGEON TYPES* 💎\n${UI.PRO_BAR}\nYour Level: ${player.level}\n${UI.PRO_BAR}\n\n` : `🏰 *DUNGEON TYPES*\n${UI.FREE_BAR}\nYour Level: ${player.level}\n${UI.FREE_BAR}\n\n`;
      all.forEach((d, i) => {
        const locked = d.minLevel > player.level ? `🔒 Lv${d.minLevel}+ required` : '✅ Available';
        txt += `${i+1}. ${d.emoji} *${d.name}*\n   ${locked}\n   💭 ${d.description}\n   🏆 20 Floors | Bosses F5/F10/F15/F20\n\n`;
      });
      txt += `${FRAME}\n💡 Form a party first: /dungeon party create\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO DELVER* — ${available.length}/${all.length} unlocked` : `\n${UI.upsell()}`);
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── PARTY COMMANDS ────────────────────────────────────────
    if (sub === 'party') {
      const partyAction = args[1]?.toLowerCase();

      if (partyAction === 'create') {
        return sock.sendMessage(chatId, {
          text: `🚫 */dungeon party create has been removed.*\n\nGate raids no longer use the old party system.\nUse a gate code instead:\n\n⚔️ /gateraid <CODE>  — auto-creates your raid\n   • Guild members → party raid\n   • Outsiders → instant solo raid\n\nGet a code by buying a gate (*/gate buy*).`,
        }, { quoted: msg });
      }

      if (partyAction === 'join') {
        const partyId = args[2];
        if (!partyId) return sock.sendMessage(chatId, { text: '❌ Usage: /dungeon party join [ID]' }, { quoted: msg });
        const result = DungeonPartyManager.joinParty(partyId, sender, player.name);
        if (!result.success) return sock.sendMessage(chatId, { text: `❌ ${result.message}` }, { quoted: msg });
        saveDatabase();
        const party = result.party || DungeonPartyManager.getPartyByPlayer(sender);
        return sock.sendMessage(chatId, { text: `✅ *${player.name}* joined party *${partyId}*!\n👥 Members: ${party.members.length}/5\n\nMark ready: /dungeon ready` }, { quoted: msg });
      }

      if (partyAction === 'leave') {
        const party = DungeonPartyManager.getPartyByPlayer(sender);
        if (!party) return sock.sendMessage(chatId, { text: '❌ Not in a party!' }, { quoted: msg });
        if (party.status === 'active') return sock.sendMessage(chatId, { text: '❌ Dungeon in progress!\nUse /dungeon flee to escape.' }, { quoted: msg });
        const result = DungeonPartyManager.leaveParty(party.id, sender);
        saveDatabase();
        return sock.sendMessage(chatId, { text: result.disbanded ? '🚪 Party disbanded.' : '🚪 You left the party.' }, { quoted: msg });
      }

      if (partyAction === 'info' || !partyAction) {
        const party = DungeonPartyManager.getPartyByPlayer(sender);
        if (!party) return sock.sendMessage(chatId, { text: '❌ Not in a party!' }, { quoted: msg });
        return sock.sendMessage(chatId, { text: DungeonPartyManager.formatPartyInfo(party) }, { quoted: msg });
      }

      return sock.sendMessage(chatId, { text: '❌ Usage: /dungeon party [create/join/leave/info]' }, { quoted: msg });
    }

    // ── READY ─────────────────────────────────────────────────
    if (sub === 'ready') {
      const party = DungeonPartyManager.getPartyByPlayer(sender);
      if (!party) return sock.sendMessage(chatId, { text: '❌ Join a party first!\n/dungeon party create' }, { quoted: msg });
      DungeonPartyManager.setReady(party.id, sender, true);
      saveDatabase();
      const allReady = DungeonPartyManager.allReady(party.id);
      let txt = `✅ *${player.name}* is ready!\n\n`;
      party.members.forEach(m => { txt += `  ${m.ready ? '✅' : '⏳'} ${m.name}\n`; });
      if (allReady && party.members.length >= 2) txt += `\n🎉 *ALL READY!* Leader: /dungeon start\n/dungeon types to see options`;
      else if (party.members.length < 1)         txt += `\n✅ You can start solo or invite friends!`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── SHOP ─────────────────────────────────────────────────
    if (sub === 'shop') {
      const party = DungeonPartyManager.getPartyByPlayer(sender);
      if (!party) return sock.sendMessage(chatId, { text: '❌ Join a party first!' }, { quoted: msg });
      if (party.status === 'active') return sock.sendMessage(chatId, { text: '❌ Cannot shop mid-dungeon!' }, { quoted: msg });

      const shopAction = args[1]?.toLowerCase();
      if (!shopAction) {
        return sock.sendMessage(chatId, { text: (pro ? `${UI.PRO_BAR}\n🛒 *DUNGEON SHOP* 💎\n${UI.PRO_BAR}\nYour ` : `🛒 *DUNGEON SHOP*\n${UI.FREE_BAR}\nYour `) + `Nexus: ${(player.gold || 0).toLocaleString()} 💠\n${FRAME}\n🩹 /dungeon shop hp [qty]     — 5,000 💠 Nexus — Restore 50% HP (party)\n💙 /dungeon shop energy [qty] — 4,000 💠 Nexus — Restore 50% Energy (party)\n🎫 /dungeon shop revive [qty] — 10,000 💠 Nexus — Revive a fallen member\n🍀 /dungeon shop luck [qty]   — 5,000 💠 Nexus — +25% claim luck (personal)\n${FRAME}\n🎒 Party inventory:\n🩹 HP Potions: ${party.sharedItems?.healthPotions || 0}\n💙 Energy Potions: ${party.sharedItems?.energyPotions || 0}\n🎫 Revive Tokens: ${party.sharedItems?.reviveTokens || 0}\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO QUARTERMASTER* — stock ${(party.sharedItems?.healthPotions || 0) + (party.sharedItems?.energyPotions || 0) + (party.sharedItems?.reviveTokens || 0)} shared items` : `\n${UI.upsell()}`) }, { quoted: msg });
      }

      const items = {
        hp: { key:'healthPotions', cost:5000, name:'Health Potion', emoji:'🩹', shared:true },
        health: { key:'healthPotions', cost:5000, name:'Health Potion', emoji:'🩹', shared:true },
        energy: { key:'energyPotions', cost:4000, name:'Energy Potion', emoji:'💙', shared:true },
        ep:     { key:'energyPotions', cost:4000, name:'Energy Potion', emoji:'💙', shared:true },
        revive: { key:'reviveTokens', cost:10000, name:'Revive Token', emoji:'🎫', shared:true },
        luck:   { key:'luckPotion', cost:5000, name:'Luck Potion', emoji:'🍀', shared:false },
      };
      const item = items[shopAction];
      if (!item) return sock.sendMessage(chatId, { text: '❌ Invalid item! Try: hp | energy | revive | luck' }, { quoted: msg });

      const qty  = parseInt(args[2]) || 1;
      const cost = item.cost * qty;
      if ((player.gold || 0) < cost) return sock.sendMessage(chatId, { text: `❌ Not enough Nexus!\nNeed: ${cost.toLocaleString()} 💠 | Have: ${(player.gold||0).toLocaleString()} 💠` }, { quoted: msg });

      player.gold -= cost;
      if (item.shared) {
        DungeonPartyManager.addItem(party.id, item.key, qty);
      } else {
        if (!player.inventory) player.inventory = { items: [] };
        if (!player.inventory.items) player.inventory.items = [];
        for (let i = 0; i < qty; i++) player.inventory.items.push({ name: 'Luck Potion', type: 'Consumable', rarity: 'uncommon', isLuckPotion: true });
      }
      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ *${item.name} ×${qty}* purchased!\n💠 Spent: ${cost.toLocaleString()}g\n🏦 Nexus left: ${player.gold.toLocaleString()} 💠` }, { quoted: msg });
    }

    // ── START ─────────────────────────────────────────────────
    if (sub === 'start') {
      let party = DungeonPartyManager.getPartyByPlayer(sender);
      if (!party) return sock.sendMessage(chatId, { text: '❌ Create a party first!\n/dungeon party create' }, { quoted: msg });
      if (party.status === 'active') return sock.sendMessage(chatId, { text: '❌ Dungeon already in progress!' }, { quoted: msg });
      if (party.leader !== sender) return sock.sendMessage(chatId, { text: '❌ Only the party leader can start!' }, { quoted: msg });
      if (!DungeonPartyManager.allReady(party.id)) return sock.sendMessage(chatId, { text: '❌ Not all members ready!\nEveryone: /dungeon ready' }, { quoted: msg });
      if (party.members.length < 1) return sock.sendMessage(chatId, { text: '❌ No members in party!' }, { quoted: msg });

      const members    = party.members.map(m => db.users[m.id]).filter(u => u);
      const avgLevel   = Math.floor(members.reduce((s,m) => s + m.level, 0) / members.length);
      const available  = DungeonManager.getAvailableTypes(avgLevel);

      // Show menu if no choice given
      const choice = parseInt(args[1]);
      if (!args[1] || isNaN(choice)) {
        let txt = pro ? `${UI.PRO_BAR}\n🏰 *CHOOSE DUNGEON* 💎\n${UI.PRO_BAR}\nParty Avg Level: ${avgLevel}\n${UI.PRO_BAR}\n\n` : `🏰 *CHOOSE DUNGEON*\n${UI.FREE_BAR}\nParty Avg Level: ${avgLevel}\n${UI.FREE_BAR}\n\n`;
        if (available.length === 0) return sock.sendMessage(chatId, { text: '❌ No dungeons available!\nAll dungeons require higher level.' }, { quoted: msg });
        available.forEach((d,i) => {
          txt += `*${i+1}.* ${d.emoji} ${d.name}\n   📊 Rank: ${d.rank} | Req. Lv${d.minLevel}+\n   💭 ${d.description}\n\n`;
        });
        txt += `${FRAME}\n/dungeon start [#] to enter\n${FRAME}` + (pro ? '' : `\n${UI.upsell()}`);
        return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
      }

      const idx = choice - 1;
      if (idx < 0 || idx >= available.length) return sock.sendMessage(chatId, { text: `❌ Invalid number! Choose 1-${available.length}` }, { quoted: msg });

      const selected = available[idx];

      // Initialize dungeon state in party
      party.status = 'active';
      party.dungeon = {
        name:            selected.name,
        rank:            selected.rank,
        typeId:          selected.id,
        currentFloor:    1,
        maxFloors:       20,
        monstersDefeated: 0,
        totalMonsters:   1,
        turn:            1,
        startTime:       Date.now(),
        floorsCleared:   [],
        awaitingAdvance: false,
        currentMonster:  DungeonManager.getFloorMonster(selected.id, 1, avgLevel),
      };
      party._avgLevel = avgLevel;

      // Apply cooldowns
      members.forEach(m => { m.dungeonCooldown = Date.now() + 30 * 60 * 1000; });
      saveDatabase();

      const monster = party.dungeon.currentMonster;
      const dtype   = selected;
      const atmo    = dtype.atmosphere[Math.floor(Math.random() * dtype.atmosphere.length)];
      const line    = getDialogue(monster.name);
      const mBar    = BarSystem.getMonsterHPBar(monster.stats.hp, monster.stats.maxHp);
      const bonuses = getPartyBonuses(members);
      const bonusTxt = formatBonusSummary(bonuses) || '';

      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n${dtype.emoji} *${dtype.name.toUpperCase()}* 💎\n${UI.PRO_BAR}\n` : `${dtype.emoji} *${dtype.name.toUpperCase()}*\n${UI.FREE_BAR}\n`) + `${atmo}\n${FRAME}\n📊 Rank: ${dtype.rank} | 20 Floors\n👥 Party: ${party.members.length} hunters${bonusTxt ? '\n'+bonusTxt : ''}\n⚠️ Boss floors: F5, F10, F15, F20\n${FRAME}\n🔽 *FLOOR 1*\n${FRAME}\n${monster.emoji} *${monster.name}* [Lv.${monster.level}]\n💬 "${line}"\n${FRAME}\n${mBar}\n⚔️ ATK: ${monster.stats.atk} | 🛡️ DEF: ${monster.stats.def}\n💥 Abilities: ${monster.abilities.join(', ')}\n${FRAME}\n⚔️ /dungeon attack\n⚡ /<classcmd> [skill]\n🎒 /dungeon item [hp/energy]\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO DELVE* — ${dtype.rank} · 20 floors · party of ${party.members.length}` : `\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    // ── STATUS ────────────────────────────────────────────────
    if (sub === 'status') {
      const party = DungeonPartyManager.getPartyByPlayer(sender);
      if (!party || party.status !== 'active') return sock.sendMessage(chatId, { text: '❌ Not in an active dungeon!' }, { quoted: msg });
      const dungeon = party.dungeon;
      const monster = dungeon.currentMonster;
      const mBar    = BarSystem.getMonsterHPBar(monster.stats.hp, monster.stats.maxHp);
      let txt = pro ? `${UI.PRO_BAR}\n📊 *FLOOR ${dungeon.currentFloor}/${dungeon.maxFloors}* 💎\n${UI.PRO_BAR}\n` : `📊 *FLOOR ${dungeon.currentFloor}/${dungeon.maxFloors}*\n${UI.FREE_BAR}\n`;
      txt += `${DungeonManager.isBossFloor(dungeon.currentFloor) ? '⚠️ BOSS FLOOR!' : `🔽 Floor ${dungeon.currentFloor}`}\n`;
      txt += `${monster.emoji} *${monster.name}*\n${mBar}\n❤️ ${monster.stats.hp}/${monster.stats.maxHp}\n\n`;
      txt += `👥 *Party:*\n`;
      party.members.forEach(m => {
        const mp  = db.users[m.id];
        if (!mp) return;
        const bar = BarSystem.getHPBar(mp.stats.hp, mp.stats.maxHp, require('../../rpg/utils/UnifiedCombat').isPro(mp));
        txt += `${mp.stats.hp > 0 ? '⚔️' : '💀'} *${m.name}* — ${bar} ${mp.stats.hp}/${mp.stats.maxHp}\n`;
      });
      txt += `\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO READ* — ${monster.name} at ${Math.max(0, Math.round(100 * monster.stats.hp / monster.stats.maxHp))}%` : `\n${UI.upsell()}`);
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── ADVANCE ───────────────────────────────────────────────
    if (sub === 'advance') {
      // ── SOLO ADVANCE ──────────────────────────────────────
      if (db.soloDungeons && db.soloDungeons[sender]) {
        const sd = db.soloDungeons[sender];
        if (!sd.awaitingAdvance) {
          return sock.sendMessage(chatId, { text: '❌ Defeat the current enemy first!' }, { quoted: msg });
        }
        const nextFloor = sd.currentFloor + 1;
        if (nextFloor > sd.maxFloors) {
          // Complete
          awardXP(player, 'dungeon_complete', saveDatabase, sock, chatId);
          player.gold = (player.gold || 0) + sd.totalNexus;
          player.manaCrystals = (player.manaCrystals || 0) + sd.totalCrystals;
          delete db.soloDungeons[sender];
          saveDatabase();
          LevelUpManager.checkAndApplyLevelUps(player, saveDatabase, sock, chatId);
          try {
            const _ref = require('../../rpg/utils/ReferralSystem').onLevelUp(db, player);
            if (_ref) { saveDatabase(); await sock.sendMessage(chatId, { text: `🔗 *REFERRAL REWARD!*

*${_ref.recruitName}* hit Lv.3!
💠 @${_ref.referrerId.split('@')[0]} earned *10,000 Nexus*!`, mentions: [_ref.referrerId] }); }
          } catch (e) {}
          return sock.sendMessage(chatId, {
            text: (pro ? `${UI.PRO_BAR}\n🏆 *SOLO DUNGEON COMPLETE!* 💎\n${UI.PRO_BAR}\n` : `🏆 *SOLO DUNGEON COMPLETE!*\n${UI.FREE_BAR}\n`) + `✅ All 10 floors cleared!\n\n📊 *TOTAL REWARDS:*\n💠 Nexus: +${sd.totalNexus.toLocaleString()}\n💎 Mana Stones: +${sd.totalCrystals}\n${FRAME}\n💪 Well done, solo hunter!` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO DELVER* — run total ${UI.num(sd.totalNexus)} 💠` : `\n${UI.upsell()}`)
          }, { quoted: msg });
        }

        const isBoss = nextFloor % 5 === 0;
        const monster = isBoss
          ? DungeonManager.getFloorBoss(sd.dungeonTypeId, nextFloor, player.level)
          : DungeonManager.getFloorMonster(sd.dungeonTypeId, nextFloor, player.level);

        // Scale down for solo
        monster.stats.hp = Math.floor(monster.stats.hp * 0.5);
        monster.stats.maxHp = monster.stats.hp;
        monster.stats.atk = Math.floor(monster.stats.atk * 0.5);
        monster.stats.def = Math.floor(monster.stats.def * 0.5);

        sd.currentFloor = nextFloor;
        sd.currentMonster = monster;
        sd.awaitingAdvance = false;
        saveDatabase();

        const dtype2 = DungeonManager.getDungeonType(sd.dungeonTypeId);
        const atmo2  = dtype2?.atmosphere[Math.floor(Math.random() * (dtype2.atmosphere.length || 1))] || '💭 You press deeper...';
        const line2  = getDialogue(monster.name);
        const mBar = BarSystem.getMonsterHPBar(monster.stats.hp, monster.stats.maxHp);
        let txt = pro ? `${UI.PRO_BAR}\n` : `${UI.FREE_BAR}\n`;
        if (isBoss) {
          txt += `⚠️ *BOSS — FLOOR ${nextFloor}!*${pro ? ' 💎' : ''}\n${FRAME}\n💭 ${monster.desc || 'A terrifying guardian blocks your path!'}\n`;
        } else {
          txt += `🔽 *FLOOR ${nextFloor}*${pro ? ' 💎' : ''}\n${FRAME}\n${atmo2}\n`;
        }
        txt += `${FRAME}\n${monster.emoji} *${monster.name}* [Lv.${monster.level}]${isBoss ? ' 🔴 BOSS' : ''}\n💬 "${line2}"\n${FRAME}\n${mBar}\n❤️ ${monster.stats.hp}/${monster.stats.maxHp} HP\n⚔️ ATK: ${monster.stats.atk} | 🛡️ DEF: ${monster.stats.def}\n💥 Abilities: ${monster.abilities.join(', ')}\n${FRAME}\n⚔️ /dungeon attack\n⚡ /<classcmd> [skill]\n🎒 /dungeon item [hp/energy]\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO SCOUT* — ATK ${monster.stats.atk} · DEF ${monster.stats.def}` : `\n${UI.upsell()}`);
        return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
      }

      // ── PARTY ADVANCE ─────────────────────────────────────
      const party = DungeonPartyManager.getPartyByPlayer(sender);
      if (!party || party.status !== 'active') return sock.sendMessage(chatId, { text: '❌ Not in an active dungeon!' }, { quoted: msg });
      if (party.leader !== sender) return sock.sendMessage(chatId, { text: '❌ Only the party leader can advance!' }, { quoted: msg });
      const dungeon = party.dungeon;
      if (!dungeon.awaitingAdvance) return sock.sendMessage(chatId, { text: '❌ Defeat the current enemy first!' }, { quoted: msg });

      const nextFloor = dungeon.currentFloor + 1;
      if (nextFloor > dungeon.maxFloors) {
        return handleDungeonComplete(sock, chatId, party, db, saveDatabase, msg);
      }

      const members  = party.members.map(m => db.users[m.id]).filter(u => u);
      const avgLevel = party._avgLevel || Math.floor(members.reduce((s,m) => s + m.level, 0) / members.length);
      const isBoss   = DungeonManager.isBossFloor(nextFloor);
      const monster  = isBoss
        ? DungeonManager.getFloorBoss(dungeon.typeId, nextFloor, avgLevel)
        : DungeonManager.getFloorMonster(dungeon.typeId, nextFloor, avgLevel);

      dungeon.currentFloor    = nextFloor;
      dungeon.currentMonster  = monster;
      dungeon.awaitingAdvance = false;
      dungeon.turn            = 1;
      saveDatabase();

      const dtype = DungeonManager.getDungeonType(dungeon.typeId);
      const atmo  = dtype?.atmosphere[Math.floor(Math.random() * (dtype.atmosphere.length||1))] || '💭 You press deeper...';
      const line  = getDialogue(monster.name);
      const mBar  = BarSystem.getMonsterHPBar(monster.stats.hp, monster.stats.maxHp);

      let txt = pro ? `${UI.PRO_BAR}\n` : `${UI.FREE_BAR}\n`;
      if (isBoss) {
        txt += `⚠️ *BOSS FLOOR ${nextFloor}!*${pro ? ' 💎' : ''}\n${FRAME}\n💭 ${monster.desc || 'A terrifying guardian blocks your path!'}\n`;
      } else {
        txt += `🔽 *FLOOR ${nextFloor}*${pro ? ' 💎' : ''}\n${FRAME}\n${atmo}\n`;
      }
      txt += `${FRAME}\n${monster.emoji} *${monster.name}* [Lv.${monster.level}]${isBoss ? ' 🔴 BOSS' : ''}\n💬 "${line}"\n${FRAME}\n${mBar}\n⚔️ ATK: ${monster.stats.atk} | 🛡️ DEF: ${monster.stats.def}\n💥 Abilities: ${monster.abilities.join(', ')}\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO SCOUT* — ATK ${monster.stats.atk} · DEF ${monster.stats.def}` : `\n${UI.upsell()}`);
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── LEAVE (voluntary exit) ────────────────────────────────
    if (sub === 'leave') {
      // Solo leave — loot kept is the leave reward. NO completion bonus
      // (leaving early is not clearing; this was a free-XP exploit).
      if (db.soloDungeons && db.soloDungeons[sender]) {
        const sd = db.soloDungeons[sender];
        player.gold = (player.gold || 0) + sd.totalNexus;
        player.manaCrystals = (player.manaCrystals || 0) + sd.totalCrystals;
        delete db.soloDungeons[sender];
        saveDatabase();
        LevelUpManager.checkAndApplyLevelUps(player, saveDatabase, sock, chatId);
        try {
          const _ref = require('../../rpg/utils/ReferralSystem').onLevelUp(db, player);
          if (_ref) { saveDatabase(); await sock.sendMessage(chatId, { text: `🔗 *REFERRAL REWARD!*

*${_ref.recruitName}* hit Lv.3!
💠 @${_ref.referrerId.split('@')[0]} earned *10,000 Nexus*!`, mentions: [_ref.referrerId] }); }
        } catch (e) {}
        return sock.sendMessage(chatId, {
          text: (pro ? `${UI.PRO_BAR}\n🚪 *EXITED SOLO DUNGEON* 💎\n${UI.PRO_BAR}\n` : `🚪 *EXITED SOLO DUNGEON*\n${UI.FREE_BAR}\n`) + `Cleared ${sd.currentFloor - 1} floor(s)\n\n📦 *REWARDS KEPT:*\n💠 Nexus: +${sd.totalNexus.toLocaleString()}\n💎 Mana Stones: +${sd.totalCrystals}\n${FRAME}` + (pro ? '' : `\n${UI.upsell()}`)
        }, { quoted: msg });
      }
      const party = DungeonPartyManager.getPartyByPlayer(sender);
      if (!party || party.status !== 'active') return sock.sendMessage(chatId, { text: '❌ Not in an active dungeon!' }, { quoted: msg });
      if (!party.dungeon.awaitingAdvance && party.leader === sender) {
        return sock.sendMessage(chatId, { text: '⚠️ You can only leave after clearing a floor!\nDefeat the current enemy first.\n\nWant to flee mid-fight? Use /dungeon flee' }, { quoted: msg });
      }
      return handleDungeonExit(sock, chatId, party, db, saveDatabase, msg, sender, false);
    }

    // ── FLEE ──────────────────────────────────────────────────
    if (sub === 'flee') {
      // Solo flee — lose all rewards
      if (db.soloDungeons && db.soloDungeons[sender]) {
        delete db.soloDungeons[sender];
        saveDatabase();
        return sock.sendMessage(chatId, { text: '🏃 *You fled the dungeon!*\n❌ All rewards lost.\n\nUse /dungeon solo to try again.' }, { quoted: msg });
      }
      const party = DungeonPartyManager.getPartyByPlayer(sender);
      if (!party || party.status !== 'active') return sock.sendMessage(chatId, { text: '❌ Not in an active dungeon!' }, { quoted: msg });
      if (party.members.length === 1) return sock.sendMessage(chatId, { text: '⛓️ *You cannot flee!*\nYou are the last one standing!\nFight or fall!' }, { quoted: msg });
      return handleDungeonExit(sock, chatId, party, db, saveDatabase, msg, sender, true);
    }

    // ── ATTACK ────────────────────────────────────────────────
    if (sub === 'attack') {
      // ── ATTACK PATTERN usage: /dungeon attack <number> ────────
      const patternNum = parseInt(args[1]);
      if (!isNaN(patternNum) && patternNum > 0) {
        const { generateAttack, RANK_EMOJI } = require('../../rpg/utils/AttackPatternDB');
        const owned = player.attackPatterns?.owned || [];
        const _dngEquipped = player.attackPatterns?.equipped || [];
        if (!_dngEquipped.includes(patternNum)) {
          return sock.sendMessage(chatId, { text: '❌ Attack Pattern *#' + patternNum + '* is not equipped!\nEquip it first: /attacks equip ' + patternNum }, { quoted: msg });
        }
        if (!owned.includes(patternNum)) {
          return sock.sendMessage(chatId, { text: "❌ You don't own Attack Pattern *#" + patternNum + "*!\n/attacks owned — see your patterns\n/attacks shop — buy patterns" }, { quoted: msg });
        }
        const atk = generateAttack(patternNum);
        if (!atk) return sock.sendMessage(chatId, { text: '❌ Invalid attack pattern number.' }, { quoted: msg });

        const isSoloDng = db.soloDungeons && db.soloDungeons[sender];
        const partyDng  = DungeonPartyManager.getPartyByPlayer(sender);
        if (!isSoloDng && (!partyDng || partyDng.status !== 'active'))
          return sock.sendMessage(chatId, { text: '❌ Not in an active dungeon!' }, { quoted: msg });

        const dunSd  = isSoloDng ? db.soloDungeons[sender] : null;
        const dunPty = partyDng?.dungeon || null;
        const monster = dunSd ? dunSd.currentMonster : dunPty?.currentMonster;
        if (!monster) return sock.sendMessage(chatId, { text: '❌ No monster here.' }, { quoted: msg });
        if (dunSd  && dunSd.awaitingAdvance)  return sock.sendMessage(chatId, { text: '✅ Floor cleared! /dungeon advance' }, { quoted: msg });
        if (dunPty && dunPty.awaitingAdvance) return sock.sendMessage(chatId, { text: '✅ Floor cleared! /dungeon advance' }, { quoted: msg });

        // Frozen / stunned hunters lose their turn (tick once, then skip)
        // Batch-47: stunned loses the STRIKE via the skip-branch below —
        // the monster counter-attack still plays out.
        let _dngStunSkip = null;
        try {
          const _dngUC = require('../../rpg/utils/UnifiedCombat');
          const _dngFx = _dngUC.canAct(player);
          if (!_dngFx.canAct) {
            try { _dngUC.tickStatuses(player); } catch(e){}
            _dngStunSkip = ((r => ({ frozen: '❄️ *YOU ARE FROZEN*', stunned: '💫 *YOU ARE STUNNED*', paralyzed: '🔱 *YOU ARE PARALYZED*', feared: '😱 *YOU ARE FEARED*' }[r] || '💫 *YOU ARE STUNNED*'))(_dngFx.reason)) + ' — ' + player.name + ' cannot move this turn.\nStrike lost (0 dmg) — but the battle plays on!';
          }
        } catch(e){}

        const UCd2 = require('../../rpg/utils/UnifiedCombat');
        let finalDmg, isCrit, _dungeonUnified;
        const _cdChk = UCd2.isOnCooldown(player, atk.id);
        if (_dngStunSkip || _cdChk.onCd) {
          finalDmg = 0; isCrit = false; _dungeonUnified = { missed:false, crit:false, effective:'skipped' };
          try { UCd2.tickStatuses(player); } catch(e){}
          try { UCd2.tickStatuses(monster); } catch(e){}
          const _skipMsg = _dngStunSkip || `⏳ *attack failed — still on cooldown ${UCd2.formatCd(_cdChk.remaining)} remaining* — turn skipped (0 dmg, status -1)`;
          // store for intro patching
          player._dungeonSkipMsg = _skipMsg;
          // do not damage monster
        } else {
          const _uni = UCd2.calcMoveDamage(player, monster, atk);
          _dungeonUnified = _uni;
          if (_uni.missed) { finalDmg = 0; isCrit = false; }
          else { finalDmg = _uni.damage; isCrit = _uni.crit; monster.stats.hp = Math.max(0, monster.stats.hp - finalDmg); }
          UCd2.setCooldown(player, atk.id, atk);
          const _effTmp = UCd2.tryApplyEffect(atk, player, monster);
          if (_effTmp) player._dungeonEffTmp = _effTmp;
        }

        const re = RANK_EMOJI[atk.rank] || '⬜';

        // ── Build per-beat sections so each combat tick is its own
        //    WhatsApp message: pattern → crit (if any) → damage →
        //    status (if any) → monster counter-attack → final state.
        let introLines;
        if (player._dungeonSkipMsg) {
          const _smsg = player._dungeonSkipMsg; delete player._dungeonSkipMsg;
          introLines = [
            FRAME,
            `🥋 *ATTACK PATTERN — FAILED*${pro ? ' 💎' : ''}`,
            FRAME,
            `${re} *#${atk.id} — ${atk.name}* [${atk.rank}]`,
            _smsg,
            `_${(atk.description||atk.flavour)}_`, // batch-47: full description
            `📊 Atk×${atk.atkMult} Def×${atk.defMult} Spd×${atk.speedMult} Crit×${atk.critMult} Acc ${atk.accuracy}%`,
            FRAME,
          ];
          // clear effectLine skip duplication
          if (effectLine === _smsg) effectLine = null;
        } else {
          introLines = [
            FRAME,
            `🥋 *ATTACK PATTERN*${pro ? ' 💎' : ''}`,
            FRAME,
            `${re} *#${atk.id} — ${atk.name}* [${atk.rank}]`,
            `_${atk.description || atk.flavour}_`,
            `📊 Atk×${atk.atkMult} Def×${atk.defMult} Spd×${atk.speedMult} Crit×${atk.critMult} Acc ${atk.accuracy}%`,
            FRAME,
          ];
        }

        // Effect application — unified
        let effectLine = null;
        if (player._dungeonEffTmp) {
          const _et = player._dungeonEffTmp; delete player._dungeonEffTmp;
          effectLine = `${_et.emoji || atk.effect?.emoji || '✨'} *${_et.type}* applied! (${_et.duration}t)`;
        } else if (player._dungeonSkipMsg) {
          effectLine = player._dungeonSkipMsg; // will be handled as intro
        }

        // Quest tracking notes — keep them as small inline footnotes
        const questNotes = [];
        try {
          const { trackAndNotify } = require('../../rpg/utils/QuestDispatcher');
          const note = trackAndNotify(player, 'pattern', 1, sock, sender, chatId);
          if (note) questNotes.push(note);
          if (monster.stats.hp <= 0) {
            const kn = trackAndNotify(player, 'kill', 1, sock, sender, chatId);
            if (kn) questNotes.push(kn);
            if (dunSd && dunSd.currentFloor % 5 === 0) {
              const bn = trackAndNotify(player, 'boss', 1, sock, sender, chatId);
              if (bn) questNotes.push(bn);
            }
          }
        } catch (e) {}

        // Tick statuses and prepend summary + damage logs at start of this turn
        let _tickSoloLogs = [];
        let _statusSolo = null;
        try {
          const UCTick = require('../../rpg/utils/UnifiedCombat');
          _tickSoloLogs = UCTick.tickStatuses(player) || [];
          const mTick = UCTick.tickStatuses(monster) || [];
          if (mTick.length) _tickSoloLogs = _tickSoloLogs.concat(mTick);
          _statusSolo = statusSummary(player) || statusSummary(monster);
        } catch(e){}
        if (_tickSoloLogs.length) introLines.unshift(_tickSoloLogs.join('\n'));
        if (_statusSolo) introLines.unshift(`⚠️ *STATUS:* ${_statusSolo}`);
        const sections = [
          { text: introLines.join('\n') },
          {
            text: [
              isCrit ? '💥 *CRITICAL HIT!*' : null,
              `💥 Dealt *${finalDmg}* damage! (×${atk.dmgMult})`,
            ].filter(Boolean).join('\n'),
          },
        ];
        if (effectLine) sections.push({ text: effectLine });
        for (const n of questNotes) sections.push({ text: n });

        if (monster.stats.hp <= 0) {
          // ── Victory ─────────────────────────────────────────
          let rewardLine = '';
          if (dunSd) {
            const rewards = DungeonManager.getFloorRewards(dunSd.currentFloor, player.level, dunSd.currentFloor % 5 === 0);
            dunSd.totalNexus += Math.floor(rewards.gold);
            dunSd.totalCrystals += Math.floor(rewards.crystals || 0);
            dunSd.awaitingAdvance = true;
            // Unified battle win rewards (aura/BP/pass/XP)
            try { const BR=require('../../rpg/utils/BattleRewards'); const w=BR.giveBattleWinRewards(player, db, 'dungeon', player.level, sock, chatId); rewardLine = `💠 +${Math.floor(rewards.gold)} 💠  |  💎 +${Math.floor(rewards.crystals || 0)} | ${BR.formatRewards(w).replace(/\n/g,' | ')}`; } catch(e){ rewardLine = `💠 +${Math.floor(rewards.gold)} 💠  |  💎 +${Math.floor(rewards.crystals || 0)}`; }
          } else if (dunPty) {
            dunPty.awaitingAdvance = true;
          }
          sections.push({
            text: [
              `${FRAME}`,
              `💀 *${monster.name}* defeated!`,
              rewardLine,
              ``,
              `/dungeon advance — next floor`,
              `/dungeon leave   — exit with rewards`,
              `${FRAME}`,
            ].filter(Boolean).join('\n'),
          });
          saveDatabase();
          return sock.sendMessage(chatId, { sections }, { quoted: msg });
        }

        // ── Monster counter-attack ─────────────────────────
        sections.push({ text: executeMonsterAI(monster, player) });

        if (player.stats.hp <= 0) {
          player.stats.hp = 1;
          if (dunSd) {
            player.gold = (player.gold || 0) + Math.floor(dunSd.totalNexus * 0.5);
            delete db.soloDungeons[sender];
          }
          saveDatabase();
          sections.push({
            text: [
              FRAME,
              `💀 *You were defeated!*`,
              `50% of dungeon Nexus kept.`,
              `/use — recover`,
              FRAME,
            ].join('\n'),
          });
          return sock.sendMessage(chatId, { sections }, { quoted: msg });
        }

        // ── Status snapshot ───────────────────────────────
        const mBar = BarSystem.getMonsterHPBar(monster.stats.hp, monster.stats.maxHp);
        const pBar = BarSystem.getHPBar(player.stats.hp, player.stats.maxHp, require('../../rpg/utils/UnifiedCombat').isPro(player));
        sections.push({
          text: [
            FRAME,
            `${monster.emoji} *${monster.name}*`,
            `${mBar}`,
            `❤️ ${monster.stats.hp}/${monster.stats.maxHp}`,
            ``,
            `👤 *${player.name}*`,
            `${pBar}`,
            `❤️ ${player.stats.hp}/${player.stats.maxHp}`,
            FRAME,
            `⚔️ /dungeon attack — next hit`,
            `⚡ /<classcmd> [skill]   — use a skill`,
            FRAME,
          ].join('\n'),
        });
        saveDatabase();
        return sock.sendMessage(chatId, { sections }, { quoted: msg });
      }
      // ── End pattern block — fall through to regular attack ────
      // ── SOLO ATTACK ───────────────────────────────────────
      if (db.soloDungeons && db.soloDungeons[sender]) {
        const sd = db.soloDungeons[sender];
        const monster = sd.currentMonster;

        if (sd.awaitingAdvance) {
          return sock.sendMessage(chatId, { text: '✅ Floor cleared!\n/dungeon advance — next floor\n/dungeon leave — exit with rewards' }, { quoted: msg });
        }

        // Status effects — Unified tick + summary for next round
        let _preStatus = statusSummary(player) || statusSummary(monster);
        const fx = StatusEffectManager.processTurnEffects(player);
        let log = '';
        if (fx.messages.length) log += fx.messages.join('\n') + '\n\n';
        else if (_preStatus) log += `⚠️ *STATUS:* ${_preStatus}\n\n`;
        // Batch-47: stunned loses the strike, monster still attacks.
        let _soloStunned = false;
        if (!fx.canAct) {
          log += `❌ *${player.name}* cannot move this turn — strike lost!\n💢 *But the battle plays on...*\n\n`;
          _soloStunned = true;
        }
        if (!_soloStunned) {

        // Player attacks monster — full bonus calculation like party
        const artBSolo = ArtifactSystem.calculateCombatBonusFromPlayer?.(player);
        const artAtkSolo = artBSolo?.bonuses?.atk || 0;
        const weapAtkSolo = player.weapon?.bonus || player.weapon?.attack || 0;
        PetManager.updateHunger(sender);
        const petBSolo = PetManager.getPetBattleBonus(sender);
        const petAtkSolo = petBSolo?.bonuses?.atk || 0;
        const modsSolo = StatusEffectManager.getStatModifiers(player);
        let consAtkSolo = 0;
        try { const CS=require('../../rpg/utils/ConstellationSystem'); consAtkSolo=CS.getSponsorBonus(player).atk||0; } catch(e) {}
        let _gearAtkSolo = 0, _gearCritSolo = 0;
        try { const _gb = require('../../rpg/utils/GearSystem').getEquippedBonuses(player); _gearAtkSolo = _gb.atk || 0; _gearCritSolo = _gb.crit || 0; } catch (e) {}
        const effAtkSolo = Math.floor((player.stats.atk + weapAtkSolo + artAtkSolo + petAtkSolo + consAtkSolo + _gearAtkSolo) * modsSolo.atkMod);
        const isCritSolo = Math.random() < (((player.stats.critChance || 10) + _gearCritSolo) / 100);
        const critMSolo  = 1.5 + (player.statAllocations?.critDamage || 0) * 0.01;
        const playerDmg  = Math.max(1, Math.floor(effAtkSolo * (isCritSolo ? critMSolo : 1.0)) - Math.floor(monster.stats.def * 0.4));

        // Lifesteal
        const lsPctSolo = (player.statAllocations?.lifesteal || 0) * 0.5 / 100;
        if (lsPctSolo > 0) {
          const healLS = Math.floor(playerDmg * lsPctSolo);
          if (healLS > 0) { player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healLS); log += `💚 Lifesteal: +${healLS} HP\n`; }
        }

        monster.stats.hp = Math.max(0, monster.stats.hp - playerDmg);

        log += `${FRAME}\n⚔️ *${player.name}* attacks *${monster.name}*!\n${FRAME}\n`;
        if (isCritSolo) log += `💥 *CRITICAL HIT!*\n`;
        if (artAtkSolo > 0) log += `✨ Artifact: +${artAtkSolo} ATK!\n`;
        if (petAtkSolo > 0) log += `🐾 Pet: +${petAtkSolo} ATK!\n`;
        log += `💥 Dealt *${playerDmg}* damage!\n`;

        if (monster.stats.hp <= 0) {
          // Monster defeated
          const isBossSolo = sd.currentFloor % 5 === 0;
          const rewards = DungeonManager.getFloorRewards(sd.currentFloor, player.level, isBossSolo);
          const xpGain      = Math.floor(rewards.xp);
          const goldGain    = Math.floor(rewards.gold);
          const crystalGain = Math.floor(rewards.crystals || 0);

          // ── Quest tracking: kill + boss + floor ─────────────────
          try {
            const { trackAndNotify } = require('../../rpg/utils/QuestDispatcher');
            const kn = trackAndNotify(player, 'kill', 1, sock, sender, chatId);
            if (kn) log += '\n' + kn;
            if (isBossSolo) {
              const bn = trackAndNotify(player, 'boss', 1, sock, sender, chatId);
              if (bn) log += '\n' + bn;
            }
            const fn = trackAndNotify(player, 'floor', sd.currentFloor, sock, sender, chatId);
            if (fn) log += '\n' + fn;
            if (sd.currentFloor === sd.maxFloors) {
              const cn = trackAndNotify(player, 'clear', 1, sock, sender, chatId);
              if (cn) log += '\n' + cn;
            }
            const dn = trackAndNotify(player, 'dungeon', 1, sock, sender, chatId);
            if (dn) log += '\n' + dn;
          } catch(e) {}

          sd.totalXp      += xpGain;
          sd.totalNexus    += goldGain;
          sd.totalCrystals += crystalGain;

          // Award Guild Points for Guild War (defeating dungeon monster)
          try { require('../../rpg/utils/WeeklyGuildWar').addGP(db, sender, 5, saveDatabase); } catch(e) {}

          log += `\n${FRAME}\n`;
          log += `💀 *${monster.name}* has been defeated!\n${FRAME}\n`;
          log += `💠 +${goldGain} Nexus | 💎 +${crystalGain} Mana Stones\n`;
          if (isBossSolo) {
            log += `\n👹 *BOSS DEFEATED!* You earned bonus rewards!`;
            // 25% egg drop on solo boss floors
            if (Math.random() < 0.25) {
              try {
                const { rollEggType } = require('../../rpg/utils/PetDatabase');
                const PetManager = require('../../rpg/utils/PetManager');
                const r = PetManager.giveEgg(sender, rollEggType());
                if (r.success) log += `\n🥚 *${r.egg.name}* found in the boss chamber!`;
              } catch(e) {}
            }
          }

          if (sd.currentFloor >= sd.maxFloors) {
            // Apply buff multipliers
          if (BuffManager) {
            sd.totalXp   = Math.floor(sd.totalXp   * (BuffManager.getXpMultiplier(player)   || 1));
            sd.totalNexus = Math.floor(sd.totalNexus * (BuffManager.getNexusMultiplier(player) || 1));
          }
          awardXP(player, 'dungeon_complete', saveDatabase, sock, chatId);
            player.gold         = (player.gold          || 0) + sd.totalNexus;
            player.manaCrystals = (player.manaCrystals  || 0) + sd.totalCrystals;
            delete db.soloDungeons[sender];
            saveDatabase();
            return sock.sendMessage(chatId, {
              text: `${log}\n\n${FRAME}\n🏆 *SOLO DUNGEON COMPLETE!*${pro ? ' 💎' : ''}\n${FRAME}\n✅ All 10 floors cleared!\n\n📊 *TOTAL REWARDS:*\n💠 Nexus: +${sd.totalNexus.toLocaleString()}\n💎 Mana Stones: +${sd.totalCrystals}\n${FRAME}\n💪 Well done, solo hunter!` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO DELVER* — run total ${UI.num(sd.totalNexus)} 💠` : `\n${UI.upsell()}`)
            }, { quoted: msg });
          }

          sd.awaitingAdvance = true;
          saveDatabase();
          log += `\n\n🏆 Floor ${sd.currentFloor} cleared!\n/dungeon advance — Floor ${sd.currentFloor + 1}\n/dungeon leave — Exit with rewards`;
          return sock.sendMessage(chatId, { text: log }, { quoted: msg });
        }

        } // ── end player strike (skipped when stunned) ──

        // Monster counterattacks using full AI (abilities + dialogue)
        log += executeMonsterAI(monster, player);

        // Monster status effects tick
        const mfxSolo = StatusEffectManager.processTurnEffects(monster);
        if (mfxSolo.messages.length) log += '\n' + mfxSolo.messages.join('\n') + '\n';

        const mHpBar = BarSystem.getMonsterHPBar(monster.stats.hp, monster.stats.maxHp);
        const pHpBar = BarSystem.getHPBar(player.stats.hp, player.stats.maxHp, require('../../rpg/utils/UnifiedCombat').isPro(player));

        if (player.stats.hp <= 0) {
          // Player died — give partial rewards
          player.stats.hp = 1;
          awardXP(player, 'dungeon_floor', saveDatabase, sock, chatId);
          player.gold = (player.gold  || 0) + Math.floor(sd.totalNexus * 0.5);
          delete db.soloDungeons[sender];
          saveDatabase();
          return sock.sendMessage(chatId, {
            text: `${log}\n\n${FRAME}\n💀 *DEFEATED on Floor ${sd.currentFloor}!*\n${FRAME}\n📦 Kept 50% of earned rewards.\n💠 Nexus: +${Math.floor(sd.totalNexus * 0.5)}\n${FRAME}\n🏥 Use /use to recover.`
          }, { quoted: msg });
        }

        if (!sd.turn) sd.turn = 1;
        sd.turn++;
        saveDatabase();

        log += `\n${FRAME}\n`;
        log += `${monster.emoji} *${monster.name}*\n${mHpBar}\n❤️ ${monster.stats.hp}/${monster.stats.maxHp}\n\n`;
        log += `👤 *${player.name}*\n${pHpBar}\n❤️ ${player.stats.hp}/${player.stats.maxHp}\n`;
        log += `${FRAME}\n🎯 Floor ${sd.currentFloor}/10 | Turn ${sd.turn}`;
        return sock.sendMessage(chatId, { text: log }, { quoted: msg });
      }

      // ── PARTY ATTACK ──────────────────────────────────────
      const party = DungeonPartyManager.getPartyByPlayer(sender);
      if (!party || party.status !== 'active') return sock.sendMessage(chatId, { text: '❌ No active dungeon!' }, { quoted: msg });
      if (party.dungeon.awaitingAdvance) return sock.sendMessage(chatId, { text: '✅ Floor cleared! Use /dungeon advance to go deeper, or /dungeon leave to exit.' }, { quoted: msg });

      const dungeon = party.dungeon;
      const monster = dungeon.currentMonster;

      // Status effects
      const fx = StatusEffectManager.processTurnEffects(player);
      let log = '';
      if (fx.messages.length) log += fx.messages.join('\n') + '\n\n';
      if (!fx.canAct) { log += `❌ ${player.name} cannot act this turn!`; return sock.sendMessage(chatId, { text: log }, { quoted: msg }); }

      // Damage calc
      const artB  = ArtifactSystem.calculateCombatBonusFromPlayer?.(player);
      const artAtk = artB?.bonuses?.atk || 0;
      const weapAtk = player.weapon?.bonus || player.weapon?.attack || 0;
      PetManager.updateHunger(sender);
      const petB   = PetManager.getPetBattleBonus(sender);
      const petAtk = petB?.bonuses?.atk || 0;
      const mods   = StatusEffectManager.getStatModifiers(player);
      let consAtkDungeon = 0;
      try { const CS=require('../../rpg/utils/ConstellationSystem'); consAtkDungeon=CS.getSponsorBonus(player).atk||0; } catch(e) {}
      let _gearAtkD = 0;
      try { _gearAtkD = require('../../rpg/utils/GearSystem').getEquippedBonuses(player).atk || 0; } catch (e) {}
      const effAtk = Math.floor((player.stats.atk + weapAtk + artAtk + petAtk + consAtkDungeon + _gearAtkD) * mods.atkMod);
      const isCrit  = Math.random() < (0.10 + (player.statAllocations?.critChance || 0) * 0.005);
      const critM   = 1.5 + (player.statAllocations?.critDamage || 0) * 0.01;
      let dmg       = Math.max(1, Math.floor(effAtk * (isCrit ? critM : 1.0)) - Math.floor(monster.stats.def * 0.4));

      // Lifesteal
      const lsPct = (player.statAllocations?.lifesteal || 0) * 0.5 / 100;
      if (lsPct > 0) {
        const heal = Math.floor(dmg * lsPct);
        if (heal > 0) { player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal); log += `💚 Lifesteal: +${heal} HP\n`; }
      }

      monster.stats.hp -= dmg;
      dungeon.turn++;

      log += `${FRAME}\n⚔️ *${player.name}* attacks!\n${FRAME}\n`;
      if (isCrit) log += `💥 *CRITICAL HIT!*\n`;
      if (artAtk > 0) log += `✨ Artifact: +${artAtk} ATK!\n`;
      if (petAtk > 0) log += `🐾 Pet: +${petAtk} ATK!\n`;
      log += `💥 Dealt *${dmg}* damage!\n`;

      if (monster.stats.hp <= 0) {
        // ── Quest tracking: kill + boss + floor (party) ───────────
        try {
          const { trackAndNotify } = require('../../rpg/utils/QuestDispatcher');
          const kn = trackAndNotify(player, 'kill', 1, sock, sender, chatId);
          if (kn) log += '\n' + kn;
          if (dungeon.currentFloor % 5 === 0) {
            const bn = trackAndNotify(player, 'boss', 1, sock, sender, chatId);
            if (bn) log += '\n' + bn;
          }
          const fn = trackAndNotify(player, 'floor', dungeon.currentFloor, sock, sender);
          if (fn) log += '\n' + fn;
          if (dungeon.currentFloor === dungeon.maxFloors) {
            const cn = trackAndNotify(player, 'clear', 1, sock, sender, chatId);
            if (cn) log += '\n' + cn;
          }
          const dn = trackAndNotify(player, 'dungeon', 1, sock, sender, chatId);
          if (dn) log += '\n' + dn;
        } catch(e) {}
        return handleMonsterDefeat(sock, chatId, party, monster, dungeon, db, saveDatabase, msg, sender, log);
      }

      log += executeMonsterAI(monster, player);

      const mfx = StatusEffectManager.processTurnEffects(monster);
      if (mfx.messages.length) log += '\n' + mfx.messages.join('\n') + '\n';

      if (player.stats.hp <= 0) {
        return handlePlayerDeath(sock, chatId, party, dungeon, db, saveDatabase, msg, sender, log);
      }

      saveDatabase();
      log += `\n${FRAME}\n`;
      log += `👤 *${player.name}* ❤️ ${player.stats.hp}/${player.stats.maxHp}\n${BarSystem.getHPBar(player.stats.hp, player.stats.maxHp, require('../../rpg/utils/UnifiedCombat').isPro(player))}\n`;
      log += `\n${monster.emoji} *${monster.name}*\n${BarSystem.getMonsterHPBar(monster.stats.hp, monster.stats.maxHp)}\n`;
      log += `${FRAME}\n🎯 Floor ${dungeon.currentFloor}/20 | Turn ${dungeon.turn}`;
      return sock.sendMessage(chatId, { text: log }, { quoted: msg });
    }

    // ── USE SKILL ─────────────────────────────────────────────
    if (sub === 'classcmd') {
      // ── SOLO SKILL ────────────────────────────────────────
      if (db.soloDungeons && db.soloDungeons[sender]) {
        const sd = db.soloDungeons[sender];
        if (sd.awaitingAdvance) return sock.sendMessage(chatId, { text: '✅ Floor cleared! /dungeon advance or /dungeon leave' }, { quoted: msg });

        const skillName = args.slice(1).join(' ').toLowerCase();
        if (!skillName) return sock.sendMessage(chatId, { text: '❌ Usage: /<classcmd> [skill]' }, { quoted: msg });

        const monster = sd.currentMonster;
        const fx = StatusEffectManager.processTurnEffects(player);
        let log = '';
        if (fx.messages.length) log += fx.messages.join('\n') + '\n\n';
        if (!fx.canAct) { log += `❌ ${player.name} cannot act!`; return sock.sendMessage(chatId, { text: log }, { quoted: msg }); }
        if (!fx.canUseSkills) { log += `🤐 ${player.name} is SILENCED — skills locked!`; return sock.sendMessage(chatId, { text: log }, { quoted: msg }); }

        const className = typeof player.class === 'string' ? player.class : player.class?.name  || 'Awaiting';
        // Build player entity with artifact bonuses applied
        const _artStats = ArtifactSystem?.getEquippedArtifactStats ? ArtifactSystem.getEquippedArtifactStats(player) : {};
        const _atkBoost = BuffManager?.getAtkBoost ? BuffManager.getAtkBoost(player) : 0;
        let _gearB = {};
        try { _gearB = require('../../rpg/utils/GearSystem').getEquippedBonuses(player) || {}; } catch (e) {}
        const pStats = { ...player.stats,
          atk: (player.stats.atk || 0) + (_artStats.atk || 0) + _atkBoost + (_gearB.atk || 0),
          def: (player.stats.def || 0) + (_artStats.def || 0) + (_gearB.def || 0),
          critChance: (player.stats.critChance || 0) + (_artStats.critChance || 0) + (_gearB.crit || 0)
        };
        const pEnt = { name: player.name, stats: pStats, skills: player.skills, class: { name: className }, energyType: player.energyType || 'Energy', statusEffects: player.statusEffects || [], weapon: player.weapon };
        const mEnt = { name: monster.name, stats: monster.stats, skills: {}, abilities: monster.abilities || [], statusEffects: monster.statusEffects || [] };

        const result = ImprovedCombat.executeSkill(pEnt, mEnt, skillName);
        if (!result.success) return sock.sendMessage(chatId, { text: `❌ ${result.message}` }, { quoted: msg });

        player.stats.hp      = pEnt.stats.hp;
        player.stats.energy  = pEnt.stats.energy;
        player.statusEffects = pEnt.statusEffects;
        monster.stats        = mEnt.stats;
        monster.statusEffects = mEnt.statusEffects;
        if (!sd.turn) sd.turn = 1;
        sd.turn++;

        log += result.message + '\n\n';

        if (monster.stats.hp <= 0) {
          const isBossSk = sd.currentFloor % 5 === 0;
          const rewards  = DungeonManager.getFloorRewards(sd.currentFloor, player.level, isBossSk);
          const xpGain   = Math.floor(rewards.xp);
          const goldGain = Math.floor(rewards.gold);
          const crysGain = Math.floor(rewards.crystals || 0);
          sd.totalXp += xpGain; sd.totalNexus += goldGain; sd.totalCrystals += crysGain;

          // ── Quest tracking: kill + boss + floor (solo skill) ─────
          try {
            const { trackAndNotify } = require('../../rpg/utils/QuestDispatcher');
            const kn = trackAndNotify(player, 'kill', 1, sock, sender, chatId);
            if (kn) log += '\n' + kn;
            if (isBossSk) {
              const bn = trackAndNotify(player, 'boss', 1, sock, sender, chatId);
              if (bn) log += '\n' + bn;
            }
            const fn = trackAndNotify(player, 'floor', sd.currentFloor, sock, sender, chatId);
            if (fn) log += '\n' + fn;
            if (sd.currentFloor === sd.maxFloors) {
              const cn = trackAndNotify(player, 'clear', 1, sock, sender, chatId);
              if (cn) log += '\n' + cn;
            }
            const dn = trackAndNotify(player, 'dungeon', 1, sock, sender, chatId);
            if (dn) log += '\n' + dn;
          } catch(e) {}

          log += `${FRAME}\n💀 *${monster.name}* has been defeated!\n${FRAME}\n`;
          log += `💠 +${goldGain} Nexus | 💎 +${crysGain} Mana Stones\n`;
          log += `💠 *Total earned this run: ${sd.totalNexus.toLocaleString()}g*\n`;
          if (isBossSk) log += `\n👹 *BOSS DEFEATED!* Bonus rewards earned!`;

          if (sd.currentFloor >= sd.maxFloors) {
            // Apply buff multipliers
          if (BuffManager) {
            sd.totalXp   = Math.floor(sd.totalXp   * (BuffManager.getXpMultiplier(player)   || 1));
            sd.totalNexus = Math.floor(sd.totalNexus * (BuffManager.getNexusMultiplier(player) || 1));
          }
          awardXP(player, 'dungeon_complete', saveDatabase, sock, chatId);
            player.gold         = (player.gold          || 0) + sd.totalNexus;
            player.manaCrystals = (player.manaCrystals  || 0) + sd.totalCrystals;
            delete db.soloDungeons[sender];
            saveDatabase();
            return sock.sendMessage(chatId, {
              text: `${log}\n\n${FRAME}\n🏆 *SOLO DUNGEON COMPLETE!*${pro ? ' 💎' : ''}\n${FRAME}\n✅ All 10 floors cleared!\n\n📊 *TOTAL REWARDS:*\n💠 Nexus: +${sd.totalNexus.toLocaleString()}\n💎 Mana Stones: +${sd.totalCrystals}\n${FRAME}\n💪 Well done, solo hunter!` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO DELVER* — run total ${UI.num(sd.totalNexus)} 💠` : `\n${UI.upsell()}`)
            }, { quoted: msg });
          }

          sd.awaitingAdvance = true;
          saveDatabase();
          log += `\n\n🏆 Floor ${sd.currentFloor} cleared!\n/dungeon advance — Floor ${sd.currentFloor + 1}\n/dungeon leave — Exit with rewards`;
          return sock.sendMessage(chatId, { text: log }, { quoted: msg });
        }

        log += executeMonsterAI(monster, player);
        const mfxSk = StatusEffectManager.processTurnEffects(monster);
        if (mfxSk.messages.length) log += '\n' + mfxSk.messages.join('\n') + '\n';

        if (player.stats.hp <= 0) {
          player.stats.hp = 1;
          awardXP(player, 'dungeon_floor', saveDatabase, sock, chatId);
          player.gold = (player.gold  || 0) + Math.floor(sd.totalNexus * 0.5);
          delete db.soloDungeons[sender];
          saveDatabase();
          return sock.sendMessage(chatId, {
            text: `${log}\n\n${FRAME}\n💀 *DEFEATED on Floor ${sd.currentFloor}!*\n${FRAME}\n📦 Kept 50% of earned rewards.\n💠 Nexus: +${Math.floor(sd.totalNexus * 0.5)}\n${FRAME}\n🏥 Use /use to recover.`
          }, { quoted: msg });
        }

        saveDatabase();
        log += `\n${FRAME}\n${monster.emoji} *${monster.name}*\n${BarSystem.getMonsterHPBar(monster.stats.hp, monster.stats.maxHp)}\n❤️ ${monster.stats.hp}/${monster.stats.maxHp}\n\n👤 *${player.name}*\n${BarSystem.getHPBar(player.stats.hp, player.stats.maxHp, require('../../rpg/utils/UnifiedCombat').isPro(player))}\n❤️ ${player.stats.hp}/${player.stats.maxHp}\n${FRAME}\n🎯 Floor ${sd.currentFloor}/10 | Turn ${sd.turn}`;
        return sock.sendMessage(chatId, { text: log }, { quoted: msg });
      }

      // ── PARTY SKILL ───────────────────────────────────────
      const party = DungeonPartyManager.getPartyByPlayer(sender);
      if (!party || party.status !== 'active') return sock.sendMessage(chatId, { text: '❌ No active dungeon!' }, { quoted: msg });
      if (party.dungeon.awaitingAdvance) return sock.sendMessage(chatId, { text: '✅ Floor cleared! /dungeon advance or /dungeon leave' }, { quoted: msg });

      const skillName = args.slice(1).join(' ').toLowerCase();
      if (!skillName) return sock.sendMessage(chatId, { text: '❌ Usage: /<classcmd> [skill]' }, { quoted: msg });

      const dungeon = party.dungeon;
      const monster = dungeon.currentMonster;
      const fx      = StatusEffectManager.processTurnEffects(player);
      let log = '';
      if (fx.messages.length) log += fx.messages.join('\n') + '\n\n';
      if (!fx.canAct) { log += `❌ ${player.name} cannot act!`; return sock.sendMessage(chatId, { text: log }, { quoted: msg }); }
      if (!fx.canUseSkills) { log += `🤐 ${player.name} is SILENCED — skills locked!`; return sock.sendMessage(chatId, { text: log }, { quoted: msg }); }

      const className = typeof player.class === 'string' ? player.class : player.class?.name  || 'Awaiting';
      const pEnt = { name: player.name, stats: player.stats, skills: player.skills, class: { name: className }, energyType: player.energyType || 'Energy', statusEffects: player.statusEffects || [] };
      const mEnt = { name: monster.name, stats: monster.stats, skills: {}, abilities: monster.abilities || [], statusEffects: monster.statusEffects || [] };

      const result = ImprovedCombat.executeSkill(pEnt, mEnt, skillName);
      if (!result.success) return sock.sendMessage(chatId, { text: `❌ ${result.message}` }, { quoted: msg });

      player.stats.hp     = pEnt.stats.hp;
      player.stats.energy = pEnt.stats.energy;
      player.statusEffects = pEnt.statusEffects;
      monster.stats       = mEnt.stats;
      monster.statusEffects = mEnt.statusEffects;
      dungeon.turn++;

      log += result.message + '\n\n';

      if (monster.stats.hp <= 0) {
        return handleMonsterDefeat(sock, chatId, party, monster, dungeon, db, saveDatabase, msg, sender, log);
      }

      log += executeMonsterAI(monster, player);
      if (player.stats.hp <= 0) return handlePlayerDeath(sock, chatId, party, dungeon, db, saveDatabase, msg, sender, log);

      saveDatabase();
      log += `\n${FRAME}\n👤 *${player.name}* ❤️ ${player.stats.hp}/${player.stats.maxHp}\n${BarSystem.getHPBar(player.stats.hp, player.stats.maxHp, require('../../rpg/utils/UnifiedCombat').isPro(player))}\n\n${monster.emoji} *${monster.name}*\n${BarSystem.getMonsterHPBar(monster.stats.hp, monster.stats.maxHp)}\n${FRAME}\n🎯 Floor ${dungeon.currentFloor}/20`;
      return sock.sendMessage(chatId, { text: log }, { quoted: msg });
    }

    // ── ITEM ──────────────────────────────────────────────────
    if (sub === 'item') {
      // ── SOLO ITEM ─────────────────────────────────────────
      if (db.soloDungeons && db.soloDungeons[sender]) {
        const itemType = args[1]?.toLowerCase();
        if (itemType === 'hp' || itemType === 'health') {
          const potions = player.inventory?.healthPotions || 0;
          if (potions <= 0) return sock.sendMessage(chatId, { text: '❌ No Health Potions!\nBuy some: /shop buy 1 5' }, { quoted: msg });
          player.inventory.healthPotions--;
          const heal = Math.floor(player.stats.maxHp * 0.5);
          player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
          saveDatabase();
          return sock.sendMessage(chatId, { text: `🩹 Healed *+${heal} HP*!\n❤️ ${player.stats.hp}/${player.stats.maxHp}\n🩹 Potions left: ${player.inventory.healthPotions}` }, { quoted: msg });
        }
        if (itemType === 'ep' || itemType === 'energy') {
          const potions = player.inventory?.energyPotions || player.inventory?.manaPotions || 0;
          if (potions <= 0) return sock.sendMessage(chatId, { text: '❌ No Energy Potions!\nBuy some: /shop buy 2 5' }, { quoted: msg });
          if (player.inventory.energyPotions !== undefined) player.inventory.energyPotions--;
          else player.inventory.manaPotions--;
          const restore = Math.floor(player.stats.maxEnergy * 0.5);
          player.stats.energy = Math.min(player.stats.maxEnergy, (player.stats.energy || 0) + restore);
          saveDatabase();
          return sock.sendMessage(chatId, { text: `💙 Restored *+${restore} Energy*!\n💙 ${player.stats.energy}/${player.stats.maxEnergy}` }, { quoted: msg });
        }
        return sock.sendMessage(chatId, { text: '❌ Usage: /dungeon item hp OR /dungeon item energy' }, { quoted: msg });
      }

      // ── PARTY ITEM ────────────────────────────────────────
      const party = DungeonPartyManager.getPartyByPlayer(sender);
      if (!party || party.status !== 'active') return sock.sendMessage(chatId, { text: '❌ No active dungeon!' }, { quoted: msg });

      const itemType = args[1]?.toLowerCase();
      if (itemType === 'hp' || itemType === 'health') {
        if (player.stats.hp <= 0) return sock.sendMessage(chatId, { text: '❌ You are dead! Use /dungeon item revive first.' }, { quoted: msg });
        const used = party.sharedItems?.healthPotionsUsed || 0;
        if (used >= 5) return sock.sendMessage(chatId, { text: `❌ Max 5 HP potions per dungeon! (Used: ${used}/5)` }, { quoted: msg });
        if (!DungeonPartyManager.useItem(party.id, 'healthPotions', 1)) return sock.sendMessage(chatId, { text: '❌ No HP Potions in party inventory!' }, { quoted: msg });
        if (!party.sharedItems.healthPotionsUsed) party.sharedItems.healthPotionsUsed = 0;
        party.sharedItems.healthPotionsUsed++;
        const heal = Math.floor(player.stats.maxHp * 0.5);
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
        saveDatabase();
        return sock.sendMessage(chatId, { text: `🩹 *${player.name}* healed *+${heal} HP*!\n❤️ ${player.stats.hp}/${player.stats.maxHp}\n🩹 Potions used: ${party.sharedItems.healthPotionsUsed}/5` }, { quoted: msg });
      }
      if (itemType === 'ep' || itemType === 'energy') {
        if (player.stats.hp <= 0) return sock.sendMessage(chatId, { text: '❌ You are dead! Use /dungeon item revive first.' }, { quoted: msg });
        if (!DungeonPartyManager.useItem(party.id, 'energyPotions', 1)) return sock.sendMessage(chatId, { text: '❌ No Energy Potions in party inventory!' }, { quoted: msg });
        const rest = Math.floor(player.stats.maxEnergy * 0.5);
        player.stats.energy = Math.min(player.stats.maxEnergy, player.stats.energy + rest);
        saveDatabase();
        return sock.sendMessage(chatId, { text: `💙 *${player.name}* restored *+${rest} Energy*!\n💙 ${player.stats.energy}/${player.stats.maxEnergy}` }, { quoted: msg });
      }
      if (itemType === 'revive') {
        if (player.stats.hp > 0) return sock.sendMessage(chatId, { text: '❌ You are not dead!' }, { quoted: msg });
        const rUsed = party.sharedItems?.reviveTokensUsed || 0;
        if (rUsed >= 1) return sock.sendMessage(chatId, { text: '❌ Only 1 revive token allowed per dungeon!' }, { quoted: msg });
        if (!DungeonPartyManager.useItem(party.id, 'reviveTokens', 1)) return sock.sendMessage(chatId, { text: '❌ No Revive Tokens in party inventory!' }, { quoted: msg });
        if (!party.sharedItems.reviveTokensUsed) party.sharedItems.reviveTokensUsed = 0;
        party.sharedItems.reviveTokensUsed++;
        player.stats.hp     = Math.floor(player.stats.maxHp * 0.3);
        player.stats.energy = Math.floor(player.stats.maxEnergy * 0.3);
        saveDatabase();
        return sock.sendMessage(chatId, { text: `🎫 *${player.name}* has been REVIVED!\n❤️ ${player.stats.hp}/${player.stats.maxHp}` }, { quoted: msg });
      }
      return sock.sendMessage(chatId, { text: '❌ Usage: /dungeon item [hp/energy/revive]' }, { quoted: msg });
    }

    // Default
    return sock.sendMessage(chatId, { text: '❌ Unknown command! /dungeon help' }, { quoted: msg });
  }
};

// ── DUNGEON ATTACK PATTERN INTEGRATION ────────────────────────────────────────
// This block is appended and handled by checking args[1] BEFORE the generic attack block.
// In the main execute function, /dungeon attack <number> is caught first.
// The original attack handler already works for /dungeon attack (no number).
// This is a modular addition — the AttackPatternDB is required inline.

// ── Party-defeat / completion helpers (safety stubs) ─────────────────────────
// These were previously referenced but never defined, causing every party
// attack kill to crash. They are now defined as no-op-safe wrappers that
// still credit rewards and finish the dungeon.
async function handleMonsterDefeat(sock, chatId, party, monster, dungeon, db, saveDatabase, msg, sender, log) {
  try {
    const DungeonManager = require('../../rpg/dungeons/DungeonManager');
    const DungeonPartyManager = require('../../rpg/dungeons/DungeonPartyManager');
    const BarSystem = require('../../rpg/utils/BarSystem');
    const player = db.users[sender];
    if (!player) return;
    const dPro = UI.isPro(player);
    const FRAME = dPro ? UI.PRO_BAR : UI.FREE_BAR;
    dungeon.monstersDefeated = (dungeon.monstersDefeated || 0) + 1;
    dungeon.awaitingAdvance = true;
    dungeon.totalMonsters   = (dungeon.totalMonsters || 0) + 1;
    dungeon.floorsCleared   = dungeon.floorsCleared || [];
    if (!dungeon.floorsCleared.includes(dungeon.currentFloor)) {
      dungeon.floorsCleared.push(dungeon.currentFloor);
    }

    // Award Guild Points for Guild War to party members
    try {
      party.members.forEach(m => {
        const memberId = typeof m === 'object' ? m.id : m;
        require('../../rpg/utils/WeeklyGuildWar').addGP(db, memberId, 5, saveDatabase);
      });
    } catch(e) {}
    saveDatabase();

    // ── Quest tracking for party kill ─────────────────────────────────
    try {
      const { trackAndNotify } = require('../../rpg/utils/QuestDispatcher');
      const kn = trackAndNotify(player, 'kill', 1, sock, sender, chatId);
      if (kn) log += '\n' + kn;
      if (dungeon.currentFloor % 5 === 0) {
        const bn = trackAndNotify(player, 'boss', 1, sock, sender, chatId);
        if (bn) log += '\n' + bn;
      }
      const fn = trackAndNotify(player, 'floor', dungeon.currentFloor, sock, sender);
      if (fn) log += '\n' + fn;
      if (dungeon.currentFloor === dungeon.maxFloors) {
        const cn = trackAndNotify(player, 'clear', 1, sock, sender, chatId);
        if (cn) log += '\n' + cn;
      }
      const dn = trackAndNotify(player, 'dungeon', 1, sock, sender, chatId);
      if (dn) log += '\n' + dn;
    } catch(e) {}

    let txt = log;
    txt += `\n${FRAME}\n`;
    txt += dPro ? `💀 *${monster.name}* has been defeated! 💎\n` : `💀 *${monster.name}* has been defeated!\n`;
    txt += `${FRAME}\n`;
    txt += `📊 Floor ${dungeon.currentFloor}/${dungeon.maxFloors} | Defeated: ${dungeon.monstersDefeated}\n\n`;
    if (DungeonManager.isBossFloor(dungeon.currentFloor)) {
      txt += `👹 *BOSS FLOOR CLEARED!* Bonus rewards earned.\n\n`;
    }
    txt += `👥 *Party:*\n`;
    party.members.forEach(m => {
      const mp = db.users[m.id];
      if (!mp) return;
      txt += `${mp.stats.hp > 0 ? '⚔️' : '💀'} *${m.name}* — ${BarSystem.getHPBar(mp.stats.hp, mp.stats.maxHp, require('../../rpg/utils/UnifiedCombat').isPro(mp))} ${mp.stats.hp}/${mp.stats.maxHp}\n`;
    });
    txt += `\n${FRAME}\n/dungeon advance — next floor\n/dungeon leave   — exit & keep rewards`;
    txt += dPro ? `\n${UI.PRO_MINI}\n💎 *PRO DELVER* — floor ${dungeon.currentFloor}/${dungeon.maxFloors} · ${dungeon.monstersDefeated} slain` : `\n${UI.upsell()}`;
    await sock.sendMessage(chatId, { text: txt }, { quoted: msg });
  } catch (e) {
    console.error('handleMonsterDefeat error:', e.message);
    try { await sock.sendMessage(chatId, { text: log || '✅ Monster defeated!' }, { quoted: msg }); } catch(_){}
  }
}

async function handlePlayerDeath(sock, chatId, party, dungeon, db, saveDatabase, msg, sender, log) {
  try {
    const player = db.users[sender];
    if (!player) return;
    const FRAME = UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR;
    player.stats.hp = 1;
    saveDatabase();
    await sock.sendMessage(chatId, {
      text: (log || '') + `\n${FRAME}\n💀 *${player.name} was defeated!*\nAuto-revived with 1 HP. /use to heal.\n${FRAME}`
    }, { quoted: msg });
  } catch (e) { console.error('handlePlayerDeath:', e.message); }
}

async function handleDungeonComplete(sock, chatId, party, db, saveDatabase, msg) {
  try {
    const DungeonManager = require('../../rpg/dungeons/DungeonManager');
    const cPro = (party.members || []).some(m => { try { return UI.isPro(db.users[m.id]); } catch (e) { return false; } });
    const FRAME = cPro ? UI.PRO_BAR : UI.FREE_BAR;
    party.status = 'complete';
    let totalNexus = 0, totalCrystals = 0;
    for (const m of party.members) {
      const p = db.users[m.id];
      if (!p) continue;
      p.gold = (p.gold || 0) + 25000;
      p.manaCrystals = (p.manaCrystals || 0) + 50;
      totalNexus += 25000;
      totalCrystals += 50;
    }
    saveDatabase();
    await sock.sendMessage(chatId, {
      text: `${FRAME}\n🏆 *DUNGEON COMPLETE!*${cPro ? ' 💎' : ''}\n${FRAME}\nAll ${party.members.length} hunters survived.\n\n💠 +${totalNexus.toLocaleString()} 💠 (split)\n💎 +${totalCrystals} Mana Stones (split)\n${FRAME}`
    }, { quoted: msg });
  } catch (e) { console.error('handleDungeonComplete:', e.message); }
}

async function handleDungeonExit(sock, chatId, party, db, saveDatabase, msg, sender, fled) {
  try {
    party.status = 'disbanded';
    saveDatabase();
    await sock.sendMessage(chatId, {
      text: fled
        ? `🏃 *${db.users[sender]?.name || 'A member'} fled the dungeon!*`
        : `🚪 *Dungeon ended.* All members returned safely.`
    }, { quoted: msg });
  } catch (e) { console.error('handleDungeonExit:', e.message); }
}
