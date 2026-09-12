// ═══════════════════════════════════════════════════════════════
// CHESS ENGINE — pure chess rules for the games GC (!chess family).
// No Baileys / DB dependencies: state is plain JSON (persisted in
// db.chessGames so Railway restarts never kill a match).
//
// Board: array of 64, index = rank*8 + file (rank 0 = White home).
// Piece: { t: 'p'|'n'|'b'|'r'|'q'|'k', c: 'w'|'b' } or null.
// State: { b, t:'w'|'b', cast:{K,Q,k,q}, ep:index|null, half, full }
// ═══════════════════════════════════════════════════════════════

const FILES = 'abcdefgh';

function parseSquare(s) {
  if (!s || s.length !== 2) return -1;
  const f = FILES.indexOf(s[0].toLowerCase());
  const r = parseInt(s[1], 10) - 1;
  if (f < 0 || !(r >= 0 && r < 8)) return -1;
  return r * 8 + f;
}

function squareName(idx) {
  return FILES[idx % 8] + (Math.floor(idx / 8) + 1);
}

function initialState() {
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const b = new Array(64).fill(null);
  for (let f = 0; f < 8; f++) {
    b[f] = { t: back[f], c: 'w' };
    b[8 + f] = { t: 'p', c: 'w' };
    b[48 + f] = { t: 'p', c: 'b' };
    b[56 + f] = { t: back[f], c: 'b' };
  }
  return { b, t: 'w', cast: { K: true, Q: true, k: true, q: true }, ep: null, half: 0, full: 1 };
}

function cloneBoard(b) {
  return b.map((p) => (p ? { t: p.t, c: p.c } : null));
}

function opp(c) { return c === 'w' ? 'b' : 'w'; }
function rankOf(i) { return Math.floor(i / 8); }
function fileOf(i) { return i % 8; }
function onBoard(r, f) { return r >= 0 && r < 8 && f >= 0 && f < 8; }

const KNIGHT_D = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
const KING_D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

// Is square `sq` attacked by color `by` on board `b`?
function isAttacked(b, sq, by) {
  const r = rankOf(sq), f = fileOf(sq);
  // Pawns
  const pr = by === 'w' ? r - 1 : r + 1;
  for (const df of [-1, 1]) {
    if (onBoard(pr, f + df)) {
      const p = b[pr * 8 + f + df];
      if (p && p.t === 'p' && p.c === by) return true;
    }
  }
  // Knights
  for (const [dr, df] of KNIGHT_D) {
    if (!onBoard(r + dr, f + df)) continue;
    const p = b[(r + dr) * 8 + f + df];
    if (p && p.t === 'n' && p.c === by) return true;
  }
  // King
  for (const [dr, df] of KING_D) {
    if (!onBoard(r + dr, f + df)) continue;
    const p = b[(r + dr) * 8 + f + df];
    if (p && p.t === 'k' && p.c === by) return true;
  }
  // Sliders
  for (const [dr, df] of ROOK_D) {
    let rr = r + dr, ff = f + df;
    while (onBoard(rr, ff)) {
      const p = b[rr * 8 + ff];
      if (p) {
        if (p.c === by && (p.t === 'r' || p.t === 'q')) return true;
        break;
      }
      rr += dr; ff += df;
    }
  }
  for (const [dr, df] of BISHOP_D) {
    let rr = r + dr, ff = f + df;
    while (onBoard(rr, ff)) {
      const p = b[rr * 8 + ff];
      if (p) {
        if (p.c === by && (p.t === 'b' || p.t === 'q')) return true;
        break;
      }
      rr += dr; ff += df;
    }
  }
  return false;
}

function kingSquare(b, color) {
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (p && p.t === 'k' && p.c === color) return i;
  }
  return -1;
}

function inCheckOn(b, color) {
  const k = kingSquare(b, color);
  if (k < 0) return false;
  return isAttacked(b, k, opp(color));
}

// Pseudo-legal moves for the piece on `idx` (no check filter yet).
function pseudoMoves(st, idx) {
  const { b, t, cast, ep } = st;
  const p = b[idx];
  if (!p || p.c !== t) return [];
  const moves = [];
  const r = rankOf(idx), f = fileOf(idx);
  const push = (to, extra = {}) => moves.push({ from: idx, to, piece: p.t, ...extra });

  if (p.t === 'p') {
    const dir = t === 'w' ? 1 : -1;
    const startR = t === 'w' ? 1 : 6;
    const promoR = t === 'w' ? 7 : 0;
    // single push
    if (onBoard(r + dir, f) && !b[(r + dir) * 8 + f]) {
      const to = (r + dir) * 8 + f;
      push(to, rankOf(to) === promoR ? { promo: 'q' } : {});
      // double push
      if (r === startR && !b[(r + 2 * dir) * 8 + f]) {
        push((r + 2 * dir) * 8 + f, { double: true });
      }
    }
    // captures + en passant
    for (const df of [-1, 1]) {
      if (!onBoard(r + dir, f + df)) continue;
      const to = (r + dir) * 8 + f + df;
      const target = b[to];
      if (target && target.c !== t) {
        push(to, rankOf(to) === promoR ? { promo: 'q' } : {});
      } else if (!target && ep === to) {
        push(to, { epCap: true });
      }
    }
  } else if (p.t === 'n') {
    for (const [dr, df] of KNIGHT_D) {
      if (!onBoard(r + dr, f + df)) continue;
      const to = (r + dr) * 8 + f + df;
      if (!b[to] || b[to].c !== t) push(to);
    }
  } else if (p.t === 'k') {
    for (const [dr, df] of KING_D) {
      if (!onBoard(r + dr, f + df)) continue;
      const to = (r + dr) * 8 + f + df;
      if (!b[to] || b[to].c !== t) push(to);
    }
    // Castling
    if (t === 'w' && idx === 4) {
      if (cast.K && !b[5] && !b[6] && b[7]?.t === 'r' && b[7]?.c === 'w' &&
          !inCheckOn(b, 'w') && !isAttacked(b, 5, 'b') && !isAttacked(b, 6, 'b')) {
        push(6, { castle: 'K' });
      }
      if (cast.Q && !b[3] && !b[2] && !b[1] && b[0]?.t === 'r' && b[0]?.c === 'w' &&
          !inCheckOn(b, 'w') && !isAttacked(b, 3, 'b') && !isAttacked(b, 2, 'b')) {
        push(2, { castle: 'Q' });
      }
    }
    if (t === 'b' && idx === 60) {
      if (cast.k && !b[61] && !b[62] && b[63]?.t === 'r' && b[63]?.c === 'b' &&
          !inCheckOn(b, 'b') && !isAttacked(b, 61, 'w') && !isAttacked(b, 62, 'w')) {
        push(62, { castle: 'k' });
      }
      if (cast.q && !b[59] && !b[58] && !b[57] && b[56]?.t === 'r' && b[56]?.c === 'b' &&
          !inCheckOn(b, 'b') && !isAttacked(b, 59, 'w') && !isAttacked(b, 58, 'w')) {
        push(58, { castle: 'q' });
      }
    }
  } else {
    const dirs = p.t === 'r' ? ROOK_D : p.t === 'b' ? BISHOP_D : KING_D;
    for (const [dr, df] of dirs) {
      let rr = r + dr, ff = f + df;
      while (onBoard(rr, ff)) {
        const to = rr * 8 + ff;
        if (!b[to]) { push(to); } else {
          if (b[to].c !== t) push(to);
          break;
        }
        rr += dr; ff += df;
      }
    }
  }
  return moves;
}

// Apply a move to a board IN PLACE (used for legality probes + real moves).
function rawApply(b, mv, color) {
  const piece = b[mv.from];
  let captured = b[mv.to] || null;
  b[mv.from] = null;
  if (mv.epCap) {
    const capIdx = mv.to + (color === 'w' ? -8 : 8);
    captured = b[capIdx];
    b[capIdx] = null;
  }
  b[mv.to] = mv.promo ? { t: mv.promo, c: color } : piece;
  if (mv.castle === 'K') { b[5] = b[7]; b[7] = null; }
  if (mv.castle === 'Q') { b[3] = b[0]; b[0] = null; }
  if (mv.castle === 'k') { b[61] = b[63]; b[63] = null; }
  if (mv.castle === 'q') { b[59] = b[56]; b[56] = null; }
  return captured;
}

// Fully legal moves for side to move (optionally only for square `idx`).
function legalMoves(st, idx = null) {
  const out = [];
  const squares = idx !== null ? [idx] : [...Array(64).keys()];
  for (const s of squares) {
    const p = st.b[s];
    if (!p || p.c !== st.t) continue;
    for (const mv of pseudoMoves(st, s)) {
      const trial = cloneBoard(st.b);
      rawApply(trial, mv, st.t);
      if (!inCheckOn(trial, st.t)) out.push(mv);
    }
  }
  return out;
}

// Find the legal move matching from/to (handles castle-by-king-push + promo).
function findMove(st, from, to) {
  const cands = legalMoves(st, from).filter((m) => m.to === to);
  return cands[0] || null;
}

function insufficientMaterial(b) {
  const pieces = [];
  for (const p of b) if (p && p.t !== 'k') pieces.push(p);
  if (pieces.length === 0) return true; // K vs K
  if (pieces.length === 1 && (pieces[0].t === 'b' || pieces[0].t === 'n')) return true;
  return false;
}

// Apply an already-validated move to the state IN PLACE. Returns outcome info.
function applyMove(st, mv) {
  const color = st.t;
  const piece = st.b[mv.from];
  const captured = rawApply(st.b, mv, color);

  // Castling rights
  if (piece?.t === 'k') {
    if (color === 'w') { st.cast.K = false; st.cast.Q = false; }
    else { st.cast.k = false; st.cast.q = false; }
  }
  const touch = (sq, right) => { if (mv.from === sq || mv.to === sq) st.cast[right] = false; };
  touch(7, 'K'); touch(0, 'Q'); touch(63, 'k'); touch(56, 'q');

  // En-passant square
  st.ep = mv.double ? mv.from + (color === 'w' ? 8 : -8) : null;

  // Clocks
  st.half = (piece?.t === 'p' || captured) ? 0 : st.half + 1;
  if (color === 'b') st.full += 1;
  st.t = opp(color);

  const enemy = st.t;
  const check = inCheckOn(st.b, enemy);
  const enemyMoves = check !== null ? legalMoves(st) : [];
  const mate = check && enemyMoves.length === 0;
  const stalemate = !check && enemyMoves.length === 0;
  const drawMaterial = insufficientMaterial(st.b);
  return {
    captured: captured ? { t: captured.t, c: captured.c } : null,
    promo: mv.promo || null,
    castle: mv.castle || null,
    check,
    mate,
    stalemate,
    draw: stalemate || drawMaterial,
  };
}

// Outcome of the CURRENT position (for side to move).
function positionStatus(st) {
  const check = inCheckOn(st.b, st.t);
  const moves = legalMoves(st);
  return {
    check,
    mate: check && moves.length === 0,
    stalemate: !check && moves.length === 0,
    drawMaterial: insufficientMaterial(st.b),
  };
}

module.exports = {
  parseSquare,
  squareName,
  initialState,
  legalMoves,
  findMove,
  applyMove,
  positionStatus,
  inCheckOn,
  insufficientMaterial,
  isAttacked,
};
