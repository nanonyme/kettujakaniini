/**
 * Integration test: simulates both parties executing the full two-party
 * commit-reveal handshake and verifying the resulting genesis and move blocks
 * without any network layer.
 */
import { describe, it, expect } from 'vitest';
import {
  generateKeyPair, exportPubKey, importPubKey,
  sha256hex, toHex, signFrame, verifyFrame, frameToJSON,
  deriveFirstPlayer,
} from './crypto.js';
import { hashBlock, buildGenesisBlock, buildMoveBlock, buildScoreBlock } from './blockchain.js';
import { checkWinner, getPlayerIndex } from './game-logic.js';
import type { Board, Player } from './types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build the genesis frame object that both parties independently construct. */
function makeGenesisFrame(
  firstPlayer: 0 | 1,
  hostCommit: string,
  hostRandom: string,
  guestCommit: string,
  guestRandom: string,
) {
  return {
    first_player: firstPlayer,
    host_commit:  hostCommit,
    host_random:  hostRandom,
    peer_commit:  guestCommit,
    peer_random:  guestRandom,
    type: 'genesis',
  } as const;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Two-party handshake integration', () => {
  it('both parties derive the identical genesis frame', async () => {
    const hostKP  = await generateKeyPair();
    const guestKP = await generateKeyPair();
    const hostPubB64  = await exportPubKey(hostKP.publicKey);
    const guestPubB64 = await exportPubKey(guestKP.publicKey);
    const hostViewsGuestPub = await importPubKey(guestPubB64);
    const guestViewsHostPub = await importPubKey(hostPubB64);

    // Both generate 256-bit randoms and commits
    const hostRandom  = crypto.getRandomValues(new Uint8Array(32));
    const guestRandom = crypto.getRandomValues(new Uint8Array(32));
    const hostCommit  = await sha256hex(hostRandom);
    const guestCommit = await sha256hex(guestRandom);

    // Both validate each other's commit (SHA-256(random) === received commit)
    expect(await sha256hex(hostRandom)).toBe(hostCommit);
    expect(await sha256hex(guestRandom)).toBe(guestCommit);

    // Both derive the same first_player from their own perspective
    const hostFirstPlayer  = deriveFirstPlayer(hostRandom,  guestRandom);
    const guestFirstPlayer = deriveFirstPlayer(guestRandom, hostRandom);
    expect(hostFirstPlayer).toBe(guestFirstPlayer);

    // Both independently build the genesis frame
    // Host: my=host, peer=guest
    const frameFromHost  = makeGenesisFrame(
      hostFirstPlayer, hostCommit, toHex(hostRandom), guestCommit, toHex(guestRandom),
    );
    // Guest: my=guest, peer=host  →  host_* fields still refer to the host player
    const frameFromGuest = makeGenesisFrame(
      guestFirstPlayer, hostCommit, toHex(hostRandom), guestCommit, toHex(guestRandom),
    );

    // The JSON must be byte-for-byte identical so each signature covers the same data
    expect(frameToJSON(frameFromHost)).toBe(frameToJSON(frameFromGuest));

    // Both sign and exchange signatures; each verifies the other's
    const hostGenesisSig  = await signFrame(frameFromHost,  hostKP.privateKey);
    const guestGenesisSig = await signFrame(frameFromGuest, guestKP.privateKey);
    expect(await verifyFrame(frameFromHost,  guestGenesisSig, hostViewsGuestPub)).toBe(true);
    expect(await verifyFrame(frameFromGuest, hostGenesisSig,  guestViewsHostPub)).toBe(true);

    // Wrong-key verification must fail
    expect(await verifyFrame(frameFromHost, hostGenesisSig, hostViewsGuestPub)).toBe(false);
  });

  it('a cheating commit (random changed after commit) is detected', async () => {
    const hostRandom  = crypto.getRandomValues(new Uint8Array(32));
    const guestRandom = crypto.getRandomValues(new Uint8Array(32));
    const guestCommit = await sha256hex(guestRandom);

    // Guest tries to reveal a different random than what they committed to
    const fakeRandom = crypto.getRandomValues(new Uint8Array(32));
    const recomputedCommit = await sha256hex(fakeRandom);
    expect(recomputedCommit).not.toBe(guestCommit); // detection: commit mismatch
  });

  it('full game: genesis → moves → score, chain is intact throughout', async () => {
    const hostKP  = await generateKeyPair();
    const guestKP = await generateKeyPair();
    const hostPubB64  = await exportPubKey(hostKP.publicKey);
    const guestPubB64 = await exportPubKey(guestKP.publicKey);
    const hostViewsGuestPub = await importPubKey(guestPubB64);
    const guestViewsHostPub = await importPubKey(hostPubB64);

    const hostRandom  = crypto.getRandomValues(new Uint8Array(32));
    const guestRandom = crypto.getRandomValues(new Uint8Array(32));
    const hostCommit  = await sha256hex(hostRandom);
    const guestCommit = await sha256hex(guestRandom);

    const firstPlayer = deriveFirstPlayer(hostRandom, guestRandom);

    const genesisFrame = makeGenesisFrame(
      firstPlayer, hostCommit, toHex(hostRandom), guestCommit, toHex(guestRandom),
    );
    const hostGenesisSig  = await signFrame(genesisFrame, hostKP.privateKey);
    const guestGenesisSig = await signFrame(genesisFrame, guestKP.privateKey);
    const genesisBlock = buildGenesisBlock(
      firstPlayer, hostCommit, toHex(hostRandom), guestCommit, toHex(guestRandom),
      hostGenesisSig, guestGenesisSig,
    );

    // Simulate a winning game: fox takes the top row (cells 0, 1, 2)
    // fox = firstPlayer; rabbit = 1 - firstPlayer
    const board: Board = Array(9).fill(null);
    const chain = [genesisBlock];
    let currentPlayer: Player = 'fox';
    let moveIdx = 0;

    const moves = [0, 3, 1, 4, 2]; // fox: 0,1,2  rabbit: 3,4

    for (const cell of moves) {
      const prevHash  = await hashBlock(chain[chain.length - 1]);
      const playerIdx = getPlayerIndex(currentPlayer, firstPlayer);
      const frame     = { index: moveIdx, move: cell, player: playerIdx, previous_hash: prevHash, type: 'move' } as const;

      // The current player signs
      const signerKP = playerIdx === 0 ? hostKP : guestKP;
      const sig = await signFrame(frame, signerKP.privateKey);
      const block = buildMoveBlock(moveIdx, cell, playerIdx, prevHash, sig);
      chain.push(block);
      moveIdx++;

      // The other party validates the signature
      const verifierPub = playerIdx === 0 ? guestViewsHostPub : hostViewsGuestPub;
      expect(await verifyFrame(frame, sig, verifierPub)).toBe(true);

      board[cell] = currentPlayer;
      const winner = checkWinner(board);
      if (winner) {
        // Both sign score block
        const scorePrevHash = await hashBlock(chain[chain.length - 1]);
        const scoreFrame = { previous_hash: scorePrevHash, starter: firstPlayer, type: 'score', winner } as const;
        const hostScoreSig  = await signFrame(scoreFrame, hostKP.privateKey);
        const guestScoreSig = await signFrame(scoreFrame, guestKP.privateKey);
        expect(await verifyFrame(scoreFrame, guestScoreSig, hostViewsGuestPub)).toBe(true);
        expect(await verifyFrame(scoreFrame, hostScoreSig,  guestViewsHostPub)).toBe(true);
        const scoreBlock = buildScoreBlock(scorePrevHash, firstPlayer, winner, hostScoreSig, guestScoreSig);
        chain.push(scoreBlock);
        expect(winner).toBe('fox');
        break;
      }
      currentPlayer = currentPlayer === 'fox' ? 'rabbit' : 'fox';
    }

    // Verify the full chain is consistent
    for (let i = 1; i < chain.length; i++) {
      const expectedPrevHash = await hashBlock(chain[i - 1]);
      const frame = chain[i].frame;
      if (frame.type === 'move' || frame.type === 'score') {
        expect(frame.previous_hash).toBe(expectedPrevHash);
      }
    }

    expect(chain).toHaveLength(7); // genesis + 5 moves + score
  });

  it('tampering with a move frame breaks subsequent chain links', async () => {
    const kp = await generateKeyPair();
    const hostRandom  = crypto.getRandomValues(new Uint8Array(32));
    const hostCommit  = await sha256hex(hostRandom);

    const genesis = buildGenesisBlock(0, hostCommit, toHex(hostRandom), null, null,
      await signFrame({ first_player: 0, host_commit: hostCommit, host_random: toHex(hostRandom), peer_commit: null, peer_random: null, type: 'genesis' }, kp.privateKey),
    );
    const prevHash = await hashBlock(genesis);
    const moveFrame = { index: 0, move: 4, player: 0, previous_hash: prevHash, type: 'move' } as const;
    const sig = await signFrame(moveFrame, kp.privateKey);
    const moveBlock = buildMoveBlock(0, 4, 0, prevHash, sig);

    // A subsequent block links to the real move block
    const realHash    = await hashBlock(moveBlock);

    // If we tamper with the move (change cell 4 to cell 5), the hash changes
    const tamperedBlock = buildMoveBlock(0, 5, 0, prevHash, sig);
    const tamperedHash  = await hashBlock(tamperedBlock);

    expect(realHash).not.toBe(tamperedHash);
    // The next block's previous_hash would no longer match
  });
});
