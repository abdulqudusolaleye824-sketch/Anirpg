// ═══════════════════════════════════════════════════════════════
// /rank — Hunter Rank Card
// Usage: /rank            → your own rank
//        /rank @player    → view someone else's rank
// ═══════════════════════════════════════════════════════════════

// ── Rank tier table ─────────────────────────────────────────────
// Thresholds calibrated so:
//   • New players start F and reach E after light early play
//   • Active mid-game (Lv.30, ~20 bosses, ~40 dungeons) = B-rank
//   • SS/National/Beyond are true endgame achievements
const RANKS = [
  { rank: 'F',        min:      0, emoji: '⚪', title: 'Rookie'        },
  { rank: 'E',        min:   2000, emoji: '🟢', title: 'Apprentice'    },
  { rank: 'D',        min:   6000, emoji: '🔵', title: 'Hunter'        },
  { rank: 'C',        min:  12000, emoji: '🟡', title: 'Elite Hunter'  },
  { rank: 'B',        min:  22000, emoji: '🟠', title: 'Expert'        },
  { rank: 'A',        min:  36000, emoji: '🔴', title: 'Veteran'       },
  { rank: 'S',        min:  52000, emoji: '🟣', title: 'Shadow Hunter' },
  { rank: 'SS',       min:  65000, emoji: '✨', title: 'Mythic Hunter' },
  { rank: 'National', min:  78000, emoji: '👑', title: 'National Hero' },
  { rank: 'Beyond',   min:  92000, emoji: '🌌', title: 'Transcendent'  },
];

// ── Power formula ────────────────────────────────────────────────
function calcPower(p) {
  const lvl   = p.level || 1;
  const xp    = p.xp    || 0;
  const xpCap = Math.floor(200 * Math.pow(lvl, 1.8));

  // Boss kills — bossesDefeated is {total: N, byRank: {...}} object
  const bosses = typeof p.bossesDefeated === 'object'
    ? (p.bossesDefeated?.total || Object.values(p.bossesDefeated?.byRank || {}).reduce((s,v)=>s+v,0) || 0)
    : (p.bossesDefeated || 0);
  const dungeons = p.dungeon?.cleared || 0;

  const pvpW    = p.pvpWins   || 0;
  const pvpT    = pvpW + (p.pvpLosses || 0);
  const winRate = pvpT > 0 ? pvpW / pvpT : 0;

  const invested = Object.values(p.statAllocations || {})
    .reduce((s, v) => s + (v || 0), 0);
  const up = p.upgradePoints || 0;

  const skills    = (p.skills?.active?.length  || 0)
                  + (p.skills?.passive?.length || 0);
  const artifacts = Object.values(p.artifacts?.equipped || {})
    .filter(Boolean).length;
  const weapon    = p.weapon?.bonus || p.weapon?.attack || 0;
  const gold      = p.gold || 0;

  const parts = {
    level:     lvl       * 50,
    xp:        Math.floor((xp / Math.max(xpCap, 1)) * 30),
    bosses:    bosses    * 40,
    dungeons:  dungeons  * 15,
    pvp:       Math.floor(pvpW * 20 + winRate * 150),
    invested:  invested  * 10,
    up:        up        * 5,
    skills:    skills    * 60,
    artifacts: artifacts * 100,
    weapon:    Math.floor(weapon * 3),
    gold:      Math.floor(Math.log10(Math.max(gold, 10)) * 25),
  };

  const total = Object.values(parts).reduce((s, v) => s + v, 0);
  return { total, parts };
}

// ── Helpers ──────────────────────────────────────────────────────
function getRank(power) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (power >= RANKS[i].min) {
      return { cur: RANKS[i], next: RANKS[i + 1] || null };
    }
  }
  return { cur: RANKS[0], next: RANKS[1] };
}

function progBar(power, curMin, nextMin, len = 14) {
  if (!nextMin) return '█'.repeat(len);
  const pct    = Math.max(0, Math.min(1, (power - curMin) / (nextMin - curMin)));
  const filled = Math.round(pct * len);
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

function rpad(str, w) {
  str = String(str);
  return str + ' '.repeat(Math.max(0, w - str.length));
}

function fmt(n)   { return Number(n).toLocaleString(); }
function short(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000)    return Math.floor(n / 1000) + 'k';
  if (n >= 1_000)     return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

// Global leaderboard position with lightweight in-memory caching
// (_cachedPower is NOT saved to DB — just avoids recalculating everyone
//  on every single /rank call during the same process session)
function serverRank(db, targetId) {
  const list = Object.entries(db.users || {})
    .filter(([, p]) => p && p.name && p.level)
    .map(([id, p]) => {
      if (!p._cachedPower) p._cachedPower = calcPower(p).total;
      return { id, pw: p._cachedPower };
    })
    .sort((a, b) => b.pw - a.pw);

  const pos = list.findIndex(e => e.id === targetId);
  return { pos: pos >= 0 ? pos + 1 : list.length + 1, total: list.length };
}

// ════════════════════════════════════════════════════════════════
module.exports = {
  name: 'rank',
  description: 'View your Hunter Rank card with power breakdown',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db     = getDatabase();

    // Resolve target — self or @mention
    const mention  = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const targetId = mention || sender;
    const isOther  = targetId !== sender;

    const player = db.users[targetId];
    if (!player) {
      return sock.sendMessage(chatId, {
        text: isOther
          ? '❌ That player is not registered!'
          : '❌ You are not registered!\nUse /register [name] to start.',
      }, { quoted: msg });
    }

    // ── Compute ───────────────────────────────────────────────
    const { total: power, parts } = calcPower(player);
    const { cur, next }           = getRank(power);
    const { pos, total: srvTotal } = serverRank(db, targetId);

    // Persist rank & flush cache for this player
    player.hunterRank   = cur.rank;
    player._cachedPower = power;
    saveDatabase();

    // ── Identity strings ──────────────────────────────────────
    const lvl      = player.level || 1;
    const clsName  = typeof player.class === 'object'
      ? (player.class.name   || 'Unknown')
      : (player.class        || 'Unknown');
    const clsRar   = typeof player.class === 'object'
      ? (player.class.rarity || 'Common')
      : 'Common';

    const CLS_ICON = {
      Warrior:'⚔️', Mage:'🔮', Archer:'🏹', Rogue:'🗡️', Assassin:'🗡️',
      Berserker:'🪓', Paladin:'🛡️', Necromancer:'💀',
      Devourer:'👹', DragonKnight:'🐉', 'Dragon Knight':'🐉',
    };
    const RAR_ICON = {
      Common:'⚪', Rare:'🔵', Epic:'🟣', Legendary:'🟡', Evil:'🔴', Mythic:'🌌',
    };

    // ── PVP / record numbers ──────────────────────────────────
    const pvpW = player.pvpWins   || 0;
    const pvpL = player.pvpLosses || 0;
    const pvpT = pvpW + pvpL;
    const pvpR = pvpT > 0 ? Math.round((pvpW / pvpT) * 100) : 0;

    const bosses   = typeof player.bossesDefeated === 'object'
      ? (player.bossesDefeated?.total || Object.values(player.bossesDefeated?.byRank || {}).reduce((s,v)=>s+v,0) || 0)
      : (player.bossesDefeated || 0);
    const dungeons = player.dungeon?.cleared || 0;

    const invested = Object.values(player.statAllocations || {})
      .reduce((s, v) => s + (v || 0), 0);
    const up       = player.upgradePoints || 0;

    const activeS  = player.skills?.active?.length  || 0;
    const passiveS = player.skills?.passive?.length || 0;
    const eqArt    = Object.values(player.artifacts?.equipped || {}).filter(Boolean).length;
    const invArt   = player.artifacts?.inventory?.length || 0;

    const eIcon  = player.energyColor || '💙';
    const eLabel = player.energyType  || 'Energy';

    // ── Progress to next rank ─────────────────────────────────
    const bar    = progBar(power, cur.min, next?.min);
    const pct    = next
      ? Math.min(100, Math.floor(((power - cur.min) / (next.min - cur.min)) * 100))
      : 100;
    const needed = next ? Math.max(0, next.min - power) : 0;

    // ════════════════════════════════════════════════════════
    // BUILD OUTPUT
    // ════════════════════════════════════════════════════════
    const SEP = '━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    const who = isOther ? `${player.name}'s` : 'YOUR';
    let out   = '';

    // ── Header ───────────────────────────────────────────────
    out += `${SEP}\n`;
    out += `${cur.emoji} ${who} HUNTER RANK ${cur.emoji}\n`;
    out += `${SEP}\n\n`;

    // ── Identity ─────────────────────────────────────────────
    out += `👤 *${player.name}*\n`;
    out += `${CLS_ICON[clsName] || '⚔️'} ${clsName} ${RAR_ICON[clsRar] || '⚪'} | Lv.${lvl}\n`;
    out += `🌐 Server Rank: *#${pos}* of ${srvTotal}\n\n`;

    // ── Rank card ─────────────────────────────────────────────
    out += `${SEP}\n🏅 RANK\n${SEP}\n\n`;
    out += `${cur.emoji} *${cur.rank}-RANK* — ${cur.title}\n`;
    out += `⚡ Power: *${fmt(power)}*\n\n`;

    if (next) {
      out += `${bar} ${pct}%\n`;
      out += `→ ${next.emoji} *${next.rank}-Rank* (${next.title})\n`;
      out += `  ${fmt(needed)} more power needed\n\n`;
    } else {
      out += `${'█'.repeat(14)} MAX\n`;
      out += `🌌 *TRANSCENDENT* — Beyond all limits!\n\n`;
    }

    // ── Power breakdown ───────────────────────────────────────
    out += `${SEP}\n📊 POWER BREAKDOWN\n${SEP}\n\n`;

    const rows = [
      [`⭐ Level ${lvl}`,                      parts.level    ],
      [`✨ XP Progress`,                       parts.xp       ],
      [`👑 Bosses   (${bosses})`,              parts.bosses   ],
      [`🏰 Dungeons (${dungeons})`,            parts.dungeons ],
      [`⚔️ PVP      (${pvpW}W / ${pvpL}L)`,  parts.pvp      ],
      [`💠 Stat Pts  (${invested})`,           parts.invested ],
      [`🔮 Skills    (${activeS + passiveS})`, parts.skills   ],
      [`🏺 Artifacts (${eqArt}/8)`,            parts.artifacts],
      [`🗡️ Weapon Bonus`,                      parts.weapon   ],
      [`💠 Wealth`,                            parts.gold     ],
      [`🔷 UP Pool   (${up})`,                 parts.up       ],
    ];

    for (const [label, val] of rows) {
      out += `${rpad(label, 26)}+${fmt(val)}\n`;
    }
    out += '\n';

    // ── Combat snapshot ───────────────────────────────────────
    out += `${SEP}\n🗡️ COMBAT STATS\n${SEP}\n\n`;
    out += `❤️  HP     ${fmt(player.stats?.hp || 0)} / ${fmt(player.stats?.maxHp || 0)}\n`;
    out += `⚔️  ATK    ${fmt(player.stats?.atk || 0)}\n`;
    out += `🛡️  DEF    ${fmt(player.stats?.def || 0)}\n`;
    out += `${eIcon}  ${rpad(eLabel, 5)}  ${fmt(player.stats?.energy || 0)} / ${fmt(player.stats?.maxEnergy || 0)}\n`;

    const crit = player.stats?.critChance || 0;
    const cdmg = player.stats?.critDamage || 0;
    const ls   = player.stats?.lifesteal  || 0;
    if (crit > 0) out += `💥  Crit   ${crit}%\n`;
    if (cdmg > 0) out += `🔥  CritDmg +${cdmg}%\n`;
    if (ls   > 0) out += `💚  Leech  ${ls}%\n`;
    out += '\n';

    // ── Battle record ─────────────────────────────────────────
    out += `${SEP}\n🏆 RECORD\n${SEP}\n\n`;
    out += `⚔️  PVP       ${pvpW}W / ${pvpL}L`;
    out += pvpT > 0 ? `  (${pvpR}% win rate)\n` : '\n';
    out += `👑  Bosses    ${fmt(bosses)}\n`;
    out += `🏰  Dungeons  ${fmt(dungeons)}\n`;
    out += `🔮  Skills    ${activeS} active, ${passiveS} passive\n`;
    out += `🏺  Artifacts ${eqArt} equipped`;
    out += invArt > 0 ? `, ${invArt} in bag\n` : '\n';
    out += '\n';

    // ── Tier reference ────────────────────────────────────────
    out += `${SEP}\n📜 RANK TIERS\n${SEP}\n\n`;
    for (const tier of RANKS) {
      const isCur  = tier.rank === cur.rank;
      const nameStr = isCur ? `*${tier.rank}-Rank*` : `${tier.rank}-Rank`;
      const mark    = isCur ? '  ◀ YOU' : '';
      out += `${tier.emoji} ${rpad(nameStr, 13)} ${short(tier.min)}+${mark}\n`;
    }
    out += `\n${SEP}`;

    return sock.sendMessage(chatId, {
      text: out,
      mentions: isOther ? [targetId] : [],
    }, { quoted: msg });
  },
};