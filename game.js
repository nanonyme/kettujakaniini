// ── State ─────────────────────────────────────────────────────────────────────
let board = Array(9).fill(null); // null | 'fox' | 'rabbit'
let currentPlayer = 'fox';
let gameOver = false;

// Multiplayer
let gameMode = 'local';   // 'local' | 'host' | 'guest'
let peer = null;
let conn = null;
let myRole = null;        // 'fox' | 'rabbit' (multiplayer only)
let roundNumber = 0;
let foxStartOffset = 0;   // 0 or 1, randomised per session so first-round fox is not always the host
let sessionTimer = null;
const SESSION_SECONDS = 900; // 15 minutes

// ── DOM refs ──────────────────────────────────────────────────────────────────
const canvas      = document.getElementById('canvas');
const ctx         = canvas.getContext('2d');
const statusEl    = document.getElementById('status');
const resetBtn    = document.getElementById('resetBtn');
const lockOverlay = document.getElementById('lockOverlay');
const roleEl      = document.getElementById('roleIndicator');

// ── Canvas setup ──────────────────────────────────────────────────────────────
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

window.addEventListener('resize', () => {
  if (!document.getElementById('gameArea').classList.contains('hidden')) resizeCanvas();
});

// ── Drawing helpers ───────────────────────────────────────────────────────────

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

// ── Grid drawing ──────────────────────────────────────────────────────────────
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

// ── Legend canvases ───────────────────────────────────────────────────────────
function drawLegends() {
  const lf = document.getElementById('legendFox');
  const lr = document.getElementById('legendRabbit');
  [lf, lr].forEach(c => { c.width = 36; c.height = 36; });
  drawFox(lf.getContext('2d'), 18, 20, 14);
  drawRabbit(lr.getContext('2d'), 18, 20, 14);
}

// ── Win logic ─────────────────────────────────────────────────────────────────
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

// ── Multiplayer helpers ───────────────────────────────────────────────────────

/** Generate a 128-bit cryptographically random token (hex string) */
function generateToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function isMyTurn() {
  return gameMode === 'local' || myRole === currentPlayer;
}

/**
 * Even rounds (adjusted by foxStartOffset): host=fox (goes first), guest=rabbit.
 * Odd  rounds (adjusted by foxStartOffset): host=rabbit, guest=fox (goes first).
 * Fox always moves first; who IS fox alternates each round.
 * foxStartOffset is randomised per session so the host is not always fox in round 0.
 */
function getRoundConfig(n) {
  return (n + foxStartOffset) % 2 === 0
    ? { hostRole: 'fox',    guestRole: 'rabbit' }
    : { hostRole: 'rabbit', guestRole: 'fox' };
}

function el(id) { return document.getElementById(id); }
function show(id) { el(id).classList.remove('hidden'); }
function hide(id) { el(id).classList.add('hidden'); }

function showMpPanel(id) {
  ['mpChoice', 'hostPanel', 'connectingPanel'].forEach(p =>
    el(p).classList.toggle('hidden', p !== id));
}

// ── UI navigation ─────────────────────────────────────────────────────────────
function showModeSelect() {
  show('modeOverlay'); hide('mpOverlay'); hide('gameArea');
  cleanupPeer();
}

function showMultiplayerSetup() {
  hide('modeOverlay'); show('mpOverlay'); hide('gameArea');
  showMpPanel('mpChoice');
  // Pre-fill token from URL hash — the #fragment is never sent to any server,
  // so the session token never appears in GitHub or CDN access logs.
  if (location.hash.startsWith('#kjk-')) el('tokenInput').value = location.hash.slice(5);
}

function showGameArea() {
  hide('modeOverlay'); hide('mpOverlay'); show('gameArea');
  resizeCanvas();
  drawLegends();
}

function updateLockOverlay() {
  lockOverlay.classList.toggle('hidden', gameMode === 'local' || gameOver || isMyTurn());
}

function updateRoleDisplay() {
  if (gameMode === 'local') { roleEl.classList.add('hidden'); return; }
  roleEl.classList.remove('hidden');
  roleEl.textContent = myRole === 'fox' ? 'Sinä olet: 🦊 Kettu' : 'Sinä olet: 🐰 Kaniini';
}

function updateStatus() {
  if (gameMode === 'local') {
    statusEl.textContent = currentPlayer === 'fox' ? 'Kettu 🦊 vuoro' : 'Kaniini 🐰 vuoro';
  } else {
    statusEl.textContent = isMyTurn() ? 'Sinun vuorosi!' : 'Vastustajan vuoro…';
  }
}

// ── Local mode ────────────────────────────────────────────────────────────────
function startLocal() {
  gameMode = 'local';
  showGameArea();
  resetGame();
}

// ── Host mode ─────────────────────────────────────────────────────────────────
function startHosting() {
  const token = generateToken();
  // Token is placed in the URL #fragment so it is never transmitted to any server
  el('shareUrl').value = location.origin + location.pathname + '#kjk-' + token;
  showMpPanel('hostPanel');

  peer = new Peer('kjk-' + token);
  peer.on('error', err => cancelSession('Yhteysongelma: ' + err.type));

  peer.on('open', () => {
    let rem = SESSION_SECONDS;
    updateTimer(rem);
    sessionTimer = setInterval(() => {
      rem--;
      updateTimer(rem);
      if (rem <= 0) {
        clearInterval(sessionTimer); sessionTimer = null;
        cancelSession('Sessio vanheni. Luo uusi peli.');
      }
    }, 1000);
  });

  peer.on('connection', incoming => {
    if (conn) { incoming.close(); return; } // reject second connection
    clearInterval(sessionTimer); sessionTimer = null;
    conn = incoming;
    foxStartOffset = Math.floor(Math.random() * 2); // randomise who is fox in round 0
    const cfg = getRoundConfig(0);
    roundNumber = 0; myRole = cfg.hostRole; gameMode = 'host';
    wireConn();
    const sendStart = () => {
      peer.disconnect(); // revoke the token once connection is established — no further connections possible
      conn.send({ type: 'start', guestRole: cfg.guestRole });
      showGameArea();
      beginRound();
    };
    if (conn.open) { sendStart(); } else { conn.on('open', sendStart); }
  });
}

function updateTimer(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  el('sessionTimer').textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

function cancelSession(msg) {
  cleanupPeer();
  showModeSelect();
  if (msg) setTimeout(() => alert(msg), 50);
}

function copyLink() {
  const url = el('shareUrl').value;
  navigator.clipboard.writeText(url).catch(() => {
    el('shareUrl').select();
    alert('Kopioi linkki manuaalisesti: Ctrl+C / ⌘C');
  });
}

function shareInvite() {
  const url = el('shareUrl').value;
  if (navigator.share) {
    navigator.share({ title: 'Kettu ja Kaniini', text: 'Liity peliin!', url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).catch(() => {
      el('shareUrl').select();
      alert('Kopioi linkki manuaalisesti: Ctrl+C / ⌘C');
    });
  }
}

// ── Guest mode ────────────────────────────────────────────────────────────────
function joinGame() {
  let t = el('tokenInput').value.trim();
  if (!t) { alert('Syötä liitymiskoodi!'); return; }
  // Accept a pasted full share URL (token is in the #fragment), a bare peer ID, or just the token
  if (t.includes('#kjk-')) {
    t = t.split('#kjk-')[1];
  } else if (t.startsWith('kjk-')) {
    t = t.slice(4);
  }
  showMpPanel('connectingPanel');

  peer = new Peer();
  peer.on('error', err => cancelSession('Yhteysongelma: ' + err.type));
  peer.on('open', () => {
    conn = peer.connect('kjk-' + t, { reliable: true });
    wireConn();
  });
}

// ── Connection management ─────────────────────────────────────────────────────
function wireConn() {
  conn.on('data', onRemoteData);
  conn.on('close', onDisconnect);
  conn.on('error', onDisconnect);
}

function onDisconnect() {
  if (!peer) return; // already cleaned up
  cleanupPeer(); gameMode = 'local';
  setTimeout(() => { alert('Yhteys katkesi. Peli päättyi.'); showModeSelect(); }, 50);
}

function onRemoteData(data) {
  if (data.type === 'start') {
    gameMode = 'guest'; myRole = data.guestRole; roundNumber = 0;
    // Clear hash so a page refresh does not attempt to re-join a closed session
    history.replaceState(null, '', location.pathname + location.search);
    showGameArea(); beginRound();
  } else if (data.type === 'move') {
    applyMove(data.index);
  } else if (data.type === 'newround') {
    myRole = data.guestRole; roundNumber = data.roundNumber;
    beginRound();
  } else if (data.type === 'requestnewgame') {
    if (gameMode === 'host' && gameOver) resetGame();
  }
}

function cleanupPeer() {
  if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null; }
  if (conn) { try { conn.close(); } catch (_) {} conn = null; }
  if (peer) { try { peer.destroy(); } catch (_) {} peer = null; }
  myRole = null;
}

// ── Round / game logic ────────────────────────────────────────────────────────

/** Fox always moves first; who IS fox alternates each round via getRoundConfig() */
function beginRound() {
  board = Array(9).fill(null);
  currentPlayer = 'fox';
  gameOver = false;
  resetBtn.style.display = 'none';
  updateRoleDisplay();
  updateStatus();
  updateLockOverlay();
  drawAll();
}

// ── Click / tap handler ───────────────────────────────────────────────────────
function handleClick(e) {
  if (gameOver || !isMyTurn()) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top)  * (canvas.height / rect.height);
  const cs = cellSize();
  const idx = Math.floor(y / cs) * 3 + Math.floor(x / cs);
  if (board[idx]) return;
  if (gameMode !== 'local' && conn) conn.send({ type: 'move', index: idx });
  applyMove(idx);
}

function applyMove(idx) {
  board[idx] = currentPlayer;
  drawAll();

  const winner = checkWinner();
  if (winner === 'draw') {
    gameOver = true;
    statusEl.textContent = 'Tasapeli! 🤝';
    resetBtn.style.display = 'inline-block';
    lockOverlay.classList.add('hidden');
  } else if (winner) {
    gameOver = true;
    statusEl.textContent = (winner === 'fox' ? 'Kettu 🦊' : 'Kaniini 🐰') + ' voitti!';
    resetBtn.style.display = 'inline-block';
    lockOverlay.classList.add('hidden');
    highlightWinner();
  } else {
    currentPlayer = currentPlayer === 'fox' ? 'rabbit' : 'fox';
    updateStatus();
    updateLockOverlay();
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

// ── Reset ─────────────────────────────────────────────────────────────────────
function resetGame() {
  if (gameMode === 'host') {
    roundNumber++;
    const cfg = getRoundConfig(roundNumber);
    myRole = cfg.hostRole;
    conn.send({ type: 'newround', guestRole: cfg.guestRole, roundNumber });
    beginRound();
  } else if (gameMode === 'guest') {
    resetBtn.style.display = 'none';
    conn.send({ type: 'requestnewgame' });
  } else {
    // local
    board = Array(9).fill(null);
    currentPlayer = 'fox';
    gameOver = false;
    statusEl.textContent = 'Kettu aloittaa! 🦊';
    resetBtn.style.display = 'none';
    drawAll();
  }
}

function returnToMenu() {
  cleanupPeer(); gameMode = 'local';
  showModeSelect();
}

// ── Init ──────────────────────────────────────────────────────────────────────
el('tokenInput').addEventListener('keydown', e => { if (e.key === 'Enter') joinGame(); });

if (location.hash.startsWith('#kjk-')) {
  showMultiplayerSetup();
} else {
  showModeSelect();
}
