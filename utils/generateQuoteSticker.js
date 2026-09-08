// Wrapper: calls the Python sticker generator
const { execFile } = require('child_process');
const path = require('path');

const PY_SCRIPT = path.join(__dirname, 'generateQuoteSticker.py');

async function generateQuoteSticker(senderName, quoteText, outputPath, avatarPath) {
  return new Promise((resolve, reject) => {
    const args = [PY_SCRIPT, senderName, quoteText, outputPath];
    if (avatarPath) args.push(avatarPath);
    execFile('python3', args, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      if (!stdout.includes('OK:')) return reject(new Error('Python did not confirm success: ' + stdout));
      resolve(outputPath);
    });
  });
}

module.exports = { generateQuoteSticker };
