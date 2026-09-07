const { downloadMediaMessage } = require('@whiskeysockets/baileys');
let sharp; try { sharp = require('sharp'); } catch(e) { sharp = null; } // Install: npm install sharp

module.exports = {
  name: 'sticker',
  aliases: ['s'],
  description: '🎨 Convert image/video to sticker',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    try {
      // Get quoted message if exists
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      
      // Check for media in current message
      const imageMessage = msg.message?.imageMessage;
      const videoMessage = msg.message?.videoMessage;
      
      // Check for media in quoted message
      const quotedImage = quotedMsg?.imageMessage;
      const quotedVideo = quotedMsg?.videoMessage;

      // Determine which message to process
      let mediaMessage = null;
      let isQuoted = false;

      if (imageMessage || videoMessage) {
        // Media in current message
        mediaMessage = msg;
        isQuoted = false;
      } else if (quotedImage || quotedVideo) {
        // Media in quoted message
        mediaMessage = {
          key: msg.message.extendedTextMessage.contextInfo.stanzaId ? {
            remoteJid: chatId,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            participant: msg.message.extendedTextMessage.contextInfo.participant
          } : msg.key,
          message: quotedMsg
        };
        isQuoted = true;
      }

      if (!mediaMessage) {
        return sock.sendMessage(chatId, {
          text: `❌ No image found!

📌 *HOW TO USE:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ Send an image with caption: /sticker
2️⃣ Reply to an image with: /sticker

✅ *SUPPORTED:*
• JPG, PNG, WebP images
• Max size: 1MB recommended

❌ *NOT SUPPORTED YET:*
• Videos (requires ffmpeg)
• GIFs (requires ffmpeg)
• Documents

💡 *TIP:* Use high quality images for best results!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      // Check if it's a video
      const isVideo = videoMessage || quotedVideo;
      
      if (isVideo) {
        return sock.sendMessage(chatId, {
          text: `⚠️ *VIDEO STICKERS NOT SUPPORTED*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Video/GIF stickers require ffmpeg installation.

💡 *ALTERNATIVES:*
• Use a still image instead
• Contact bot owner to enable video support
• Convert video to image first

✅ Try with a regular image!
━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      // Send processing message
      const processingMsg = await sock.sendMessage(chatId, {
        text: '🎨 Creating your sticker...\n⏳ Please wait...'
      }, { quoted: msg });

      // Download media
      console.log('📥 Downloading media...');
      const buffer = await downloadMediaMessage(
        mediaMessage,
        'buffer',
        {},
        { 
          logger: console,
          reuploadRequest: sock.updateMediaMessage
        }
      );

      if (!buffer || buffer.length === 0) {
        throw new Error('Failed to download media - empty buffer');
      }

      console.log(`✅ Downloaded media (${(buffer.length / 1024).toFixed(2)} KB)`);

      // Check file size (max 1MB)
      if (buffer.length > 1024 * 1024) {
        return sock.sendMessage(chatId, {
          text: `❌ *FILE TOO LARGE!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Your file: ${(buffer.length / 1024 / 1024).toFixed(2)} MB
⚠️ Max size: 1 MB

💡 *TIPS:*
• Compress the image first
• Send a smaller/lower quality version
• Try a different image
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      // Process image to sticker format
      console.log('🔄 Processing sticker...');
      const processedBuffer = await sharp(buffer)
        .resize(512, 512, {
          fit: 'contain', // Maintain aspect ratio
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .webp({
          quality: 95, // High quality
          lossless: false
        })
        .toBuffer();

      console.log(`✅ Processed sticker (${(processedBuffer.length / 1024).toFixed(2)} KB)`);

      // Send as sticker
      await sock.sendMessage(chatId, {
        sticker: processedBuffer
      }, { 
        quoted: msg
      });

      console.log('✅ Sticker sent successfully!');

      // Delete processing message
      try {
        await sock.sendMessage(chatId, { delete: processingMsg.key });
      } catch (e) {
        // Ignore deletion errors
      }

    } catch (error) {
      console.error('❌ Sticker creation error:', error);
      
      // Determine error type and provide helpful message
      let errorMsg = `❌ *STICKER CREATION FAILED!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      if (error.message.includes('Input buffer') || error.message.includes('Input file')) {
        errorMsg += `⚠️ *INVALID IMAGE FILE*

The image file is corrupted or in an unsupported format.

💡 *TRY THIS:*
• Download and re-upload the image
• Convert to JPG or PNG format
• Use a different image
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      } else if (error.message.includes('empty buffer') || error.message.includes('download')) {
        errorMsg += `⚠️ *DOWNLOAD FAILED*

Failed to download the image from WhatsApp.

💡 *TRY THIS:*
• Send the image again
• Check your internet connection
• Try a smaller image file
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      } else if (error.message.includes('Unsupported image format')) {
        errorMsg += `⚠️ *UNSUPPORTED FORMAT*

This image format is not supported.

✅ *SUPPORTED FORMATS:*
• JPG / JPEG
• PNG
• WebP

💡 Convert your image to one of these formats!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      } else {
        errorMsg += `⚠️ *UNEXPECTED ERROR*

${error.message}

💡 *COMMON ISSUES:*
• File too large (max 1MB)
• Corrupted image file
• Network connection issue
• Unsupported format

*TRY THIS:*
• Use a smaller image
• Re-upload the image
• Try a different image
• Use JPG or PNG format
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      }

      return sock.sendMessage(chatId, {
        text: errorMsg
      }, { quoted: msg });
    }
  }
};