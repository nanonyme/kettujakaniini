// ── Entry point: DOM wiring, drawing, networking, and game orchestration ──────
import {
  toHex, fromHex, sha256hex,
  generateKeyPair, exportPubKey, importPubKey,
  signFrame, verifyFrame, frameToJSON,
  deriveFirstPlayer,
} from './crypto.js';
import { hashBlock, buildGenesisBlock } from './blockchain.js';
import { checkWinner, otherPlayer, getPlayerIndex, getMyRole, WIN_LINES, BOARD_SIZE } from './game-logic.js';
import type { Player, Board, Winner, GameMode, Block, Frame } from './types.js';

// ── State ─────────────────────────────────────────────────────────────────────
let board: Board = Array(BOARD_SIZE).fill(null);
let currentPlayer: Player = 'fox';
let gameOver = false;

// Multiplayer
let gameMode: GameMode = 'local';
let peer: PeerJSInstance | null = null;
let conn: PeerJSDataConnection | null = null;
let myRole: Player | null = null;
let sessionTimer: ReturnType<typeof setInterval> | null = null;

// Blockchain & Cryptography
let blockchain: Block[] = [];
let moveIndex = 0;            // global move counter, never resets between games
let firstPlayer: 0 | 1 = 0;  // player index who plays fox (goes first) this game
let gameStarter: 0 | 1 = 0;  // firstPlayer at game start; used in score block
let myKeyPair: CryptoKeyPair | null = null;
let myPubKeyB64: string | null = null;
let peerPubKey: CryptoKey | null = null;
let myRandom32: Uint8Array | null = null;
let myCommitHex: string | null = null;
let peerCommitHex: string | null = null;
let peerRandomHex: string | null = null;
let pendingScoreFrame: Frame | null = null;
let myScoreSig: string | null = null;
let peerScoreSigHex: string | null = null;
let resolveHandshakeStep: ((msg: Record<string, unknown>) => void) | null = null;
let handshakeQueue: Record<string, unknown>[] = [];

const SESSION_SECONDS = 900; // 15 minutes

// ── DOM refs ──────────────────────────────────────────────────────────────────
const canvas      = document.getElementById('canvas') as HTMLCanvasElement;
const ctx         = canvas.getContext('2d') as CanvasRenderingContext2D;
const statusEl    = document.getElementById('status') as HTMLElement;
const resetBtn    = document.getElementById('resetBtn') as HTMLButtonElement;
const lockOverlay = document.getElementById('lockOverlay') as HTMLElement;
const roleEl      = document.getElementById('roleIndicator') as HTMLElement;

// ── Canvas setup ──────────────────────────────────────────────────────────────
function cellSize(): number {
  const maxW = Math.min(window.innerWidth - 32, 420);
  return Math.floor(maxW / 3);
}

function resizeCanvas(): void {
  const cs = cellSize();
  canvas.width = cs * 3;
  canvas.height = cs * 3;
  drawAll();
}

window.addEventListener('resize', () => {
  if (!document.getElementById('gameArea')!.classList.contains('hidden')) resizeCanvas();
});

// ── Drawing helpers ───────────────────────────────────────────────────────────

function drawFox(c: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  c.beginPath();
  c.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  c.fillStyle = '#e06c2e';
  c.fill();

  c.beginPath();
  c.arc(cx - r * 0.22, cy + r * 0.18, r * 0.28, 0, Math.PI * 2);
  c.arc(cx + r * 0.22, cy + r * 0.18, r * 0.28, 0, Math.PI * 2);
  c.fillStyle = '#fff8f0';
  c.fill();

  [-1, 1].forEach(side => {
    c.beginPath();
    c.moveTo(cx + side * r * 0.28, cy - r * 0.55);
    c.lineTo(cx + side * r * 0.72, cy - r * 1.05);
    c.lineTo(cx + side * r * 0.72, cy - r * 0.38);
    c.closePath();
    c.fillStyle = '#e06c2e';
    c.fill();
    c.beginPath();
    c.moveTo(cx + side * r * 0.34, cy - r * 0.58);
    c.lineTo(cx + side * r * 0.65, cy - r * 0.92);
    c.lineTo(cx + side * r * 0.65, cy - r * 0.46);
    c.closePath();
    c.fillStyle = '#c04000';
    c.fill();
  });

  [-1, 1].forEach(side => {
    c.beginPath();
    c.arc(cx + side * r * 0.28, cy - r * 0.1, r * 0.12, 0, Math.PI * 2);
    c.fillStyle = '#1a0a00';
    c.fill();
    c.beginPath();
    c.arc(cx + side * r * 0.28 + r * 0.04, cy - r * 0.1 - r * 0.04, r * 0.04, 0, Math.PI * 2);
    c.fillStyle = '#fff';
    c.fill();
  });

  c.beginPath();
  c.moveTo(cx, cy + r * 0.18);
  c.lineTo(cx - r * 0.09, cy + r * 0.08);
  c.lineTo(cx + r * 0.09, cy + r * 0.08);
  c.closePath();
  c.fillStyle = '#1a0a00';
  c.fill();

  c.beginPath();
  c.arc(cx + r * 0.7, cy + r * 0.6, r * 0.38, Math.PI * 0.3, Math.PI * 1.4);
  c.strokeStyle = '#e06c2e';
  c.lineWidth = r * 0.18;
  c.lineCap = 'round';
  c.stroke();
  c.beginPath();
  c.arc(cx + r * 1.02, cy + r * 0.42, r * 0.16, 0, Math.PI * 2);
  c.fillStyle = '#fff8f0';
  c.fill();
}

function drawRabbit(c: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  [-1, 1].forEach(side => {
    const ex = cx + side * r * 0.28;
    const ey = cy - r * 0.55;
    const ew = r * 0.22;
    const eh = r * 0.9;
    c.beginPath();
    c.ellipse(ex, ey - eh * 0.35, ew, eh * 0.7, 0, 0, Math.PI * 2);
    c.fillStyle = '#4a90d9';
    c.fill();
    c.beginPath();
    c.ellipse(ex, ey - eh * 0.35, ew * 0.48, eh * 0.5, 0, 0, Math.PI * 2);
    c.fillStyle = '#a8d0f0';
    c.fill();
  });

  c.beginPath();
  c.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  c.fillStyle = '#4a90d9';
  c.fill();

  c.beginPath();
  c.arc(cx - r * 0.22, cy + r * 0.2, r * 0.26, 0, Math.PI * 2);
  c.arc(cx + r * 0.22, cy + r * 0.2, r * 0.26, 0, Math.PI * 2);
  c.fillStyle = '#e8f4ff';
  c.fill();

  [-1, 1].forEach(side => {
    c.beginPath();
    c.arc(cx + side * r * 0.28, cy - r * 0.08, r * 0.13, 0, Math.PI * 2);
    c.fillStyle = '#1a1a2e';
    c.fill();
    c.beginPath();
    c.arc(cx + side * r * 0.28 + r * 0.04, cy - r * 0.08 - r * 0.04, r * 0.04, 0, Math.PI * 2);
    c.fillStyle = '#fff';
    c.fill();
  });

  c.beginPath();
  c.ellipse(cx, cy + r * 0.14, r * 0.1, r * 0.07, 0, 0, Math.PI * 2);
  c.fillStyle = '#f9a0b0';
  c.fill();

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

  c.beginPath();
  c.arc(cx - r * 0.82, cy + r * 0.3, r * 0.22, 0, Math.PI * 2);
  c.fillStyle = '#e8f4ff';
  c.fill();
}

// ── Grid drawing ──────────────────────────────────────────────────────────────
function drawGrid(): void {
  const cs = cellSize();
  const w = cs * 3, h = cs * 3;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff9ee';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = Math.max(2, cs * 0.025);
  ctx.lineCap = 'round';
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(i * cs, cs * 0.1); ctx.lineTo(i * cs, h - cs * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cs * 0.1, i * cs); ctx.lineTo(w - cs * 0.1, i * cs); ctx.stroke();
  }
}

function drawAll(): void {
  const cs = cellSize();
  drawGrid();
  for (let i = 0; i < BOARD_SIZE; i++) {
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
function drawLegends(): void {
  const lf = document.getElementById('legendFox') as HTMLCanvasElement;
  const lr = document.getElementById('legendRabbit') as HTMLCanvasElement;
  [lf, lr].forEach(c => { c.width = 36; c.height = 36; });
  drawFox(lf.getContext('2d') as CanvasRenderingContext2D, 18, 20, 14);
  drawRabbit(lr.getContext('2d') as CanvasRenderingContext2D, 18, 20, 14);
}

// ── Multiplayer helpers ───────────────────────────────────────────────────────

function generateToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function isMyTurn(): boolean {
  return gameMode === 'local' || myRole === currentPlayer;
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function el(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}
function show(id: string): void { el(id).classList.remove('hidden'); }
function hide(id: string): void { el(id).classList.add('hidden'); }

function showMpPanel(id: string): void {
  ['mpChoice', 'hostPanel', 'connectingPanel'].forEach(p =>
    el(p).classList.toggle('hidden', p !== id));
}

// ── UI navigation ─────────────────────────────────────────────────────────────
function showModeSelect(): void {
  show('modeOverlay'); hide('mpOverlay'); hide('gameArea');
  cleanupPeer();
}

function showMultiplayerSetup(): void {
  hide('modeOverlay'); show('mpOverlay'); hide('gameArea');
  showMpPanel('mpChoice');
  if (location.hash.startsWith('#kjk-'))
    (el('tokenInput') as HTMLInputElement).value = location.hash.slice(5);
}

function showGameArea(): void {
  hide('modeOverlay'); hide('mpOverlay'); show('gameArea');
  resizeCanvas();
  drawLegends();
}

function updateLockOverlay(): void {
  lockOverlay.classList.toggle('hidden', gameMode === 'local' || gameOver || isMyTurn());
}

function updateRoleDisplay(): void {
  if (gameMode === 'local') { roleEl.classList.add('hidden'); return; }
  roleEl.classList.remove('hidden');
  roleEl.textContent = myRole === 'fox' ? 'Sinä olet: 🦊 Kettu' : 'Sinä olet: 🐰 Kaniini';
}

function updateStatus(): void {
  if (gameMode === 'local') {
    statusEl.textContent = currentPlayer === 'fox' ? 'Kettu 🦊 vuoro' : 'Kaniini 🐰 vuoro';
  } else {
    statusEl.textContent = isMyTurn() ? 'Sinun vuorosi!' : 'Vastustajan vuoro…';
  }
}

// ── Blockchain management ─────────────────────────────────────────────────────

/** Show a sync error, disconnect and return to menu. */
function syncError(msg: string): void {
  gameOver = true;
  lockOverlay.classList.add('hidden');
  cleanupPeer();
  gameMode = 'local';
  setTimeout(() => { alert('Synkronointivirhe: ' + msg); showModeSelect(); }, 50);
}

/** Return a promise that resolves with the next handshake message. */
function waitForMsg(): Promise<Record<string, unknown>> {
  return new Promise(resolve => {
    if (handshakeQueue.length > 0) {
      resolve(handshakeQueue.shift()!);
    } else {
      resolveHandshakeStep = resolve;
    }
  });
}

/**
 * Cryptographic handshake (called by both host and guest after connection opens).
 * Performs commit-reveal key exchange, derives first_player, builds and signs genesis block.
 */
async function initHandshake(): Promise<void> {
  myKeyPair = await generateKeyPair();
  myPubKeyB64 = await exportPubKey(myKeyPair.publicKey);
  moveIndex = 0;
  blockchain = [];
  handshakeQueue = [];
  pendingScoreFrame = null;
  myScoreSig = null;
  peerScoreSigHex = null;

  // Step 1: exchange public keys
  conn!.send({ type: 'pubkey', key: myPubKeyB64 });
  const pubkeyMsg = await waitForMsg();
  peerPubKey = await importPubKey(pubkeyMsg['key'] as string);

  // Step 2: exchange SHA-256 commits of 256-bit random numbers
  myRandom32 = new Uint8Array(32);
  crypto.getRandomValues(myRandom32);
  myCommitHex = await sha256hex(myRandom32);
  conn!.send({ type: 'commit', commit: myCommitHex });
  const commitMsg = await waitForMsg();
  peerCommitHex = commitMsg['commit'] as string;

  // Step 3: reveal random numbers
  conn!.send({ type: 'random', random: toHex(myRandom32) });
  const randomMsg = await waitForMsg();
  peerRandomHex = randomMsg['random'] as string;

  // Validate peer's commit
  const peerRandomBytes = fromHex(peerRandomHex);
  if (await sha256hex(peerRandomBytes) !== peerCommitHex) {
    syncError('Vastustaja huijasi satunnaisluvulla!'); return;
  }

  // Determine first_player using full entropy of both randoms
  firstPlayer = deriveFirstPlayer(myRandom32, peerRandomBytes);
  gameStarter = firstPlayer;

  // Step 4: build genesis frame (both parties produce identical JSON)
  const genesisFrame = {
    first_player: firstPlayer,
    host_commit:  gameMode === 'host' ? myCommitHex    : peerCommitHex,
    host_random:  gameMode === 'host' ? toHex(myRandom32) : peerRandomHex,
    peer_commit:  gameMode === 'host' ? peerCommitHex  : myCommitHex,
    peer_random:  gameMode === 'host' ? peerRandomHex  : toHex(myRandom32),
    type: 'genesis',
  };
  const myGenesisSig = await signFrame(genesisFrame, myKeyPair.privateKey);
  conn!.send({ type: 'genesis_sig', signature: myGenesisSig });
  const genesisSigMsg = await waitForMsg();
  const peerGenesisSig = genesisSigMsg['signature'] as string;

  if (!await verifyFrame(genesisFrame, peerGenesisSig, peerPubKey)) {
    syncError('Geneesilohkon allekirjoitusvirhe!'); return;
  }

  const hostSig  = gameMode === 'host' ? myGenesisSig  : peerGenesisSig;
  const guestSig = gameMode === 'host' ? peerGenesisSig : myGenesisSig;
  blockchain = [buildGenesisBlock(
    firstPlayer,
    genesisFrame.host_commit, genesisFrame.host_random,
    genesisFrame.peer_commit, genesisFrame.peer_random,
    hostSig, guestSig,
  )];

  myRole = getMyRole(gameMode as 'host' | 'guest', firstPlayer);
  showGameArea();
  beginRound();
}

/** Create a signed move block, record it in the blockchain, optionally send to peer. */
async function recordAndApplyMove(idx: number): Promise<void> {
  const prevHash = await hashBlock(blockchain[blockchain.length - 1]);
  const playerIdx = getPlayerIndex(currentPlayer, firstPlayer);
  const frame = {
    index:         moveIndex,
    move:          idx,
    player:        playerIdx,
    previous_hash: prevHash,
    type:          'move',
  };
  const sig = await signFrame(frame, myKeyPair!.privateKey);
  const block: Block = { frame: frame as Frame, signatures: [sig] };
  blockchain.push(block);
  moveIndex++;
  if (gameMode !== 'local' && conn) conn.send({ type: 'move', block });
  applyMove(idx);
}

/** Receive, validate and apply a move block from the peer. */
async function onRemoteMoveBlock(block: Block): Promise<void> {
  const prevHash = await hashBlock(blockchain[blockchain.length - 1]);
  if (block.frame.type !== 'move') { syncError('Väärä lohkotyyppi!'); return; }
  if (block.frame.previous_hash !== prevHash) { syncError('Siirtoketju ei täsmää!'); return; }
  if (block.frame.player !== getPlayerIndex(currentPlayer, firstPlayer)) { syncError('Väärä pelaaja siirtolohkossa!'); return; }
  if (block.frame.index !== moveIndex) { syncError('Väärä siirtoindeksi!'); return; }
  if (block.frame.move < 0 || block.frame.move > 8 || board[block.frame.move]) { syncError('Virheellinen siirto!'); return; }
  if (!await verifyFrame(block.frame, block.signatures[0], peerPubKey!)) { syncError('Siirtolohkon allekirjoitus epäkelpo!'); return; }
  blockchain.push(block);
  moveIndex++;
  applyMove(block.frame.move);
}

/** Sign and (in multiplayer) send score signature; finalize block when both sigs available. */
async function finalizeScore(winner: Winner): Promise<void> {
  const prevHash = await hashBlock(blockchain[blockchain.length - 1]);
  const frame = {
    previous_hash: prevHash,
    starter:       gameStarter,
    type:          'score',
    winner,
  };
  pendingScoreFrame = frame as Frame;
  myScoreSig = await signFrame(frame, myKeyPair!.privateKey);
  if (gameMode !== 'local') {
    conn!.send({ type: 'score_sig', signature: myScoreSig });
    if (peerScoreSigHex) await completeScoreBlock();
  } else {
    blockchain.push({ frame: pendingScoreFrame, signatures: [myScoreSig] });
  }
}

/** Handle incoming score_sig from peer. */
async function onScoreSig(sigHex: string): Promise<void> {
  peerScoreSigHex = sigHex;
  if (pendingScoreFrame && myScoreSig) await completeScoreBlock();
}

/** Validate peer's score signature and commit the final score block. */
async function completeScoreBlock(): Promise<void> {
  if (!await verifyFrame(pendingScoreFrame!, peerScoreSigHex!, peerPubKey!)) {
    syncError('Pistelohkon allekirjoitus epäkelpo!'); return;
  }
  const hostSig  = gameMode === 'host' ? myScoreSig!    : peerScoreSigHex!;
  const guestSig = gameMode === 'host' ? peerScoreSigHex! : myScoreSig!;
  blockchain.push({ frame: pendingScoreFrame!, signatures: [hostSig, guestSig] });
  pendingScoreFrame = null;
  myScoreSig = null;
  peerScoreSigHex = null;
}

// ── Local mode ────────────────────────────────────────────────────────────────
async function startLocal(): Promise<void> {
  gameMode = 'local';
  myKeyPair = await generateKeyPair();
  myRandom32 = new Uint8Array(32);
  crypto.getRandomValues(myRandom32);
  myCommitHex = await sha256hex(myRandom32);
  firstPlayer = 0;
  gameStarter = 0;
  moveIndex = 0;
  const genesisFrame = {
    first_player: 0 as const,
    host_commit:  myCommitHex,
    host_random:  toHex(myRandom32),
    peer_commit:  null,
    peer_random:  null,
    type: 'genesis' as const,
  };
  const sig = await signFrame(genesisFrame, myKeyPair.privateKey);
  blockchain = [buildGenesisBlock(0, myCommitHex, toHex(myRandom32), null, null, sig)];
  showGameArea();
  beginRound();
}

// ── Host mode ─────────────────────────────────────────────────────────────────
function startHosting(): void {
  const token = generateToken();
  el('shareUrl')!.setAttribute('value', location.origin + location.pathname + '#kjk-' + token);
  (el('shareUrl') as HTMLInputElement).value = location.origin + location.pathname + '#kjk-' + token;
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
        clearInterval(sessionTimer!); sessionTimer = null;
        cancelSession('Sessio vanheni. Luo uusi peli.');
      }
    }, 1000);
  });

  peer.on('connection', incoming => {
    if (conn) { incoming.close(); return; }
    clearInterval(sessionTimer!); sessionTimer = null;
    conn = incoming;
    gameMode = 'host';
    wireConn();
    const doHandshake = (): void => {
      peer!.disconnect();
      initHandshake().catch(e => cancelSession('Yhteysongelma: ' + (e as Error).message));
    };
    if (conn.open) { doHandshake(); } else { conn.on('open', doHandshake); }
  });
}

function updateTimer(sec: number): void {
  const m = Math.floor(sec / 60), s = sec % 60;
  el('sessionTimer').textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

function cancelSession(msg?: string): void {
  cleanupPeer();
  showModeSelect();
  if (msg) setTimeout(() => alert(msg), 50);
}

function copyLink(): void {
  const url = (el('shareUrl') as HTMLInputElement).value;
  navigator.clipboard.writeText(url).catch(() => {
    (el('shareUrl') as HTMLInputElement).select();
    alert('Kopioi linkki manuaalisesti: Ctrl+C / ⌘C');
  });
}

function shareInvite(): void {
  const url = (el('shareUrl') as HTMLInputElement).value;
  if (navigator.share) {
    navigator.share({ title: 'Kettu ja Kaniini', text: 'Liity peliin!', url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).catch(() => {
      (el('shareUrl') as HTMLInputElement).select();
      alert('Kopioi linkki manuaalisesti: Ctrl+C / ⌘C');
    });
  }
}

// ── Guest mode ────────────────────────────────────────────────────────────────
function joinGame(): void {
  let t = (el('tokenInput') as HTMLInputElement).value.trim();
  if (!t) { alert('Syötä liitymiskoodi!'); return; }
  if (t.includes('#kjk-')) {
    t = t.split('#kjk-')[1];
  } else if (t.startsWith('kjk-')) {
    t = t.slice(4);
  }
  showMpPanel('connectingPanel');

  peer = new Peer();
  peer.on('error', err => cancelSession('Yhteysongelma: ' + err.type));
  peer.on('open', () => {
    conn = peer!.connect('kjk-' + t, { reliable: true });
    gameMode = 'guest';
    wireConn();
    conn.on('open', () => {
      history.replaceState(null, '', location.pathname + location.search);
      initHandshake().catch(e => cancelSession('Yhteysongelma: ' + (e as Error).message));
    });
  });
}

// ── Connection management ─────────────────────────────────────────────────────
function wireConn(): void {
  conn!.on('data', onRemoteData);
  conn!.on('close', onDisconnect);
  conn!.on('error', onDisconnect);
}

function onDisconnect(): void {
  if (!peer) return;
  cleanupPeer(); gameMode = 'local';
  setTimeout(() => { alert('Yhteys katkesi. Peli päättyi.'); showModeSelect(); }, 50);
}

function onRemoteData(data: unknown): void {
  const msg = data as Record<string, unknown>;
  if (['pubkey', 'commit', 'random', 'genesis_sig'].includes(msg['type'] as string)) {
    if (resolveHandshakeStep) {
      const resolve = resolveHandshakeStep;
      resolveHandshakeStep = null;
      resolve(msg);
    } else {
      handshakeQueue.push(msg);
    }
  } else if (msg['type'] === 'move') {
    onRemoteMoveBlock(msg['block'] as Block).catch(e => console.error(e));
  } else if (msg['type'] === 'score_sig') {
    onScoreSig(msg['signature'] as string).catch(e => console.error(e));
  } else if (msg['type'] === 'newround') {
    gameStarter = msg['starter'] as 0 | 1;
    firstPlayer = msg['starter'] as 0 | 1;
    myRole = getMyRole(gameMode as 'host' | 'guest', firstPlayer);
    beginRound();
  } else if (msg['type'] === 'requestnewgame') {
    if (gameMode === 'host' && gameOver) resetGame();
  }
}

function cleanupPeer(): void {
  if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null; }
  if (conn) { try { conn.close(); } catch (_) {} conn = null; }
  if (peer) { try { peer.destroy(); } catch (_) {} peer = null; }
  myRole = null;
}

// ── Round / game logic ────────────────────────────────────────────────────────
function beginRound(): void {
  board = Array(BOARD_SIZE).fill(null);
  currentPlayer = 'fox';
  gameOver = false;
  pendingScoreFrame = null;
  myScoreSig = null;
  peerScoreSigHex = null;
  resetBtn.style.display = 'none';
  updateRoleDisplay();
  updateStatus();
  updateLockOverlay();
  drawAll();
}

// ── Click / tap handler ───────────────────────────────────────────────────────
function handleClick(e: { clientX: number; clientY: number }): void {
  if (gameOver || !isMyTurn()) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top)  * (canvas.height / rect.height);
  const cs = cellSize();
  const idx = Math.floor(y / cs) * 3 + Math.floor(x / cs);
  if (board[idx]) return;
  recordAndApplyMove(idx).catch(e => console.error(e));
}

function applyMove(idx: number): void {
  board[idx] = currentPlayer;
  drawAll();

  const winner = checkWinner(board);
  if (winner === 'draw') {
    gameOver = true;
    statusEl.textContent = 'Tasapeli! 🤝';
    resetBtn.style.display = 'inline-block';
    lockOverlay.classList.add('hidden');
    finalizeScore('draw').catch(e => console.error(e));
  } else if (winner) {
    gameOver = true;
    statusEl.textContent = (winner === 'fox' ? 'Kettu 🦊' : 'Kaniini 🐰') + ' voitti!';
    resetBtn.style.display = 'inline-block';
    lockOverlay.classList.add('hidden');
    highlightWinner();
    finalizeScore(winner).catch(e => console.error(e));
  } else {
    currentPlayer = otherPlayer(currentPlayer);
    updateStatus();
    updateLockOverlay();
  }
}

function highlightWinner(): void {
  const cs = cellSize();
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      const c1 = { x: (a % 3) * cs + cs / 2, y: Math.floor(a / 3) * cs + cs / 2 };
      const c2 = { x: (c % 3) * cs + cs / 2, y: Math.floor(c / 3) * cs + cs / 2 };
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
function resetGame(): void {
  if (gameMode === 'host') {
    gameStarter = ((gameStarter + 1) % 2) as 0 | 1;
    firstPlayer = gameStarter;
    myRole = getMyRole('host', firstPlayer);
    conn!.send({ type: 'newround', starter: gameStarter });
    beginRound();
  } else if (gameMode === 'guest') {
    resetBtn.style.display = 'none';
    conn!.send({ type: 'requestnewgame' });
  } else {
    beginRound();
  }
}

function returnToMenu(): void {
  cleanupPeer(); gameMode = 'local';
  showModeSelect();
}

// ── Init ──────────────────────────────────────────────────────────────────────
(el('tokenInput') as HTMLInputElement).addEventListener('keydown', e => {
  if ((e as KeyboardEvent).key === 'Enter') joinGame();
});

// Wire up button event listeners (removing inline onclick from HTML is not required;
// these calls are also made available as global functions for the onclick attributes).
el('resetBtn').addEventListener('click', resetGame);
el('menuBtn').addEventListener('click', returnToMenu);

if (location.hash.startsWith('#kjk-')) {
  showMultiplayerSetup();
} else {
  showModeSelect();
}

// Expose functions called by inline onclick attributes in index.html
declare global {
  interface Window {
    startLocal: () => void;
    showMultiplayerSetup: () => void;
    startHosting: () => void;
    joinGame: () => void;
    cancelSession: (msg?: string) => void;
    copyLink: () => void;
    shareInvite: () => void;
    showModeSelect: () => void;
  }
}

window.startLocal = () => startLocal().catch(e => console.error(e));
window.showMultiplayerSetup = showMultiplayerSetup;
window.startHosting = startHosting;
window.joinGame = joinGame;
window.cancelSession = cancelSession;
window.copyLink = copyLink;
window.shareInvite = shareInvite;
window.showModeSelect = showModeSelect;
