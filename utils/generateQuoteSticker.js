'use strict';

const sharp = require('sharp');
const fs    = require('fs');

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapTextSvg(text, maxCharsPerLine = 14) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      if (word.length > maxCharsPerLine) {
        let sub = '';
        for (const ch of word) {
          if ((sub + ch).length <= maxCharsPerLine) {
            sub += ch;
          } else {
            lines.push(sub);
            sub = ch;
          }
        }
        currentLine = sub;
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

async function generateQuoteSticker(senderName, quoteText, outputPath, avatarPath) {
  let avatarBuffer = null;
  if (avatarPath && fs.existsSync(avatarPath)) {
    try {
      avatarBuffer = fs.readFileSync(avatarPath);
    } catch (e) {
      avatarBuffer = null;
    }
  }

  const nameEsc = escapeXml(senderName);

  let fontSize = 52;
  let maxChars = 14;
  if (quoteText.length > 150) { fontSize = 18; maxChars = 30; }
  else if (quoteText.length > 80) { fontSize = 22; maxChars = 26; }
  else if (quoteText.length > 35) { fontSize = 28; maxChars = 22; }
  else if (quoteText.length > 15) { fontSize = 38; maxChars = 18; }

  const textWrapped = wrapTextSvg(quoteText, maxChars);
  const lineHeight = fontSize * 1.35;

  const totalTextHeight = textWrapped.length * lineHeight;
  const bodyTop = 130;
  const bodyBottom = 450;
  const availableH = bodyBottom - bodyTop;
  const startY = Math.max(140, bodyTop + (availableH - totalTextHeight) / 2 + fontSize * 0.8);

  const textLinesSvg = textWrapped.map((line, idx) => {
    return `<tspan x="256" y="${startY + (idx * lineHeight)}" text-anchor="middle" font-weight="bold" fill="#f8fafc">${escapeXml(line)}</tspan>`;
  }).join('');

  let avatarSvg = '';
  if (avatarBuffer) {
    const base64Av = avatarBuffer.toString('base64');
    avatarSvg = `
      <clipPath id="avatarClip">
        <circle cx="65" cy="65" r="28" />
      </clipPath>
      <image href="data:image/jpeg;base64,${base64Av}" x="37" y="37" width="56" height="52" clip-path="url(#avatarClip)" />
    `;
  } else {
    avatarSvg = `
      <circle cx="65" cy="65" r="28" fill="#38bdf8" opacity="0.3" />
      <text x="65" y="73" font-family="'Noto Sans CJK JP', 'Noto Color Emoji', sans-serif" font-size="24" font-weight="bold" fill="#f8fafc" text-anchor="middle">${escapeXml((senderName[0] || 'U').toUpperCase())}</text>
    `;
  }

  const svg = `
  <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a081a" />
        <stop offset="50%" stop-color="#120a24" />
        <stop offset="100%" stop-color="#1a0818" />
      </linearGradient>
      <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8" />
        <stop offset="50%" stop-color="#818cf8" />
        <stop offset="100%" stop-color="#ef4444" />
      </linearGradient>
      <linearGradient id="nameGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#38bdf8" />
        <stop offset="100%" stop-color="#f43f5e" />
      </linearGradient>
      <style>
        .all-text {
          font-family: 'Noto Sans CJK JP', 'Noto Color Emoji', 'Noto Sans', 'DejaVu Sans', sans-serif;
        }
      </style>
    </defs>
    <!-- Background Card -->
    <rect width="512" height="512" rx="32" fill="url(#cardBg)" stroke="#ef4444" stroke-opacity="0.15" stroke-width="2" />
    
    <!-- Left Accent Gradient Bar -->
    <rect x="24" y="28" width="6" height="456" rx="3" fill="url(#barGrad)" />

    <!-- Top Left Quote Mark -->
    <text class="all-text" x="42" y="120" font-size="130" font-weight="bold" fill="#ef4444" opacity="0.12">“</text>

    <!-- Bottom Right Quote Mark -->
    <text class="all-text" x="470" y="460" font-size="130" font-weight="bold" fill="#38bdf8" opacity="0.12" text-anchor="end">”</text>

    <!-- Avatar -->
    ${avatarSvg}

    <!-- Sender Name -->
    <text class="all-text" x="108" y="73" font-size="24" font-weight="bold" fill="url(#nameGrad)">${nameEsc}</text>

    <!-- Divider Line -->
    <line x1="24" y1="110" x2="488" y2="110" stroke="url(#nameGrad)" stroke-opacity="0.3" stroke-width="1.5" />

    <!-- Centered Bold Quote Text -->
    <text class="all-text" font-size="${fontSize}" font-weight="bold" fill="#f8fafc">
      ${textLinesSvg}
    </text>

    <!-- Footer -->
    <text class="all-text" x="480" y="482" font-size="13" fill="#94a3b8" text-anchor="end">quotly by ✦ 𝐀𝐬𝐭𝐫𝐚™</text>
  </svg>
  `;

  const webpBuf = await sharp(Buffer.from(svg)).webp({ quality: 95 }).toBuffer();
  fs.writeFileSync(outputPath, webpBuf);
  return outputPath;
}

module.exports = { generateQuoteSticker };
