#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Continue image generation in a future session.
//
// Usage:
//   1. Open a fresh conversation
//   2. Ask the assistant to run: node scripts/continueImageGen.js 10
//      (where 10 is the batch size — keep ≤ 10 per session)
//   3. The script will print the next N prompts as a JSON manifest
//   4. The assistant fires them in parallel via generate_image
//   5. The script auto-updates the queue (removes generated paths)
//   6. Repeat
//
// This script is the durable artifact of this session. The full
// inventory is in /home/user/anirpg_inventory.json, the queue
// is in /home/user/anirpg_image_queue.json, and the prompts
// regenerate from the inventory each time you want a fresh batch.
// ═══════════════════════════════════════════════════════════════

'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = '/home/user/project/anirpg';
const INVENTORY = '/home/user/anirpg_inventory.json';
const QUEUE = '/home/user/anirpg_image_queue.json';

const batchSize = parseInt(process.argv[2] || '10');

// Always rebuild the queue from inventory — that way the queue
// is always fresh and reflects what's actually missing.
console.log('🔄 Rebuilding queue from inventory…');
execSync(`node ${path.join(ROOT, 'scripts/buildImageQueue.js')}`, { stdio: 'inherit' });

const queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
console.log();
console.log(`📦 Queue size: ${queue.length} images to generate`);
console.log(`🎨 Firing next batch of ${batchSize}:`);
console.log();

const slice = queue.slice(0, batchSize);
slice.forEach((q, i) => {
  const rel = q.path.replace(ROOT + '/', '');
  console.log(`[${i}] ${rel}`);
  console.log(`    ${q.prompt}`);
  console.log();
});

console.log('─'.repeat(60));
console.log();
console.log('📋 To fire this batch, copy each [N] (path + prompt) into a generate_image call.');
console.log('   After all 10 succeed, the queue will be updated next time you run this script.');
console.log();
console.log('💡 Tip: you can filter the queue by kind. Example:');
console.log('   node scripts/buildImageQueue.js  → builds the queue');
console.log('   jq \'[.[] | select(.kind=="monster")]\' ' + QUEUE + '  → only monsters');
