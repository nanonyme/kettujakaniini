import { describe, it, expect } from 'vitest';
import { hashBlock, buildGenesisBlock, buildMoveBlock, buildScoreBlock } from './blockchain.js';
import { sha256hex, frameToJSON } from './crypto.js';

describe('hashBlock', () => {
  it('matches sha256 of the frame JSON', async () => {
    const block = buildGenesisBlock(0, 'hc', 'hr', null, null, 'sig');
    const hash = await hashBlock(block);
    expect(hash).toBe(await sha256hex(frameToJSON(block.frame)));
  });

  it('changes when the frame changes', async () => {
    const b1 = buildGenesisBlock(0, 'c1', 'r1', null, null, 's');
    const b2 = buildGenesisBlock(1, 'c1', 'r1', null, null, 's');
    expect(await hashBlock(b1)).not.toBe(await hashBlock(b2));
  });

  it('is the same regardless of signatures', async () => {
    const b1 = buildGenesisBlock(0, 'c', 'r', null, null, 'sig-a');
    const b2 = buildGenesisBlock(0, 'c', 'r', null, null, 'sig-b');
    expect(await hashBlock(b1)).toBe(await hashBlock(b2));
  });
});

describe('buildGenesisBlock', () => {
  it('creates a local genesis block with one signature', () => {
    const block = buildGenesisBlock(0, 'hc', 'hr', null, null, 'sig1');
    expect(block.frame.type).toBe('genesis');
    expect(block.signatures).toEqual(['sig1']);
    if (block.frame.type === 'genesis') {
      expect(block.frame.first_player).toBe(0);
      expect(block.frame.peer_commit).toBeNull();
      expect(block.frame.peer_random).toBeNull();
    }
  });

  it('creates a multiplayer genesis block with two signatures', () => {
    const block = buildGenesisBlock(1, 'hc', 'hr', 'pc', 'pr', 'hsig', 'gsig');
    expect(block.signatures).toEqual(['hsig', 'gsig']);
    if (block.frame.type === 'genesis') {
      expect(block.frame.first_player).toBe(1);
      expect(block.frame.peer_commit).toBe('pc');
    }
  });

  it('sets all genesis frame fields correctly', () => {
    const block = buildGenesisBlock(0, 'HC', 'HR', 'PC', 'PR', 's1', 's2');
    if (block.frame.type === 'genesis') {
      expect(block.frame.host_commit).toBe('HC');
      expect(block.frame.host_random).toBe('HR');
      expect(block.frame.peer_commit).toBe('PC');
      expect(block.frame.peer_random).toBe('PR');
    }
  });
});

describe('buildMoveBlock', () => {
  it('creates a valid move block', () => {
    const block = buildMoveBlock(3, 7, 1, 'prevhash', 'mysig');
    expect(block.frame.type).toBe('move');
    expect(block.signatures).toEqual(['mysig']);
    if (block.frame.type === 'move') {
      expect(block.frame.index).toBe(3);
      expect(block.frame.move).toBe(7);
      expect(block.frame.player).toBe(1);
      expect(block.frame.previous_hash).toBe('prevhash');
    }
  });
});

describe('buildScoreBlock', () => {
  it('creates a valid score block with fox winner', () => {
    const block = buildScoreBlock('prevhash', 0, 'fox', 'hsig', 'gsig');
    expect(block.frame.type).toBe('score');
    expect(block.signatures).toEqual(['hsig', 'gsig']);
    if (block.frame.type === 'score') {
      expect(block.frame.winner).toBe('fox');
      expect(block.frame.starter).toBe(0);
      expect(block.frame.previous_hash).toBe('prevhash');
    }
  });

  it('creates a valid score block with draw', () => {
    const block = buildScoreBlock('ph', 1, 'draw', 'h', 'g');
    if (block.frame.type === 'score') {
      expect(block.frame.winner).toBe('draw');
      expect(block.frame.starter).toBe(1);
    }
  });
});

describe('blockchain chaining', () => {
  it('hash of genesis block can be used as previous_hash for move', async () => {
    const genesis = buildGenesisBlock(0, 'hc', 'hr', null, null, 'sig');
    const genesisHash = await hashBlock(genesis);
    const move = buildMoveBlock(0, 4, 0, genesisHash, 'msig');
    if (move.frame.type === 'move') {
      expect(move.frame.previous_hash).toBe(genesisHash);
    }
  });
});
