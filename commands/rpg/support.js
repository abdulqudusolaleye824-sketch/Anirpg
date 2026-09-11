// support.js — Sends user all --main community group links via DM with URL Buttons (no messy links)
// (Excludes Mods GC; DM is delivered by the user's assigned Serf bot)

const fs = require('fs');
const path = require('path');
const COOLDOWN = 5 * 60 * 1000; // 5 minutes
const supportCooldown = new Map();
const AstralGroups = require('../../rpg/utils/AstralGroups');
const SerfDM = require('../../rpg/utils/SerfDM');
const MultiSocketManager = require('../../bots/MultiSocketManager');
const ButtonHelper = (()=>{ try { return require('../../utils/buttonHelper'); } catch(e){ return null; } })();
const UI = require('../../rpg/utils/UI');

function getAstraSupportImage(){
  const candidates = [
    path.join(__dirname, '../../assets/profile_default.jpg'),
    path.join(process.cwd(), 'assets/profile_default.jpg'),
    path.join(__dirname, '../../assets/help_banner.jpg'),
    path.join(process.cwd(), 'assets/help_banner.jpg'),
  ];
  for(const p of candidates){
    try{
      if(fs.existsSync(p)) return fs.readFileSync(p);
    } catch{}
  }
  return null;
}

module.exports = {
  name: 'support',
  description: '📩 Get main community group links in your DM',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const config = require('../../config.json');

    // Cooldown check
    const now = Date.now();
    const last = supportCooldown.get(sender) || 0;
    if (now - last < COOLDOWN) {
      const left = Math.ceil((COOLDOWN - (now - last)) / 60000);
      return sock.sendMessage(chatId, {
        text: `⏳ Wait ${left} more minute(s) before using /support again.`
      }, { quoted: msg });
    }
    supportCooldown.set(sender, now);

    // /support owner — notify owner directly
    if (args[0]?.toLowerCase() === 'owner') {
      const ownerId = config.ownerNumber;
      await sock.sendMessage(chatId, { text: '📩 Your message has been forwarded to the Owner.' }, { quoted: msg });
      if (ownerId) {
        await sock.sendMessage(ownerId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━\n📩 SUPPORT REQUEST\n━━━━━━━━━━━━━━━━━━━━━━━\n👤 User: @${sender.split('@')[0]}\n💬 From: ${chatId}\n⏰ ${new Date().toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [sender]
        });
      }
      return;
    }

    // Get all --main tagged groups excluding mods GC.
    // Display = the ACTUAL registered GC name (entry.groupName), NEVER the
    // type tag — this fixes "Support" rendering as "Arise" and vice versa.
    const allMain = AstralGroups.getAll(db).filter(g => g.isMain && g.type !== 'mods');

    const groupLinesText = [];
    const buttonGroups = [];
    for (const g of allMain) {
      const info = AstralGroups.typeInfo(g.type);
      const displayName = g.groupName || info.name || g.type;
      groupLinesText.push(`${info.emoji} *${displayName}*`);
      if (g.inviteLink) {
        buttonGroups.push({
          inviteLink: g.inviteLink,
          groupName: displayName,
          typeInfo: info,
        });
      }
    }

    if (groupLinesText.length === 0) {
      const supportLink = AstralGroups.getSupportLink(db);
      if (supportLink) {
        groupLinesText.push(`🛡️ *✦ 𝐀𝐬𝐭𝐫𝐚™ Arise Support*`);
        buttonGroups.push({
          inviteLink: supportLink,
          groupName: 'Arise Support',
          typeInfo: { emoji: '🛡️', name: 'Arise Support' }
        });
      }
    }

    // Names only — invite links ride on the URL buttons below (raw links are kept
    // ONLY as a last-resort fallback when button delivery throws).
    const dmPro = UI.isPro(db.users?.[sender]);
    const fullDmText = [
      ...(dmPro ? [UI.PRO_BAR, `🛡️ *ASTRA SUPPORT GROUPS* 💎`, UI.PRO_BAR] : [`🛡️ *ASTRA SUPPORT GROUPS*`, UI.FREE_BAR]),
      `Tap a group below to join.`,
      ``,
      ...(groupLinesText.length ? groupLinesText : ['⚠️ No main community groups configured yet. Ask the owner to set them using `/setgroup <type> --main`.']),
      ``,
      dmPro ? UI.PRO_BAR : UI.FREE_BAR,
    ].join('\n');
    const supportImage = getAstraSupportImage();

    // URL buttons: EVERY --main GC gets a NAME+LINK button (chunked 3 per
    // message by the helper — nothing is cut off at 3 anymore).
    let supportButtons = null;
    try {
      if (ButtonHelper?.buildSupportButtons && buttonGroups.length) {
        supportButtons = ButtonHelper.buildSupportButtons(buttonGroups);
      }
    } catch {}

    const dmPayload = supportImage
      ? { image: supportImage, caption: fullDmText, mimetype: 'image/jpeg', footer: 'Astra™ 2026' }
      : { text: fullDmText, footer: 'Astra™ 2026' };
    const linksText = buttonGroups.length ? '\n\n' + buttonGroups.map(g => `🔗 ${g.groupName}: ${g.inviteLink}`).join('\n') : '';
    const fallbackWithLinks = supportImage
      ? { image: supportImage, caption: fullDmText + linksText, mimetype: 'image/jpeg' }
      : { text: fullDmText + linksText };

    // ── Deliver via serf, THEN report the real result ──────────────────
    const serfRes = SerfDM.getSerfSocket(db, sender);
    let dmRes;
    if (!serfRes.ok) {
      dmRes = { ok: false, reason: serfRes.reason, detail: serfRes.detail };
    } else if (supportButtons && supportButtons.length && ButtonHelper?.sendWithButtons) {
      try {
        await ButtonHelper.sendWithButtons(serfRes.serfSock, sender, dmPayload, supportButtons, null);
        dmRes = { ok: true, via: 'serf' };
      } catch (e) {
        dmRes = await SerfDM.sendSerfDM(sock, db, sender, fallbackWithLinks);
      }
    } else {
      dmRes = await SerfDM.sendSerfDM(sock, db, sender, fallbackWithLinks);
    }

    // Notify in group chat (no links) — with the honest delivery result.
    if (chatId.endsWith('@g.us')) {
      await sock.sendMessage(chatId, {
        text: `@${sender.split('@')[0]}\n` + SerfDM.resultNotice('📩 SUPPORT LINKS', dmRes),
        mentions: [sender]
      }, { quoted: msg });
    } else if (!dmRes.ok) {
      await sock.sendMessage(chatId, {
        text: SerfDM.resultNotice('📩 SUPPORT LINKS', dmRes) + `\n\n${linksText.trim()}`,
      }, { quoted: msg });
    }

    // Silent owner log
    try {
      const ownerId = config.ownerNumber;
      if (ownerId) {
        await sock.sendMessage(ownerId, {
          text: `📊 /support used by @${sender.split('@')[0]}`,
          mentions: [sender]
        });
      }
    } catch(e) {}
  }
};
