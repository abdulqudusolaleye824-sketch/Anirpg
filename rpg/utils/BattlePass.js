// ═══════════════════════════════════════════════════════════════
// BATTLE PASS SYSTEM — Monthly season with free + premium tracks
// Pass XP earned from: PvP wins, dungeon clears, boss kills,
// daily claims, challenges, casino wins, world boss, summons
// ═══════════════════════════════════════════════════════════════

const SEASON_DURATION_DAYS = 30;
const PASS_LEVELS = 50; // 0→50 levels per season
const XP_PER_LEVEL = 500;

// ── Current season config (update monthly) ────────────────────────
const CURRENT_SEASON = {
  id: 1,
  name: 'Season 1: The Shadow Invasion',
  emoji: '🌑',
  theme: 'Dark matter corrupts the gates. Hunters must push back the void.',
  premiumCost: 500, // crystals for premium pass
};

// ── Reward track (free + premium per level) ───────────────────────
// Every 5 levels = milestone. Free track is modest, premium is worth it.
function getRewardTrack() {
  const track = [];
  for (let lvl = 1; lvl <= PASS_LEVELS; lvl++) {
    const isMilestone = lvl % 5 === 0;
    const free  = getFreeReward(lvl, isMilestone);
    const prem  = getPremiumReward(lvl, isMilestone);
    track.push({ lvl, free, prem, isMilestone });
  }
  return track;
}

function getFreeReward(lvl, isMilestone) {
  if (lvl === PASS_LEVELS) return { type:'title', value:'Shadow Survivor', desc:'👁️ Exclusive Season 1 title' };
  if (isMilestone) {
    const milestones = {
      5:  { type:'gold',     value:2000,   desc:'2,000 Nexus' },
      10: { type:'crystals', value:20,     desc:'20 Mana Stones' },
      15: { type:'gold',     value:8000,   desc:'8,000 Nexus' },
      20: { type:'crystals', value:40,     desc:'40 Mana Stones' },
      25: { type:'gold',     value:20000,  desc:'20,000 Nexus' },
      30: { type:'crystals', value:60,     desc:'60 Mana Stones' },
      35: { type:'gold',     value:50000,  desc:'50,000 Nexus' },
      40: { type:'crystals', value:80,     desc:'80 Mana Stones' },
      45: { type:'gold',     value:100000, desc:'100,000 Nexus' },
    };
    return milestones[lvl] || { type:'gold', value:1000, desc:'1,000 Nexus' };
  }
  return { type:'xp', value:200, desc:'+200 XP' };
}

function getPremiumReward(lvl, isMilestone) {
  if (lvl === PASS_LEVELS) return { type:'weapon', value:'void_scythe', name:'🌑 Void Scythe', desc:'Season 1 Exclusive Weapon (+100 ATK)', bonus:{ atk:100 }, seasonal:true };
  if (lvl === 25) return { type:'pet_egg', value:'void_egg', name:'🖤 Void Dragon Egg', desc:'Exclusive season pet egg', seasonal:true };
  if (lvl === 1)  return { type:'title', value:'Shadow Hunter', desc:'🌑 Premium Season 1 title' };
  if (isMilestone) {
    const milestones = {
      5:  { type:'crystals', value:80,    desc:'80 Mana Stones' },
      10: { type:'summon_ticket', value:1, desc:'🎟️ 1 Summon Ticket' },
      15: { type:'crystals', value:150,   desc:'150 Mana Stones' },
      20: { type:'summon_ticket', value:2, desc:'🎟️ 2 Summon Tickets' },
      30: { type:'crystals', value:300,   desc:'300 Mana Stones' },
      35: { type:'summon_ticket', value:3, desc:'🎟️ 3 Summon Tickets' },
      40: { type:'crystals', value:400,   desc:'400 Mana Stones' },
      45: { type:'summon_ticket', value:5, desc:'🎟️ 5 Summon Tickets' },
    };
    return milestones[lvl] || { type:'crystals', value:50, desc:'50 Mana Stones' };
  }
  // Every non-milestone premium level
  if (lvl % 2 === 0) return { type:'gold',     value:3000, desc:'3,000 Nexus' };
  return                    { type:'crystals', value:15,   desc:'15 Mana Stones' };
}

// ── Pass XP sources ───────────────────────────────────────────────
const XP_SOURCES = {
  pvp_win:        150,
  pvp_participate: 30,
  dungeon_floor:  20,   // per floor
  dungeon_clear: 300,   // full dungeon
  boss_kill:     200,
  world_boss:    300,
  daily_claim:    25,
  challenge_done: 100,
  casino_win:     25,
  summon_pull:    10,   // per pull
};

// ── Player pass state ─────────────────────────────────────────────
function getPassState(player) {
  if (!player.battlePass) player.battlePass = {};
  const bp = player.battlePass;
  if (bp.seasonId !== CURRENT_SEASON.id) {
    // New season — reset
    bp.seasonId = CURRENT_SEASON.id;
    bp.xp       = 0;
    bp.level    = 0;
    bp.premium  = false;
    bp.claimed  = []; // array of level numbers claimed
  }
  return bp;
}

// Reward multiplier, centralized: Pro 2x, BP-premium 2x, both 4x.
// (Callers pass base amounts only — no manual doubling at call sites.)
function _rewardMult(player) {
  const bp = getPassState(player); // also rolls the season when due
  const isPro = !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
  return { bp, mult: (isPro ? 2 : 1) * (bp.premium ? 2 : 1) };
}

function addPassXP(player, source, multiplier = 1) {
  const baseXP = XP_SOURCES[source] || 0;
  if (!baseXP) return 0;
  const { bp, mult } = _rewardMult(player);
  const gained = Math.floor(baseXP * (multiplier || 1) * mult);
  bp.xp += gained;
  // Level up
  while (bp.xp >= XP_PER_LEVEL && bp.level < PASS_LEVELS) {
    bp.xp  -= XP_PER_LEVEL;
    bp.level++;
  }
  if (bp.level >= PASS_LEVELS) bp.xp = 0;
  return gained;
}

// Direct-amount XP: credit a BASE number of BP XP — the Pro x premium
// multiplier (1x/2x/4x) is applied inside. Callers must NOT pre-double.
function addPassXPAmount(player, amount) {
  if (!player || !amount || amount <= 0) return 0;
  const { bp, mult } = _rewardMult(player);
  const final = Math.floor(amount * mult);
  bp.xp += final;
  while (bp.xp >= XP_PER_LEVEL && bp.level < PASS_LEVELS) {
    bp.xp -= XP_PER_LEVEL;
    bp.level++;
  }
  if (bp.level >= PASS_LEVELS) bp.xp = 0;
  return final;
}

function claimReward(player, level) {
  const bp = getPassState(player);
  if (bp.level < level) return { success:false, reason:`Reach Pass Level ${level} first! (You: ${bp.level})` };
  if (bp.claimed.includes(level)) return { success:false, reason:'Already claimed!' };

  const track = getRewardTrack();
  const row   = track.find(r => r.lvl === level);
  if (!row) return { success:false, reason:'Invalid level' };

  const rewards = [row.free];
  if (bp.premium) rewards.push(row.prem);

  const gained = [];
  for (const reward of rewards) {
    if (!reward) continue;
    if (reward.type === 'gold')           { player.gold = (player.gold||0) + reward.value; gained.push(`💠 +${reward.value.toLocaleString()} 💠`); }
    if (reward.type === 'crystals')       { player.manaCrystals = (player.manaCrystals||0) + reward.value; gained.push(`💎 +${reward.value}`); }
    if (reward.type === 'xp')             { player.xp = (player.xp||0) + reward.value; gained.push(`✨ +${reward.value} XP`); }
    if (reward.type === 'title')          { if (!player.titles) player.titles=[]; if (!player.titles.includes(reward.value)) player.titles.push(reward.value); gained.push(`🎖️ Title: "${reward.value}"`); }
    if (reward.type === 'summon_ticket')  { player.summonTickets = (player.summonTickets||0) + reward.value; gained.push(`🎟️ ×${reward.value} Summon Ticket`); }
    if (reward.type === 'pet_egg')        { if (!player.inventory) player.inventory={}; if (!Array.isArray(player.inventory.items)) player.inventory.items=[]; player.inventory.items.push({ name:reward.name, type:'pet_egg', rarity:'legendary', petType:reward.value, seasonal:true }); gained.push(`🥚 ${reward.name}`); }
    if (reward.type === 'weapon')         { const b=reward.bonus?.atk||0; if (!player.inventory) player.inventory={}; if (!Array.isArray(player.inventory.items)) player.inventory.items=[]; player.inventory.items.push({ name:reward.name, type:'gear', isGear:true, slot:'weapon', rarity:'legendary', durability:100, maxDurability:100, stats:{atk:b}, lore:reward.desc||'', source:'battlepass', seasonal:true, acquiredAt:Date.now() }); gained.push(`⚔️ ${reward.name} (${b} ATK)`); }
  }

  bp.claimed.push(level);
  return { success:true, gained };
}

module.exports = {
  CURRENT_SEASON, PASS_LEVELS, XP_PER_LEVEL, XP_SOURCES, SEASON_DURATION_DAYS,
  getRewardTrack, getPassState, addPassXP, addPassXPAmount, claimReward,
};