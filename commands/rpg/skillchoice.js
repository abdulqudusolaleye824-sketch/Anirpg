// ═══════════════════════════════════════════════════════════════
// SKILL CHOICE SYSTEM
// At levels 20, 40, 60, 80, players choose between 2 skill paths
// This makes each character's loadout unique even within the same class
// ═══════════════════════════════════════════════════════════════

const SkillDescriptions = require('../../rpg/utils/SkillDescriptions');

// Levels where players get a choice between two skill variants
const CHOICE_LEVELS = [20, 40, 60, 80];

// Per-class skill choices: two flavors at each milestone
// Aggressive (high damage, offensive) vs Tactical (utility, sustain)
const SKILL_CHOICES = {
  Mage: {
    20: {
      a: { name:'Meteor Strike',   flavor:'☄️ AGGRESSIVE — 200% burst. Devastate single target.',    damage:120, energyCost:50, cooldown:3, effect:{ type:'stun', chance:0.20, duration:1 } },
      b: { name:'Arcane Barrier',  flavor:'🔵 TACTICAL — Shield 40% max HP. Reflect 20% damage.',     damage:0,   energyCost:35, cooldown:4, effect:{ type:'shield', value:40 } },
    },
    40: {
      a: { name:'Blizzard',        flavor:'🌨️ AGGRESSIVE — AOE ice storm, 150% + 50% freeze chance.',damage:90,  energyCost:45, cooldown:4, effect:{ type:'freeze', chance:0.50, duration:1 } },
      b: { name:'Time Stop',       flavor:'⏰ TACTICAL — All enemies lose their next turn. Once/battle.',damage:0, energyCost:60, cooldown:99,effect:{ type:'stun', chance:1.0, duration:1 } },
    },
    60: {
      a: { name:'Gravity Well',    flavor:'⚫ AGGRESSIVE — 170% magic + pull. Enemy DEF -25% for 2t.',damage:100, energyCost:55, cooldown:3, effect:{ type:'enfeeble', chance:0.80, duration:2 } },
      b: { name:'Mana Shield',     flavor:'🔷 TACTICAL — Convert 30% mana into a damage sponge.',     damage:0,   energyCost:40, cooldown:3, effect:{ type:'shield', value:30 } },
    },
    80: {
      a: { name:'Cosmic Ray',      flavor:'✨ AGGRESSIVE — 250% true magic damage, ignores DEF.',     damage:150, energyCost:70, cooldown:4, effect:{ type:'weaken', chance:0.60, duration:2 } },
      b: { name:'Temporal Rift',   flavor:'🌀 TACTICAL — Rewind a turn. Restore 35% HP + energy.',    damage:0,   energyCost:60, cooldown:5, effect:{ type:'regen', value:35 } },
    },
  },
  Warrior: {
    20: {
      a: { name:'Whirlwind',       flavor:'🌪️ AGGRESSIVE — Spin attack hits all, 90% DMG each.',      damage:70,  energyCost:35, cooldown:3, effect:{ type:'bleed', chance:0.40, duration:2 } },
      b: { name:'Iron Wall',       flavor:'🛡️ TACTICAL — Reduce all damage by 35% for 3 turns.',      damage:0,   energyCost:30, cooldown:5, effect:{ type:'def_buff', value:35, duration:3 } },
    },
    40: {
      a: { name:'Execute',         flavor:'⚔️ AGGRESSIVE — Deals +1% per 1% of missing HP. LETHAL.',   damage:80,  energyCost:45, cooldown:3, effect:{ type:'weaken', chance:0.30, duration:2 } },
      b: { name:'Battle Trance',   flavor:'🧘 TACTICAL — Enter focus. +20% ATK/DEF for 4 turns.',      damage:0,   energyCost:40, cooldown:5, effect:{ type:'atk_buff', value:20, duration:4 } },
    },
    60: {
      a: { name:'Juggernaut',      flavor:'🦏 AGGRESSIVE — Unstoppable charge. 180% DMG + STUN.',      damage:110, energyCost:55, cooldown:3, effect:{ type:'stun', chance:0.55, duration:1 } },
      b: { name:'Warlord Command', flavor:'👑 TACTICAL — Inspire party. All allies +15% ATK for 3t.',  damage:0,   energyCost:45, cooldown:5, effect:{ type:'party_atk_buff', value:15, duration:3 } },
    },
    80: {
      a: { name:'Colossus Strike', flavor:'💥 AGGRESSIVE — 220% DMG. Cannot be blocked or dodged.',    damage:140, energyCost:65, cooldown:4, effect:{ type:'stun', chance:0.45, duration:1 } },
      b: { name:'Last Stand',      flavor:'❤️ TACTICAL — At <30% HP: gain immunity + 40% heal.',       damage:0,   energyCost:50, cooldown:8, effect:{ type:'shield', value:40 } },
    },
  },
  Assassin: {
    20: {
      a: { name:'Lethal Strike',   flavor:'🗡️ AGGRESSIVE — 170% + guaranteed crit below 50% HP.',     damage:100, energyCost:40, cooldown:3, effect:{ type:'bleed', chance:0.60, duration:3 } },
      b: { name:'Shadow Clone',    flavor:'👤 TACTICAL — Clone takes next hit. Then vanish + counter.', damage:0,   energyCost:45, cooldown:5, effect:{ type:'shield', value:50 } },
    },
    40: {
      a: { name:'Death Mark',      flavor:'💀 AGGRESSIVE — Mark target. Deal 30% current HP.',         damage:0,   energyCost:55, cooldown:4, effect:{ type:'execute', chance:0.30 } },
      b: { name:'Smoke Screen',    flavor:'💨 TACTICAL — Blind enemy + 40% dodge for 2 turns.',        damage:0,   energyCost:40, cooldown:4, effect:{ type:'blind', chance:1.0, duration:2 } },
    },
    60: {
      a: { name:'Thousand Cuts',   flavor:'🔪 AGGRESSIVE — 5 rapid hits, 60% each. Applies bleed.',    damage:50,  energyCost:60, cooldown:3, effect:{ type:'bleed', chance:0.80, duration:3 } },
      b: { name:'Vanish',          flavor:'🌫️ TACTICAL — Disappear. Immune + choose next skill free.', damage:0,   energyCost:50, cooldown:6, effect:{ type:'dodge_buff', value:100, duration:1 } },
    },
    80: {
      a: { name:'Assassination',   flavor:'☠️ AGGRESSIVE — 280% DMG. Double if target is poisoned.',   damage:170, energyCost:70, cooldown:4, effect:{ type:'poison', chance:0.70, duration:3 } },
      b: { name:'Shadow Realm',    flavor:'🌑 TACTICAL — Phase out. Untargetable for 1 turn, +50% ATK.',damage:0,  energyCost:60, cooldown:7, effect:{ type:'atk_buff', value:50, duration:2 } },
    },
  },
  // Generic fallback choices applied to: Archer, Rogue, Paladin, Berserker, Necromancer, Dragon Knight, Devourer
  _default: {
    20: {
      a: { name:'Power Surge',     flavor:'⚡ AGGRESSIVE — 160% DMG with 40% status chance.',         damage:95,  energyCost:40, cooldown:3, effect:{ type:'weaken', chance:0.40, duration:2 } },
      b: { name:'Fortify',         flavor:'🛡️ TACTICAL — Reduce all incoming damage 30% for 3 turns.',damage:0,   energyCost:35, cooldown:5, effect:{ type:'def_buff', value:30, duration:3 } },
    },
    40: {
      a: { name:'Rampage',         flavor:'🌪️ AGGRESSIVE — 2-hit combo, 100% each. STUN on 2nd.',     damage:85,  energyCost:50, cooldown:3, effect:{ type:'stun', chance:0.45, duration:1 } },
      b: { name:'Second Wind',     flavor:'💚 TACTICAL — Heal 30% max HP. Clear one debuff.',          damage:0,   energyCost:40, cooldown:5, effect:{ type:'heal', value:30 } },
    },
    60: {
      a: { name:'Obliterate',      flavor:'💥 AGGRESSIVE — 200% DMG, ignore 40% DEF.',                damage:120, energyCost:60, cooldown:4, effect:{ type:'weaken', chance:0.50, duration:2 } },
      b: { name:'Adrenaline Rush', flavor:'⚡ TACTICAL — +30% ATK/SPEED for 3 turns, +10 energy/turn.',damage:0,  energyCost:45, cooldown:5, effect:{ type:'atk_buff', value:30, duration:3 } },
    },
    80: {
      a: { name:'Annihilate',      flavor:'☠️ AGGRESSIVE — 250% DMG. Cannot be guarded.',             damage:155, energyCost:70, cooldown:4, effect:{ type:'stun', chance:0.40, duration:1 } },
      b: { name:'Transcend',       flavor:'✨ TACTICAL — Cleanse all debuffs + +25% all stats for 3t.',damage:0,  energyCost:65, cooldown:6, effect:{ type:'cleanse', value:25, duration:3 } },
    },
  },
};

function getChoicesForPlayer(player, level) {
  const cls = typeof player.class==='object'?player.class.name:player.class;
  const classChoices = SKILL_CHOICES[cls] || SKILL_CHOICES['_default'];
  return classChoices[level] || null;
}

function hasPendingChoice(player) {
  return player.pendingSkillChoice !== undefined && player.pendingSkillChoice !== null;
}

// Called by LevelUpManager when player hits a choice level
function triggerSkillChoice(player, level) {
  const choices = getChoicesForPlayer(player, level);
  if (!choices) return null;
  player.pendingSkillChoice = { level, choices };
  return choices;
}

// Format the choice message
function formatChoiceMessage(player, level) {
  const choices = getChoicesForPlayer(player, level);
  if (!choices) return null;
  const cls = typeof player.class==='object'?player.class.name:player.class;
  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 SKILL SPECIALIZATION — Level ${level}!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

*${player.name}* [${cls}], choose your path!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ OPTION A: *${choices.a.name}*
${choices.a.flavor}
${choices.a.damage>0?`💥 Damage: ${choices.a.damage}`:'💡 No direct damage'}
${player.energyColor||'💙'} Cost: ${choices.a.energyCost} | ⏰ CD: ${choices.a.cooldown}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ OPTION B: *${choices.b.name}*
${choices.b.flavor}
${choices.b.damage>0?`💥 Damage: ${choices.b.damage}`:'💡 No direct damage'}
${player.energyColor||'💙'} Cost: ${choices.b.energyCost} | ⏰ CD: ${choices.b.cooldown}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type /choose a or /choose b
(Or /choose later to decide later)
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

module.exports = {
  name: 'choose',
  description: '🌟 Choose a skill specialization at milestone levels',
  CHOICE_LEVELS,
  triggerSkillChoice,
  formatChoiceMessage,
  hasPendingChoice,
  getChoicesForPlayer,

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId,{text:'❌ Not registered!'},{quoted:msg});

    const pick = args[0]?.toLowerCase();

    if (!pick || pick==='status') {
      if (!hasPendingChoice(player)) {
        const cls=typeof player.class==='object'?player.class.name:player.class;
        const nextChoiceLevel = CHOICE_LEVELS.find(l=>l>player.level);
        return sock.sendMessage(chatId,{
          text:`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌟 SKILL SPECIALIZATION\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 ${player.name} [${cls} Lv.${player.level}]\n\n${hasPendingChoice(player)?'⚠️ You have a pending choice! Use /choose a or /choose b':nextChoiceLevel?`📈 Next choice at Level *${nextChoiceLevel}*`:'🏆 All specializations unlocked!'}\n\n💡 At levels 20, 40, 60, 80 you choose\nbetween an AGGRESSIVE or TACTICAL skill.\nThis makes your build unique!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        },{quoted:msg});
      }
      const {level, choices} = player.pendingSkillChoice;
      return sock.sendMessage(chatId,{text:formatChoiceMessage(player,level)},{quoted:msg});
    }

    if (pick==='later') {
      return sock.sendMessage(chatId,{text:`⏳ Choice postponed!\nUse /choose when ready to decide.\n\n⚠️ Warning: Until you choose, the slot is empty.`},{quoted:msg});
    }

    if (pick==='a'||pick==='b') {
      if (!hasPendingChoice(player)) {
        return sock.sendMessage(chatId,{text:'❌ No pending skill choice!\nYou will receive a choice at levels 20, 40, 60, 80.'},{quoted:msg});
      }
      const {level, choices} = player.pendingSkillChoice;
      const chosen = pick==='a' ? choices.a : choices.b;

      // Add skill to available skills (player must /skills learn it)
      if (!player.availableSkills) player.availableSkills=[];
      // Check if player has a full active skill bar (5 slots) — if not, auto-equip
      if ((player.skills?.active?.length||0) < 5) {
        if (!player.skills) player.skills={active:[],passive:[]};
        if (!player.skills.active) player.skills.active=[];
        // Remove old version of same name if exists
        player.skills.active = player.skills.active.filter(s=>s.name!==chosen.name);
        player.skills.active.push({
          name: chosen.name,
          damage: chosen.damage,
          energyCost: chosen.energyCost,
          cooldown: chosen.cooldown,
          level: 1,
          maxLevel: 5,
          effect: chosen.effect,
          isSpecialization: true
        });
      } else {
        // Full skills — add to available
        player.availableSkills = player.availableSkills.filter(s=>s.name!==chosen.name);
        player.availableSkills.push({
          name: chosen.name,
          damage: chosen.damage,
          energyCost: chosen.energyCost,
          cooldown: chosen.cooldown,
          level: 1,
          maxLevel: 5,
          effect: chosen.effect,
          isSpecialization: true
        });
      }

      // Track specialization history
      if (!player.specializations) player.specializations=[];
      player.specializations.push({ level, skill:chosen.name, path:pick==='a'?'Aggressive':'Tactical', timestamp:Date.now() });

      player.pendingSkillChoice = null;
      saveDatabase();

      const skillSlots=player.skills?.active?.length||0;
      return sock.sendMessage(chatId,{
        text:`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌟 SPECIALIZATION CHOSEN!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${pick==='a'?'⚔️ AGGRESSIVE PATH':'🛡️ TACTICAL PATH'}\n✅ Learned: *${chosen.name}*\n\n${chosen.flavor}\n\n${skillSlots>=5?'⚠️ Skill bar full! Use /skills learn to swap in.\nUse /skills forget [#] first.':'✅ Auto-equipped to your skill bar!'}\n\n💡 Your specialization history:\n${(player.specializations||[]).map(s=>`• Lv.${s.level}: ${s.skill} (${s.path})`).join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      },{quoted:msg});
    }

    return sock.sendMessage(chatId,{text:'❌ Use /choose a or /choose b\nOr /choose to see the options.'},{quoted:msg});
  }
};
