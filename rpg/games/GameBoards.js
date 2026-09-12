// ═══════════════════════════════════════════════════════════════
// GAME BOARDS — canvas image renderers (+ plain-text fallbacks)
// for Tic-Tac-Toe and Chess. Renderers NEVER throw: they resolve
// null when canvas is unavailable so commands fall back to text.
// ═══════════════════════════════════════════════════════════════

let _canvasLib = null;
let _canvasTried = false;

function canvasLib() {
  if (_canvasTried) return _canvasLib;
  _canvasTried = true;
  try {
    _canvasLib = require('@napi-rs/canvas');
  } catch (e1) {
    try {
      _canvasLib = require('canvas');
    } catch (e2) {
      _canvasLib = null;
    }
  }
  return _canvasLib;
}

function canvasAvailable() {
  const lib = canvasLib();
  return !!(lib && typeof lib.createCanvas === 'function');
}

async function toPng(canvas) {
  let out = null;
  if (typeof canvas.toBuffer === 'function') out = canvas.toBuffer('image/png');
  else if (typeof canvas.encode === 'function') out = Buffer.from(await canvas.encode('png'));
  // Only real PNG buffers pass — anything else (stubs, junk) → text fallback.
  if (!Buffer.isBuffer(out) || out.length === 0) throw new Error('no png encoder');
  return out;
}

// ── TIC-TAC-TOE ────────────────────────────────────────────────
// board9: array of 9 ('X' | 'O' | null), row-major (a1..c3).

const TTT_LABELS = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3'];

async function renderTTT(board9) {
  try {
    const lib = canvasLib();
    if (!lib) return null;
    const S = 600, N = 3, cell = S / N;
    const canvas = lib.createCanvas(S, S);
    const ctx = canvas.getContext('2d');

    // background
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, S, S);

    // grid
    ctx.strokeStyle = '#2f6bff';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (let i = 1; i < N; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 14); ctx.lineTo(i * cell, S - 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(14, i * cell); ctx.lineTo(S - 14, i * cell); ctx.stroke();
    }

    for (let i = 0; i < 9; i++) {
      const r = Math.floor(i / 3), c = i % 3;
      const x = c * cell, y = r * cell;
      const v = board9[i];
      if (v === 'X') {
        ctx.strokeStyle = '#ff2d2d';
        ctx.lineWidth = 16;
        const m = cell * 0.22;
        ctx.beginPath();
        ctx.moveTo(x + m, y + m); ctx.lineTo(x + cell - m, y + cell - m);
        ctx.moveTo(x + cell - m, y + m); ctx.lineTo(x + m, y + cell - m);
        ctx.stroke();
      } else if (v === 'O') {
        ctx.strokeStyle = '#f5f5f5';
        ctx.lineWidth = 13;
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.28, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // empty-cell label
        ctx.fillStyle = '#5b6472';
        ctx.font = '30px "DejaVu Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(TTT_LABELS[i], x + cell / 2, y + cell / 2);
      }
    }
    return await toPng(canvas);
  } catch (e) {
    return null;
  }
}

function textTTT(board9) {
  const cell = (i) => board9[i] === 'X' ? '❌' : board9[i] === 'O' ? '⭕' : TTT_LABELS[i];
  const rows = [];
  for (let r = 0; r < 3; r++) {
    rows.push(` ${cell(r * 3)} │ ${cell(r * 3 + 1)} │ ${cell(r * 3 + 2)} `);
    if (r < 2) rows.push('─────┼──────┼─────');
  }
  return '```\n' + rows.join('\n') + '\n```';
}

// ── CHESS ──────────────────────────────────────────────────────
// b: array of 64 ({t,c}|null). opts.lastMove = {from,to} for highlight.

const CHESS_GLYPH = {
  w: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }, // drawn white-filled
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }, // drawn black-filled
};

async function renderChess(b, opts = {}) {
  try {
    const lib = canvasLib();
    if (!lib) return null;
    const M = 44;            // coordinate margin
    const CELL = 76;         // square size
    const S = M * 2 + CELL * 8;
    const canvas = lib.createCanvas(S, S);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#14161c';
    ctx.fillRect(0, 0, S, S);

    const LIGHT = '#edd6a4', DARK = '#9d5f33';
    const last = opts.lastMove || null;

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        // rank 8 at top: board index = (7-r)*8 + f
        const idx = (7 - r) * 8 + f;
        const x = M + f * CELL, y = M + r * CELL;
        ctx.fillStyle = (r + f) % 2 === 0 ? LIGHT : DARK;
        ctx.fillRect(x, y, CELL, CELL);
        if (last && (idx === last.from || idx === last.to)) {
          ctx.fillStyle = 'rgba(205, 215, 80, 0.55)';
          ctx.fillRect(x, y, CELL, CELL);
        }
        const p = b[idx];
        if (p) {
          const glyph = (p.c === 'w' ? CHESS_GLYPH.w : CHESS_GLYPH.b)[p.t];
          ctx.font = `${Math.floor(CELL * 0.82)}px "DejaVu Sans", "Noto Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const cx = x + CELL / 2, cy = y + CELL / 2 + 2;
          if (p.c === 'w') {
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#2a2a2a';
            ctx.strokeText(glyph, cx, cy);
            ctx.fillStyle = '#fafafa';
            ctx.fillText(glyph, cx, cy);
          } else {
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#e8e8e8';
            ctx.strokeText(glyph, cx, cy);
            ctx.fillStyle = '#161616';
            ctx.fillText(glyph, cx, cy);
          }
        }
      }
    }

    // coordinates
    ctx.fillStyle = '#8b93a3';
    ctx.font = '22px "DejaVu Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let f = 0; f < 8; f++) {
      ctx.fillText('abcdefgh'[f], M + f * CELL + CELL / 2, S - M / 2);
    }
    for (let r = 0; r < 8; r++) {
      ctx.fillText(String(8 - r), M / 2, M + r * CELL + CELL / 2);
    }
    return await toPng(canvas);
  } catch (e) {
    return null;
  }
}

const TEXT_PIECE = {
  'w_k': '♚', 'w_q': '♛', 'w_r': '♜', 'w_b': '♝', 'w_n': '♞', 'w_p': '♟',
  'b_k': '♚', 'b_q': '♛', 'b_r': '♜', 'b_b': '♝', 'b_n': '♞', 'b_p': '♟',
};

function textChess(b) {
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    let row = `${r + 1} `;
    for (let f = 0; f < 8; f++) {
      const p = b[r * 8 + f];
      row += p ? TEXT_PIECE[`${p.c}_${p.t}`] : ((r + f) % 2 === 0 ? '▫️' : '▪️');
    }
    rows.push(row);
  }
  rows.push('   abcdefgh');
  return '```\n' + rows.join('\n') + '\n```';
}

module.exports = {
  canvasAvailable,
  renderTTT,
  textTTT,
  renderChess,
  textChess,
  TTT_LABELS,
};
