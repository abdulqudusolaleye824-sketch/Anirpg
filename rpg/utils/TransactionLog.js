// ═══════════════════════════════════════════════════════════════
// TRANSACTION LOG UTILITY (patched)
// Keeps the last 100 wallet movements per player. Every economy command
// (daily/weekly/bank/market/shop/send/trade/casino/passes/prostore/pvp)
// logs here. Convention: `amount` is ALWAYS positive; the sign is derived
// from `type` (see CREDIT_TYPES) — this is what keeps the /balance ledger
// and /transactions signs correct for both 💠 Nexus and 💎 Mana Stones.
// Entry: { type, amount, currency, note } (+ auto timestamp)
// ═══════════════════════════════════════════════════════════════

'use strict';

const MAX_TRANSACTIONS = 100;

// Types that ADD to the wallet (everything else subtracts).
const CREDIT_TYPES = new Set([
  'receive', 'trade_receive',
  'casino_win',
  'daily_claim', 'weekly_claim', 'monthly_claim',
  'pass_claim', 'bp_claim',
  'bank_withdraw', 'bank_interest',
  'market_sell',
  'send_receive', 'gift_receive',
  'quest_reward', 'dungeon_reward', 'pvp_reward',
  'prostore_bonus', 'admin_grant', 'shop_swap',
]);

const TYPE_ICONS = {
  send: '📤', receive: '📥', send_receive: '📥',
  trade: '🔄', trade_receive: '🔄',
  casino_win: '🎰', casino_loss: '💸',
  daily_claim: '📅', weekly_claim: '🗓️', monthly_claim: '📆',
  pass_claim: '🌟', bp_claim: '🎖️',
  bank_deposit: '🏦', bank_withdraw: '🏦', bank_interest: '💹', bank_fee: '🏦',
  market_buy: '🛒', market_sell: '💰', market_fee: '🧾',
  shop_buy: '🛍️', shop_swap: '🔄',
  gift_receive: '🎁',
  quest_reward: '📜', dungeon_reward: '⚔️', pvp_reward: '🏆',
  prostore_buy: '💎', prostore_bonus: '🎁',
  admin_grant: '🛡️',
};

const TYPE_LABELS = {
  send: 'Sent', receive: 'Received', send_receive: 'Received',
  trade: 'Trade sent', trade_receive: 'Trade received',
  casino_win: 'Casino win', casino_loss: 'Casino loss',
  daily_claim: 'Daily claim', weekly_claim: 'Weekly claim', monthly_claim: 'Monthly claim',
  pass_claim: 'Astra Pass', bp_claim: 'Battle Pass',
  bank_deposit: 'Bank deposit', bank_withdraw: 'Bank withdrawal',
  bank_interest: 'Bank interest', bank_fee: 'Bank fee',
  market_buy: 'Market buy', market_sell: 'Market sell', market_fee: 'Market fee',
  shop_buy: 'Shop buy', shop_swap: 'Shop swap',
  gift_receive: 'Gift',
  quest_reward: 'Quest reward', dungeon_reward: 'Dungeon reward', pvp_reward: 'PvP reward',
  prostore_buy: 'Pro Store', prostore_bonus: 'Pro Store bonus',
  admin_grant: 'Admin grant',
};

/**
 * Log a transaction on a player object.
 * @param {object} player  - db.users[id]
 * @param {object} entry   - { type, amount, currency, note }
 */
function logTransaction(player, entry) {
  if (!player || !entry) return;
  if (!Array.isArray(player.transactions)) player.transactions = [];
  player.transactions.unshift({
    type: entry.type || 'unknown',
    amount: Math.abs(entry.amount || 0),
    currency: entry.currency || '💠',
    note: entry.note || '',
    timestamp: Date.now(),
  });
  if (player.transactions.length > MAX_TRANSACTIONS) {
    player.transactions = player.transactions.slice(0, MAX_TRANSACTIONS);
  }
}

function isCredit(type) {
  return CREDIT_TYPES.has(type);
}

function signFor(type) {
  return isCredit(type) ? '+' : '−';
}

function fmtNum(n) {
  try { return Number(n || 0).toLocaleString(); } catch (e) { return String(n); }
}

// One-line render for the /balance PRO LEDGER (newest first already).
function formatTx(t) {
  const icon = TYPE_ICONS[t.type] || '💰';
  const label = t.label || TYPE_LABELS[t.type] || t.type || 'Transaction';
  const amt = typeof t.amount === 'number' ? `: ${signFor(t.type)}${fmtNum(t.amount)} ${t.currency || '💠'}` : '';
  return `  • ${icon} ${label}${amt}`;
}

function fmtTime(ts) {
  try {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getDate()}/${d.getMonth() + 1} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch (e) { return ''; }
}

/**
 * Build a readable transaction history string for a player.
 * @param {object} player
 * @param {number} limit — max entries (newest first)
 */
function buildHistoryText(player, limit = 50) {
  if (!Array.isArray(player.transactions) || player.transactions.length === 0) {
    return '📭 No transactions recorded yet.';
  }
  const list = player.transactions.slice(0, Math.max(1, limit));
  const lines = list.map((t, i) => {
    const icon = TYPE_ICONS[t.type] || '💰';
    const label = t.label || TYPE_LABELS[t.type] || t.type || 'Transaction';
    const note = t.note ? ` ${t.note}` : '';
    return `${i + 1}. ${icon} ${label}: ${signFor(t.type)}${fmtNum(t.amount)} ${t.currency || '💠'}${note} _${fmtTime(t.timestamp)}_`;
  });
  return lines.join('\n');
}

module.exports = { logTransaction, buildHistoryText, isCredit, signFor, formatTx, CREDIT_TYPES, MAX_TRANSACTIONS };
