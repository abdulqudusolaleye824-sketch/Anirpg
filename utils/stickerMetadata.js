/**
 * stickerMetadata.js
 * Injects WhatsApp sticker metadata into a WebP buffer using node-webpmux (or sharp).
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

  const json = JSON.stringify({
    'sticker-pack-id':        'com.astra.bot',
    'sticker-pack-name':      name,
    'sticker-pack-publisher': author,
    'emojis':                 ['✨'],
  });

  const jsonBuf = Buffer.from(json, 'utf-8');

  // Standard TIFF EXIF Header
  const tiffHeader = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, // Little Endian "II", Magic 42
    0x08, 0x00, 0x00, 0x00  // Offset to IFD0 (8)
  ]);

  // IFD0: 1 tag entry (Tag 0x4157 'WA')
  const ifd0 = Buffer.alloc(18);
  ifd0.writeUInt16LE(1, 0);               // Count of tags (1)
  ifd0.writeUInt16LE(0x4157, 2);          // Tag 0x4157 ('WA')
  ifd0.writeUInt16LE(7, 4);               // Type UNDEFINED
  ifd0.writeUInt32LE(jsonBuf.length, 6);  // Length of json
  ifd0.writeUInt32LE(26, 10);             // Value offset from TIFF header start (26)
  ifd0.writeUInt32LE(0, 14);              // Next IFD offset (0)

  const exifPayload = Buffer.concat([
    tiffHeader,
    ifd0,
    jsonBuf
  ]);

  try {
    const webpmux = require('node-webpmux');
    const img = new webpmux.Image();
    await img.load(webpBuf);
    img.exif = exifPayload;
    return await img.save(null);
  } catch (err) {
    try {
      const sharp = require('sharp');
      return await sharp(webpBuf)
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
