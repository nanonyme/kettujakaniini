// ── Cryptographic utilities ───────────────────────────────────────────────────
// All functions are pure (no side effects on shared state) and fully testable.

/** JSON-encode an object with alphabetically sorted keys (deterministic across parties). */
export function frameToJSON(frame: object): string {
  return JSON.stringify(frame, Object.keys(frame as Record<string, unknown>).sort());
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
}

export async function sha256hex(data: Uint8Array | string): Promise<string> {
  // new Uint8Array(src) always produces an ArrayBuffer-backed copy, satisfying BufferSource
  const bytes: Uint8Array<ArrayBuffer> =
    typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(hash));
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
}

export async function exportPubKey(key: CryptoKey): Promise<string> {
  const buf = await crypto.subtle.exportKey('spki', key);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export async function importPubKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'spki',
    buf,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify'],
  );
}

export async function signFrame(frame: object, privateKey: CryptoKey): Promise<string> {
  const data = new TextEncoder().encode(frameToJSON(frame));
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    data,
  );
  return toHex(new Uint8Array(sig));
}

export async function verifyFrame(
  frame: object,
  sigHex: string,
  publicKey: CryptoKey,
): Promise<boolean> {
  const data = new TextEncoder().encode(frameToJSON(frame));
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    publicKey,
    fromHex(sigHex),
    data,
  );
}

/**
 * Derive first_player (0 or 1) from two 256-bit random values.
 * Uses parity of all bits in (myRandom XOR peerRandom) for full entropy.
 */
export function deriveFirstPlayer(myRandom: Uint8Array, peerRandom: Uint8Array): 0 | 1 {
  let xorParity = 0;
  for (let i = 0; i < 32; i++) xorParity ^= myRandom[i] ^ peerRandom[i];
  return (xorParity & 1) as 0 | 1;
}
