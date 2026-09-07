// worldboss.js — World Boss System
// Party of 2-5, form BEFORE boss spawns, turn-based attacks
// Boss has phases, telegraphed attacks, HP shared across party

const StatusEffectManager = require('../../rpg/utils/StatusEffectManager');
const BP = require('../../rpg/utils/BattlePass');
const BarSystem           = require('../../rpg/utils/BarSystem');
const LevelUpManager      = require('../../rpg/utils/LevelUpManager');
const ArtifactSystem      = require('../../rpg/utils/ArtifactSystem');
const PetManager          = require('../../rpg/utils/PetManager');
const QuestManager        = require('../../rpg/utils/QuestManager');
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
      { threshold: 0.6, name: 'Furious',      atkMult: 1.45, msg: '🐉 PHASE 2: You hurt him. HIM. His eyes burn gold. "INSOLENT WORMS! I WILL TURN YOU TO ASH!"' },
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

    const action = args[0]?.toLowerCase();

    // ── HELP ────────────────────────────────────────────────────
    if (!action || action === 'help') {
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌍 *WORLD BOSS RAIDS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nMassive bosses requiring a party of 2-5 hunters!\nBosses have 3 phases — harder as HP drops.\n\n📋 *COMMANDS:*\n/worldboss list          — View current world bosses\n/worldboss create [#]    — Form a party for boss #\n/worldboss join [ID]     — Join a forming party\n/worldboss ready         — Mark yourself ready\n/worldboss start         — Leader starts the raid (all ready)\n/worldboss attack        — Attack the boss\n/worldboss skill [name]  — Use a skill\n/worldboss defend        — Reduce incoming damage 60%\n/worldboss status        — View raid status\n/worldboss disband       — Disband party (pre-start only)\n\n⚠️ *RULES:*\n• Minimum 2 players, maximum 5\n• All members must be /worldboss ready\n• Watch for ⚠️ WARNING telegraphs — use /worldboss defend!\n• Each player takes damage individually each turn\n• If ALL members die, the raid fails\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── LIST ────────────────────────────────────────────────────
    if (action === 'list') {
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌍 *WORLD BOSSES*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      WORLD_BOSSES.forEach((b, i) => {
        const locked = player.level < b.minLevel ? `🔒 Req. Lv${b.minLevel}` : '✅ Available';
        txt += `${i+1}. ${b.emoji} *${b.name}*\n   ${locked} | Party: ${b.minParty}-${b.maxParty} hunters\n   💭 ${b.description}\n\n`;
      });
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 Form a party: /worldboss create [#]\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
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
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌍 *RAID PARTY FORMED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${bossDef.emoji} Target: *${bossDef.name}*\n💭 ${bossDef.description}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 Party ID: *${party.id}*\n👑 Leader: ${player.name}\n👥 Members: 1/${bossDef.maxParty}\n⚠️ Need: ${bossDef.minParty}-${bossDef.maxParty} hunters\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📌 Share party ID with hunters:\n/worldboss join ${party.id}\n\nWhen ready: /worldboss ready\nLeader starts: /worldboss start\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
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
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *JOINED RAID PARTY!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 ${player.name} joined ${partyId}!\n👥 Members: ${party.members.length}/${party.maxMembers}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nMark yourself ready: /worldboss ready\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
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
        let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 *RAID PARTY ${party.id}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        txt += `${bossDef?.emoji||'👹'} Target: *${bossDef?.name||'?'}*\n`;
        txt += `👥 Members: ${party.members.length}/${party.maxMembers}\n\n`;
        party.members.forEach(m => { txt += `  ${m.ready?'✅':'⏳'} ${m.name}\n`; });
        txt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
      }

      // Active raid status
      const boss = party.boss;
      if (!boss) return sock.sendMessage(chatId, { text: '❌ No active boss!' }, { quoted: msg });

      const bossBar  = BarSystem.getMonsterHPBar(boss.stats.hp, boss.stats.maxHp);
      const phase    = boss.phases[boss.currentPhase];
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌍 *WORLD BOSS — TURN ${party.turn}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      txt += `${boss.emoji} *${boss.name}* [${phase.name}]\n${bossBar}\n❤️ ${boss.stats.hp.toLocaleString()}/${boss.stats.maxHp.toLocaleString()}\n\n`;
      txt += `👥 *PARTY STATUS:*\n`;
      party.members.forEach(m => {
        const mp = db.users[m.id];
        if (!mp) return;
        const hpBar = BarSystem.getHPBar(mp.stats.hp, mp.stats.maxHp);
        const hasAction = !!party.pendingActions[m.id];
        txt += `${hasAction?'✅':'⏳'} *${m.name}*\n  ${hpBar}\n  ❤️ ${mp.stats.hp}/${mp.stats.maxHp}\n\n`;
      });
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
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
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌍 *WORLD BOSS RAID BEGINS!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${boss.emoji} *${boss.name}*\n💭 "${boss.desc}"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${bBar}\n❤️ ${boss.stats.hp.toLocaleString()} HP | ⚔️ ATK: ${boss.stats.atk}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👥 *YOUR PARTY:*\n${mList}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚠️ Boss has 3 PHASES — gets stronger as HP drops!\nWatch for WARNING telegraphs!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 *TURN 1 — ALL ATTACK!*\n/worldboss attack — basic strike\n/worldboss skill [name] — use a skill\n/worldboss defend — brace for damage\n/worldboss status — check party\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── COMBAT ACTIONS (attack / skill / defend) ────────────────
    if (['attack', 'skill', 'defend'].includes(action)) {
      const party = WorldBossParties.getByPlayer(sender);
      if (!party || party.status !== 'active') return sock.sendMessage(chatId, { text: '❌ No active raid! /worldboss create [#]' }, { quoted: msg });

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
        party.pendingActions[sender] = { type: 'attack' };
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
  const boss    = party.boss;
  const members = party.members.map(m => ({ ...m, player: db.users[m.id] })).filter(m => m.player);

  let log = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌍 *RAID TURN ${party.turn}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  // ── PHASE 1: PARTY ATTACKS BOSS ──────────────────────────────
  log += `\n⚔️ *PARTY ATTACKS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  let totalDmg = 0;

  for (const m of members) {
    const pl     = m.player;
    if (pl.stats.hp <= 0) continue;
    const act    = party.pendingActions[m.id];
    if (!act) continue;

    let dmg = 0;

    if (act.type === 'defend') {
      log += `🛡️ *${m.name}* braces for impact!\n`;
      continue;
    }

    if (act.type === 'attack') {
      const isCrit = Math.random() < 0.12;
      dmg = Math.max(1, Math.floor(pl.stats.atk * (isCrit ? 1.5 : 1.0)) - Math.floor(boss.stats.def * 0.3));
      const art = ArtifactSystem.calculateCombatBonusFromPlayer?.(pl);
      if (art?.bonuses?.atk) dmg += art.bonuses.atk;
      boss.stats.hp -= dmg;
      totalDmg += dmg;
      log += `⚔️ *${m.name}* deals *${dmg.toLocaleString()}* dmg${isCrit ? ' 💥 CRIT!' : ''}!\n`;
    } else if (act.type === 'skill') {
      // simplified skill: 1.8x atk
      const isCrit = Math.random() < 0.15;
      dmg = Math.max(1, Math.floor(pl.stats.atk * (isCrit ? 2.7 : 1.8)) - Math.floor(boss.stats.def * 0.2));
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
    log += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ *PHASE CHANGE!*\n${newPhase.msg}\n⚔️ Boss ATK increased!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  }

  // ── CHECK WIN ────────────────────────────────────────────────
  if (boss.stats.hp <= 0) {
    return handleRaidVictory(sock, chatId, party, db, saveDatabase, log);
  }

  // ── BOSS ATTACKS PARTY ───────────────────────────────────────
  log += `\n${boss.emoji} *${boss.name.toUpperCase()} ATTACKS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  const telegraph = party.pendingTelegraph;
  party.pendingTelegraph = null;

  // Execute telegraph effect if any
  if (telegraph) {
    if (telegraph.aoe) {
      // AOE hits everyone
      for (const m of members) {
        const pl = m.player;
        if (pl.stats.hp <= 0) continue;
        const defending = m.defending;
        const baseDmg   = Math.floor(boss.stats.atk * telegraph.dmgMult * (defending ? 0.4 : 1.0));
        const finalDmg  = Math.max(1, baseDmg - Math.floor(pl.stats.def * 0.35));
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
        const dmg = Math.max(1, Math.floor(boss.stats.atk * telegraph.dmgMult * (defending ? 0.4 : 1.0)) - Math.floor(target.player.stats.def * 0.35));
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
      const dmg      = Math.max(1, Math.floor(baseDmg * (defending ? 0.4 : 1.0)) - Math.floor(target.player.stats.def * 0.35));
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
  log += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${boss.emoji} *${boss.name}* [${phase.name}]\n${bBar}\n❤️ ${boss.stats.hp.toLocaleString()}/${boss.stats.maxHp.toLocaleString()}\n\n👥 *Party:*\n`;

  members.forEach(m => {
    const pl  = m.player;
    const bar = BarSystem.getHPBar(pl.stats.hp, pl.stats.maxHp);
    const sta = pl.stats.hp > 0 ? '⚔️' : '💀';
    log += `${sta} *${m.name}* — ${bar} ${pl.stats.hp}/${pl.stats.maxHp}\n`;
  });

  // Save and prepare next turn
  party.pendingActions = {};
  party.turn++;
  saveDatabase();

  log += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 *TURN ${party.turn}* — All act!\n/worldboss attack | defend | skill [name]`;
  return sock.sendMessage(chatId, { text: log });
}

// ═══════════════════════════════════════════════════════════════
// VICTORY
// ═══════════════════════════════════════════════════════════════
async function handleRaidVictory(sock, chatId, party, db, saveDatabase, log) {
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

  members.forEach(({ player: member, id: memberId }) => {
    member.xp           = (member.xp           || 0) + xpReward;
    member.gold         = (member.gold          || 0) + goldReward;
    member.manaCrystals = (member.manaCrystals  || 0) + crystalRew;
    member.upgradePoints = (member.upgradePoints || 0) + upReward;
    if (!member.inventory) member.inventory = {};
    member.inventory.gold = member.gold;
    LevelUpManager.checkAndApplyLevelUps(member, saveDatabase, sock, chatId);
    // Track achievement
    try { AchievementManager.track(member, 'boss_kill', 1); } catch(e) {}
    try { if (DC) DC.trackProgress(member, 'boss_kill', 1); } catch(e) {}
    try { const WK=require('./weekly'); WK.trackWeeklyProgress(member,'boss_kill',1); } catch(e) {}
    try { if (TitleSystem) TitleSystem.checkAndAwardTitles(member); } catch(e) {}
    // Fix #4: use memberId directly instead of broken member._id lookup
    try { const BP2=require('../../rpg/utils/BattlePass'); BP2.addPassXP(member,'world_boss'); } catch(e) {}
    try { QuestManager.updateProgress(memberId, { type: 'boss_kill', count: 1, target: boss.name }); } catch(e) {}
    // #7: Guild War points for world boss kill (+50 per the guildwar description)
    try { if (GuildWar) GuildWar.addWarPoints(db, memberId, 50, null); } catch(e) {}
  });

  party.status = 'completed';
  saveDatabase();
  setTimeout(() => WorldBossParties.remove(party.id), 10000);

  log += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏆 *WORLD BOSS DEFEATED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${boss.emoji} *${boss.name}* has fallen!\n💭 A legendary victory!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *REWARDS (Each member):*\n✨ +${xpReward.toLocaleString()} XP\n💠 +${goldReward.toLocaleString()} Nexus\n💎 +${crystalRew} Mana Stones\n⬆️ +${upReward} Upgrade Points${eventBonusMsg}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  return sock.sendMessage(chatId, { text: log });
}

// ═══════════════════════════════════════════════════════════════
// WIPE
// ═══════════════════════════════════════════════════════════════
async function handleRaidWipe(sock, chatId, party, db, saveDatabase, log) {
  party.status = 'failed';
  saveDatabase();
  setTimeout(() => WorldBossParties.remove(party.id), 5000);
  log += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💀 *PARTY WIPED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${party.boss.emoji} *${party.boss.name}* stands victorious...\n💭 All hunters have fallen!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nRecover and try again with a stronger party!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  return sock.sendMessage(chatId, { text: log });
}