import { describe, it, expect } from 'vitest';
import {
  toHex, fromHex, sha256hex, frameToJSON,
  generateKeyPair, exportPubKey, importPubKey,
  signFrame, verifyFrame, deriveFirstPlayer,
} from './crypto.js';

describe('toHex / fromHex', () => {
  it('roundtrips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect(fromHex(toHex(bytes))).toEqual(bytes);
  });

  it('pads single-digit hex values', () => {
    expect(toHex(new Uint8Array([0, 15, 16]))).toBe('000f10');
  });

  it('fromHex handles all hex pairs', () => {
    expect(fromHex('ff00ab')).toEqual(new Uint8Array([255, 0, 171]));
  });
});

describe('sha256hex', () => {
  it('matches known SHA-256 of empty string', async () => {
    expect(await sha256hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('accepts Uint8Array input', async () => {
    expect(await sha256hex(new Uint8Array(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('produces different hashes for different inputs', async () => {
    const h1 = await sha256hex('hello');
    const h2 = await sha256hex('world');
    expect(h1).not.toBe(h2);
  });

  it('is consistent across calls', async () => {
    const h1 = await sha256hex('test');
    const h2 = await sha256hex('test');
    expect(h1).toBe(h2);
  });
});

describe('frameToJSON', () => {
  it('sorts keys alphabetically', () => {
    expect(frameToJSON({ z: 1, a: 2, m: 3 })).toBe('{"a":2,"m":3,"z":1}');
  });

  it('is deterministic regardless of insertion order', () => {
    const f1 = { b: 'x', a: 'y' };
    const f2 = { a: 'y', b: 'x' };
    expect(frameToJSON(f1)).toBe(frameToJSON(f2));
  });

  it('handles null values', () => {
    expect(frameToJSON({ a: null, b: 'hi' })).toBe('{"a":null,"b":"hi"}');
  });

  it('serialises numbers', () => {
    expect(frameToJSON({ n: 42 })).toBe('{"n":42}');
  });
});

describe('deriveFirstPlayer', () => {
  it('returns 0 or 1', () => {
    const a = new Uint8Array(32).fill(0);
    const b = new Uint8Array(32).fill(0);
    expect([0, 1]).toContain(deriveFirstPlayer(a, b));
  });

  it('is symmetric (same result from both perspectives)', () => {
    const a = crypto.getRandomValues(new Uint8Array(32));
    const b = crypto.getRandomValues(new Uint8Array(32));
    expect(deriveFirstPlayer(a, b)).toBe(deriveFirstPlayer(b, a));
  });

  it('uses parity of all bytes (all-ones XOR all-zeros = parity of 32 ones = 0)', () => {
    const a = new Uint8Array(32).fill(0);
    const b = new Uint8Array(32).fill(1); // each byte XOR'd = 1; 32 bytes, parity = 0
    expect(deriveFirstPlayer(a, b)).toBe(0);
  });

  it('returns 1 when XOR parity is odd', () => {
    const a = new Uint8Array(32).fill(0);
    const b = new Uint8Array(32).fill(0);
    b[0] = 1; // single byte difference → parity = 1
    expect(deriveFirstPlayer(a, b)).toBe(1);
  });
});

describe('ECDSA key operations', () => {
  it('generateKeyPair produces a key pair', async () => {
    const kp = await generateKeyPair();
    expect(kp.publicKey).toBeDefined();
    expect(kp.privateKey).toBeDefined();
  });

  it('exportPubKey produces a non-empty base64 string', async () => {
    const kp = await generateKeyPair();
    const b64 = await exportPubKey(kp.publicKey);
    expect(typeof b64).toBe('string');
    expect(b64.length).toBeGreaterThan(0);
  });

  it('importPubKey roundtrips with exportPubKey', async () => {
    const kp = await generateKeyPair();
    const b64 = await exportPubKey(kp.publicKey);
    const imported = await importPubKey(b64);
    expect(imported).toBeDefined();
    expect(imported.type).toBe('public');
  });

  it('signFrame and verifyFrame roundtrip', async () => {
    const kp = await generateKeyPair();
    const frame = { index: 0, move: 4, player: 0, previous_hash: 'abc', type: 'move' };
    const sig = await signFrame(frame, kp.privateKey);
    expect(typeof sig).toBe('string');
    expect(await verifyFrame(frame, sig, kp.publicKey)).toBe(true);
  });

  it('verifyFrame rejects tampered frame', async () => {
    const kp = await generateKeyPair();
    const frame = { index: 0, move: 4, player: 0, previous_hash: 'abc', type: 'move' };
    const sig = await signFrame(frame, kp.privateKey);
    const tampered = { ...frame, move: 5 };
    expect(await verifyFrame(tampered, sig, kp.publicKey)).toBe(false);
  });

  it('verifyFrame rejects signature from a different key', async () => {
    const kp1 = await generateKeyPair();
    const kp2 = await generateKeyPair();
    const frame = { type: 'genesis', first_player: 0 };
    const sig = await signFrame(frame, kp1.privateKey);
    expect(await verifyFrame(frame, sig, kp2.publicKey)).toBe(false);
  });

  it('cross-party verification succeeds with correct keys', async () => {
    const hostKP = await generateKeyPair();
    const guestKP = await generateKeyPair();
    const hostPubKey = await importPubKey(await exportPubKey(hostKP.publicKey));
    const guestPubKey = await importPubKey(await exportPubKey(guestKP.publicKey));
    const frame = { first_player: 0, type: 'genesis' };
    const hostSig = await signFrame(frame, hostKP.privateKey);
    const guestSig = await signFrame(frame, guestKP.privateKey);
    expect(await verifyFrame(frame, hostSig, hostPubKey)).toBe(true);
    expect(await verifyFrame(frame, guestSig, guestPubKey)).toBe(true);
    expect(await verifyFrame(frame, hostSig, guestPubKey)).toBe(false);
  });
});
