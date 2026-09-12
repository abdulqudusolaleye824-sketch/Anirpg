// ═══════════════════════════════════════════════════════════════
// STEAL COMMAND — Sticker Theft & Rebranding
// Reply to a sticker or image with /steal or /s to steal it into your own pack.
// Default: Pack Name: ✦ 𝐀𝐬𝐭𝐫𝐚™ | Author: owner/user name
// Custom: /steal My Pack | My Author  or /s My Pack | My Author
// ═══════════════════════════════════════════════════════════════

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { injectStickerMetadata } = require('../../utils/stickerMetadata');
let sharp; try { sharp = require('sharp'); } catch(e) { sharp = null; }

const cooldowns = new Map();
const UI = require('../../rpg/utils/UI');

// ── Sticker packs: durable per-user storage (base64 webp, capped) ──
const MAX_PACKS = 5, MAX_PER_PACK = 15, MAX_STICKER_BYTES = 1_000_000;
function getPacks(player) {
  if (!player.stickerPacks || typeof player.stickerPacks !== 'object') player.stickerPacks = {};
  return player.stickerPacks;
}

async function handlePackSubcommand(sock, chatId, msg, sender, db, saveDatabase, rawText, subWord) {
  const player = db?.users?.[sender];
  if (!player) return sock.sendMessage(chatId, { text: '❌ You are not registered! Use /register' }, { quoted: msg });
  const packs = getPacks(player);
  const names = Object.keys(packs);
  const sPro = UI.isPro(player);
  const sFRAME = sPro ? UI.PRO_BAR : UI.FREE_BAR;
  if (subWord === 'packs' || subWord === 'list') {
    if (!names.length) return sock.sendMessage(chatId, { text: '📦 You have no sticker packs yet!\n\nReply to any sticker with */s* to start your first pack.' }, { quoted: msg });
    const lines = names.map((n, i) => `  ${i + 1}. *${n}* — ${packs[n].stickers.length}/${MAX_PER_PACK} stickers`);
    const totalStk = names.reduce((s, n) => s + (packs[n].stickers?.length || 0), 0);
    return sock.sendMessage(chatId, { text: `📦 *YOUR STICKER PACKS (${names.length}/${MAX_PACKS})*${sPro ? ' 💎' : ''}\n${sFRAME}\n${lines.join('\n')}\n${sFRAME}\n💡 /s pack <name> — resend a pack` + (sPro ? `\n${UI.PRO_MINI}\n💎 *PRO HOARD* — ${totalStk} stickers banked` : `\n${UI.upsell()}`) }, { quoted: msg });
  }
  if (subWord === 'pack') {
    const want = rawText.slice(4).trim().toLowerCase();
    const key = names.find(n => n.toLowerCase() === want);
    if (!key) return sock.sendMessage(chatId, { text: `❌ No pack named *${rawText.slice(4).trim() || '?'}*.\n\nSee your packs: */s packs*` }, { quoted: msg });
    for (const b64 of packs[key].stickers) {
      await sock.sendMessage(chatId, { sticker: Buffer.from(b64, 'base64') }, { quoted: msg });
    }
    return;
  }
  // delete / del / remove <pack> [n] — exact pack-name match wins over trailing-number index
  const rest = rawText.split(/\s+/).slice(1).join(' ').trim();
  const fullKey = names.find(n => n.toLowerCase() === rest.toLowerCase());
  const m = rest.match(/^(.*?)\s*(\d+)?$/);
  const want = (m[1] || '').trim().toLowerCase();
  const idx = m[2] ? parseInt(m[2]) : null;
  const key = names.find(n => n.toLowerCase() === want);
  if (fullKey && (idx == null || idx < 1 || idx > packs[fullKey].stickers.length)) {
    delete packs[fullKey];
    saveDatabase();
    return sock.sendMessage(chatId, { text: `🗑️ Pack *${fullKey}* deleted.` }, { quoted: msg });
  }
  if (!key) return sock.sendMessage(chatId, { text: `❌ No pack named *${want || '?'}*.\n\nUsage: */s delete <pack> [number]*` }, { quoted: msg });
  if (idx == null) {
    delete packs[key];
    saveDatabase();
    return sock.sendMessage(chatId, { text: `🗑️ Pack *${key}* deleted.` }, { quoted: msg });
  }
  if (idx < 1 || idx > packs[key].stickers.length) return sock.sendMessage(chatId, { text: `❌ Sticker #${idx} doesn't exist in *${key}* (1–${packs[key].stickers.length}).` }, { quoted: msg });
  packs[key].stickers.splice(idx - 1, 1);
  saveDatabase();
  return sock.sendMessage(chatId, { text: `🗑️ Sticker #${idx} removed from *${key}* (${packs[key].stickers.length} left).` }, { quoted: msg });
}

function extractContextAndQuoted(msg) {
  if (!msg || !msg.message) return { contextInfo: null, quoted: null };

  const message = msg.message;
  const contextInfo =
    message.extendedTextMessage?.contextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo ||
    message.stickerMessage?.contextInfo ||
    message.templateButtonReplyMessage?.contextInfo ||
    message.buttonsResponseMessage?.contextInfo ||
    message.interactiveResponseMessage?.contextInfo ||
    message.ephemeralMessage?.message?.extendedTextMessage?.contextInfo ||
    message.viewOnceMessage?.message?.imageMessage?.contextInfo ||
    message.viewOnceMessageV2?.message?.imageMessage?.contextInfo;

  if (!contextInfo || !contextInfo.quotedMessage) {
    return { contextInfo: null, quoted: null };
  }

  let quoted = contextInfo.quotedMessage;
  while (quoted) {
    if (quoted.ephemeralMessage?.message) quoted = quoted.ephemeralMessage.message;
    else if (quoted.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;
    else if (quoted.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;
    else if (quoted.documentWithCaptionMessage?.message) quoted = quoted.documentWithCaptionMessage.message;
    else break;
  }

  return { contextInfo, quoted };
}

module.exports = {
  name: 'steal',
  aliases: ['s', 'ssteal', 'stickersteal', 'stealsticker'],
  description: 'Reply to a sticker or image with /steal [pack | author] or /s [pack | author] to steal it.',
  usage: '/steal [pack | author] — /s packs | /s pack <name> | /s delete <pack> [n]',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    const now = Date.now();
    const last = cooldowns.get(sender) || 0;
    if (now - last < 3000) {
      const remaining = Math.ceil((3000 - (now - last)) / 1000);
      return sock.sendMessage(chatId, {
        text: `⏳ Wait *${remaining}s* before stealing another sticker.`
      }, { quoted: msg });
    }

    const { contextInfo, quoted } = extractContextAndQuoted(msg);
    const db = getDatabase();
    const ownerName = db?.users?.[sender]?.name || msg.pushName || 'Senku';
    const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || '')
      .replace(/^\/(steal|ssteal|stickersteal|stealsticker|s)\s*/i, '')
      .trim();
    const stickerMsg = quoted?.stickerMessage;
    const imageMsg   = quoted?.imageMessage || msg.message?.imageMessage;
    const videoMsg   = quoted?.videoMessage || msg.message?.videoMessage;

    // ── Pack management subcommands (no reply needed; WITH a reply these words are just pack names) ──
    const hasMedia = !!(quoted || imageMsg || videoMsg);
    const subWord = (rawText.split(/\s+/)[0] || '').toLowerCase();
    if (!hasMedia && ['packs', 'list', 'pack', 'delete', 'del', 'remove'].includes(subWord)) {
      return handlePackSubcommand(sock, chatId, msg, sender, db, saveDatabase, rawText, subWord);
    }

    if (!hasMedia) {
      const stPlayer = db?.users?.[sender];
      const text = UI.card(stPlayer || {}, {
        icon: '📌', title: 'STEAL A STICKER',
        lines: [
          `Reply to a *sticker, image, or GIF/video* with */steal* or */s*`,
          ``,
          `Usage: */s My Pack | My Author*`,
          ``,
          `📦 *PACKS:*`,
          `• /s packs — list your packs`,
          `• /s pack <name> — resend a whole pack`,
          `• /s delete <pack> [n] — delete a pack or sticker #n`,
          ``,
          `*(To steal Nexus from a player, use /rob @user)*`,
        ],
        proLines: (() => { try { const n = Object.keys(getPacks(stPlayer)).length; return [`💎 *PRO HOARD* — ${n}/${MAX_PACKS} packs`]; } catch (e) { return []; } })(),
        tip: 'packs survive — your hoard is safe',
      });
      return sock.sendMessage(chatId, { text }, { quoted: msg });
    }

    let packName = '✦ 𝐀𝐬𝐭𝐫𝐚™';
    let author   = ownerName;

    if (rawText) {
      if (rawText.includes('|')) {
        const parts = rawText.split('|').map(p => p.trim());
        packName = parts[0] || '✦ 𝐀𝐬𝐭𝐫𝐚™';
        author   = parts[1] || ownerName;
      } else {
        packName = rawText;
        author   = ownerName;
      }
    }

    try {
      cooldowns.set(sender, now);

      let buffer = null;

      if (stickerMsg) {
        const mediaMsg = {
          message: quoted,
          key: {
            remoteJid: chatId,
            id: contextInfo?.stanzaId,
            participant: contextInfo?.participant
          }
        };
        buffer = await downloadMediaMessage(mediaMsg, 'buffer', {});
      } else if (imageMsg || videoMsg) {
        const targetNode = imageMsg ? imageMsg : videoMsg;
        const mediaMsg = quoted ? {
          message: quoted,
          key: {
            remoteJid: chatId,
            id: contextInfo?.stanzaId,
            participant: contextInfo?.participant
          }
        } : msg;

        const mediaBuf = await downloadMediaMessage(mediaMsg, 'buffer', {});
        if (mediaBuf && sharp) {
          try {
            buffer = await sharp(mediaBuf, { animated: !!videoMsg })
              .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
              .webp({ quality: 90 })
              .toBuffer();
          } catch(e) {
            buffer = mediaBuf;
          }
        } else {
          buffer = mediaBuf;
        }
      }

      if (!buffer || buffer.length === 0) {
        return sock.sendMessage(chatId, {
          text: '❌ Couldn\'t download that media. It may have expired.'
        }, { quoted: msg });
      }

      const rebrandedWebp = await injectStickerMetadata(buffer, packName, author);

      let isAnim = false;
      try {
        const webpmux = require('node-webpmux');
        const img = new webpmux.Image();
        await img.load(rebrandedWebp);
        isAnim = img.hasAnim || false;
      } catch (e) {}

      await sock.sendMessage(chatId, {
        sticker: rebrandedWebp,
        isAnimated: isAnim
      }, { quoted: msg });

      // ── Save into the named pack (durable, capped — never breaks the steal) ──
      try {
        const _pl = db?.users?.[sender];
        if (_pl && rebrandedWebp.length <= MAX_STICKER_BYTES) {
          const _packs = getPacks(_pl);
          if (!_packs[packName] && Object.keys(_packs).length >= MAX_PACKS) {
            await sock.sendMessage(chatId, { text: `⚠️ Pack limit reached (${MAX_PACKS})! Sticker sent but not saved.\nDelete one: */s delete <pack>*` }, { quoted: msg });
          } else {
            if (!_packs[packName]) _packs[packName] = { author, stickers: [], updatedAt: Date.now() };
            if (_packs[packName].stickers.length >= MAX_PER_PACK) {
              await sock.sendMessage(chatId, { text: `⚠️ Pack *${packName}* is full (${MAX_PER_PACK})! Sticker sent but not saved.` }, { quoted: msg });
            } else {
              _packs[packName].stickers.push(rebrandedWebp.toString('base64'));
              _packs[packName].author = author;
              _packs[packName].updatedAt = Date.now();
              saveDatabase();
              await sock.sendMessage(chatId, { text: `✅ Saved to pack *${packName}* (${_packs[packName].stickers.length}/${MAX_PER_PACK}).` }, { quoted: msg });
            }
          }
        } else if (_pl) {
          await sock.sendMessage(chatId, { text: `⚠️ Sticker too large to save (>1MB) — sent but not stored.` }, { quoted: msg });
        }
      } catch (e) { /* saving must never break the steal */ }

    } catch (err) {
      console.error('steal sticker error:', err.message);
      await sock.sendMessage(chatId, {
        text: `❌ Error stealing sticker: ${err.message}`
      }, { quoted: msg });
    }
  }
};

// Shared with retrieve.js (view-once saver) — same unwrap logic, no duplication.
module.exports.extractContextAndQuoted = extractContextAndQuoted;

// /bypass hook: drop this module's in-memory cooldown for one user.
// Returns true when something was actually cleared.
function resetCooldownsFor(jid) {
  try { return cooldowns.delete(jid) === true; } catch (e) { return false; }
}
module.exports.resetCooldownsFor = resetCooldownsFor;
