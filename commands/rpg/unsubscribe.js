module.exports = {
  name: 'unsubscribe',
  description: '🔕 Unsubscribe from bot updates',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const db = getDatabase();
    if (!db.subscribers || typeof db.subscribers !== 'object') db.subscribers = [];
    if (!Array.isArray(db.subscribers)) db.subscribers = Object.values(db.subscribers).filter(v => typeof v === 'string');

    db.subscribers = db.subscribers.filter(id => id !== sender);
    saveDatabase();

    await sock.sendMessage(sender, {
      text: '🔕 You have unsubscribed from update broadcasts.'
    });
  }
};
