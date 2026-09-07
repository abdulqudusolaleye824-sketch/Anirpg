// Wrapper: calls the Python sticker generator
const { execFile } = require('child_process');
const path = require('path');

const PY_SCRIPT = path.join(__dirname, 'generateQuoteSticker.py');

async function generateQuoteSticker(senderName, quoteText, outputPath) {
  return new Promise((resolve, reject) => {
    execFile('python3', [PY_SCRIPT, senderName, quoteText, outputPath], { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      if (!stdout.includes('OK:')) return reject(new Error('Python did not confirm success: ' + stdout));
      resolve(outputPath);
    });
  });
}

module.exports = { generateQuoteSticker };
