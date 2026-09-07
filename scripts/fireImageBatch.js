// Helper: read the queue and print the next N items as a JSON
// manifest that the human (or another script) can pipe to the
// image generation tool in parallel.

'use strict';
const fs = require('fs');
const path = require('path');

const QUEUE_FILE = '/home/user/anirpg_image_queue.json';
const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));

const offset = parseInt(process.argv[2] || '0');
const count  = parseInt(process.argv[3] || '10');

const slice = queue.slice(offset, offset + count);
console.log(JSON.stringify(slice, null, 2));
