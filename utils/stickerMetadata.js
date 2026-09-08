/**
 * stickerMetadata.js
 * Injects WhatsApp sticker metadata into a WebP buffer using node-webpmux.
 * Preserves original image data (static or animated) and adds valid TIFF EXIF.
 */

'use strict';

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

  let isAnimated = false;
  try {
    const webpmux = require('node-webpmux');
    const img = new webpmux.Image();
    await img.load(webpBuf);
    isAnimated = img.hasAnim || false;
  } catch (e) {}

  const jsonObj = {
    'sticker-pack-id':        'com.astra.bot',
    'sticker-pack-name':      name,
    'sticker-pack-publisher': author,
    'emojis':                 ['✨'],
  };

  if (isAnimated) {
    jsonObj['is-animated-sticker'] = 1;
  }

  const jsonBuf = Buffer.from(JSON.stringify(jsonObj), 'utf-8');

  // Exact 22-byte WhatsApp TIFF EXIF Header
  const exifHeader = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, // Little Endian "II", Magic 42
    0x08, 0x00, 0x00, 0x00, // Offset to IFD0 (8)
    0x01, 0x00,             // Tag count = 1
    0x41, 0x57,             // Tag 0x4157 ('WA')
    0x07, 0x00,             // Type UNDEFINED (7)
    0x00, 0x00, 0x00, 0x00, // Offset 14: Placeholder for json length LE
    0x16, 0x00, 0x00, 0x00  // Offset 18: Value offset = 22 bytes LE
  ]);

  exifHeader.writeUInt32LE(jsonBuf.length, 14);

  const exifPayload = Buffer.concat([exifHeader, jsonBuf]);

  try {
    const webpmux = require('node-webpmux');
    const img = new webpmux.Image();
    await img.load(webpBuf);
    img.exif = exifPayload;
    return await img.save(null);
  } catch (err) {
    try {
      const sharp = require('sharp');
      return await sharp(webpBuf, { animated: true })
        .withMetadata({ exif: { raw: exifPayload } })
        .toBuffer();
    } catch (e) {
      return webpBuf;
    }
  }
}

module.exports = {
  injectStickerMetadata,
  writeStickerMetadata: injectStickerMetadata,
  getMetadata: () => null
};
