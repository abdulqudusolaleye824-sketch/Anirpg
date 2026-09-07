/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║             ✦ 𝐀𝐬𝐭𝐫𝐚™ — GateVideoEngine.js                      ║
 * ║  Builds gate videos using ffmpeg + Sharp compositing.        ║
 * ║                                                              ║
 * ║  Videos produced:                                            ║
 * ║    1. Blue gate spawn    — static gate video sent on spawn   ║
 * ║    2. Red gate morph     — static red gate video on morph    ║
 * ║    3. Party entry video  — walking skins enter the gate      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

const path      = require('path');
const fs        = require('fs');
const os        = require('os');
const ffmpeg    = require('fluent-ffmpeg');
const ffmpegBin = require('ffmpeg-static');
const sharp     = require('sharp');
const { createCanvas, loadImage } = require('canvas');

const { renderPartyFrame, renderFrameSequence } = require('./RigRenderer');
const { buildGearLayerData }                    = require('./GearLayerSystem');
const { getEquippedSkin, initSkinData }         = require('./SkinManager');
const { ANIMATION_STATES, FRAME_WIDTH, FRAME_HEIGHT } = require('./RigSpec');

// Point fluent-ffmpeg at the static binary
ffmpeg.setFfmpegPath(ffmpegBin);

// ── Asset paths ───────────────────────────────────────────────────────────────
const ASSET_ROOT  = path.join(__dirname, '..', '..', 'assets');
const GATE_DIR    = path.join(ASSET_ROOT, 'gates');
const VIDEO_DIR   = path.join(ASSET_ROOT, 'videos');

const BLUE_GATE_VIDEO = path.join(VIDEO_DIR, 'blue_gate.mp4');
const RED_GATE_VIDEO  = path.join(VIDEO_DIR, 'red_gate.mp4');

// ── Party video settings ──────────────────────────────────────────────────────
const PARTY_VIDEO_FPS     = 12;
const PARTY_WALK_FRAMES   = ANIMATION_STATES.walk.frames;   // 12 frames
const PARTY_TOTAL_FRAMES  = 48;   // 4 full walk cycles
const PARTY_VIDEO_QUALITY = 28;   // ffmpeg CRF (lower = better quality)
const MAX_PARTY_MEMBERS   = 6;    // cap to avoid giant videos
const PARTY_FRAME_W       = FRAME_WIDTH;   // 256px per member
const PARTY_FRAME_H       = FRAME_HEIGHT;  // 512px tall

// ── Temp directory helper ────────────────────────────────────────────────────
function makeTempDir(prefix = 'anirpg_gate_') {
  const dir = path.join(os.tmpdir(), `${prefix}${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) { console.warn('[SILENT] GateVideoEngine: temp dir cleanup failed:', e.message); }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STATIC GATE VIDEOS — blue_gate.mp4 / red_gate.mp4
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if the static gate video exists on disk.
 */
function gateVideoExists(type = 'blue') {
  const p = type === 'red' ? RED_GATE_VIDEO : BLUE_GATE_VIDEO;
  return fs.existsSync(p);
}

/**
 * Get the buffer of a static gate video.
 * Returns null if it doesn't exist yet.
 */
function getGateVideoBuffer(type = 'blue') {
  const p = type === 'red' ? RED_GATE_VIDEO : BLUE_GATE_VIDEO;
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PARTY ENTRY VIDEO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a party gate entry video.
 *
 * Shows all party member skins walking side-by-side toward the gate.
 * The gate image is composited in the background.
 *
 * @param {Array}  members    — array of player objects from DB
 * @param {string} gateType   — 'blue' | 'red'
 * @param {string} gateRank   — 'F'|'E'|'D'|'C'|'B'|'A'|'S'|'DISASTER'
 * @returns {Buffer|null}     — MP4 video buffer, or null on failure
 */
async function buildPartyEntryVideo(members, gateType = 'blue', gateRank = 'E') {
  if (!members || members.length === 0) return null;

  const capped   = members.slice(0, MAX_PARTY_MEMBERS);
  const tmpDir   = makeTempDir('gate_entry_');
  const outPath  = path.join(tmpDir, 'party_entry.mp4');

  try {
    // ── Prepare skin data for each member ────────────────────────────────────
    const memberData = capped.map(player => {
      try {
        initSkinData(player);
        return {
          skinData: getEquippedSkin(player),
          gearData: buildGearLayerData(player),
          name:     player.name || 'Hunter',
        };
      } catch (e) {
        return {
          skinData: null,
          gearData: {},
          name:     player.name || 'Hunter',
        };
      }
    });

    const totalW = capped.length * PARTY_FRAME_W;
    const totalH = PARTY_FRAME_H;

    // ── Load gate background frame (if exists) ────────────────────────────────
    const gateBgPath = path.join(GATE_DIR, `${gateType}_gate_frame.png`);
    let   gateBgBuf  = null;
    if (fs.existsSync(gateBgPath)) {
      gateBgBuf = await sharp(gateBgPath)
        .resize(totalW, totalH, { fit: 'cover' })
        .toBuffer();
    }

    // ── Render each frame ─────────────────────────────────────────────────────
    const framePaths = [];

    for (let f = 0; f < PARTY_TOTAL_FRAMES; f++) {
      const walkFrame = f % PARTY_WALK_FRAMES;

      // Build composite frame: gate BG + all member skins walking
      const canvas = createCanvas(totalW, totalH);
      const ctx    = canvas.getContext('2d');

      // Background: gate image or gradient
      if (gateBgBuf) {
        const bgImg = await loadImage(gateBgBuf);
        ctx.drawImage(bgImg, 0, 0, totalW, totalH);
      } else {
        // Fallback gradient — dark blue/purple gate glow
        const grad = ctx.createRadialGradient(
          totalW / 2, totalH / 2, 60,
          totalW / 2, totalH / 2, totalW * 0.7
        );
        if (gateType === 'red') {
          grad.addColorStop(0, '#6b0000');
          grad.addColorStop(0.4, '#3d0000');
          grad.addColorStop(1, '#0d0006');
        } else {
          grad.addColorStop(0, '#00148a');
          grad.addColorStop(0.4, '#000d5c');
          grad.addColorStop(1, '#00040d');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, totalW, totalH);

        // Gate portal glow in centre
        const portalX = totalW / 2;
        const portalY = totalH * 0.3;
        const glow    = ctx.createRadialGradient(portalX, portalY, 10, portalX, portalY, 120);
        if (gateType === 'red') {
          glow.addColorStop(0, 'rgba(255,30,30,0.9)');
          glow.addColorStop(0.3, 'rgba(180,0,0,0.5)');
          glow.addColorStop(1, 'rgba(80,0,0,0)');
        } else {
          glow.addColorStop(0, 'rgba(80,140,255,0.9)');
          glow.addColorStop(0.3, 'rgba(30,80,200,0.5)');
          glow.addColorStop(1, 'rgba(0,10,80,0)');
        }
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, totalW, totalH);

        // Animated gate shimmer line
        const shimmerY = totalH * 0.05 + (f / PARTY_TOTAL_FRAMES) * totalH * 0.5;
        ctx.fillStyle = gateType === 'red'
          ? 'rgba(255,60,60,0.15)'
          : 'rgba(100,160,255,0.15)';
        ctx.fillRect(0, shimmerY, totalW, 2);
      }

      // Draw each member walking
      for (let m = 0; m < memberData.length; m++) {
        const { skinData, gearData } = memberData[m];
        try {
          const frameBuf = await renderPartyFrame([{ skinData, gearData }], walkFrame);
          if (frameBuf) {
            const img = await loadImage(frameBuf);
            ctx.drawImage(img, m * PARTY_FRAME_W, 0, PARTY_FRAME_W, PARTY_FRAME_H);
          }
        } catch (e) {
          // Draw placeholder for failed member
          ctx.fillStyle = `rgba(30,40,80,0.6)`;
          ctx.fillRect(m * PARTY_FRAME_W, 0, PARTY_FRAME_W, PARTY_FRAME_H);
        }
      }

      // Name tags under each member
      ctx.font      = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      for (let m = 0; m < memberData.length; m++) {
        const nameX = m * PARTY_FRAME_W + PARTY_FRAME_W / 2;
        const nameY = totalH - 12;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(m * PARTY_FRAME_W + 4, nameY - 18, PARTY_FRAME_W - 8, 22);
        ctx.fillStyle = gateType === 'red' ? '#ff8080' : '#80c8ff';
        ctx.fillText(memberData[m].name, nameX, nameY);
      }

      // Gate rank badge
      ctx.textAlign = 'left';
      ctx.font      = 'bold 18px sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(8, 8, 120, 30);
      ctx.fillStyle = gateType === 'red' ? '#ff4444' : '#4488ff';
      ctx.fillText(`${gateRank}-Rank Gate`, 14, 28);

      // Save frame as PNG
      const framePath = path.join(tmpDir, `frame_${String(f).padStart(4, '0')}.png`);
      const pngBuf    = canvas.toBuffer('image/png');
      fs.writeFileSync(framePath, pngBuf);
      framePaths.push(framePath);
    }

    // ── Encode frames → MP4 with ffmpeg ──────────────────────────────────────
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(path.join(tmpDir, 'frame_%04d.png'))
        .inputFPS(PARTY_VIDEO_FPS)
        .videoCodec('libx264')
        .outputOptions([
          `-crf ${PARTY_VIDEO_QUALITY}`,
          '-pix_fmt yuv420p',     // WhatsApp MP4 compatibility
          '-movflags +faststart', // streaming-friendly
          '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2', // ensure even dims
        ])
        .output(outPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const videoBuf = fs.readFileSync(outPath);
    return videoBuf;

  } catch (err) {
    console.error('❌ GateVideoEngine: party video build failed:', err.message);
    return null;
  } finally {
    cleanTempDir(tmpDir);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RED GATE MORPH SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

// ── Global red gate state ─────────────────────────────────────────────────────
// Only ONE red gate can exist across the entire game at a time.
// Approximate frequency: once every ~60 days = once per ~8,640,000 game-minutes.
// Per gate entry check: probability = 1 / (gates entered in 60 days)
// We estimate ~200 gate entries per day → 12,000 per 60 days → p ≈ 0.0000833 per entry

const RED_GATE_STATE = {
  active:      false,   // is a red gate currently active globally?
  gateId:      null,    // which gate is the red gate?
  chatId:      null,    // which group?
  morphedAt:   null,    // timestamp
  party:       [],      // JIDs of locked-in party
  lastRedGate: 0,       // timestamp of last red gate (to enforce cooldown)
};

// Minimum 55 days between red gates (in ms)
const RED_GATE_COOLDOWN_MS = 55 * 24 * 60 * 60 * 1000;
// Probability per gate entry (tuned for ~1 per 60 days at normal play rate)
const RED_GATE_PROBABILITY = 0.000083;

/**
 * Roll for a red gate morph.
 * Called each time a party enters a blue gate.
 *
 * @returns {boolean} whether a red gate should trigger
 */
function rollRedGate() {
  if (RED_GATE_STATE.active) return false; // already one active
  const cooldownOk = (Date.now() - RED_GATE_STATE.lastRedGate) >= RED_GATE_COOLDOWN_MS;
  if (!cooldownOk) return false;
  return Math.random() < RED_GATE_PROBABILITY;
}

/**
 * Activate a red gate on an existing gate.
 * Locks the party in and marks the gate as red globally.
 *
 * @param {Object} gate     — gate object from GateManager
 * @param {string} chatId   — group JID
 * @param {string[]} party  — array of player JIDs in the raid
 * @returns {Object} red gate state
 */
function activateRedGate(gate, chatId, party) {
  gate.isRedGate     = true;
  gate.canFlee       = false;
  gate.rewardMult    = 0.5;   // 50% reward penalty
  gate.redGateMorphedAt = Date.now();

  RED_GATE_STATE.active    = true;
  RED_GATE_STATE.gateId    = gate.id;
  RED_GATE_STATE.chatId    = chatId;
  RED_GATE_STATE.morphedAt = Date.now();
  RED_GATE_STATE.party     = [...party];
  RED_GATE_STATE.lastRedGate = Date.now();

  return RED_GATE_STATE;
}

/**
 * Deactivate the global red gate (called on gate clear or wipe).
 */
function deactivateRedGate() {
  RED_GATE_STATE.active   = false;
  RED_GATE_STATE.gateId   = null;
  RED_GATE_STATE.chatId   = null;
  RED_GATE_STATE.morphedAt = null;
  RED_GATE_STATE.party    = [];
}

/**
 * Build the red gate announcement message with invisible member tags.
 * Invisible tags = zero-width space between @ and number,
 * so they're linked but don't produce a notification ping.
 *
 * @param {Object}   gate      — gate object
 * @param {string[]} partyJids — player JIDs in the party
 * @param {Object}   db        — database object (to get player names)
 * @returns {{ text: string, mentions: string[] }}
 */
function buildRedGateAnnouncement(gate, partyJids, db) {
  const mentions = [...partyJids];

  // Build invisible mention tags: @\u200Bnumber (zero-width space breaks the ping)
  const invisibleMentions = partyJids.map(jid => {
    const num  = jid.split('@')[0].split(':')[0];
    const name = db.users?.[jid]?.name || num;
    return `@\u200B${num} _(${name})_`;
  }).join('  ');

  const text = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🔴 *⚠️ RED GATE DETECTED ⚠️*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `The gate has *morphed*.`,
    ``,
    `*Gate ID:* \`${gate.id}\``,
    `*Rank:* ${gate.rank}-Rank *(now RED)*`,
    ``,
    `🔒 *Rules of a Red Gate:*`,
    `• You *cannot flee*. The gate will not open until cleared — or until you fall.`,
    `• Rewards are reduced by *50%*.`,
    `• The gate boss has been *empowered*.`,
    ``,
    `⚠️ *Party locked inside:*`,
    invisibleMentions,
    ``,
    `There is no escape. Clear it — or die trying.`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');

  return { text, mentions };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GATE SPAWN MESSAGE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a rich gate spawn announcement with video attachment data.
 *
 * @param {Object} gate — gate object from GateManager.spawnGate()
 * @returns {{ text: string, videoBuffer: Buffer|null, videoType: string }}
 */
async function buildGateSpawnPayload(gate) {
  const rankEmojis = {
    F:'⬛', E:'⚫', D:'🟤', C:'🔵', B:'🟢', A:'🟡', S:'🔴', DISASTER:'🟣'
  };
  const emoji = rankEmojis[gate.rank] || '⬛';

  const text = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `${emoji} *${gate.rank}-RANK GATE DETECTED*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `A gate has opened in this area.`,
    ``,
    `*Gate ID:* \`${gate.id}\``,
    `*Rank:* ${gate.rank}`,
    `*Floors:* ${gate.rankData.floors}`,
    `*Boss:* ${gate.boss.name}`,
    gate.isFree ? `✅ *Free Gate* — no purchase required` : `🔮 *Cost:* ${gate.rankData.purchasePrice.toLocaleString()} Mana Stones`,
    gate.isDisaster ? `\n⚠️ *DISASTER LEVEL — Must be cleared!*` : '',
    ``,
    `*COMMANDS*`,
    `/gate buy ${gate.id}   — Purchase this gate`,
    `/gate join ${gate.id}  — Apply to raid`,
    `/gate info ${gate.id}  — Gate details`,
    ``,
    `*Time until break:* 2 hours`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].filter(l => l !== '').join('\n');

  // Attach blue gate video if it exists
  const videoBuf = getGateVideoBuffer('blue');

  return { text, videoBuffer: videoBuf, videoType: 'blue' };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Static video helpers
  gateVideoExists,
  getGateVideoBuffer,
  // Party entry video
  buildPartyEntryVideo,
  // Red gate system
  RED_GATE_STATE,
  RED_GATE_PROBABILITY,
  RED_GATE_COOLDOWN_MS,
  rollRedGate,
  activateRedGate,
  deactivateRedGate,
  buildRedGateAnnouncement,
  // Spawn payload
  buildGateSpawnPayload,
};
