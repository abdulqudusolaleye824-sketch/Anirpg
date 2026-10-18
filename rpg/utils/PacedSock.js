// Push #103b: combat flow pacing — every message of ONE combat action lands
// with a ≥3 s gap after the previous one (strike → counter → statuses → buffs…),
// so the group can actually read the fight. First message is immediate.
'use strict';
const GAP_MS = 2000;
function paced(sock, gap = GAP_MS) {
  if (!sock || sock.__paced) return sock;
  let last = 0;
  const wrapped = Object.create(sock);
  wrapped.__paced = true;
  wrapped.sendMessage = async function (...args) {
    const wait = last ? Math.max(0, gap - (Date.now() - last)) : 0;
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    last = Date.now();
    return sock.sendMessage(...args);
  };
  return wrapped;
}
module.exports = { paced, GAP_MS };
