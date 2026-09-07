module.exports = {
  name: 'subscribe',
  description: '🔔 Subscribe to bot updates',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const db = getDatabase();

    if (!db.subscribers || typeof db.subscribers !== 'object') db.subscribers = [];
    if (!Array.isArray(db.subscribers)) db.subscribers = Object.values(db.subscribers).filter(v => typeof v === 'string');

    if (db.subscribers.includes(sender)) {
      await sock.sendMessage(sender, {
        text: '🔔 You are already subscribed to updates.'
      });
      return;
    }

    db.subscribers.push(sender);
    saveDatabase();

    await sock.sendMessage(sender, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━
🔔 SUBSCRIBED SUCCESSFULLY
━━━━━━━━━━━━━━━━━━━━━━━
You will now receive:
• New commands
• Events
• Updates
• Maintenance notices

You can unsubscribe anytime with:
/unsubscribe
━━━━━━━━━━━━━━━━━━━━━━━`
    });
  }
};
