import { describe, it, expect } from 'vitest';
import {
  checkWinner, otherPlayer, getPlayerIndex, getMyRole,
  WIN_LINES, BOARD_SIZE,
} from './game-logic.js';
import type { Board } from './types.js';

describe('checkWinner', () => {
  const empty: Board = Array(BOARD_SIZE).fill(null);

  it('returns null for an empty board', () => {
    expect(checkWinner(empty)).toBeNull();
  });

  it('returns null for an in-progress board', () => {
    const b: Board = [...empty];
    b[0] = 'fox'; b[4] = 'rabbit';
    expect(checkWinner(b)).toBeNull();
  });

  it('detects a fox row win', () => {
    const b: Board = ['fox', 'fox', 'fox', null, null, null, null, null, null];
    expect(checkWinner(b)).toBe('fox');
  });

  it('detects a rabbit column win', () => {
    const b: Board = ['rabbit', null, null, 'rabbit', null, null, 'rabbit', null, null];
    expect(checkWinner(b)).toBe('rabbit');
  });

  it('detects a diagonal win', () => {
    const b: Board = ['fox', null, null, null, 'fox', null, null, null, 'fox'];
    expect(checkWinner(b)).toBe('fox');
  });

  it('detects a draw', () => {
    // A no-win full board
    const b: Board = ['fox', 'rabbit', 'fox', 'fox', 'rabbit', 'fox', 'rabbit', 'fox', 'rabbit'];
    expect(checkWinner(b)).toBe('draw');
  });

  it('covers all WIN_LINES for fox', () => {
    for (const [a, b, c] of WIN_LINES) {
      const board: Board = Array(BOARD_SIZE).fill(null);
      board[a] = 'fox'; board[b] = 'fox'; board[c] = 'fox';
      expect(checkWinner(board)).toBe('fox');
    }
  });

  it('covers all WIN_LINES for rabbit', () => {
    for (const [a, b, c] of WIN_LINES) {
      const board: Board = Array(BOARD_SIZE).fill(null);
      board[a] = 'rabbit'; board[b] = 'rabbit'; board[c] = 'rabbit';
      expect(checkWinner(board)).toBe('rabbit');
    }
  });
});

describe('otherPlayer', () => {
  it('returns rabbit for fox', () => expect(otherPlayer('fox')).toBe('rabbit'));
  it('returns fox for rabbit', () => expect(otherPlayer('rabbit')).toBe('fox'));
  it('is its own inverse', () => {
    expect(otherPlayer(otherPlayer('fox'))).toBe('fox');
    expect(otherPlayer(otherPlayer('rabbit'))).toBe('rabbit');
  });
});

describe('getPlayerIndex', () => {
  it('fox has index = firstPlayer', () => {
    expect(getPlayerIndex('fox', 0)).toBe(0);
    expect(getPlayerIndex('fox', 1)).toBe(1);
  });

  it('rabbit has index = 1 - firstPlayer', () => {
    expect(getPlayerIndex('rabbit', 0)).toBe(1);
    expect(getPlayerIndex('rabbit', 1)).toBe(0);
  });
});

describe('getMyRole', () => {
  it('host is fox when firstPlayer = 0', () => {
    expect(getMyRole('host', 0)).toBe('fox');
  });

  it('host is rabbit when firstPlayer = 1', () => {
    expect(getMyRole('host', 1)).toBe('rabbit');
  });

  it('guest is fox when firstPlayer = 1', () => {
    expect(getMyRole('guest', 1)).toBe('fox');
  });

  it('guest is rabbit when firstPlayer = 0', () => {
    expect(getMyRole('guest', 0)).toBe('rabbit');
  });
});

describe('WIN_LINES', () => {
  it('has 8 winning lines', () => {
    expect(WIN_LINES.length).toBe(8);
  });

  it('all indices are within board bounds', () => {
    for (const line of WIN_LINES) {
      for (const idx of line) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(BOARD_SIZE);
      }
    }
  });
});

describe('BOARD_SIZE', () => {
  it('is 9', () => expect(BOARD_SIZE).toBe(9));
});
