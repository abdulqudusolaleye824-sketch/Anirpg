// /summon — Multi-banner gacha system
const BS = require('../../rpg/utils/BannerSystem');

// Summon cooldown — prevent rate-overlimit spam
const SUMMON_COOLDOWN = new Map();
const COOLDOWN_MS = 8000; // 8 seconds between summons

function getState(player, bannerId) {
  if (!player.bannerState) player.bannerState={};
  if (!player.bannerState[bannerId]) player.bannerState[bannerId]={pity:0,guaranteedRateUp:false};
  return player.bannerState[bannerId];
}

function pityBar(pity, hard) {
  const f = Math.min(20,Math.round((pity/hard)*20));
  return '[' + '█'.repeat(f) + '░'.repeat(20-f) + `] ${pity}/${hard}`;
}

// Cinematic pull reveal text
function buildPullLine(item, outcome, bannerId, index) {
  const re = BS.RARITY_EMOJI[item.rarity]||'⚪';
  const el = BS.ELEMENT_EMOJI[item.element||'none'];
  const isRU = bannerId==='limited' && BS.BANNERS.limited.rateUpIds?.includes(item.id);
  const prefix = item.rarity==='legendary' ? '🌟 ' : item.rarity==='epic' ? '💫 ' : item.rarity==='rare' ? '✨ ' : '';
  const ruTag = isRU ? ' ⭐ *RATE-UP*' : '';
  const elTag = el ? ` ${el}` : '';
  return `${prefix}${re} *${item.name}*${elTag}${ruTag} [${item.rarity.toUpperCase()}]\n   └ ${outcome.msg}`;
}

// Big reveal for legendary
function legendaryReveal(item, bannerId) {
  const el = BS.ELEMENT_EMOJI[item.element||'none'];
  const isRU = bannerId==='limited' && BS.BANNERS.limited.rateUpIds?.includes(item.id);
  const ruLine = isRU ? '\n⭐ *LIMITED RATE-UP ITEM!* ⭐\n' : '';
  return (
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `✦ ✦ ✦  🌟 LEGENDARY 🌟  ✦ ✦ ✦\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `${el}${el} *${item.name}* ${el}${el}\n` +
    `${ruLine}` +
    `📖 _${item.lore||''}_\n` +
    (item.passive ? `\n⚡ *Passive: ${item.passive.name}*\n   ${item.passive.desc}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  );
}

module.exports = {
  name:'summon',
  aliases:['pull','gacha','banner'],
  description:'🎲 Multi-banner gacha — Standard, Weapon, and Limited banners',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId,{text:'❌ Not registered! Use /register first.'},{quoted:msg});
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const sub  = (args[0]||'').toLowerCase();
    const sub2 = (args[1]||'').toLowerCase();

    // ── /summon — main menu ────────────────────────────────────
    if (!sub||sub==='menu'||sub==='banners') {
      const limited = db.activeLimitedBanner;
      const rates = {};
      for (const bid of ['standard','weapon','limited']) rates[bid] = BS.getBannerRates(bid);
      let txt = pro
        ? `${UI.PRO_BAR}\n🎲 *SUMMON PORTAL* 💎\n${UI.PRO_BAR}\n`
        : `🎲 *SUMMON PORTAL*\n${UI.FREE_BAR}\n`;
      txt +=
        `💎 Your 💎 Mana Stones: *${player.manaCrystals||0}*\n` +
        `🎟️ Summon Tickets: *${player.summonTickets||0}*\n\n`;

      // Standard
      const ss = getState(player,'standard');
      txt += `⭐ *Standard Summon*\n`;
      txt += `   All weapons • Artifacts • Pet Eggs\n`;
      txt += `   🎯 Pity: ${ss.pity||0}/100 | Soft: 50\n`;
      txt += `   💠 100💎/pull | 900💎 for x10\n\n`;

      // Weapon
      const ws = getState(player,'weapon');
      txt += `⚔️ *Weapon Summon*\n`;
      txt += `   Weapons only • Higher legendary rate\n`;
      txt += `   🎯 Pity: ${ws.pity||0}/80 | Soft: 40\n`;
      txt += `   💠 100💎/pull | 900💎 for x10\n\n`;

      // Limited
      if (limited && Date.now()<limited.expiresAt) {
        const days = Math.ceil((limited.expiresAt-Date.now())/86400000);
        const ls = getState(player,'limited');
        txt += `🌟 *LIMITED BANNER* ⏰ ${days}d left\n`;
        txt += `   *${limited.name}*\n`;
        txt += `   50/50 mechanic — Rate-up legends!\n`;
        txt += `   🎯 Pity: ${ls.pity||0}/90 | 50/50: ${ls.guaranteedRateUp?'✅ Guaranteed!':'🎲 Active'}\n`;
        txt += `   💠 160💎/pull | 1440💎 for x10\n\n`;
      } else {
        txt += `🌟 *Limited Banner* — No active banner\n   Watch for special events!\n\n`;
      }

      txt +=
        `${FRAME}\n` +
        `*/summon [standard|weapon|limited] x1*\n` +
        `*/summon [banner] x10*\n` +
        `*/summon [banner] ticket* — use a ticket\n` +
        `*/summon history* — last 20 pulls\n` +
        `*/summon collection* — your items\n` +
        `${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO PULLER* — pity S:${ss.pity||0} W:${ws.pity||0}` : `\n${UI.upsell()}`);
      return sock.sendMessage(chatId,{text:txt},{quoted:msg});
    }

    // ── /summon history ────────────────────────────────────────
    if (sub==='history') {
      const hist = player.summonHistory||[];
      if (!hist.length) return sock.sendMessage(chatId,{text:'📭 No pull history yet!'},{quoted:msg});
      const lines = hist.slice(0,20).map((h,i)=>{
        const re = BS.RARITY_EMOJI[h.rarity]||'⚪';
        const el = BS.ELEMENT_EMOJI[h.element||'none'];
        const d  = new Date(h.timestamp);
        return `${i+1}. ${re}${el} *${h.itemName}* [${h.bannerId}] ${d.getDate()}/${d.getMonth()+1}`;
      });
      return sock.sendMessage(chatId,{
        text:(pro ? `${UI.PRO_BAR}\n📜 *PULL HISTORY (last 20)* 💎\n${UI.PRO_BAR}\n` : `📜 *PULL HISTORY (last 20)*\n${UI.FREE_BAR}\n`) + `${lines.join('\n')}\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO PULLER* — ${hist.filter(h => h.rarity === 'legendary').length} legends in last 20` : `\n${UI.upsell()}`)
      },{quoted:msg});
    }

    // ── /summon collection ─────────────────────────────────────
    if (sub==='collection'||sub==='weapons'||sub==='artifacts') {
      const weaps = player.summonWeapons?Object.values(player.summonWeapons):[];
      const arts  = player.summonArtifacts||[];
      let txt = pro ? `${UI.PRO_BAR}\n🗃️ *SUMMON COLLECTION* 💎\n${UI.PRO_BAR}` : `🗃️ *SUMMON COLLECTION*\n${UI.FREE_BAR}`;
      if (weaps.length) {
        txt += `\n\n⚔️ *WEAPONS (${weaps.length})*\n`;
        weaps.forEach(w=>{
          const re=BS.RARITY_EMOJI[w.rarity]; const el=BS.ELEMENT_EMOJI[w.element||'none'];
          const eq = player.weapon?.id===w.id?'  ← EQUIPPED':'';
          txt += `${re}${el} *${w.name}* R${w.refinement||1} (+${w.bonus?.atk||0} ATK)${eq}\n`;
          if (w.passive) txt += `   ⚡ *${w.passive.name}* — ${w.passive.desc}\n`;
        });
      }
      if (arts.length) {
        txt += `\n🏺 *ARTIFACTS (${arts.length})*\n`;
        arts.forEach(a=>{
          const re=BS.RARITY_EMOJI[a.rarity];
          txt += `${re} *${a.name}* C${a.constellation||1}\n   ${a.desc}\n`;
        });
      }
      if (!weaps.length&&!arts.length) txt += '\n\n📭 Nothing yet — start pulling!';
      txt += `\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO ARSENAL* — wielding ${player.weapon?.name || 'nothing'}` : `\n${UI.upsell()}`);
      return sock.sendMessage(chatId,{text:txt},{quoted:msg});
    }

    // ── Banner commands ────────────────────────────────────────
    const VALID = ['standard','weapon','limited'];
    if (!VALID.includes(sub)) {
      return sock.sendMessage(chatId,{text:`❌ Unknown banner.\n\nUse /summon to see all banners.\n/summon [standard|weapon|limited] x1`},{quoted:msg});
    }

    const bannerId = sub;
    const banner   = BS.BANNERS[bannerId];
    const state    = getState(player, bannerId);
    const rates    = BS.getBannerRates(bannerId);

    if (bannerId==='limited') {
      const lb = db.activeLimitedBanner;
      if (!lb||Date.now()>lb.expiresAt) return sock.sendMessage(chatId,{text:'❌ No active limited banner right now!\nWatch for special events.'},{quoted:msg});
    }

    // ── /summon [banner] pity ──────────────────────────────────
    if (sub2==='pity'||sub2==='info') {
      const p=state.pity||0, hard=banner.hardPityAt, soft=banner.softPityAt;
      let txt =
        (pro ? `${UI.PRO_BAR}\n${banner.emoji} *${banner.name} — PITY* 💎\n${UI.PRO_BAR}\n\n` : `${banner.emoji} *${banner.name} — PITY*\n${UI.FREE_BAR}\n\n`) +
        `📊 Progress:\n${pityBar(p,hard)}\n\n` +
        `🟣 Soft pity at: *${soft}* pulls (higher epic/leg chance)\n` +
        `🟡 Hard pity at: *${hard}* pulls (legendary guaranteed)\n` +
        `💡 Pity resets ONLY on legendary\n`;
      if (bannerId==='limited') {
        txt += `\n🎰 *50/50 Status:* ${state.guaranteedRateUp?'✅ *Guaranteed rate-up!*':'🎲 Active — 50% chance for rate-up item'}`;
      }
      txt += `\n\n📊 *Actual rates:*\n🔵 Rare: ${rates.rare||'0%'} | 🟣 Epic: ${rates.epic||'0%'} | 🟡 Legendary: ${rates.legendary||'0%'}`;
      txt += `\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO PULLER* — ${Math.max(0, hard - p)} pulls to hard pity` : `\n${UI.upsell()}`);
      return sock.sendMessage(chatId,{text:txt},{quoted:msg});
    }

    // ── Pull ───────────────────────────────────────────────────
    const isMulti  = sub2==='x10'||sub2==='10';
    const isSingle = sub2==='x1'||sub2==='1'||sub2==='single';
    const isTicket = sub2==='ticket'||sub2==='free';

    if (!isSingle&&!isMulti&&!isTicket) {
      return sock.sendMessage(chatId,{
        text:`${banner.emoji} *${banner.name}*\n${banner.desc}\n\n💡 Use:\n/summon ${bannerId} x1  — ${banner.costCrystals}💎\n/summon ${bannerId} x10 — ${banner.cost10Crystals}💎\n/summon ${bannerId} ticket — use Summon Ticket\n/summon ${bannerId} pity — check pity\n\n📊 Rates: 🔵${rates.rare||'0%'} 🟣${rates.epic||'0%'} 🟡${rates.legendary||'0%'}`
      },{quoted:msg});
    }

    // Ticket pull
    if (isTicket) {
      if ((player.summonTickets||0)<1) return sock.sendMessage(chatId,{text:`❌ No Summon Tickets!\n\n🎟️ Earn tickets from Battle Pass (premium track)\nCheck /pass for your progress.`},{quoted:msg});
      player.summonTickets--;
      const item = BS.doPull(bannerId, state);
      if (!item){player.summonTickets++;return sock.sendMessage(chatId,{text:'❌ Pull failed, try again.'},{quoted:msg});}
      const outcome = BS.applyDuplicate(player,item);
      BS.recordPull(player,bannerId,item);
      try{require('../../rpg/utils/BattlePass').addPassXP(player,'summon_pull',1);}catch(e){}
      try{const _QD=require('../../rpg/utils/QuestDispatcher');_QD.trackAndNotify(player,'summon',1,sock,sender,chatId);if(item.rarity==='legendary')_QD.trackAndNotify(player,'legendary',1,sock,sender,chatId);}catch(e){}
      saveDatabase();
      const el=BS.ELEMENT_EMOJI[item.element||'none'];
      const special = item.rarity==='legendary'?legendaryReveal(item,bannerId):item.rarity==='epic'?`\n💫 *EPIC PULL!*\n📖 _${item.lore||''}_`:'' ;
      return sock.sendMessage(chatId,{
        text:(pro ? `${UI.PRO_BAR}\n🎟️ *TICKET SUMMON* 💎\n${UI.PRO_BAR}\n\n` : `🎟️ *TICKET SUMMON*\n${UI.FREE_BAR}\n\n`) + `${buildPullLine(item,outcome,bannerId,1)}${special}\n\n${FRAME}\n🎟️ Tickets left: *${player.summonTickets}* | 🎯 Pity: *${state.pity}/${banner.hardPityAt}*`
      },{quoted:msg});
    }

    const cost  = isMulti?banner.cost10Crystals:banner.costCrystals;
    const count = isMulti?10:1;

    if ((player.manaCrystals||0)<cost) {
      return sock.sendMessage(chatId,{
        text:`❌ Not enough crystals!\nNeed: *${cost}💎* | Have: *${player.manaCrystals||0}💎*\n\n💡 Earn crystals from:\n🏰 Dungeon full clears\n👹 World Boss victories\n📅 Daily streak rewards\n📋 Weekly challenges\n🎖️ Battle Pass levels`
      },{quoted:msg});
    }

    player.manaCrystals-=cost;

    const results=[];
    for(let i=0;i<count;i++){
      const item=BS.doPull(bannerId,state);
      if(!item)continue;
      const outcome=BS.applyDuplicate(player,item);
      BS.recordPull(player,bannerId,item);
      results.push({item,outcome});
    }
    try{require('../../rpg/utils/BattlePass').addPassXP(player,'summon_pull',count);}catch(e){}
    try{require('./weekly').trackWeeklyProgress(player,'summon_pull',count);}catch(e){}
    try{const _QD=require('../../rpg/utils/QuestDispatcher');_QD.trackAndNotify(player,'summon',count,sock,sender,chatId);const _legs=results.filter(r=>r.item.rarity==='legendary').length;if(_legs)_QD.trackAndNotify(player,'legendary',_legs,sock,sender,chatId);}catch(e){}
    saveDatabase();

    // Single pull
    if(isSingle){
      const {item,outcome}=results[0];
      const el=BS.ELEMENT_EMOJI[item.element||'none'];
      let special='';
      if(item.rarity==='legendary') special=legendaryReveal(item,bannerId);
      else if(item.rarity==='epic') special=`\n💫 *EPIC PULL!*\n📖 _${item.lore||''}_\n${item.passive?`⚡ *Passive: ${item.passive.name}*\n   ${item.passive.desc}`:''}`;
      else if(item.lore) special=`\n📖 _${item.lore}_`;
      return sock.sendMessage(chatId,{
        text:(pro ? `${UI.PRO_BAR}\n${banner.emoji} *SUMMON RESULT* 💎\n${UI.PRO_BAR}\n\n` : `${banner.emoji} *SUMMON RESULT*\n${UI.FREE_BAR}\n\n`) + `${buildPullLine(item,outcome,bannerId,1)}${special}\n\n${FRAME}\n💎 Left: *${player.manaCrystals}* | 🎯 Pity: *${state.pity}/${banner.hardPityAt}*`
      },{quoted:msg});
    }

    // 10-pull
    const lines = results.map((r,i)=>buildPullLine(r.item,r.outcome,bannerId,i+1)).join('\n\n');
    const legs  = results.filter(r=>r.item.rarity==='legendary');
    const epics = results.filter(r=>r.item.rarity==='epic');
    let highlight='';
    if(legs.length){
      highlight='\n\n'+legs.map(r=>legendaryReveal(r.item,bannerId)).join('\n');
    } else if(epics.length){
      highlight=`\n\n💫 *${epics.length} EPIC(S) PULLED!*`;
      epics.forEach(r=>{
        if(r.item.passive) highlight+=`\n⚡ ${r.item.name}: *${r.item.passive.name}* — ${r.item.passive.desc}`;
      });
    }
    return sock.sendMessage(chatId,{
      text:(pro ? `${UI.PRO_BAR}\n${banner.emoji} *10-PULL RESULTS* 💎\n${UI.PRO_BAR}\n\n` : `${banner.emoji} *10-PULL RESULTS*\n${UI.FREE_BAR}\n\n`) + `${lines}${highlight}\n\n${FRAME}\n💎 Left: *${player.manaCrystals}* | 🎯 Pity: *${state.pity}/${banner.hardPityAt}*`
    },{quoted:msg});
  }
};