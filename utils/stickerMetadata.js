/**
 * stickerMetadata.js
 * Injects WhatsApp sticker metadata into a WebP buffer WITHOUT re-encoding.
 * Preserves the original image data exactly, only adds EXIF chunk.
 */

/**
 * @param {Buffer} webpBuf    - Original WebP buffer
 * @param {string} packName   - Sticker pack name
 * @param {string} packAuthor - Sticker pack author
 * @returns {Buffer}          - WebP buffer with metadata injected
 */
function injectStickerMetadata(webpBuf, packName, packAuthor) {
  if (!webpBuf || !Buffer.isBuffer(webpBuf)) throw new Error('Invalid WebP buffer');
  if (webpBuf.slice(0,4).toString() !== 'RIFF') throw new Error('Not a RIFF file');
  if (webpBuf.slice(8,12).toString() !== 'WEBP') throw new Error('Not a WebP file');

  const json = JSON.stringify({
    'sticker-pack-id':        'com.senkubot.v1',
    'sticker-pack-name':      packName || '✦ 𝐀𝐬𝐭𝐫𝐚™',
    'sticker-pack-publisher': packAuthor || '✦ 𝐀stra™ Bot',
    'emojis':                 ['✨'],
  });

  // Build EXIF chunk: "Exif\0\0" prefix + JSON
  const exifPayload = Buffer.concat([
    Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]), // Exif\0\0
    Buffer.from(json, 'utf-8')
  ]);
  const pad = exifPayload.length % 2 !== 0 ? Buffer.from([0x00]) : Buffer.alloc(0);
  const szBuf = Buffer.alloc(4);
  szBuf.writeUInt32LE(exifPayload.length);
  const exifChunk = Buffer.concat([Buffer.from('EXIF'), szBuf, exifPayload, pad]);

  // Find VP8X chunk if it exists
  let offset = 12, vp8xOffset = -1;
  while (offset + 8 <= webpBuf.length) {
    const id   = webpBuf.slice(offset, offset + 4).toString('ascii');
    const sz   = webpBuf.readUInt32LE(offset + 4);
    if (id === 'VP8X') { vp8xOffset = offset; break; }
    offset += 8 + sz + (sz % 2);
  }

  let result;
  if (vp8xOffset !== -1) {
    const copy = Buffer.from(webpBuf);
    copy[vp8xOffset + 8] = copy[vp8xOffset + 8] | 0x08;
    result = Buffer.concat([copy, exifChunk]);
  } else {
    const vp8xData = Buffer.alloc(10);
    vp8xData[0] = 0x08;
    vp8xData[4] = 0xFF; vp8xData[5] = 0x01;
    vp8xData[7] = 0xFF; vp8xData[8] = 0x01;
    const vp8xSz = Buffer.alloc(4); vp8xSz.writeUInt32LE(10);
    const vp8xChunk = Buffer.concat([Buffer.from('VP8X'), vp8xSz, vp8xData]);
    result = Buffer.concat([webpBuf.slice(0, 12), vp8xChunk, webpBuf.slice(12), exifChunk]);
  }

  const out = Buffer.from(result);
  out.writeUInt32LE(out.length - 8, 4);
  return out;
}

module.exports = {
  injectStickerMetadata,
  writeStickerMetadata: injectStickerMetadata,
  getMetadata: () => null
};
