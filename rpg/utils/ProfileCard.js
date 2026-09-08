// ProfileCard.js — Canvas-based profile card generator
let canvas;
try { canvas = require('canvas'); } catch(e) { console.warn('[SILENT] ProfileCard: canvas not available, will return null'); canvas = null; }

const CLASS_THEMES = {
  Warrior:      { bg: ['#0d0500','#2a0a00'], accent: '#e74c3c', glow: '#ff6b6b', badge: '#8B2500', secondary: '#c0392b' },
  Mage:         { bg: ['#04001a','#0e0040'], accent: '#9b59b6', glow: '#c39bd3', badge: '#5B0EA6', secondary: '#8e44ad' },
  Archer:       { bg: ['#001408','#002a10'], accent: '#2ecc71', glow: '#82e0aa', badge: '#1A6B00', secondary: '#27ae60' },
  Rogue:        { bg: ['#080808','#141428'], accent: '#95a5a6', glow: '#bdc3c7', badge: '#2C3E50', secondary: '#7f8c8d' },
  Knight:       { bg: ['#04041a','#0a0a3d'], accent: '#3498db', glow: '#85c1e9', badge: '#1A4A8A', secondary: '#2980b9' },
  Monk:         { bg: ['#140c00','#2e1a00'], accent: '#f39c12', glow: '#fad7a0', badge: '#8B5000', secondary: '#e67e22' },
  Shaman:       { bg: ['#001414','#002828'], accent: '#1abc9c', glow: '#76d7c4', badge: '#0A5C52', secondary: '#16a085' },
  Warlord:      { bg: ['#140000','#320000'], accent: '#e74c3c', glow: '#ff0000', badge: '#800000', secondary: '#c0392b' },
  Paladin:      { bg: ['#141000','#2e2400'], accent: '#f1c40f', glow: '#fdebd0', badge: '#8B7300', secondary: '#d4ac0d' },
  Necromancer:  { bg: ['#030010','#0a0033'], accent: '#a569bd', glow: '#d2b4de', badge: '#3D0066', secondary: '#6c3483' },
  Assassin:     { bg: ['#040404','#0d0d0d'], accent: '#bdc3c7', glow: '#ecf0f1', badge: '#1a1a1a', secondary: '#95a5a6' },
  Elementalist: { bg: ['#000c1a','#001a38'], accent: '#74b9ff', glow: '#a9cce3', badge: '#004080', secondary: '#0984e3' },
  Ranger:       { bg: ['#001200','#002400'], accent: '#55efc4', glow: '#a2d9ce', badge: '#006644', secondary: '#00b894' },
  BloodKnight:  { bg: ['#140004','#300010'], accent: '#ff4757', glow: '#ff6b81', badge: '#800020', secondary: '#d63031' },
  SpellBlade:   { bg: ['#0c0020','#180040'], accent: '#c8b8ff', glow: '#d7bde2', badge: '#5533AA', secondary: '#a29bfe' },
  Berserker:    { bg: ['#140000','#3e0000'], accent: '#ff6b35', glow: '#f0b27a', badge: '#8B0000', secondary: '#ff4500' },
  DragonKnight: { bg: ['#0a0300','#200a00'], accent: '#fd7272', glow: '#f1948a', badge: '#6B2800', secondary: '#e17055' },
  Summoner:     { bg: ['#080014','#140040'], accent: '#fdcfe8', glow: '#f8c8e4', badge: '#6B0033', secondary: '#fd79a8' },
  ShadowDancer: { bg: ['#02020a','#04040f'], accent: '#a29bfe', glow: '#d7bde2', badge: '#2D1B8A', secondary: '#6c5ce7' },
  Devourer:     { bg: ['#040000','#100000'], accent: '#ff0000', glow: '#e74c3c', badge: '#600000', secondary: '#d00000' },
  Chronomancer: { bg: ['#000410','#000e28'], accent: '#81ecec', glow: '#a2d9ce', badge: '#006666', secondary: '#00cec9' },
  Phantom:      { bg: ['#020208','#060618'], accent: '#dfe6e9', glow: '#ffffff', badge: '#404040', secondary: '#b2bec3' },
};

const RARITY_COLORS = {
  Common: '#95a5a6', Rare: '#3498db', Epic: '#9b59b6',
  Legendary: '#f39c12', Divine: '#ffd700', Evil: '#e74c3c',
};

const PVP_RANKS = [
  { name:'Unranked', min:0,    color:'#95a5a6' },
  { name:'Bronze',   min:800,  color:'#cd7f32' },
  { name:'Silver',   min:1000, color:'#c0c0c0' },
  { name:'Nexus',     min:1200, color:'#ffd700' },
  { name:'Platinum', min:1400, color:'#00d2ff' },
  { name:'Diamond',  min:1600, color:'#b9f2ff' },
  { name:'Master',   min:1800, color:'#ff6b6b' },
  { name:'Grandmaster', min:2000, color:'#ff4500' },
  { name:'Legend',   min:2200, color:'#f39c12' },
];
function getPvpRank(elo) {
  const e = elo || 1000;
  for (let i = PVP_RANKS.length - 1; i >= 0; i--) {
    if (e >= PVP_RANKS[i].min) return PVP_RANKS[i];
  }
  return PVP_RANKS[0];
}

const CLASS_EMOJIS = {
  Warrior:'⚔️',Mage:'🔮',Archer:'🏹',Rogue:'🗡️',Knight:'🛡️',Monk:'👊',
  Shaman:'🌿',Warlord:'🪖',Paladin:'✨',Necromancer:'💀',Assassin:'🌑',
  Elementalist:'⚡',Ranger:'🌲',BloodKnight:'🩸',SpellBlade:'🌀',
  Berserker:'🔥',DragonKnight:'🐉',Summoner:'🔯',ShadowDancer:'💃',
  Devourer:'🕳️',Chronomancer:'⏳',Phantom:'👻',
};

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function drawGradBar(ctx, x, y, w, h, pct, c1, c2) {
  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, x, y, w, h, h/2); ctx.fill();
  // Fill
  const fw = Math.max(0, Math.min(w, w * Math.min(1, Math.max(0, pct))));
  if (fw > 2) {
    const grad = ctx.createLinearGradient(x, 0, x+fw, 0);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, fw, h, h/2); ctx.fill();
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, x, y, fw, h/2, h/2); ctx.fill();
  }
}

function glowText(ctx, text, x, y, color, size, bold=true, blur=10) {
  ctx.font = `${bold?'bold ':''} ${size}px sans-serif`;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

function card(ctx, x, y, w, h, theme, r=10) {
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = theme.accent + '30';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, r); ctx.stroke();
}

function sectionTitle(ctx, text, x, y, theme) {
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = theme.accent + 'cc';
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.fillStyle = theme.accent + '44';
  ctx.fillRect(x, y+3, ctx.measureText(text.toUpperCase()).width, 1);
}

async function generateProfileCard(player) {
  if (!canvas) return null;
  const { createCanvas } = canvas;

  const W = 540, H = 820;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');

  const className = typeof player.class === 'string'
    ? player.class : (player.class?.name  || 'Awaiting');
  const rarity = typeof player.class === 'object'
    ? (player.class?.rarity || 'Common') : 'Common';
  const theme = CLASS_THEMES[className] || CLASS_THEMES.Warrior;
  const rarityCol = RARITY_COLORS[rarity] || RARITY_COLORS.Common;
  const emoji = CLASS_EMOJIS[className] || '⚔️';

  // ── BACKGROUND ───────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, theme.bg[0]);
  bg.addColorStop(1, theme.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Diagonal light sweep
  const sweep = ctx.createLinearGradient(0, 0, W, H);
  sweep.addColorStop(0, 'rgba(255,255,255,0.03)');
  sweep.addColorStop(0.5, 'rgba(255,255,255,0.07)');
  sweep.addColorStop(1, 'rgba(255,255,255,0.01)');
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, W, H);

  // Subtle dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let gx = 20; gx < W; gx += 28)
    for (let gy = 20; gy < H; gy += 28) {
      ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI*2); ctx.fill();
    }

  // ── OUTER BORDER ─────────────────────────────────────────
  const borderGrad = ctx.createLinearGradient(0, 0, W, H);
  borderGrad.addColorStop(0, theme.accent + '80');
  borderGrad.addColorStop(0.5, theme.glow + '40');
  borderGrad.addColorStop(1, theme.accent + '80');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 6, 6, W-12, H-12, 16); ctx.stroke();

  // Top glow strip
  const topStrip = ctx.createLinearGradient(0, 0, W, 0);
  topStrip.addColorStop(0, 'transparent');
  topStrip.addColorStop(0.3, theme.accent);
  topStrip.addColorStop(0.7, theme.glow);
  topStrip.addColorStop(1, 'transparent');
  ctx.fillStyle = topStrip;
  ctx.fillRect(6, 6, W-12, 3);

  // Bottom glow strip
  ctx.fillStyle = topStrip;
  ctx.fillRect(6, H-9, W-12, 3);

  // ── BIG CLASS WATERMARK ──────────────────────────────────
  ctx.font = '160px serif';
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = theme.accent;
  ctx.fillText(emoji, W - 200, 200);
  ctx.globalAlpha = 1;

  // ── HEADER SECTION ───────────────────────────────────────
  // Name with glow
  ctx.font = 'bold 34px sans-serif';
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(player.name || 'Unknown', 28, 58);
  ctx.shadowBlur = 0;

  // Class badge
  const badgeTxt = `${emoji}  ${className}`;
  ctx.font = 'bold 13px sans-serif';
  const badgeW = ctx.measureText(badgeTxt).width + 24;
  const bGrad = ctx.createLinearGradient(28, 0, 28+badgeW, 0);
  bGrad.addColorStop(0, theme.badge + 'dd');
  bGrad.addColorStop(1, theme.secondary + '99');
  ctx.fillStyle = bGrad;
  roundRect(ctx, 28, 68, badgeW, 24, 6); ctx.fill();
  ctx.strokeStyle = rarityCol + '99';
  ctx.lineWidth = 1;
  roundRect(ctx, 28, 68, badgeW, 24, 6); ctx.stroke();
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(badgeTxt, 40, 85);

  // Rarity tag
  ctx.font = '11px sans-serif';
  ctx.fillStyle = rarityCol;
  ctx.fillText(rarity.toUpperCase(), 28 + badgeW + 10, 85);

  // Level pill (top right)
  const lvl = player.level || 1;
  const lvlTxt = `LV ${lvl}`;
  ctx.font = 'bold 18px sans-serif';
  const lvlW = ctx.measureText(lvlTxt).width + 22;
  const lvlGrad = ctx.createLinearGradient(W-lvlW-18, 0, W-18, 0);
  lvlGrad.addColorStop(0, theme.accent);
  lvlGrad.addColorStop(1, theme.glow);
  ctx.fillStyle = lvlGrad;
  roundRect(ctx, W-lvlW-18, 18, lvlW, 32, 8); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
  ctx.fillText(lvlTxt, W-lvlW-7, 40);
  ctx.shadowBlur = 0;

  // Rank badge (below level)
  const rank = player.rank || 'F';
  const rankColors = {'F':'#e74c3c','E':'#e67e22','D':'#f1c40f','C':'#2ecc71','B':'#3498db','A':'#9b59b6','S':'#f39c12','SS':'#ffd700'};
  const rc = rankColors[rank] || '#e74c3c';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = rc + 'cc';
  roundRect(ctx, W-60, 58, 42, 22, 6); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(rank, W - 60 + 21 - ctx.measureText(rank).width/2, 74);

  // Divider
  const divGrad = ctx.createLinearGradient(0, 0, W, 0);
  divGrad.addColorStop(0, 'transparent');
  divGrad.addColorStop(0.2, theme.accent + '88');
  divGrad.addColorStop(0.8, theme.glow + '88');
  divGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = divGrad;
  ctx.fillRect(28, 106, W-56, 1);

  // ── VITALS BARS ──────────────────────────────────────────
  const hp = player.stats?.hp || 0;
  const maxHp = player.stats?.maxHp || 100;
  const en = player.stats?.energy || player.stats?.mana || 0;
  const maxEn = player.stats?.maxEnergy || player.stats?.maxMana || 100;
  const xp = player.xp || 0;
  const xpNeeded = Math.floor(200 * Math.pow(lvl, 1.8));

  const bars = [
    { label:'❤️ HP', cur:hp, max:maxHp, c1:'#c0392b', c2:'#ff6b6b', sub:`${hp.toLocaleString()} / ${maxHp.toLocaleString()}` },
    { label:`⚡ ${player.energyType||'Energy'}`, cur:en, max:maxEn, c1:'#2471a3', c2:'#5dade2', sub:`${en} / ${maxEn}` },
    { label:'✨ EXP', cur:xp, max:xpNeeded, c1:'#b7950b', c2:'#f39c12', sub:`${Math.floor(Math.min(100,(xp/xpNeeded)*100))}% to Lv${lvl+1}` },
  ];

  bars.forEach((b, i) => {
    const y = 124 + i * 40;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = b.c2;
    ctx.fillText(b.label, 28, y);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText(b.sub, W - 28 - ctx.measureText(b.sub).width, y);
    drawGradBar(ctx, 28, y+6, W-56, 12, b.cur/b.max, b.c1, b.c2);
  });

  // ── COMBAT STATS ─────────────────────────────────────────
  const statsY = 252;
  card(ctx, 28, statsY, W-56, 110, theme);
  sectionTitle(ctx, '⚔️ Combat Stats', 44, statsY+18, theme);

  const atk = player.stats?.atk || 0;
  const def = player.stats?.def || 0;
  const spd = player.stats?.speed || player.stats?.spd || 0;
  const crit = player.stats?.crit || 0;
  const weapBonus = player.weapon?.bonus || player.weapon?.attack || 0;

  const statItems = [
    { label:'ATK', val:atk, icon:'⚔️', col:'#e74c3c', sub:`+${weapBonus} weapon` },
    { label:'DEF', val:def, icon:'🛡️', col:'#3498db', sub:'damage reduction' },
    { label:'SPD', val:spd, icon:'💨', col:'#2ecc71', sub:'initiative' },
    { label:'CRIT', val:`${crit}%`, icon:'🎯', col:'#f39c12', sub:'critical rate' },
  ];

  statItems.forEach((s, i) => {
    const sx = 36 + i * 120;
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#555';
    ctx.fillText(s.icon + ' ' + s.label, sx, statsY + 40);
    glowText(ctx, String(s.val), sx, statsY + 64, s.col, 22, true, 8);
    ctx.font = '9px sans-serif'; ctx.fillStyle = '#444';
    ctx.fillText(s.sub, sx, statsY + 80);
  });

  // ── PVP ──────────────────────────────────────────────────
  const pvpY = 376;
  const elo = player.pvpElo || 1000;
  const pvpRank = getPvpRank(elo);
  const pvpWins = player.pvpWins || 0;
  const pvpLoss = player.pvpLosses || 0;
  const pvpTotal = pvpWins + pvpLoss;
  const wr = pvpTotal > 0 ? Math.floor((pvpWins/pvpTotal)*100) : 0;

  card(ctx, 28, pvpY, W-56, 90, theme);
  sectionTitle(ctx, '⚔️ PVP Record', 44, pvpY+18, theme);

  glowText(ctx, pvpRank.name.toUpperCase(), 44, pvpY+46, pvpRank.color, 18, true, 10);
  ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#aaa';
  ctx.fillText(`ELO ${elo}`, 44, pvpY+66);

  ctx.font = 'bold 14px sans-serif';
  glowText(ctx, `${pvpWins}W`, W-200, pvpY+46, '#2ecc71', 14, true, 6);
  ctx.fillStyle = '#666'; ctx.fillText(' / ', W-172, pvpY+46);
  glowText(ctx, `${pvpLoss}L`, W-155, pvpY+46, '#e74c3c', 14, true, 6);
  ctx.font = '11px sans-serif'; ctx.fillStyle = '#555';
  ctx.fillText(`Win Rate: ${wr}%`, W-200, pvpY+66);

  // ELO progress bar
  const rankIdx = PVP_RANKS.findIndex(r => r.name === pvpRank.name);
  const nextRank = PVP_RANKS[rankIdx+1];
  if (nextRank) {
    const prog = (elo - pvpRank.min) / (nextRank.min - pvpRank.min);
    drawGradBar(ctx, 44, pvpY+74, W-88, 8, prog, pvpRank.color, pvpRank.color+'cc');
  }

  // ── GEAR & RESOURCES ─────────────────────────────────────
  const gearY = 480;
  card(ctx, 28, gearY, (W-64)/2, 90, theme);
  card(ctx, 28+(W-64)/2+8, gearY, (W-64)/2, 90, theme);

  sectionTitle(ctx, '💰 Resources', 44, gearY+18, theme);
  glowText(ctx, (player.gold||0).toLocaleString(), 44, gearY+48, '#f39c12', 18, true, 6);
  ctx.font = '11px sans-serif'; ctx.fillStyle = '#555';
  ctx.fillText('🪙 Nexus', 44, gearY+68);

  const cx2 = 28+(W-64)/2+22;
  sectionTitle(ctx, '💎 Mana Stones', cx2, gearY+18, theme);
  glowText(ctx, (player.manaCrystals||0).toLocaleString(), cx2, gearY+48, '#74b9ff', 18, true, 6);
  ctx.font = '11px sans-serif'; ctx.fillStyle = '#555';
  ctx.fillText('💎 Mana Stones', cx2, gearY+68);

  // ── JOURNEY STATS ────────────────────────────────────────
  const journeyY = 584;
  card(ctx, 28, journeyY, W-56, 90, theme);
  sectionTitle(ctx, '📈 Journey', 44, journeyY+18, theme);

  const bossKills = typeof player.bossesDefeated === 'object'
    ? Object.keys(player.bossesDefeated||{}).length
    : (player.bossesDefeated || 0);
  const dungeons = player.dungeonsCleared || player.dungeon?.cleared || 0;
  const quests = player.questsCompleted || 0;
  const achCount = player.achievements?.unlocked?.length || 0;

  const journeyItems = [
    { icon:'👹', label:'Bosses', val:bossKills, col:'#e74c3c' },
    { icon:'🏰', label:'Dungeons', val:dungeons, col:'#3498db' },
    { icon:'📜', label:'Quests', val:quests, col:'#2ecc71' },
    { icon:'🏅', label:'Achievements', val:achCount, col:'#f39c12' },
  ];

  journeyItems.forEach((j, i) => {
    const jx = 36 + i * 120;
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#555';
    ctx.fillText(`${j.icon} ${j.label}`, jx, journeyY+38);
    glowText(ctx, String(j.val), jx, journeyY+62, j.col, 20, true, 6);
  });

  // ── WEAPON & GUILD ───────────────────────────────────────
  const extraY = 688;
  const weapName = player.weapon?.name || 'No weapon';
  const weapTxt = `⚔️ ${weapName}${weapBonus > 0 ? ` (+${weapBonus})` : ''}`;

  ctx.font = '11px sans-serif';
  ctx.fillStyle = theme.accent + '88';
  ctx.fillText(weapTxt, 28, extraY);

  // Guild
  let guildTxt = '🏛️ No guild';
  try {
    if (player.guildId) {
      const { createCanvas: _c } = canvas; // just checking player fields
      guildTxt = `🏛️ ${player.guildName || 'Guild member'}`;
    }
  } catch(e) { console.warn('[SILENT] ProfileCard guild lookup failed:', e.message); }
  ctx.fillStyle = '#444';
  ctx.fillText(guildTxt, W/2, extraY);

  // Reg date
  const reg = player.registeredAt || player.createdAt;
  const regStr = reg ? `Registered: ${new Date(reg).toLocaleDateString('en-GB')}` : '';
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#333';
  ctx.fillText(regStr, 28, H-22);

  // CP
  const cp = Math.floor(atk*12 + weapBonus*8 + def*8 + maxHp*0.4 + spd*6 + lvl*60);
  ctx.font = 'bold 11px sans-serif';
  glowText(ctx, `⚡ CP ${cp.toLocaleString()}`, W-140, H-22, theme.accent, 11, true, 4);

  return c.toBuffer('image/jpeg', { quality: 0.93 });
}

module.exports = { generateProfileCard, CLASS_THEMES, RARITY_COLORS };