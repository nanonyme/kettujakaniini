// ── Pure game logic (no DOM, fully testable) ──────────────────────────────────
import type { Player, Board, Winner } from './types.js';

export type { Player, Board, Winner };

export const BOARD_SIZE = 9;

export const WIN_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

/** Return the winning player, 'draw', or null if the game is still in progress. */
export function checkWinner(board: Board): Winner | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Player;
    }
  }
  if (board.every(Boolean)) return 'draw';
  return null;
}

export function otherPlayer(player: Player): Player {
  return player === 'fox' ? 'rabbit' : 'fox';
}

/**
 * Map 'fox'/'rabbit' to the player index (0 = host, 1 = guest).
 * Fox always moves first; firstPlayer is the index of the player who plays fox.
 */
export function getPlayerIndex(player: Player, firstPlayer: 0 | 1): 0 | 1 {
  return player === 'fox' ? firstPlayer : ((1 - firstPlayer) as 0 | 1);
}

/**
 * Determine myRole ('fox' | 'rabbit') for the local player.
 * @param gameMode 'host' or 'guest'
 * @param firstPlayer the player index (0 = host, 1 = guest) who plays fox
 */
export function getMyRole(gameMode: 'host' | 'guest', firstPlayer: 0 | 1): Player {
  return (gameMode === 'host' ? firstPlayer === 0 : firstPlayer === 1) ? 'fox' : 'rabbit';
}
