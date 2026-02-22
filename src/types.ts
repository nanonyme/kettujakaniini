// ── Shared game and blockchain types ─────────────────────────────────────────

export type Player = 'fox' | 'rabbit';
export type Board = (Player | null)[];
export type GameMode = 'local' | 'host' | 'guest';
export type Winner = Player | 'draw';

export interface GenesisFrame {
  readonly type: 'genesis';
  readonly first_player: 0 | 1;
  readonly host_commit: string;
  readonly host_random: string;
  readonly peer_commit: string | null;
  readonly peer_random: string | null;
}

export interface MoveFrame {
  readonly type: 'move';
  readonly index: number;
  readonly move: number;
  readonly player: 0 | 1;
  readonly previous_hash: string;
}

export interface ScoreFrame {
  readonly type: 'score';
  readonly previous_hash: string;
  readonly starter: 0 | 1;
  readonly winner: Winner;
}

export type Frame = GenesisFrame | MoveFrame | ScoreFrame;

export interface Block {
  readonly frame: Frame;
  readonly signatures: string[];
}
