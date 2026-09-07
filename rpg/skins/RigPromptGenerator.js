/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║             ✦ 𝐀𝐬𝐭𝐫𝐚™ — RigPromptGenerator.js                   ║
 * ║  Generates Midjourney / DALL-E prompts for the base rig      ║
 * ║  animation state spritesheets.                               ║
 * ║                                                              ║
 * ║  Usage:                                                      ║
 * ║    node rpg/skins/RigPromptGenerator.js                      ║
 * ║  Outputs: rig_prompts.json in project root                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { ANIMATION_STATES, FRAME_WIDTH, FRAME_HEIGHT } = require('./RigSpec');

// ── Base rig description ───────────────────────────────────────────────────────
// This is injected into every prompt. It defines what the rig IS.
const RIG_BASE = `
A blank humanoid anime character template figure, gender-neutral, 
no face details or features, pure flat silhouette shape only, 
no colour fill — outline only in thin clean lines,
full body visible from head to toe,
anime proportions: slightly large head, defined torso, long limbs,
figure is centred in frame, slight transparent background,
character height fills approximately 85% of the frame height,
designed as a base rig template that other texture skins will be layered on top of,
NO clothing, NO weapons, NO accessories, NO shading, NO hair detail,
pure anatomy guide lines only, minimal line art,
white/transparent background`.trim().replace(/\n/g, ' ');

// ── Technical spritesheet requirements ────────────────────────────────────────
const SHEET_TECH = (state) => {
  const { frames, fps } = ANIMATION_STATES[state];
  return `
Horizontal spritesheet with exactly ${frames} frames in a single row,
each frame is ${FRAME_WIDTH}x${FRAME_HEIGHT}px (total image: ${frames * FRAME_WIDTH}x${FRAME_HEIGHT}px),
sequential animation frames evenly spaced,
consistent figure size and position across all frames,
clean transparent PNG background,
anime style flat line art`.trim().replace(/\n/g, ' ');
};

// ── Per-state movement descriptions ───────────────────────────────────────────
const STATE_DETAILS = {
  idle: `
Breathing idle animation across ${ANIMATION_STATES.idle.frames} frames.
Frame 1: neutral standing pose, weight on back foot, arms at sides slightly raised.
Frames 2-4: subtle chest expansion (breathing in), shoulders rise slightly.
Frames 5-8: chest returns to neutral (breathing out), minimal movement.
Slight torso lean forward and back. Figure stays centred. Very subtle motion.`,

  walk: `
Full walking cycle across ${ANIMATION_STATES.walk.frames} frames.
Complete stride cycle: right leg forward → left leg forward → repeat.
Arms swing in opposition to legs naturally.
Slight vertical bob (head moves up/down ~4px per step).
Frame 1: neutral start. Frame 4: full right stride. Frame 7: neutral. Frame 10: full left stride. Frames 11-12: return.
Figure always centred horizontally. Walking direction: slight rightward lean.`,

  combat_sword: `
Two-handed sword attack animation across ${ANIMATION_STATES.combat_sword.frames} frames.
Frame 1: guard stance, both hands raised at chest.
Frames 2-3: wind-up, arms draw back overhead.
Frames 4-6: overhead slash forward and down — full body rotation, powerful.
Frame 7: follow-through, blade pointing downward.
Frames 8-10: recovery back to guard stance.
Dynamic, aggressive energy. Full body commitment.`,

  combat_staff: `
Magic staff casting animation across ${ANIMATION_STATES.combat_staff.frames} frames.
Frame 1: staff held upright at side.
Frames 2-3: staff raised overhead, dominant arm extended.
Frames 4-6: energy charge pose — arms spread, slight backward lean, concentration.
Frame 7: release — arms thrust forward dramatically.
Frames 8-10: recovery, staff pulled back to rest position.`,

  combat_bow: `
Archery attack animation across ${ANIMATION_STATES.combat_bow.frames} frames.
Frame 1: bow at side, relaxed.
Frames 2-3: bow raised, left arm extends forward holding bow.
Frames 4-6: right arm draws string back fully, body angled sideways.
Frame 7: full draw — perfect archery form, string at cheek.
Frames 8-9: release — string hand snaps back, arrow flies.
Frame 10: follow-through, bow arm steady.`,

  combat_spear: `
Spear thrust animation across ${ANIMATION_STATES.combat_spear.frames} frames.
Frame 1: spear held at side, two-hand grip.
Frames 2-3: step forward, spear drawn back into coiled thrust position.
Frames 4-6: powerful forward thrust — full body weight behind it, lunging step.
Frame 7: maximum extension, arm fully outstretched.
Frames 8-10: pull back to guard, reset.`,

  combat_axe: `
Heavy axe swing across ${ANIMATION_STATES.combat_axe.frames} frames.
Frame 1: axe resting on shoulder, casual power stance.
Frames 2-3: winding up, both hands grip, axe raised to full overhead.
Frames 4-6: full body rotation — wide horizontal sweep from right to left.
Frame 7: maximum swing momentum, axe at full extension.
Frames 8-10: decelerate, plant stance, recover to idle.`,

  combat_scythe: `
Scythe sweep animation across ${ANIMATION_STATES.combat_scythe.frames} frames.
Frame 1: scythe held diagonally, relaxed threat.
Frames 2-3: wind-up — scythe raised high to left shoulder.
Frames 4-7: wide graceful sweeping arc — high left to low right, full fluid rotation.
Frames 8-9: scythe completes arc, blade pointing downward left.
Frame 10: recovery step back, return to guard.`,

  combat_dagger: `
Fast dagger combo across ${ANIMATION_STATES.combat_dagger.frames} frames.
Frame 1: low crouch, dagger at hip.
Frames 2-3: lunge forward — rapid first stab (right hand).
Frame 4: immediate pull back.
Frames 5-7: second quick slash — wide horizontal cut.
Frames 8-9: recover back, reposition.
Frame 10: ready stance, dagger raised.`,

  equip: `
Gear showcase / equip pose across ${ANIMATION_STATES.equip.frames} frames.
Frame 1: forward-facing, weapon raised to side proudly.
Frames 2-4: weight shifts to back leg, chest puffed, weapon/arms spread slightly.
Frames 5-6: slight lean forward, confident presentation pose.
Frames 7-8: return to clean centred display stance.
Clear full-body visibility. All gear slots visible. Heroic and proud.`,

  victory: `
Victory celebration across ${ANIMATION_STATES.victory.frames} frames.
Frame 1: normal stance.
Frames 2-4: arm/weapon thrusts upward dramatically.
Frames 5-7: full raised-arm victory pose, possibly slight jump.
Frames 8-9: energy/momentum still present, held high.
Frame 10: settle into confident relaxed victory stance.
Triumphant, energetic, satisfying.`,

  damaged: `
Hit reaction animation across ${ANIMATION_STATES.damaged.frames} frames.
Frame 1: normal stance.
Frames 2-3: sudden recoil — body snaps back, one arm flies up defensively.
Frame 4: maximum recoil — stumbled back, off-balance.
Frames 5-6: recovery — regain footing, brace, return to guard.
Quick, reactive, believable physics. Sells the hit.`,
};

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildRigPrompt(state) {
  const detail = STATE_DETAILS[state].trim().replace(/\n/g, ' ');
  const tech   = SHEET_TECH(state);
  const { fps } = ANIMATION_STATES[state];

  return {
    state,
    filename:    `assets/rig/${state}.png`,
    frames:      ANIMATION_STATES[state].frames,
    fps,
    totalWidth:  ANIMATION_STATES[state].frames * FRAME_WIDTH,
    height:      FRAME_HEIGHT,
    prompt: [
      RIG_BASE,
      `\n\nANIMATION: ${detail}`,
      `\n\nTECHNICAL: ${tech}`,
      `\n\nSTYLE NOTES: anime line art, minimal shading, clean edges,`,
      `suitable for game sprite compositing, transparent PNG,`,
      `professional game asset quality`,
    ].join(' ').replace(/\s+/g, ' ').trim(),
    negativePrompt: [
      'colour fill', 'shading', 'gradient', 'face details', 'eyes', 'hair texture',
      'clothing', 'weapons', 'accessories', 'background', 'shadows', 'realistic',
      '3D', 'photograph', 'single frame only', 'text', 'watermark',
      'blurry', 'low quality', 'inconsistent size', 'figure cut off',
    ].join(', '),
    midjourney: `${RIG_BASE} -- ANIMATION: ${detail} -- ${tech} --ar ${ANIMATION_STATES[state].frames * FRAME_WIDTH}:${FRAME_HEIGHT} --style anime --q 2`,
  };
}

// ── Generate all prompts ───────────────────────────────────────────────────────

function generateAllRigPrompts() {
  const prompts = {};
  for (const state of Object.keys(ANIMATION_STATES)) {
    prompts[state] = buildRigPrompt(state);
  }
  return prompts;
}

// ── CLI output ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  const prompts = generateAllRigPrompts();
  const outPath = path.join(__dirname, '..', '..', 'rig_prompts.json');
  fs.writeFileSync(outPath, JSON.stringify(prompts, null, 2), 'utf8');

  console.log('\n╔══════════════════════════════════╗');
  console.log('║   ✦ 𝐀𝐬𝐭𝐫𝐚™ — Rig Prompt Generator  ║');
  console.log('╚══════════════════════════════════╝\n');
  console.log(`Generated ${Object.keys(prompts).length} rig spritesheet prompts.`);
  console.log(`Output: ${outPath}\n`);

  for (const [state, data] of Object.entries(prompts)) {
    console.log(`── ${state.toUpperCase()} ──`);
    console.log(`   Frames: ${data.frames}  |  FPS: ${data.fps}  |  Size: ${data.totalWidth}×${data.height}px`);
    console.log(`   File:   ${data.filename}`);
    console.log(`   Prompt (first 120 chars): ${data.prompt.slice(0, 120)}...`);
    console.log();
  }

  console.log('── HOW TO USE ──');
  console.log('1. Open rig_prompts.json');
  console.log('2. For each state, copy the "prompt" field into your AI image tool');
  console.log('3. Use "negativePrompt" for negative prompt field');
  console.log('4. Save output as the filename shown (e.g. assets/rig/idle.png)');
  console.log('5. Each output must be a HORIZONTAL SPRITESHEET with the exact frame count shown');
  console.log('\nMidjourney users: use the "midjourney" field directly.\n');
}

module.exports = { generateAllRigPrompts, buildRigPrompt };
