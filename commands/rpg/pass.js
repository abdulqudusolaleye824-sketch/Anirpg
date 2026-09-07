// /pass — Battle Pass command (free + premium tracks)
const BP = require('../../rpg/utils/BattlePass');
const SEASON_DAYS = BP.SEASON_DURATION_DAYS || 30;

module.exports = {
  name: 'pass',
  aliases: ['battlepass', 'bp'],
  description: '🎖️ Battle Pass — earn XP, claim rewards, unlock exclusive items',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });

    const sub  = (args[0] || '').toLowerCase();
    const sub2 = (args[1] || '').toLowerCase();
    const bp   = BP.getPassState(player);
    const s    = BP.CURRENT_SEASON;

    // ── ADMIN COMMANDS ─────────────────────────────────────────
    const Mod = require('../../rpg/utils/ModerationUtils');
    const isAdmin = Mod.canModerate(db, sender);

    if (sub === 'admin') {
      if (!isAdmin) return sock.sendMessage(chatId, { text: '❌ Admin only!' }, { quoted: msg });

      // /pass admin grant @user — grant premium pass to a user (they paid IRL)
      if (sub2 === 'grant') {
        const mentionedId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mentionedId) return sock.sendMessage(chatId, { text: '❌ Tag a user: /pass admin grant @user' }, { quoted: msg });
        const target = db.users[mentionedId];
        if (!target) return sock.sendMessage(chatId, { text: '❌ That player is not registered!' }, { quoted: msg });
        const tbp = BP.getPassState(target);
        tbp.premium = true;
        saveDatabase();
        // Notify the player
        try { await sock.sendMessage(mentionedId, { text: `🌟 *PREMIUM PASS GRANTED!*\n\n${s.emoji} *${s.name}*\n\nYou now have access to ALL premium rewards!\nUse /pass to check your progress.\nUse /pass claim to collect rewards!` }); } catch(e) {}
        return sock.sendMessage(chatId, { text: `✅ Premium pass granted to *${target.name}*!` }, { quoted: msg });
      }

      // /pass admin revoke @user
      if (sub2 === 'revoke') {
        const mentionedId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const target = db.users[mentionedId];
        if (!target) return sock.sendMessage(chatId, { text: '❌ Player not found.' }, { quoted: msg });
        const tbp = BP.getPassState(target);
        tbp.premium = false;
        saveDatabase();
        return sock.sendMessage(chatId, { text: `✅ Premium revoked from *${target.name}*.` }, { quoted: msg });
      }

      // /pass admin newseason [number] [name...] — advance to a new season
      if (sub2 === 'newseason' || sub2 === 'season') {
        const seasonNum = parseInt(args[2]);
        const seasonName = args.slice(3).join(' ') || `Season ${seasonNum}`;
        if (isNaN(seasonNum)) return sock.sendMessage(chatId, { text: '❌ Usage: /pass admin newseason [number] [name]' }, { quoted: msg });
        // Update CURRENT_SEASON via db override
        if (!db.seasonOverride) db.seasonOverride = {};
        db.seasonOverride.id   = seasonNum;
        db.seasonOverride.name = `Season ${seasonNum}: ${seasonName}`;
        db.seasonStart = Date.now();
        // Update BattlePass current season at runtime
        BP.CURRENT_SEASON.id   = seasonNum;
        BP.CURRENT_SEASON.name = `Season ${seasonNum}: ${seasonName}`;
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `✅ *New Season started!*\n📅 Season ${seasonNum}: ${seasonName}\n\nAll players will get their pass reset on next /pass use.`
        }, { quoted: msg });
      }

      // /pass admin banner [item_id] [days] — set active limited banner
      if (sub2 === 'banner') {
        const itemId  = args[2];
        const days    = parseInt(args[3]) || 14;
        if (!itemId) return sock.sendMessage(chatId, { text: '❌ Usage: /pass admin banner [item_id] [days]\n\nLimited item IDs: divine_judgment, eclipse_blade, abyssal_scythe, soul_prism, void_heart, void_egg' }, { quoted: msg });
        const BS = require('../../rpg/utils/BannerSystem');
        const item = BS.ITEM_REGISTRY[itemId];
        if (!item || !item.limited) return sock.sendMessage(chatId, { text: `❌ *${itemId}* is not a valid limited item ID.` }, { quoted: msg });
        db.activeLimitedBanner = {
          name:      item.name,
          desc:      item.desc || 'A powerful limited item!',
          itemId,
          rateUpIds: [itemId],
          expiresAt: Date.now() + days * 86400000,
          startedAt: Date.now(),
        };
        // Update limited banner pool to boost the item
        BS.BANNERS.limited.rateUpIds = [itemId];
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `🌟 *Limited Banner set!*\n\n⭐ *${item.name}*\n⏰ Active for *${days} days*\n\nPlayers can pull it with /summon limited x1/x10`
        }, { quoted: msg });
      }

      // /pass admin clearban — close limited banner early
      if (sub2 === 'closebanner') {
        delete db.activeLimitedBanner;
        saveDatabase();
        return sock.sendMessage(chatId, { text: '✅ Limited banner closed.' }, { quoted: msg });
      }

      // Admin menu
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚙️ *PASS ADMIN*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n/pass admin grant @user       — Give premium pass\n/pass admin revoke @user      — Remove premium\n/pass admin newseason [#] [name] — Start new season\n/pass admin banner [item_id] [days] — Set limited banner\n/pass admin closebanner       — End limited banner\n\n📋 *Limited item IDs:*\ndivine_judgment, eclipse_blade, abyssal_scythe\nsoul_prism, void_heart, void_egg\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── /pass buy — buy premium with crystals ──────────────────
    if (sub === 'buy' || sub === 'premium' || sub === 'upgrade') {
      if (bp.premium) return sock.sendMessage(chatId, { text: '✅ You already have the *Premium Pass*! 🌟' }, { quoted: msg });

      // Note: Admin grants premium for free. Mana Stones option is a self-serve alternative.
      if ((player.manaCrystals||0) < s.premiumCost) {
        return sock.sendMessage(chatId, {
          text: `💎 *PREMIUM PASS*\n\n${s.emoji} *${s.name}*\n\nThe premium pass unlocks exclusive rewards on every level including:\n🎟️ Summon Tickets\n🥚 Exclusive Pet Egg (Level 25)\n⚔️ Season Exclusive Weapon (Level 50)\n💎 Extra crystals every level\n🎖️ Exclusive Season Title (Level 1)\n\n*Cost: ${s.premiumCost} 💎*\nYou have: ${player.manaCrystals||0} 💎\n\n💡 Ask an admin if you've paid for premium!`
        }, { quoted: msg });
      }
      player.manaCrystals -= s.premiumCost;
      bp.premium = true;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌟 *PREMIUM PASS ACTIVATED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${s.emoji} *${s.name}*\n\n✅ Premium track unlocked!\nUse /pass claim to collect all your rewards!\n\n🎁 Premium bonuses include:\n🎖️ Title unlocked at Level 1!\n🎟️ Summon Tickets at milestones\n🥚 Exclusive Void Dragon Egg at Level 25\n⚔️ Season Exclusive Weapon at Level 50\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── /pass claim [level] or claim all ──────────────────────
    if (sub === 'claim') {
      const targetLvl = parseInt(args[1]);
      const track = BP.getRewardTrack();

      if (isNaN(targetLvl)) {
        // Claim all available unclaimed
        let totalClaimed = 0;
        const allGained = [];
        for (const row of track) {
          if (row.lvl > bp.level) break;
          if (bp.claimed.includes(row.lvl)) continue;
          const result = BP.claimReward(player, row.lvl);
          if (result.success) { totalClaimed++; allGained.push(...result.gained); }
        }
        if (!totalClaimed) return sock.sendMessage(chatId, {
          text: `❌ Nothing to claim!\n\nEarn Pass XP from:\n⚔️ PvP wins (+${BP.XP_SOURCES.pvp_win})\n🏰 Dungeon clears (+${BP.XP_SOURCES.dungeon_clear})\n📅 Daily claims (+${BP.XP_SOURCES.daily_claim})\n...and more!`
        }, { quoted: msg });
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *PASS REWARDS CLAIMED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✅ Claimed *${totalClaimed}* level(s)!\n\n${allGained.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      const result = BP.claimReward(player, targetLvl);
      if (!result.success) return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });
      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ *Level ${targetLvl} claimed!*\n\n${result.gained.join('\n')}` }, { quoted: msg });
    }

    // ── /pass rewards — full reward track ─────────────────────
    if (sub === 'rewards' || sub === 'track') {
      const track = BP.getRewardTrack();
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${s.emoji} *${s.name}*\n🆓 Free | 💎 Premium\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      const start = Math.max(0, bp.level - 2);
      const shown = track.slice(start, start + 12);
      for (const row of shown) {
        const claimed  = bp.claimed.includes(row.lvl);
        const unlocked = bp.level >= row.lvl;
        const icon  = claimed ? '✅' : unlocked ? '🎁' : '🔒';
        txt += `${icon} *Lv${row.lvl}${row.isMilestone?' ⭐':''}*\n`;
        txt += `  🆓 ${row.free.desc}\n`;
        txt += `  💎 ${row.prem?.desc||'—'} ${bp.premium?'':'*(premium)*'}\n\n`;
      }
      if (start + 12 < track.length) txt += `...and ${track.length - start - 12} more levels\n`;
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/pass claim — collect all available`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /pass xp — show XP sources ────────────────────────────
    if (sub === 'xp' || sub === 'sources') {
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 *PASS XP SOURCES*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      const labels = {
        pvp_win: '⚔️ PvP win', pvp_participate: '🤝 PvP participate',
        dungeon_floor: '🗡️ Dungeon floor', dungeon_clear: '🏰 Dungeon full clear',
        boss_kill: '👹 Boss kill', world_boss: '🌍 World Boss',
        daily_claim: '📅 Daily claim', challenge_done: '📋 Challenge complete',
        casino_win: '🎰 Casino win', summon_pull: '🎲 Summon (per pull)',
      };
      for (const [key, label] of Object.entries(labels)) {
        txt += `${label}: *+${BP.XP_SOURCES[key]||0} XP*\n`;
      }
      txt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 ${BP.XP_PER_LEVEL} XP per level | ${BP.PASS_LEVELS} levels total`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /pass (main overview) ──────────────────────────────────
    const xpToNext = BP.XP_PER_LEVEL;
    const xpPct    = Math.min(100, Math.floor((bp.xp / xpToNext) * 100));
    const xpBar    = '█'.repeat(Math.floor(xpPct/5)) + '░'.repeat(20-Math.floor(xpPct/5));
    const track    = BP.getRewardTrack();
    const unclaimed= track.filter(r => r.lvl <= bp.level && !bp.claimed.includes(r.lvl)).length;
    const seasonStart = db.seasonStart || Date.now();
    const daysLeft = Math.max(0, SEASON_DAYS - Math.floor((Date.now()-seasonStart)/86400000));

    // Next rewards preview
    const nextFree = track.find(r => r.lvl > bp.level)?.free;
    const nextPrem = track.find(r => r.lvl > bp.level)?.prem;

    let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${s.emoji} *${s.name}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `⭐ *Level ${bp.level}/${BP.PASS_LEVELS}*\n`;
    txt += `[${xpBar}] ${bp.xp}/${xpToNext} XP\n\n`;
    txt += `${bp.premium ? '💎 *PREMIUM PASS ✅*' : `🆓 Free Pass — /pass buy for Premium (${s.premiumCost}💎)`}\n`;
    if (unclaimed) txt += `\n🎁 *${unclaimed} reward(s) ready!* → /pass claim\n`;
    if (nextFree) txt += `\n📦 *Next reward (Lv${bp.level+1}):*\n  🆓 ${nextFree.desc}\n  💎 ${nextPrem?.desc||'—'}${bp.premium?'':' *(premium)*'}\n`;
    txt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⏰ Season ends in: *~${daysLeft} days*\n\n`;
    txt += `/pass rewards  — full reward track\n/pass claim    — collect rewards\n/pass xp       — XP sources\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
  }
};
