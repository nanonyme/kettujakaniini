# Kettu ja Kaniini – Blockchain Game-State Specification

## 1. Purpose

This document defines the cryptographic protocol used to make it impossible for either
player to cheat in a multiplayer game of Kettu ja Kaniini without the other player
detecting it.  Every game action is recorded in a tamper-evident blockchain.  Both
parties hold identical copies of the chain and validate every step independently.

---

## 2. Threat model

### In scope

- A player **modifying their own local JavaScript** to place illegal moves, replay old
  moves, rewrite game history, or falsely claim a win.
- A player **fabricating messages** that appear to come from the other player.
- A player **denying** that they made a move they did in fact make.

### Out of scope

- Network-level attacks on the WebRTC transport layer.  The session token is exchanged
  **out-of-band** (in a URL fragment that never touches any server).  Only two parties
  who already know that token can connect.  Once the WebRTC data channel is open,
  the DTLS transport layer provides end-to-end encryption and integrity.  Substituting
  a player's public key would require compromising both the out-of-band token exchange
  **and** the DTLS session simultaneously — this is outside the scope of an anti-cheating
  system for a casual browser game.
- Server-side attacks (there is no game server).
- Denial-of-service / disconnection (one party can always abort; this cannot be
  prevented without a third party).

---

## 3. Cryptographic primitives

| Primitive | Algorithm | Purpose |
|-----------|-----------|---------|
| Asymmetric signing | ECDSA, curve P-256 | Proving authorship of a block frame |
| Hash | SHA-256 | Commit scheme; chain links; deterministic frame IDs |
| Random | `crypto.getRandomValues`, 256 bits | Unbiased coin flip for first-player selection |

Signing convention: **the canonical JSON of a frame is passed directly to the ECDSA
signing primitive**.  The ECDSA+SHA-256 algorithm applies SHA-256 internally; the
application never hashes the frame manually before signing.

Key lifetime: key pairs are **ephemeral** — generated fresh for each session and never
persisted.

---

## 4. Session handshake

The handshake runs immediately after the WebRTC data channel opens.  Both parties
execute it concurrently; messages interleave in the order described below.

### Step 1 – Public-key exchange

Both parties generate an ephemeral ECDSA P-256 key pair and send their public key
(SPKI, base-64 encoded) to the other party.

```
→  { type: "pubkey", key: "<base64-SPKI>" }
←  { type: "pubkey", key: "<base64-SPKI>" }
```

### Step 2 – Commit

Both parties generate a 256-bit cryptographically random value `R` and compute its
SHA-256 hash.  The hash is sent first; the raw value is kept secret for now.

```
→  { type: "commit", commit: "<hex SHA-256(R_host)>" }
←  { type: "commit", commit: "<hex SHA-256(R_guest)>" }
```

### Step 3 – Reveal

Both parties send their raw random values.  Upon receiving the peer's value the
receiver re-computes SHA-256 and compares it to the previously received commit.  A
mismatch means the peer attempted to change their random after seeing the opponent's
commit; the session is terminated immediately.

```
→  { type: "random", random: "<hex R_host>" }
←  { type: "random", random: "<hex R_guest>" }
```

### Step 4 – First-player derivation

Both parties independently compute `first_player` using the same formula:

```
XOR[i]        =  R_host[i]  XOR  R_guest[i]          (byte-wise, i = 0 … 31)
accumulated   =  XOR[0] XOR XOR[1] XOR … XOR XOR[31]  (fold all 32 bytes)
first_player  =  accumulated AND 1                     (take the least-significant bit)
```

This is equivalent to: XOR the least-significant bits of all 32 bytes of
`(R_host XOR R_guest)`.  Changing the least-significant bit of any byte in
either random value flips `first_player`.  An attacker who has already committed
to their random cannot choose a reveal value that produces a desired `first_player`
because SHA-256 is preimage-resistant.

`first_player = 0` means the **host** plays fox (goes first).  
`first_player = 1` means the **guest** plays fox (goes first).  
Fox always moves first within every game.

### Step 5 – Genesis block

Both parties independently construct an identical **genesis frame** (see §5.1) using
the values already exchanged, sign it with their private key, and send the signature.

```
→  { type: "genesis_sig", signature: "<hex ECDSA signature>" }
←  { type: "genesis_sig", signature: "<hex ECDSA signature>" }
```

Each party verifies the other's signature against the genesis frame and the peer public
key received in Step 1.  On failure the session is terminated.

The genesis **block** is then assembled locally:

```json
{
  "frame":  { /* genesis frame – see §5.1 */ },
  "signatures": [ "<host_sig>", "<guest_sig>" ]
}
```

The handshake is complete.  Both parties now share an identical, doubly-signed genesis
block and know each other's public keys.

---

## 5. Block structure

All block frames are serialised as **JSON with keys sorted alphabetically** before
signing or hashing.  This canonical form is used by both parties so that signatures and
hashes are always computed over identical byte sequences regardless of insertion order.

`hashBlock(block)` is defined as `SHA-256(canonical_JSON(block.frame))`, returned as
a lowercase hex string.  Note that only the **frame** is hashed (not the signatures);
the chain proves the sequence of game events, and signatures prove authorship
independently.

### 5.1 Genesis block

Establishes the session, records the coin-flip material, and fixes `first_player`.

Frame fields (alphabetical order after serialisation):

| Field | Type | Value |
|-------|------|-------|
| `first_player` | `0` \| `1` | Player index who plays fox (goes first) |
| `host_commit` | hex string | SHA-256 of the host's random |
| `host_random` | hex string | The host's 256-bit random |
| `peer_commit` | hex string \| `null` | SHA-256 of the guest's random; `null` in local mode |
| `peer_random` | hex string \| `null` | The guest's 256-bit random; `null` in local mode |
| `type` | `"genesis"` | Block type discriminator |

Signatures: `[host_sig, guest_sig]` (local mode: `[host_sig]`).

Example (multiplayer):
```json
{
  "frame": {
    "first_player": 1,
    "host_commit":  "a3f1…",
    "host_random":  "c82b…",
    "peer_commit":  "7e90…",
    "peer_random":  "d441…",
    "type":         "genesis"
  },
  "signatures": ["<host_sig>", "<guest_sig>"]
}
```

### 5.2 Move block

Records a single tic-tac-toe move.

Frame fields:

| Field | Type | Value |
|-------|------|-------|
| `index` | integer | Global move counter (0, 1, 2, …; never resets between games in a session) |
| `move` | 0–8 | Board cell index (row-major: 0 = top-left, 8 = bottom-right) |
| `player` | `0` \| `1` | Player index of the moving player |
| `previous_hash` | hex string | `hashBlock` of the immediately preceding block |
| `type` | `"move"` | Block type discriminator |

Signatures: `[moving_player_sig]`.

Example:
```json
{
  "frame": {
    "index":         3,
    "move":          4,
    "player":        1,
    "previous_hash": "bf90…",
    "type":          "move"
  },
  "signatures": ["<guest_sig>"]
}
```

### 5.3 Score block

Records the outcome of one game.  Both parties must agree on the identical frame
and provide their signatures.

Frame fields:

| Field | Type | Value |
|-------|------|-------|
| `previous_hash` | hex string | `hashBlock` of the last move block |
| `starter` | `0` \| `1` | `first_player` value at the start of this game |
| `type` | `"score"` | Block type discriminator |
| `winner` | `"fox"` \| `"rabbit"` \| `"draw"` | Outcome |

Signatures: `[host_sig, guest_sig]`.

Example:
```json
{
  "frame": {
    "previous_hash": "3c11…",
    "starter":       1,
    "type":          "score",
    "winner":        "fox"
  },
  "signatures": ["<host_sig>", "<guest_sig>"]
}
```

---

## 6. Wire messages (data channel)

All messages are JSON objects sent over the WebRTC reliable data channel.

| `type` | Sender | Payload fields | Phase |
|--------|--------|---------------|-------|
| `pubkey` | both | `key` (base-64 SPKI) | Handshake step 1 |
| `commit` | both | `commit` (hex SHA-256) | Handshake step 2 |
| `random` | both | `random` (hex 256-bit) | Handshake step 3 |
| `genesis_sig` | both | `signature` (hex ECDSA) | Handshake step 5 |
| `move` | current player | `block` (full move block) | Gameplay |
| `score_sig` | both | `signature` (hex ECDSA) | End of game |
| `newround` | host | `starter` (0 \| 1) | Start next game |
| `requestnewgame` | guest | _(none)_ | Guest requests next game |

---

## 7. Chain validation rules

When a party receives a `move` message they validate **all** of the following before
applying the move:

1. `block.frame.type === "move"`
2. `block.frame.previous_hash === hashBlock(chain[chain.length - 1])`
3. `block.frame.player === getPlayerIndex(currentPlayer, firstPlayer)`
4. `block.frame.index === moveIndex` (expected global counter)
5. `0 ≤ block.frame.move ≤ 8` and the cell is currently empty
6. ECDSA signature in `block.signatures[0]` verifies against `block.frame` and the
   peer's public key

Any failure triggers a "sync error": the game is marked over, the connection is closed,
and the player is returned to the main menu.

When a party receives a `score_sig` they validate:

1. The signature verifies against the locally constructed score frame (both parties
   independently build the identical frame) and the peer's public key.
2. On success both signatures are stored in the score block appended to the chain.

---

## 8. Game continuation

After a game ends, the host increments `gameStarter` (alternating 0/1) and sends a
`newround` message.  The blockchain continues uninterrupted — the next move block
links to the previous score block.  The global `moveIndex` counter never resets; this
prevents a replayed block from a different game round passing the `index` check.

---

## 9. Local game

In a local game both players share the same browser tab.  The same blockchain
structure is used, but only the host key pair is generated; the genesis block carries a
single signature and `peer_commit` / `peer_random` are `null`.  Move and score blocks
are signed by the single host key.  This provides a tamper-evident log even without
a second party.

---

## 10. Known limitations

- **Abort attack**: a party who dislikes the first-player result derived in Step 4 may
  disconnect before the handshake completes.  Preventing this requires either a trusted
  third party or a computationally expensive commitment scheme.  For a casual browser
  game this trade-off is accepted.
- **No key continuity between sessions**: because keys are ephemeral, there is no way
  for a player to prove across sessions that they are the same person.
- **Chain covers frames only, not signatures**: `hashBlock` hashes only the frame JSON.
  This is intentional — the chain proves event ordering; signatures prove authorship
  independently.  A replayed chain would fail signature verification regardless.
