// ═══════════════════════════════════════════════════════════════
// TRANSACTION LOG UTILITY
// Keeps the last 10 transactions per player for /history lookup
// ═══════════════════════════════════════════════════════════════

const MAX_TRANSACTIONS = 10;

/**
 * Log a transaction on a player object.
 * @param {object} player  - db.users[id]
 * @param {object} entry   - { type, amount, currency, from, to, note }
 */
function logTransaction(player, entry) {
  if (!player) return;
  if (!Array.isArray(player.transactions)) player.transactions = [];
  player.transactions.unshift({
    ...entry,
    timestamp: Date.now()
  });
  // Keep only the most recent MAX_TRANSACTIONS entries
  if (player.transactions.length > MAX_TRANSACTIONS) {
    player.transactions = player.transactions.slice(0, MAX_TRANSACTIONS);
  }
}

/**
 * Build a readable transaction history string for a player.
 */
function buildHistoryText(player) {
  if (!Array.isArray(player.transactions) || player.transactions.length === 0) {
    return '📭 No transactions recorded yet.';
  }
  const lines = player.transactions.map((t, i) => {
    const date = new Date(t.timestamp);
    const timeStr = `${date.getDate()}/${date.getMonth()+1} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
    const icon = t.type === 'send' ? '📤' : t.type === 'receive' ? '📥' : t.type === 'trade' ? '🔄' : t.type === 'casino_win' ? '🎰' : t.type === 'casino_loss' ? '💸' : '💰';
    const sign = ['receive','casino_win','trade_receive'].includes(t.type) ? '+' : '-';
    return `${i+1}. ${icon} ${sign}${t.amount} ${t.currency||'💠'}  ${t.note||''}  _${timeStr}_`;
  });
  return lines.join('\n');
}

module.exports = { logTransaction, buildHistoryText };
