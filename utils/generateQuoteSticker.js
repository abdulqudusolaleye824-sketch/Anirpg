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

function wrapTextSvg(text, maxCharsPerLine = 24) {
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
  const textWrapped = wrapTextSvg(quoteText, 24);

  let fontSize = 28;
  if (quoteText.length > 120) fontSize = 18;
  else if (quoteText.length > 60) fontSize = 22;
  else if (quoteText.length > 30) fontSize = 26;

  const lineHeight = fontSize * 1.35;
  const textYStart = 160;

  const textLinesSvg = textWrapped.map((line, idx) => {
    return `<tspan x="65" y="${textYStart + (idx * lineHeight)}">${escapeXml(line)}</tspan>`;
  }).join('');

  let avatarSvg = '';
  if (avatarBuffer) {
    const base64Av = avatarBuffer.toString('base64');
    avatarSvg = `
      <clipPath id="avatarClip">
        <circle cx="75" cy="65" r="26" />
      </clipPath>
      <image href="data:image/jpeg;base64,${base64Av}" x="49" y="39" width="52" height="52" clip-path="url(#avatarClip)" />
    `;
  } else {
    avatarSvg = `
      <circle cx="75" cy="65" r="26" fill="#58a6ff" opacity="0.3" />
      <text x="75" y="73" font-family="'Noto Sans CJK JP', 'Noto Color Emoji', 'DejaVu Sans', sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">${escapeXml((senderName[0] || 'U').toUpperCase())}</text>
    `;
  }

  const svg = `
  <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        .all-text {
          font-family: 'Noto Sans CJK JP', 'Noto Color Emoji', 'Noto Sans', 'DejaVu Sans', sans-serif;
        }
      </style>
    </defs>
    <!-- Background Card -->
    <rect width="512" height="512" rx="32" fill="#0e0e1a" />
    
    <!-- Accent Bar -->
    <rect x="32" y="32" width="5" height="448" rx="2.5" fill="#58a6ff" />

    <!-- Quote Mark Background -->
    <text class="all-text" x="52" y="110" font-size="140" font-weight="bold" fill="#ffffff" opacity="0.08">“</text>

    <!-- Avatar -->
    ${avatarSvg}

    <!-- Sender Name -->
    <text class="all-text" x="115" y="73" font-size="24" font-weight="bold" fill="#58a6ff">${nameEsc}</text>

    <!-- Divider -->
    <line x1="32" y1="108" x2="480" y2="108" stroke="#58a6ff" stroke-opacity="0.25" stroke-width="1" />

    <!-- Quote Text -->
    <text class="all-text" font-size="${fontSize}" fill="#e6e6eb">
      ${textLinesSvg}
    </text>

    <!-- Footer -->
    <text class="all-text" x="480" y="475" font-size="14" fill="#78788c" text-anchor="end">via QuoteBot ✦</text>
  </svg>
  `;

  const webpBuf = await sharp(Buffer.from(svg)).webp({ quality: 95 }).toBuffer();
  fs.writeFileSync(outputPath, webpBuf);
  return outputPath;
}

module.exports = { generateQuoteSticker };
