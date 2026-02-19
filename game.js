// ── Board config ──────────────────────────────────────────────────────────
let board = Array(9).fill(null); // null | 'fox' | 'rabbit'
let currentPlayer = 'fox';
let gameOver = false;

// ── Canvas setup ──────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');

function cellSize() {
  const maxW = Math.min(window.innerWidth - 32, 420);
  return Math.floor(maxW / 3);
}

function resizeCanvas() {
  const cs = cellSize();
  canvas.width = cs * 3;
  canvas.height = cs * 3;
  drawAll();
}

window.addEventListener('resize', resizeCanvas);

// ── Drawing helpers ───────────────────────────────────────────────────────

/** Draw a simplified red fox into a given 2D context, centred in (cx,cy) with radius r */
function drawFox(c, cx, cy, r) {
  // Body / face (orange circle)
  c.beginPath();
  c.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  c.fillStyle = '#e06c2e';
  c.fill();

  // White cheek patches
  c.beginPath();
  c.arc(cx - r * 0.22, cy + r * 0.18, r * 0.28, 0, Math.PI * 2);
  c.arc(cx + r * 0.22, cy + r * 0.18, r * 0.28, 0, Math.PI * 2);
  c.fillStyle = '#fff8f0';
  c.fill();

  // Ears (triangles, left and right)
  [-1, 1].forEach(side => {
    c.beginPath();
    c.moveTo(cx + side * r * 0.28, cy - r * 0.55);
    c.lineTo(cx + side * r * 0.72, cy - r * 1.05);
    c.lineTo(cx + side * r * 0.72, cy - r * 0.38);
    c.closePath();
    c.fillStyle = '#e06c2e';
    c.fill();
    // Inner ear
    c.beginPath();
    c.moveTo(cx + side * r * 0.34, cy - r * 0.58);
    c.lineTo(cx + side * r * 0.65, cy - r * 0.92);
    c.lineTo(cx + side * r * 0.65, cy - r * 0.46);
    c.closePath();
    c.fillStyle = '#c04000';
    c.fill();
  });

  // Eyes (dark circles)
  [-1, 1].forEach(side => {
    c.beginPath();
    c.arc(cx + side * r * 0.28, cy - r * 0.1, r * 0.12, 0, Math.PI * 2);
    c.fillStyle = '#1a0a00';
    c.fill();
    // Eye shine
    c.beginPath();
    c.arc(cx + side * r * 0.28 + r * 0.04, cy - r * 0.1 - r * 0.04, r * 0.04, 0, Math.PI * 2);
    c.fillStyle = '#fff';
    c.fill();
  });

  // Nose (small triangle)
  c.beginPath();
  c.moveTo(cx, cy + r * 0.18);
  c.lineTo(cx - r * 0.09, cy + r * 0.08);
  c.lineTo(cx + r * 0.09, cy + r * 0.08);
  c.closePath();
  c.fillStyle = '#1a0a00';
  c.fill();

  // Tail hint (arc behind body)
  c.beginPath();
  c.arc(cx + r * 0.7, cy + r * 0.6, r * 0.38, Math.PI * 0.3, Math.PI * 1.4);
  c.strokeStyle = '#e06c2e';
  c.lineWidth = r * 0.18;
  c.lineCap = 'round';
  c.stroke();
  // Tail tip
  c.beginPath();
  c.arc(cx + r * 1.02, cy + r * 0.42, r * 0.16, 0, Math.PI * 2);
  c.fillStyle = '#fff8f0';
  c.fill();
}

/** Draw a simplified blue rabbit into a given 2D context, centred in (cx,cy) with radius r */
function drawRabbit(c, cx, cy, r) {
  // Long ears (two tall rounded rectangles)
  [-1, 1].forEach(side => {
    const ex = cx + side * r * 0.28;
    const ey = cy - r * 0.55;
    const ew = r * 0.22;
    const eh = r * 0.9;
    c.beginPath();
    c.ellipse(ex, ey - eh * 0.35, ew, eh * 0.7, 0, 0, Math.PI * 2);
    c.fillStyle = '#4a90d9';
    c.fill();
    // Inner ear
    c.beginPath();
    c.ellipse(ex, ey - eh * 0.35, ew * 0.48, eh * 0.5, 0, 0, Math.PI * 2);
    c.fillStyle = '#a8d0f0';
    c.fill();
  });

  // Body / face (blue circle)
  c.beginPath();
  c.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  c.fillStyle = '#4a90d9';
  c.fill();

  // White cheek patches
  c.beginPath();
  c.arc(cx - r * 0.22, cy + r * 0.2, r * 0.26, 0, Math.PI * 2);
  c.arc(cx + r * 0.22, cy + r * 0.2, r * 0.26, 0, Math.PI * 2);
  c.fillStyle = '#e8f4ff';
  c.fill();

  // Eyes
  [-1, 1].forEach(side => {
    c.beginPath();
    c.arc(cx + side * r * 0.28, cy - r * 0.08, r * 0.13, 0, Math.PI * 2);
    c.fillStyle = '#1a1a2e';
    c.fill();
    // Eye shine
    c.beginPath();
    c.arc(cx + side * r * 0.28 + r * 0.04, cy - r * 0.08 - r * 0.04, r * 0.04, 0, Math.PI * 2);
    c.fillStyle = '#fff';
    c.fill();
  });

  // Nose (small pink oval)
  c.beginPath();
  c.ellipse(cx, cy + r * 0.14, r * 0.1, r * 0.07, 0, 0, Math.PI * 2);
  c.fillStyle = '#f9a0b0';
  c.fill();

  // Whiskers
  [-1, 1].forEach(side => {
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.moveTo(cx + side * r * 0.1, cy + r * 0.14 + i * r * 0.08);
      c.lineTo(cx + side * r * 0.6, cy + r * 0.1 + i * r * 0.09);
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = r * 0.03;
      c.stroke();
    }
  });

  // Fluffy tail (small white circle behind)
  c.beginPath();
  c.arc(cx - r * 0.82, cy + r * 0.3, r * 0.22, 0, Math.PI * 2);
  c.fillStyle = '#e8f4ff';
  c.fill();
}

// ── Grid drawing ──────────────────────────────────────────────────────────
function drawGrid() {
  const cs = cellSize();
  const w = cs * 3, h = cs * 3;
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = '#fff9ee';
  ctx.fillRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = Math.max(2, cs * 0.025);
  ctx.lineCap = 'round';
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(i * cs, cs * 0.1); ctx.lineTo(i * cs, h - cs * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cs * 0.1, i * cs); ctx.lineTo(w - cs * 0.1, i * cs); ctx.stroke();
  }
}

function drawAll() {
  const cs = cellSize();
  drawGrid();
  for (let i = 0; i < 9; i++) {
    if (board[i]) {
      const col = i % 3, row = Math.floor(i / 3);
      const cx = col * cs + cs / 2, cy = row * cs + cs / 2;
      const r = cs * 0.38;
      if (board[i] === 'fox') drawFox(ctx, cx, cy, r);
      else drawRabbit(ctx, cx, cy, r);
    }
  }
}

// ── Legend canvases ───────────────────────────────────────────────────────
function drawLegends() {
  const lf = document.getElementById('legendFox');
  const lr = document.getElementById('legendRabbit');
  [lf, lr].forEach(c => { c.width = 36; c.height = 36; });
  drawFox(lf.getContext('2d'), 18, 20, 14);
  drawRabbit(lr.getContext('2d'), 18, 20, 14);
}

// ── Win logic ─────────────────────────────────────────────────────────────
const WINS = [
  [0,1,2],[3,4,5],[6,7,8], // rows
  [0,3,6],[1,4,7],[2,5,8], // cols
  [0,4,8],[2,4,6]          // diagonals
];

function checkWinner() {
  for (const [a,b,c] of WINS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(Boolean)) return 'draw';
  return null;
}

// ── Click / tap handler ───────────────────────────────────────────────────
function handleClick(e) {
  if (gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const cs = cellSize();
  const col = Math.floor(x / cs), row = Math.floor(y / cs);
  const idx = row * 3 + col;
  if (board[idx]) return;

  board[idx] = currentPlayer;
  drawAll();

  const winner = checkWinner();
  if (winner === 'draw') {
    gameOver = true;
    statusEl.textContent = 'Tasapeli! 🤝';
    resetBtn.style.display = 'inline-block';
  } else if (winner) {
    gameOver = true;
    const name = winner === 'fox' ? 'Kettu 🦊' : 'Kaniini 🐰';
    statusEl.textContent = `${name} voitti!`;
    resetBtn.style.display = 'inline-block';
    highlightWinner();
  } else {
    currentPlayer = currentPlayer === 'fox' ? 'rabbit' : 'fox';
    const nextName = currentPlayer === 'fox' ? 'Kettu 🦊' : 'Kaniini 🐰';
    statusEl.textContent = `${nextName} vuoro`;
  }
}

function highlightWinner() {
  const cs = cellSize();
  for (const [a,b,c] of WINS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      const c1 = { x: (a%3)*cs+cs/2, y: Math.floor(a/3)*cs+cs/2 };
      const c2 = { x: (c%3)*cs+cs/2, y: Math.floor(c/3)*cs+cs/2 };
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.strokeStyle = 'rgba(255,215,0,0.7)';
      ctx.lineWidth = cs * 0.12;
      ctx.lineCap = 'round';
      ctx.stroke();
      return;
    }
  }
}

canvas.addEventListener('click', handleClick);
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  handleClick({ clientX: t.clientX, clientY: t.clientY });
}, { passive: false });

// ── Reset ─────────────────────────────────────────────────────────────────
function resetGame() {
  board = Array(9).fill(null);
  currentPlayer = 'fox';
  gameOver = false;
  statusEl.textContent = 'Kettu aloittaa! 🦊';
  resetBtn.style.display = 'none';
  drawAll();
}

// ── Init ──────────────────────────────────────────────────────────────────
resizeCanvas();
drawLegends();
