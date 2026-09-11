// worldboss.js — World Boss System
// Party of 2-5, form BEFORE boss spawns, turn-based attacks
// Boss has phases, telegraphed attacks, HP shared across party

const StatusEffectManager = require('../../rpg/utils/StatusEffectManager');
const UI = require('../../rpg/utils/UI');
// Shared raid display: deluxe frame if ANY raider is Pro.
function raidFrame(party, db) {
  try {
    const ms = party.members || [];
    const anyPro = ms.some(m => { const u = db.users?.[m.id || m]; return u && UI.isPro(u); });
    return anyPro ? UI.PRO_BAR : UI.FREE_BAR;
  } catch (e) { return UI.FREE_BAR; }
}
function statusSummary(ent){ if(!ent||!ent.statusEffects||!ent.statusEffects.length) return null; const m={burn:'🔥 Burn -15 HP', poison:'☠️ Poison -10 HP', bleed:'🩸 Bleed -12 HP', stun:'💫 Stun skip', freeze:'❄️ Freeze skip + -3% HP', paralyze:'⚡ Paralyze 70% skip', weaken:'💔 Weaken -30% ATK', curse:'👁️ Curse -15% DEF', fear:'😱 Fear -20% ATK', enfeeble:'🐢 Enfeeble -30% DEF', trueslow:'🐌 Slow -35% SPD', silence:'🤐 Silence', blind:'🌫️ Blind -50% ACC'}; return ent.statusEffects.map(s=> (m[(s.type||'').toLowerCase()]||s.type)+' ('+(s.duration||s.turns||'?')+'t)').join(' | '); }
const BP = require('../../rpg/utils/BattlePass');
const BarSystem           = require('../../rpg/utils/BarSystem');
const LevelUpManager      = require('../../rpg/utils/LevelUpManager');
const ArtifactSystem      = require('../../rpg/utils/ArtifactSystem');
const PetManager          = require('../../rpg/utils/PetManager');
const AchievementManager  = require('../../rpg/utils/AchievementManager');
const ImprovedCombat      = require('../../rpg/utils/ImprovedCombat');
const SkillDescriptions   = require('../../rpg/utils/SkillDescriptions');
let SeasonManager; try { SeasonManager = require('../../rpg/utils/SeasonManager'); } catch(e) {}
let GuildWar; try { GuildWar = require('./guildwar'); } catch(e) {}
let DC; try { DC = require('../../rpg/utils/DailyChallenges'); } catch(e) {}
let TitleSystem; try { TitleSystem = require('../../rpg/utils/TitleSystem'); } catch(e) {}

// ═══════════════════════════════════════════════════════════════
// WORLD BOSSES (5 total, rotate weekly or by admin)
// ═══════════════════════════════════════════════════════════════
const WORLD_BOSSES = [
  {
    id: 'forest_hydra',
    name: 'Forest Hydra',
    emoji: '🐍',
    minLevel: 1,
    minParty: 1, maxParty: 5,
    description: 'A three-headed hydra lurking in the forest. Cut one head off and two more grow back.',
    baseMult: 0.4,
    phases: [
      { threshold: 1.0, name: 'Lurking',    atkMult: 1.0,  msg: '🐍 The Forest Hydra bursts from the trees! Three heads hiss at once!' },
      { threshold: 0.6, name: 'Regrowing',  atkMult: 1.3,  msg: '🐍 PHASE 2: You cut a head off — two more grow back! It\'s getting stronger!' },
      { threshold: 0.3, name: 'Frenzy',     atkMult: 1.6,  msg: '💀 FINAL PHASE: All heads attacking at once! The forest shakes with each strike!' }
    ],
    abilities: ['Triple Bite', 'Acid Spit', 'Coil Crush', 'Regen']
  },
  {
    id: 'titan_kraken',
    name: 'Titan Kraken',
    emoji: '🐙',
    minLevel: 10,
    minParty: 1, maxParty: 5,
    description: 'A kraken the size of an island. It has pulled entire fleets into the deep.',
    baseMult: 1.0,
    phases: [
      { threshold: 1.0, name: 'Lurking',      atkMult: 1.0,  msg: '🌊 The Titan Kraken surfaces! Tentacles slam the water!' },
      { threshold: 0.6, name: 'Enraged',      atkMult: 1.35, msg: '🌊 PHASE 2: The Kraken ERUPTS! It rises fully from the ocean — enormous beyond belief!' },
      { threshold: 0.3, name: 'Leviathan',    atkMult: 1.80, msg: '💀 FINAL PHASE: ITS TRUE FORM! The Kraken becomes the ocean itself. You fight the sea!' }
    ],
    abilities: ['Tentacle Slam', 'Ink Cloud', 'Tidal Surge', 'Depth Crush', 'Whirlpool']
  },
  {
    id: 'ancient_lich',
    name: 'Ancient Lich',
    emoji: '💀',
    minLevel: 15,
    minParty: 1, maxParty: 5,
    description: 'An immortal sorcerer ten thousand years old. He has killed everyone who challenged him.',
    baseMult: 1.1,
    phases: [
      { threshold: 1.0, name: 'Arrogant',     atkMult: 1.0,  msg: '💀 The Ancient Lich glares at you like insects. "You dare?"' },
      { threshold: 0.6, name: 'Wrathful',     atkMult: 1.40, msg: '💀 PHASE 2: The Lich drops his robes. Bone armor clicks into place. "I will end you PERSONALLY."' },
      { threshold: 0.3, name: 'Undying',      atkMult: 1.85, msg: '💀 FINAL PHASE: He cannot die! He will not stay dead! Every wound closes instantly!' }
    ],
    abilities: ['Death Wave', 'Soul Drain', 'Dark Curse', 'Bone Prison', 'Lich Form']
  },
  {
    id: 'dragon_emperor',
    name: 'Dragon Emperor',
    emoji: '🐉',
    minLevel: 30,
    minParty: 1, maxParty: 5,
    description: 'The emperor of all dragons. To challenge him is to challenge dragonkind itself.',
    baseMult: 1.25,
    phases: [
      { threshold: 1.0, name: 'Contemptuous', atkMult: 1.0,  msg: '🐉 The Dragon Emperor lands. The ground shatters. He does not consider you a threat.' },
      { threshold: 0.6, name: 'Furious',      atkMult: 1.45, msg: '🐉 PHASE 2: You hurt him. HIM. His eyes burn Nexus. "INSOLENT WORMS! I WILL TURN YOU TO ASH!"' },
      { threshold: 0.3, name: 'World Burner', atkMult: 1.90, msg: '🔥 FINAL PHASE: DRACONIC ASCENSION! His scales glow white-hot. This is how worlds end.' }
    ],
    abilities: ['Dragon Emperor Flame', 'Wing Tempest', 'Scale Shatter', 'Ancient Roar', 'Draco Meteor']
  },
  {
    id: 'shadow_god',
    name: 'The Shadow God',
    emoji: '🌑',
    minLevel: 40,
    minParty: 1, maxParty: 5,
    description: 'A deity of pure darkness. It is not evil — it is simply the end of all things.',
    baseMult: 1.5,
    phases: [
      { threshold: 1.0, name: 'Dormant',      atkMult: 1.0,  msg: '🌑 The Shadow God opens its eyes. That is all it does. You feel like dying.' },
      { threshold: 0.6, name: 'Awakening',    atkMult: 1.50, msg: '🌑 PHASE 2: It speaks. No words — just the sound of nothing. Reality cracks.' },
      { threshold: 0.3, name: 'Ascended',     atkMult: 2.0,  msg: '🕳️ FINAL PHASE: THE VOID OPENS! It is not a creature anymore. It is the absence of existence.' }
    ],
    abilities: ['Void Erase', 'Shadow Dominion', 'Existence Denial', 'Dark Singularity', 'Absolute Void']
  },
  {
    id: 'chaos_titan',
    name: 'Chaos Titan',
    emoji: '💥',
    minLevel: 50,
    minParty: 1, maxParty: 5,
    description: 'A being born from the collapse of a universe. It has no goals. It simply destroys.',
    baseMult: 2.0,
    phases: [
      { threshold: 1.0, name: 'Unstable',     atkMult: 1.0,  msg: '💥 The Chaos Titan materializes. Physics stops working nearby.' },
      { threshold: 0.6, name: 'Fracturing',   atkMult: 1.55, msg: '💥 PHASE 2: It SHATTERS and REASSEMBLES. Every fragment is as strong as the whole!' },
      { threshold: 0.3, name: 'Absolute',     atkMult: 2.2,  msg: '☄️ FINAL PHASE: CHAOS ABSOLUTE! It tears a hole in the world and pulls you toward it!' }
    ],
    abilities: ['Chaos Eruption', 'Reality Fracture', 'Titan Smash', 'Primordial Roar', 'Universe Collapse']
  }
];

// ═══════════════════════════════════════════════════════════════
// TELEGRAPHED ATTACKS
// ═══════════════════════════════════════════════════════════════
const TELEGRAPHS = {
  CHARGE: { warn: '⚠️ *[WARNING]* The boss is WINDING UP a devastating strike!\nUse */worldboss defend* next turn to halve the damage!', dmgMult: 2.5 },
  AOE:    { warn: '⚠️ *[WARNING]* The boss is preparing an AREA BLAST!\nALL party members will take damage next turn! /worldboss defend!', dmgMult: 1.8, aoe: true },
  DRAIN:  { warn: '⚠️ *[WARNING]* The boss locks on with SOUL DRAIN eyes!\nIt will steal HP from your whole party next turn!', dmgMult: 1.2, lifesteal: 0.5 },
  CURSE:  { warn: '⚠️ *[WARNING]* The boss begins a DARK CURSE chant!\n/worldboss defend or get WEAKENED + POISONED next turn!', dmgMult: 0.5, applyDebuff: true },
  HOWL:   { warn: '⚡ *[ALERT]* The boss lets out a POWER HOWL! It is buffing itself!\nExpect an empowered attack next turn!', dmgMult: 0, selfBuff: true },
};

function getTelegraph(boss, turn) {
  const h = boss.stats.hp / boss.stats.maxHp;
  if (h < 0.30 && turn % 3 === 0) return TELEGRAPHS.CHARGE;
  if (h < 0.50 && turn % 5 === 0) return TELEGRAPHS.AOE;
  if (h < 0.65 && turn % 7 === 0) return TELEGRAPHS.DRAIN;
  if (turn % 11 === 0)             return TELEGRAPHS.CURSE;
  if (turn % 13 === 0)             return TELEGRAPHS.HOWL;
  return null;
}

// ═══════════════════════════════════════════════════════════════
// ACTIVE RAIDS (in-memory, not persisted)
// ═══════════════════════════════════════════════════════════════
const WorldBossParties = {
  parties: {}, counter: 1,
  create(leaderId, leaderName, bossId, chatId) {
    const id = `WB-${this.counter++}`;
    this.parties[id] = {
      id, chatId, leaderId,
      members: [{ id: leaderId, name: leaderName, ready: false, defending: false }],
      maxMembers: 5, minMembers: 2,
      bossId, boss: null,
      status: 'recruiting', // recruiting → active → completed/failed
      turn: 0,
      pendingActions: {}, // playerId → { type, skillIndex? }
      telegraph: null,
      pendingTelegraph: null,
      selfBuffed: false,
      createdAt: Date.now()
    };
    return this.parties[id];
  },
  get(id)  { return this.parties[id]; },
  getByPlayer(pid) { return Object.values(this.parties).find(p => p.members.some(m => m.id === pid)); },
  remove(id) { delete this.parties[id]; },
};

// ═══════════════════════════════════════════════════════════════
// BOSS STAT GENERATION
// ═══════════════════════════════════════════════════════════════
function generateBoss(bossDef, avgLevel, partySize) {
  const levelMult = 1 + (avgLevel - 1) * 0.08;
  const partyMult = Math.max(0.5, 1 + (partySize - 1) * 0.3); // +40% HP/ATK per extra member
  const base      = bossDef.baseMult;

  const hp  = Math.floor(15000 * levelMult * partyMult * base);
  const atk = Math.floor(800 * levelMult * partyMult * base);
  const def = Math.floor(400 * levelMult * partyMult * base);

  return {
    id:    bossDef.id,
    name:  bossDef.name,
    emoji: bossDef.emoji,
    desc:  bossDef.description,
    level: avgLevel + 15,
    phases: bossDef.phases,
    abilities: [...bossDef.abilities],
    currentPhase: 0,
    stats: { hp, maxHp: hp, atk, def, speed: 120 },
    statusEffects: [],
    selfBuffed: false
  };
}

function checkPhase(boss) {
  const pct = boss.stats.hp / boss.stats.maxHp;
  for (let i = boss.phases.length - 1; i >= 0; i--) {
    if (pct <= boss.phases[i].threshold && boss.currentPhase < i) {
      boss.currentPhase = i;
      return boss.phases[i];
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════
module.exports = {
  name: 'worldboss',
  aliases: ['wb'],
  description: 'World Boss Raids — Party of 2-5, massive boss fights',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const player = db.users[sender];

    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const action = args[0]?.toLowerCase();

    // ── HELP ────────────────────────────────────────────────────
    if (!action || action === 'help') {
      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n🌍 *WORLD BOSS RAIDS* 💎\n${UI.PRO_BAR}\n` : `🌍 *WORLD BOSS RAIDS*\n${UI.FREE_BAR}\n`) + `Massive bosses requiring a party of 2-5 hunters!\nBosses have 3 phases — harder as HP drops.\n\n📋 *COMMANDS:*\n/worldboss list          — View current world bosses\n/worldboss create [#]    — Form a party for boss #\n/worldboss join [ID]     — Join a forming party\n/worldboss ready         — Mark yourself ready\n/worldboss start         — Leader starts the raid (all ready)\n/worldboss attack        — Attack the boss\n/worldboss skill [name]  — Use a skill\n/worldboss defend        — Reduce incoming damage 60%\n/worldboss status        — View raid status\n/worldboss disband       — Disband party (pre-start only)\n\n⚠️ *RULES:*\n• Minimum 2 players, maximum 5\n• All members must be /worldboss ready\n• Watch for ⚠️ WARNING telegraphs — use /worldboss defend!\n• Each player takes damage individually each turn\n• If ALL members die, the raid fails\n${FRAME}` + (pro ? '' : `\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    // ── LIST ────────────────────────────────────────────────────
    if (action === 'list') {
      let txt = pro ? `${UI.PRO_BAR}\n🌍 *WORLD BOSSES* 💎\n${UI.PRO_BAR}\n\n` : `🌍 *WORLD BOSSES*\n${UI.FREE_BAR}\n\n`;
      WORLD_BOSSES.forEach((b, i) => {
        const locked = player.level < b.minLevel ? `🔒 Req. Lv${b.minLevel}` : '✅ Available';
        txt += `${i+1}. ${b.emoji} *${b.name}*\n   ${locked} | Party: ${b.minParty}-${b.maxParty} hunters\n   💭 ${b.description}\n\n`;
      });
      txt += `${FRAME}\n💡 Form a party: /worldboss create [#]\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO HUNT* — ${WORLD_BOSSES.length} bosses in rotation` : `\n${UI.upsell()}`);
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── CREATE ──────────────────────────────────────────────────
    if (action === 'create') {
      const existing = WorldBossParties.getByPlayer(sender);
      if (existing) return sock.sendMessage(chatId, { text: `❌ Already in a party! (${existing.id})\nUse /worldboss disband first.` }, { quoted: msg });

      const idx = parseInt(args[1]) - 1;
      if (isNaN(idx) || idx < 0 || idx >= WORLD_BOSSES.length) {
        return sock.sendMessage(chatId, { text: `❌ Choose a boss number 1-${WORLD_BOSSES.length}\n/worldboss list to see options` }, { quoted: msg });
      }
      const bossDef = WORLD_BOSSES[idx];
      if (player.level < bossDef.minLevel) {
        return sock.sendMessage(chatId, { text: `❌ Need Level ${bossDef.minLevel}+ for this boss!\nYour level: ${player.level}` }, { quoted: msg });
      }

      const party = WorldBossParties.create(sender, player.name, bossDef.id, chatId);
      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n🌍 *RAID PARTY FORMED!* 💎\n${UI.PRO_BAR}\n` : `🌍 *RAID PARTY FORMED!*\n${UI.FREE_BAR}\n`) + `${bossDef.emoji} Target: *${bossDef.name}*\n💭 ${bossDef.description}\n${FRAME}\n📋 Party ID: *${party.id}*\n👑 Leader: ${player.name}\n👥 Members: 1/${bossDef.maxParty}\n⚠️ Need: ${bossDef.minParty}-${bossDef.maxParty} hunters\n${FRAME}\n📌 Share party ID with hunters:\n/worldboss join ${party.id}\n\nWhen ready: /worldboss ready\nLeader starts: /worldboss start\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO MUSTER* — cap ${bossDef.maxParty} hunters` : `\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    // ── JOIN ────────────────────────────────────────────────────
    if (action === 'join') {
      const partyId = args[1];
      if (!partyId) return sock.sendMessage(chatId, { text: '❌ Usage: /worldboss join [PARTY-ID]' }, { quoted: msg });

      const existing = WorldBossParties.getByPlayer(sender);
      if (existing) return sock.sendMessage(chatId, { text: `❌ Already in a party (${existing.id})!\nUse /worldboss disband first.` }, { quoted: msg });

      const party = WorldBossParties.get(partyId);
      if (!party)                       return sock.sendMessage(chatId, { text: '❌ Party not found!' }, { quoted: msg });
      if (party.status !== 'recruiting') return sock.sendMessage(chatId, { text: '❌ Raid already started!' }, { quoted: msg });
      if (party.members.length >= party.maxMembers) return sock.sendMessage(chatId, { text: '❌ Party is full!' }, { quoted: msg });

      const bossDef = WORLD_BOSSES.find(b => b.id === party.bossId);
      if (bossDef && player.level < bossDef.minLevel) {
        return sock.sendMessage(chatId, { text: `❌ Need Level ${bossDef.minLevel}+ for this boss!` }, { quoted: msg });
      }

      party.members.push({ id: sender, name: player.name, ready: false, defending: false });
      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n✅ *JOINED RAID PARTY!* 💎\n${UI.PRO_BAR}\n` : `✅ *JOINED RAID PARTY!*\n${UI.FREE_BAR}\n`) + `👤 ${player.name} joined ${partyId}!\n👥 Members: ${party.members.length}/${party.maxMembers}\n${FRAME}\nMark yourself ready: /worldboss ready\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO MUSTER* — ${party.maxMembers - party.members.length} slots left` : `\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    // ── READY ───────────────────────────────────────────────────
    if (action === 'ready') {
      const party = WorldBossParties.getByPlayer(sender);
      if (!party)                       return sock.sendMessage(chatId, { text: '❌ Not in a party! /worldboss create [#]' }, { quoted: msg });
      if (party.status !== 'recruiting') return sock.sendMessage(chatId, { text: '❌ Raid already in progress!' }, { quoted: msg });

      const member = party.members.find(m => m.id === sender);
      if (member) member.ready = true;

      const allReady = party.members.every(m => m.ready);
      const bossDef  = WORLD_BOSSES.find(b => b.id === party.bossId);

      let txt = `✅ *${player.name}* is ready!\n\n👥 Party Status:\n`;
      party.members.forEach(m => { txt += `  ${m.ready ? '✅' : '⏳'} ${m.name}\n`; });
      if (allReady && party.members.length >= (bossDef?.minParty || 1)) {
        txt += `\n🎉 *ALL READY!*\nLeader can start: /worldboss start`;
      } else if (allReady) {
        txt += `\n⚠️ Need at least ${bossDef?.minParty || 2} hunters! (Have ${party.members.length})`;
      }
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── DISBAND ─────────────────────────────────────────────────
    if (action === 'disband') {
      const party = WorldBossParties.getByPlayer(sender);
      if (!party) return sock.sendMessage(chatId, { text: '❌ Not in a party!' }, { quoted: msg });
      if (party.status === 'active') return sock.sendMessage(chatId, { text: '❌ Cannot disband during active raid! Fight or fall!' }, { quoted: msg });
      if (party.leaderId !== sender) return sock.sendMessage(chatId, { text: '❌ Only the party leader can disband!' }, { quoted: msg });
      WorldBossParties.remove(party.id);
      return sock.sendMessage(chatId, { text: `🏳️ Party ${party.id} disbanded.` }, { quoted: msg });
    }

    // ── STATUS ──────────────────────────────────────────────────
    if (action === 'status') {
      const party = WorldBossParties.getByPlayer(sender);
      if (!party) return sock.sendMessage(chatId, { text: '❌ Not in a raid party!' }, { quoted: msg });

      if (party.status === 'recruiting') {
        const bossDef = WORLD_BOSSES.find(b => b.id === party.bossId);
        let txt = pro ? `${UI.PRO_BAR}\n📊 *RAID PARTY ${party.id}* 💎\n${UI.PRO_BAR}\n` : `📊 *RAID PARTY ${party.id}*\n${UI.FREE_BAR}\n`;
        txt += `${bossDef?.emoji||'👹'} Target: *${bossDef?.name||'?'}*\n`;
        txt += `👥 Members: ${party.members.length}/${party.maxMembers}\n\n`;
        party.members.forEach(m => { txt += `  ${m.ready?'✅':'⏳'} ${m.name}\n`; });
        txt += `\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO MUSTER* — ${party.members.filter(m => m.ready).length}/${party.members.length} ready` : `\n${UI.upsell()}`);
        return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
      }

      // Active raid status
      const boss = party.boss;
      if (!boss) return sock.sendMessage(chatId, { text: '❌ No active boss!' }, { quoted: msg });

      const bossBar  = BarSystem.getMonsterHPBar(boss.stats.hp, boss.stats.maxHp);
      const phase    = boss.phases[boss.currentPhase];
      let txt = pro ? `${UI.PRO_BAR}\n🌍 *WORLD BOSS — TURN ${party.turn}* 💎\n${UI.PRO_BAR}\n` : `🌍 *WORLD BOSS — TURN ${party.turn}*\n${UI.FREE_BAR}\n`;
      txt += `${boss.emoji} *${boss.name}* [${phase.name}]\n${bossBar}\n❤️ ${boss.stats.hp.toLocaleString()}/${boss.stats.maxHp.toLocaleString()}\n\n`;
      txt += `👥 *PARTY STATUS:*\n`;
      party.members.forEach(m => {
        const mp = db.users[m.id];
        if (!mp) return;
        const hpBar = BarSystem.getHPBar(mp.stats.hp, mp.stats.maxHp, require('../../rpg/utils/UnifiedCombat').isPro(mp));
        const hasAction = !!party.pendingActions[m.id];
        txt += `${hasAction?'✅':'⏳'} *${m.name}*\n  ${hpBar}\n  ❤️ ${mp.stats.hp}/${mp.stats.maxHp}\n\n`;
      });
      txt += `${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO HUNT* — ${phase.name} · ${Math.max(0, Math.round(100 * boss.stats.hp / boss.stats.maxHp))}% HP` : `\n${UI.upsell()}`);
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── START ───────────────────────────────────────────────────
    if (action === 'start') {
      const party = WorldBossParties.getByPlayer(sender);
      if (!party)                        return sock.sendMessage(chatId, { text: '❌ Not in a party! /worldboss create [#]' }, { quoted: msg });
      if (party.leaderId !== sender)     return sock.sendMessage(chatId, { text: '❌ Only the party leader can start!' }, { quoted: msg });
      if (party.status !== 'recruiting') return sock.sendMessage(chatId, { text: '❌ Raid already started!' }, { quoted: msg });

      const bossDef = WORLD_BOSSES.find(b => b.id === party.bossId);
      if (!bossDef) return sock.sendMessage(chatId, { text: '❌ Boss not found!' }, { quoted: msg });
      if (party.members.length < (bossDef.minParty || 1)) {
        return sock.sendMessage(chatId, { text: `❌ Need at least ${bossDef.minParty} hunters! (Have ${party.members.length})\nShare party ID: ${party.id}` }, { quoted: msg });
      }
      if (!party.members.every(m => m.ready)) {
        const notReady = party.members.filter(m => !m.ready).map(m => m.name).join(', ');
        return sock.sendMessage(chatId, { text: `❌ Not all members ready!\nWaiting for: ${notReady}` }, { quoted: msg });
      }

      // Generate boss
      const members = party.members.map(m => db.users[m.id]).filter(u => u);
      const avgLevel = Math.floor(members.reduce((s, m) => s + m.level, 0) / members.length);
      party.boss   = generateBoss(bossDef, avgLevel, party.members.length);
      party.status = 'active';
      party.turn   = 1;

      const boss  = party.boss;
      const bBar  = BarSystem.getMonsterHPBar(boss.stats.hp, boss.stats.maxHp);
      const mList = party.members.map(m => `  ⚔️ ${m.name} (Lv.${db.users[m.id]?.level||'?'})`).join('\n');

      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n🌍 *WORLD BOSS RAID BEGINS!* 💎\n${UI.PRO_BAR}\n` : `🌍 *WORLD BOSS RAID BEGINS!*\n${UI.FREE_BAR}\n`) + `${boss.emoji} *${boss.name}*\n💭 "${boss.desc}"\n${FRAME}\n${bBar}\n❤️ ${boss.stats.hp.toLocaleString()} HP | ⚔️ ATK: ${boss.stats.atk}\n${FRAME}\n👥 *YOUR PARTY:*\n${mList}\n${FRAME}\n⚠️ Boss has 3 PHASES — gets stronger as HP drops!\nWatch for WARNING telegraphs!\n${FRAME}\n🎯 *TURN 1 — ALL ATTACK!*\n/worldboss attack — basic strike\n/worldboss skill [name] — use a skill\n/worldboss defend — brace for damage\n/worldboss status — check party\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO HUNT* — ${boss.stats.hp.toLocaleString()} HP · ⚔️ ${boss.stats.atk} ATK` : `\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    // ── COMBAT ACTIONS (attack / skill / defend) ────────────────
    if (['attack', 'skill', 'defend'].includes(action)) {
      const party = WorldBossParties.getByPlayer(sender);
      if (!party || party.status !== 'active') return sock.sendMessage(chatId, { text: '❌ No active raid! /worldboss create [#]' }, { quoted: msg });
      try { const _ss = statusSummary(player) || statusSummary(party.boss) || statusSummary(db.activeWorldBoss); if(_ss) await sock.sendMessage(chatId, { text: `⚠️ *STATUS EFFECTS*\n${_ss}` }, { quoted: msg }); } catch(e){}

      const boss = party.boss;
      if (!boss) return sock.sendMessage(chatId, { text: '❌ No active boss!' }, { quoted: msg });

      if (player.stats.hp <= 0) return sock.sendMessage(chatId, { text: '💀 You are defeated! You cannot act this turn.' }, { quoted: msg });
      if (party.pendingActions[sender]) return sock.sendMessage(chatId, { text: `✅ Action locked in! Waiting for others...\n\n⏳ Pending: ${Object.keys(party.pendingActions).length}/${party.members.filter(m => db.users[m.id]?.stats.hp > 0).length}` }, { quoted: msg });

      // Lock in action
      if (action === 'defend') {
        party.pendingActions[sender] = { type: 'defend' };
        party.members.find(m => m.id === sender).defending = true;
      } else if (action === 'skill') {
        const skillName = args.slice(1).join(' ').toLowerCase();
        if (!skillName) return sock.sendMessage(chatId, { text: '❌ Specify skill name!\nExample: /worldboss skill fireball' }, { quoted: msg });
        party.pendingActions[sender] = { type: 'skill', skillName };
      } else {
        // Check for pattern id from /attack <id> routed via attacks.js
        let wbPatternId = null;
        const possiblePid = parseInt((args[1]||'').toString().trim());
        if (!isNaN(possiblePid) && possiblePid>=1 && possiblePid<=750) {
          const _wbOwned = player.attackPatterns?.owned || [];
          const _wbEquipped = player.attackPatterns?.equipped || [];
          if (!_wbOwned.includes(possiblePid)) {
            return sock.sendMessage(chatId, { text: `❌ You don't own Attack #${possiblePid}!\nAcquire it first: /attacks shop` }, { quoted: msg });
          }
          if (!_wbEquipped.includes(possiblePid)) {
            return sock.sendMessage(chatId, { text: `❌ Attack #${possiblePid} is not equipped!\nEquip it first: /attacks equip ${possiblePid}` }, { quoted: msg });
          }
          wbPatternId = possiblePid;
        }
        party.pendingActions[sender] = wbPatternId ? { type: 'attack', patternId: wbPatternId } : { type: 'attack' };
      }

      // Check if all alive members have acted
      const aliveMembers = party.members.filter(m => {
        const mp = db.users[m.id];
        return mp && mp.stats.hp > 0;
      });
      const allActed = aliveMembers.every(m => party.pendingActions[m.id]);

      if (!allActed) {
        const pending = aliveMembers.filter(m => !party.pendingActions[m.id]).map(m => m.name).join(', ');
        return sock.sendMessage(chatId, {
          text: `✅ *${player.name}* locked in ${action === 'defend' ? '🛡️ Defend' : action === 'skill' ? '⚡ Skill' : '⚔️ Attack'}!\n\n⏳ Waiting for: *${pending}*\n\n📊 /worldboss status to check party`
        }, { quoted: msg });
      }

      // ALL ACTED — resolve the turn
      return await resolveRaidTurn(sock, chatId, party, db, saveDatabase);
    }

    // Default
    return sock.sendMessage(chatId, { text: '❌ Unknown command!\n/worldboss help' }, { quoted: msg });
  }
};

// ═══════════════════════════════════════════════════════════════
// TURN RESOLUTION
// ═══════════════════════════════════════════════════════════════
async function resolveRaidTurn(sock, chatId, party, db, saveDatabase) {
  const FRAME = raidFrame(party, db);
  const boss    = party.boss;
  const members = party.members.map(m => ({ ...m, player: db.users[m.id] })).filter(m => m.player);

  let log = `${FRAME}\n🌍 *RAID TURN ${party.turn}*\n${FRAME}\n`;
  // ── STATUS EFFECTS — tick at start of round for boss & each member if alive
  try {
    const UCwbS = require('../../rpg/utils/UnifiedCombat');
    const StatusWB = require('../../rpg/utils/StatusEffectManager');
    let _wbStatusLines = [];
    let _wbTickLogs = [];
    // (Boss DoTs tick once in the boss phase below — ticking here too drained durations 2-3x per round)
    // Tick each alive member
    for (const m of members) {
      if (m.player.stats.hp <= 0) continue;
      // (Member DoTs tick once in the attack loop below — no pre-tick here)
      // Build summary line for this member
      if (m.player.statusEffects && m.player.statusEffects.length) {
        const s = m.player.statusEffects.map(sEff => `${sEff.emoji||'✨'} ${sEff.type||sEff.name}(${sEff.duration||sEff.turns||'?' }t)`).join(', ');
        _wbStatusLines.push(`👤 ${m.name}: ${s}`);
      }
    }
    if (boss.statusEffects && boss.statusEffects.length) {
      const bs = boss.statusEffects.map(sEff => `${sEff.emoji||'✨'} ${sEff.type||sEff.name}(${sEff.duration||sEff.turns||'?' }t)`).join(', ');
      _wbStatusLines.push(`👹 ${boss.name}: ${bs}`);
    }
    if (_wbTickLogs.length) log += _wbTickLogs.join('\n') + '\n\n';
    if (_wbStatusLines.length) log += `⚠️ *STATUS EFFECTS*\n` + _wbStatusLines.join('\n') + `\n\n`;
  } catch(e){}

  // ── PHASE 1: PARTY ATTACKS BOSS ──────────────────────────────
  log += `\n⚔️ *PARTY ATTACKS*\n${FRAME}\n`;
  let totalDmg = 0;

  for (const m of members) {
    const pl     = m.player;
    if (pl.stats.hp <= 0) continue;
    const act    = party.pendingActions[m.id];
    if (!act) continue;

    // Frozen / stunned members lose their turn; status DoTs tick every turn
    try {
      const UCwbFx = require('../../rpg/utils/UnifiedCombat');
      const _mtick = UCwbFx.tickStatuses(pl) || [];
      if (_mtick.length) log += _mtick.join(' | ') + '\n';
      const _wf = UCwbFx.canAct(pl);
      if (!_wf.canAct) {
        { const _wm = { frozen: ['❄️', 'FROZEN'], stunned: ['💫', 'STUNNED'], paralyzed: ['🔱', 'PARALYZED'], feared: ['😱', 'FEARED'] };
          const [_we, _ww] = _wm[_wf.reason] || ['💫', 'STUNNED'];
          log += `${_we} *${m.name}* is ${_ww} and cannot move! (0 dmg, status -1)\n`; }
        continue;
      }
    } catch(e){}

    let dmg = 0;

    if (act.type === 'defend') {
      log += `🛡️ *${m.name}* braces for impact!\n`;
      continue;
    }

    if (act.type === 'attack') {
      const pidWB = act.patternId;
      if (pidWB) {
        const DBwb = require('../../rpg/utils/AttackPatternDB');
        const UCwb = require('../../rpg/utils/UnifiedCombat');
        const atkWb = DBwb.generateAttack(pidWB);
        const ownedWb = pl.attackPatterns?.owned || [];
        if (!atkWb || !ownedWb.includes(pidWB)) {
          log += `❌ *${m.name}* pattern #${pidWB} not owned — skipped\n`;
          continue;
        }
        const equippedWb = pl.attackPatterns?.equipped || [];
        if (!equippedWb.includes(pidWB)) {
          log += `❌ *${m.name}* pattern #${pidWB} not equipped — skipped (/attacks equip ${pidWB})\n`;
          continue;
        }
        const cdWb = UCwb.isOnCooldown(pl, pidWB);
        if (cdWb.onCd) {
          log += `⏳ *${m.name}'s attack failed — still on cooldown ${UCwb.formatCd(cdWb.remaining)} remaining* — 0 dmg, status -1\n`;
          try { UCwb.tickStatuses(pl); } catch(e){}
          continue;
        }
        const fakeBoss = { stats:{ hp: boss.stats.hp, maxHp: boss.stats.maxHp, atk: boss.stats.atk, def: boss.stats.def, speed: boss.stats.speed||30 }, statusEffects: boss.statusEffects||[] };
        const uniWb = UCwb.calcMoveDamage(pl, fakeBoss, atkWb);
        if (uniWb.missed) {
          log += `💨 *${m.name}'s ${atkWb.name} missed! Acc ${atkWb.accuracy}%\n`;
          UCwb.setCooldown(pl, pidWB, atkWb);
          continue;
        }
        dmg = uniWb.damage;
        const isCritWb = uniWb.crit;
        UCwb.setCooldown(pl, pidWB, atkWb);
        const effWb = UCwb.tryApplyEffect(atkWb, pl, boss);
        boss.stats.hp -= dmg;
        totalDmg += dmg;
        log += `🥋 *${m.name}* ${atkWb.name} [${atkWb.rank}] Dmg×${atkWb.dmgMult} ${isCritWb?'💥 CRIT! ':''}*${dmg.toLocaleString()}* dmg${effWb?` ${effWb.emoji} ${effWb.type}`:''}!\n`;
        try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(pl, 'pattern', 1, sock, m.id, chatId); } catch(e){}
        if (atkWb.description) log += `_${atkWb.description.slice(0,120)}_\n`;
      } else {
        const isCrit = Math.random() < 0.12;
        let _gAtkWB = 0;
        try { _gAtkWB = require('../../rpg/utils/GearSystem').getEquippedBonuses(pl).atk || 0; } catch (e) {}
        dmg = Math.max(1, Math.floor(((pl.stats.atk || 0) + _gAtkWB) * (isCrit ? 1.5 : 1.0)) - Math.floor(boss.stats.def * 0.3));
        const art = ArtifactSystem.calculateCombatBonusFromPlayer?.(pl);
        if (art?.bonuses?.atk) dmg += art.bonuses.atk;
        boss.stats.hp -= dmg;
        totalDmg += dmg;
        log += `⚔️ *${m.name}* deals *${dmg.toLocaleString()}* dmg${isCrit ? ' 💥 CRIT!' : ''}!\n`;
      }
    } else if (act.type === 'skill') {
      // simplified skill: 1.8x atk
      const isCrit = Math.random() < 0.15;
      let _gAtkWB2 = 0;
      try { _gAtkWB2 = require('../../rpg/utils/GearSystem').getEquippedBonuses(pl).atk || 0; } catch (e) {}
      dmg = Math.max(1, Math.floor(((pl.stats.atk || 0) + _gAtkWB2) * (isCrit ? 2.7 : 1.8)) - Math.floor(boss.stats.def * 0.2));
      boss.stats.hp -= dmg;
      totalDmg += dmg;
      log += `✨ *${m.name}* uses *${act.skillName || 'Skill'}* for *${dmg.toLocaleString()}* dmg${isCrit ? ' 💥 CRIT!' : ''}!\n`;
    }
  }

  boss.stats.hp = Math.max(0, boss.stats.hp);
  log += `\n💥 *Total: ${totalDmg.toLocaleString()} damage dealt!*\n`;

  // ── PHASE TRANSITION ─────────────────────────────────────────
  const newPhase = checkPhase(boss);
  if (newPhase) {
    boss.stats.atk = Math.floor(boss.stats.atk * newPhase.atkMult);
    log += `\n${FRAME}\n⚡ *PHASE CHANGE!*\n${newPhase.msg}\n⚔️ Boss ATK increased!\n${FRAME}\n`;
  }

  // ── CHECK WIN ────────────────────────────────────────────────
  if (boss.stats.hp <= 0) {
    return handleRaidVictory(sock, chatId, party, db, saveDatabase, log);
  }

  // ── BOSS ATTACKS PARTY ───────────────────────────────────────
  // Boss statuses tick here (burn/poison/bleed/freeze DoTs damage the boss)
  let _bossCanAct = { canAct: true, reason: null };
  try {
    const UCwbBoss = require('../../rpg/utils/UnifiedCombat');
    const _bt = UCwbBoss.tickStatuses(boss) || [];
    if (_bt.length) log += _bt.join(' | ') + '\n';
    _bossCanAct = UCwbBoss.canAct(boss);
  } catch(e){}
  log += `\n${boss.emoji} *${boss.name.toUpperCase()} ATTACKS*\n${FRAME}\n`;

  const telegraph = party.pendingTelegraph;
  party.pendingTelegraph = null;

  // Execute telegraph effect if any (skipped entirely if the boss is frozen/stunned)
  if (!_bossCanAct.canAct) {
    log += `🧊 *${boss.name}* is ${((r => ({ frozen: 'FROZEN solid', stunned: 'STUNNED', paralyzed: 'PARALYZED', feared: 'FEARED' }[r] || 'STUNNED'))(_bossCanAct.reason))} and cannot attack! (0 dmg)\n`;
  } else if (telegraph) {
    if (telegraph.aoe) {
      // AOE hits everyone
      for (const m of members) {
        const pl = m.player;
        if (pl.stats.hp <= 0) continue;
        const defending = m.defending;
        const baseDmg   = Math.floor(boss.stats.atk * telegraph.dmgMult * (defending ? 0.4 : 1.0));
        let _gDefWB = 0;
        try { _gDefWB = require('../../rpg/utils/GearSystem').getEquippedBonuses(pl).def || 0; } catch (e) {}
        const finalDmg  = Math.max(1, baseDmg - Math.floor(((pl.stats.def || 0) + _gDefWB) * 0.35));
        pl.stats.hp = Math.max(0, pl.stats.hp - finalDmg);
        log += `💥 *${m.name}* takes *${finalDmg.toLocaleString()}* from AOE${defending ? ' (🛡️ reduced!)' : ''}!\n`;
      }
    } else if (telegraph.lifesteal) {
      // Soul drain
      let totalStealed = 0;
      for (const m of members) {
        const pl = m.player;
        if (pl.stats.hp <= 0) continue;
        const stolen = Math.floor(pl.stats.hp * telegraph.lifesteal);
        pl.stats.hp = Math.max(0, pl.stats.hp - stolen);
        totalStealed += stolen;
      }
      const bossHeal = Math.floor(totalStealed * 0.5);
      boss.stats.hp  = Math.min(boss.stats.maxHp, boss.stats.hp + bossHeal);
      log += `🩸 *SOUL DRAIN!* Party loses HP, boss heals *${bossHeal.toLocaleString()}*!\n`;
    } else if (telegraph.applyDebuff) {
      for (const m of members) {
        const pl = m.player;
        if (pl.stats.hp <= 0) continue;
        if (!m.defending) {
          StatusEffectManager.applyEffect(pl, 'WEAKEN', 2);
          StatusEffectManager.applyEffect(pl, 'POISON', 3);
          log += `☠️ *${m.name}* is WEAKENED + POISONED! (Use /worldboss defend next time!)\n`;
        } else {
          log += `🛡️ *${m.name}* defended! Curse blocked!\n`;
        }
      }
    } else if (telegraph.selfBuff) {
      boss.stats.atk = Math.floor(boss.stats.atk * 1.3);
      log += `⚡ *${boss.name}* is empowered! ATK +30%!\n`;
    } else if (telegraph.dmgMult >= 2.0) {
      // CHARGE — single target
      const target = members.filter(m => m.player.stats.hp > 0)[Math.floor(Math.random() * members.length)];
      if (target) {
        const defending = target.defending;
        let _gDefWB4 = 0;
        try { _gDefWB4 = require('../../rpg/utils/GearSystem').getEquippedBonuses(target.player).def || 0; } catch (e) {}
        const dmg = Math.max(1, Math.floor(boss.stats.atk * telegraph.dmgMult * (defending ? 0.4 : 1.0)) - Math.floor(((target.player.stats.def || 0) + _gDefWB4) * 0.35));
        target.player.stats.hp = Math.max(0, target.player.stats.hp - dmg);
        log += `💥 *CHARGED STRIKE* hits *${target.name}* for *${dmg.toLocaleString()}*${defending ? ' (🛡️ reduced!)' : ''}!\n`;
      }
    }
  } else {
    // Normal attack — random target
    const alive  = members.filter(m => m.player.stats.hp > 0);
    if (alive.length > 0) {
      const target   = alive[Math.floor(Math.random() * alive.length)];
      const defending = target.defending;
      const phase    = boss.phases[boss.currentPhase];
      const baseDmg  = Math.floor(boss.stats.atk * phase.atkMult);
      let _gDefWB3 = 0;
      try { _gDefWB3 = require('../../rpg/utils/GearSystem').getEquippedBonuses(target.player).def || 0; } catch (e) {}
      const dmg      = Math.max(1, Math.floor(baseDmg * (defending ? 0.4 : 1.0)) - Math.floor(((target.player.stats.def || 0) + _gDefWB3) * 0.35));
      target.player.stats.hp = Math.max(0, target.player.stats.hp - dmg);
      const ability  = boss.abilities[Math.floor(Math.random() * boss.abilities.length)];
      log += `👹 *${boss.name}* uses *${ability}* on *${target.name}*!\n💥 ${dmg.toLocaleString()} damage${defending ? ' (🛡️ defended!)' : ''}!\n`;
    }
  }

  // Reset defending flags
  party.members.forEach(m => { m.defending = false; });

  // ── TELEGRAPH NEXT TURN ──────────────────────────────────────
  const nextTelegraph = getTelegraph(boss, party.turn + 1);
  if (nextTelegraph) {
    party.pendingTelegraph = nextTelegraph;
    log += `\n${nextTelegraph.warn}\n`;
  }

  // ── CHECK WIPE ───────────────────────────────────────────────
  const stillAlive = members.filter(m => m.player.stats.hp > 0);
  if (stillAlive.length === 0) {
    return handleRaidWipe(sock, chatId, party, db, saveDatabase, log);
  }

  // ── STATUS BAR ───────────────────────────────────────────────
  const bBar = BarSystem.getMonsterHPBar(boss.stats.hp, boss.stats.maxHp);
  const phase = boss.phases[boss.currentPhase];
  log += `\n${FRAME}\n${boss.emoji} *${boss.name}* [${phase.name}]\n${bBar}\n❤️ ${boss.stats.hp.toLocaleString()}/${boss.stats.maxHp.toLocaleString()}\n\n👥 *Party:*\n`;

  members.forEach(m => {
    const pl  = m.player;
    const bar = BarSystem.getHPBar(pl.stats.hp, pl.stats.maxHp, require('../../rpg/utils/UnifiedCombat').isPro(pl));
    const sta = pl.stats.hp > 0 ? '⚔️' : '💀';
    let sfx = '';
    if (pl.statusEffects && pl.statusEffects.length) {
      const sum = pl.statusEffects.map(se => `${se.emoji||'✨'}${se.type||se.name}(${se.duration||'?' }t)`).join(' ');
      sfx = ` ${sum}`;
    }
    log += `${sta} *${m.name}* — ${bar} ${pl.stats.hp}/${pl.stats.maxHp}${sfx}\n`;
  });

  // Save and prepare next turn
  party.pendingActions = {};
  party.turn++;
  saveDatabase();

  log += `\n${FRAME}\n🎯 *TURN ${party.turn}* — All act!\n/worldboss attack | defend | skill [name]`;
  return sock.sendMessage(chatId, { text: log });
}

// ═══════════════════════════════════════════════════════════════
// VICTORY
// ═══════════════════════════════════════════════════════════════
async function handleRaidVictory(sock, chatId, party, db, saveDatabase, log) {
  const FRAME = raidFrame(party, db);
  const boss    = party.boss;
  const members = party.members.map(m => ({ player: db.users[m.id], id: m.id })).filter(u => u.player);
  const avgLevel = Math.floor(members.reduce((s, m) => s + m.player.level, 0) / members.length);

  let xpReward   = Math.floor(avgLevel * 800 * boss.phases.length);
  let goldReward = Math.floor(avgLevel * 2500);
  const crystalRew = Math.min(80, Math.floor(30 + avgLevel * 2)); // 32-80 crystals for world boss
  const upReward   = 15;

  // ── Apply seasonal event bonuses ─────────────────────────────
  let eventBonusMsg = '';
  try {
    if (SeasonManager) {
      const bonused = SeasonManager.applyBonuses({ xp: xpReward, gold: goldReward });
      xpReward   = bonused.xp   ?? xpReward;
      goldReward = bonused.gold ?? goldReward;
      const event = SeasonManager.getActiveEvent();
      if (event && (bonused.gold !== goldReward || bonused.xp !== xpReward)) {
        eventBonusMsg = `\n${event.emoji} *${event.name} BONUS ACTIVE!*`;
      }
    }
  } catch(e) {}

  // Unified battle win rewards (aura/BP/pass/XP) — per member, with Pro 2× handling
  let sampleRewards = null;
  members.forEach(({ player: member, id: memberId }) => {
    member.xp           = (member.xp           || 0) + xpReward;
    member.gold         = (member.gold          || 0) + goldReward;
    try {
      const QD = require('../../rpg/utils/QuestDispatcher');
      QD.trackAndNotify(member, 'boss', 1, sock, memberId, chatId);
      QD.trackAndNotify(member, 'goldEarn', goldReward, sock, memberId, chatId);
    } catch(e){}
    try { require('../../rpg/utils/GuildPointsSystem').addGuildGP(db, memberId, 20, 'World boss contribution', { quest: true, sock, jid: memberId, chatId }); } catch(e){}
    member.manaCrystals = (member.manaCrystals  || 0) + crystalRew;
    member.upgradePoints = (member.upgradePoints || 0) + upReward;
    if (!member.inventory) member.inventory = {};
    member.inventory.gold = member.gold;
    LevelUpManager.checkAndApplyLevelUps(member, saveDatabase, sock, chatId);
    try {
      const _ref = require('../../rpg/utils/ReferralSystem').onLevelUp(db, member);
      if (_ref) { saveDatabase(); try { const _pr = sock.sendMessage(chatId, { text: `🔗 *REFERRAL REWARD!*\n\n*${_ref.recruitName}* hit Lv.3!\n💠 @${_ref.referrerId.split('@')[0]} earned *10,000 Nexus*!`, mentions: [_ref.referrerId] }); if (_pr && _pr.catch) _pr.catch(() => {}); } catch (_e) {} }
    } catch (e) {}
    // Track achievement
    try { AchievementManager.track(member, 'boss_kill', 1); } catch(e) {}
    try { if (DC) DC.trackProgress(member, 'boss_kill', 1); } catch(e) {}
    try { const WK=require('./weekly'); WK.trackWeeklyProgress(member,'boss_kill',1); } catch(e) {}
    try { if (TitleSystem) TitleSystem.checkAndAwardTitles(member); } catch(e) {}
    // Battle Pass (keep for compatibility) + unified rewards
    try { const BP2=require('../../rpg/utils/BattlePass'); BP2.addPassXP(member,'world_boss'); } catch(e) {}
    try { const BR=require('../../rpg/utils/BattleRewards'); const w=BR.giveBattleWinRewards(member, db, 'worldboss', member.level); if(!sampleRewards) sampleRewards=w; } catch(e){}
    // #7: Guild War points for world boss kill (+50 per the guildwar description)
    try { if (GuildWar) GuildWar.addWarPoints(db, memberId, 50, null); } catch(e) {}
  });

  party.status = 'completed';
  saveDatabase();
  setTimeout(() => WorldBossParties.remove(party.id), 10000);

  let brLine = '';
  try { const BR=require('../../rpg/utils/BattleRewards'); if(sampleRewards) brLine = '\n' + BR.formatRewards(sampleRewards).replace(/\n/g,'\n'); } catch(e){}
  log += `\n${FRAME}\n🏆 *WORLD BOSS DEFEATED!*\n${FRAME}\n${boss.emoji} *${boss.name}* has fallen!\n💭 A legendary victory!\n${FRAME}\n🎁 *REWARDS (Each member):*\n✨ +${xpReward.toLocaleString()} XP\n💠 +${goldReward.toLocaleString()} Nexus\n💎 +${crystalRew} Mana Stones\n⬆️ +${upReward} Upgrade Points${brLine ? '\n' + brLine : ''}${eventBonusMsg}\n${FRAME}`;
  return sock.sendMessage(chatId, { text: log });
}

// ═══════════════════════════════════════════════════════════════
// WIPE
// ═══════════════════════════════════════════════════════════════
async function handleRaidWipe(sock, chatId, party, db, saveDatabase, log) {
  const FRAME = raidFrame(party, db);
  party.status = 'failed';
  saveDatabase();
  setTimeout(() => WorldBossParties.remove(party.id), 5000);
  log += `\n${FRAME}\n💀 *PARTY WIPED!*\n${FRAME}\n${party.boss.emoji} *${party.boss.name}* stands victorious...\n💭 All hunters have fallen!\n${FRAME}\nRecover and try again with a stronger party!\n${FRAME}`;
  return sock.sendMessage(chatId, { text: log });
}