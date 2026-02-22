// ── Blockchain block construction and hashing ─────────────────────────────────
import { sha256hex, frameToJSON } from './crypto.js';
import type { Block, GenesisFrame, MoveFrame, ScoreFrame, Winner } from './types.js';

export type { Block };

/** SHA-256 of the frame JSON, returned as hex. Used as the chain link hash. */
export async function hashBlock(block: Block): Promise<string> {
  return sha256hex(frameToJSON(block.frame));
}

/**
 * Build a genesis block.
 * In local mode peer_commit/peer_random are null and guestSig is omitted.
 */
export function buildGenesisBlock(
  firstPlayer: 0 | 1,
  hostCommit: string,
  hostRandom: string,
  peerCommit: string | null,
  peerRandom: string | null,
  hostSig: string,
  guestSig?: string,
): Block {
  const frame: GenesisFrame = {
    type: 'genesis',
    first_player: firstPlayer,
    host_commit: hostCommit,
    host_random: hostRandom,
    peer_commit: peerCommit,
    peer_random: peerRandom,
  };
  const signatures = guestSig !== undefined ? [hostSig, guestSig] : [hostSig];
  return { frame, signatures };
}

/** Build a move block (signed by the moving player only). */
export function buildMoveBlock(
  index: number,
  move: number,
  player: 0 | 1,
  previousHash: string,
  sig: string,
): Block {
  const frame: MoveFrame = {
    type: 'move',
    index,
    move,
    player,
    previous_hash: previousHash,
  };
  return { frame, signatures: [sig] };
}

/** Build a score block (signed by both host and guest). */
export function buildScoreBlock(
  previousHash: string,
  starter: 0 | 1,
  winner: Winner,
  hostSig: string,
  guestSig: string,
): Block {
  const frame: ScoreFrame = {
    type: 'score',
    previous_hash: previousHash,
    starter,
    winner,
  };
  return { frame, signatures: [hostSig, guestSig] };
}
