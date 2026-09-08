/**
 * stickerMetadata.js
 * Injects WhatsApp sticker metadata into a WebP buffer using node-webpmux.
 * Preserves original image data (static or animated) and adds valid TIFF EXIF.
 */

'use strict';

const webpmux = require('node-webpmux');

/**
 * @param {Buffer} webpBuf    - Original WebP buffer
 * @param {string} packName   - Sticker pack name (default: ✦ 𝐀𝐬𝐭𝐫𝐚™)
 * @param {string} packAuthor - Sticker pack author/owner
 * @returns {Promise<Buffer>} - WebP buffer with metadata injected
 */
async function injectStickerMetadata(webpBuf, packName, packAuthor) {
  if (!webpBuf || !Buffer.isBuffer(webpBuf)) throw new Error('Invalid WebP buffer');

  const name = packName || '✦ 𝐀𝐬𝐭𝐫𝐚™';
  const author = packAuthor || 'Senku';

  const json = JSON.stringify({
    'sticker-pack-id':        'com.astra.bot',
    'sticker-pack-name':      name,
    'sticker-pack-publisher': author,
    'emojis':                 ['✨'],
  });

  const jsonBuf = Buffer.from(json, 'utf-8');
  const exifHeader = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00
  ]);
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32LE(jsonBuf.length, 0);
  const offsetBuf = Buffer.from([0x16, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

  const exifPayload = Buffer.concat([
    Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]),
    exifHeader,
    lengthBuf,
    offsetBuf,
    jsonBuf
  ]);

  try {
    const img = new webpmux.Image();
    await img.load(webpBuf);
    img.exif = exifPayload;
    return await img.save(null);
  } catch (err) {
    console.error('webpmux error, returning original buffer:', err.message);
    return webpBuf;
  }
}

module.exports = {
  injectStickerMetadata,
  writeStickerMetadata: injectStickerMetadata,
  getMetadata: () => null
};
