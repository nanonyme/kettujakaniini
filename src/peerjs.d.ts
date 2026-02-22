// Minimal PeerJS type declarations for the CDN-loaded peerjs@1.5.5 library.
// The actual runtime object is provided by the script tag in index.html.

interface PeerJSDataConnection {
  on(event: 'data', cb: (data: unknown) => void): void;
  on(event: 'close', cb: () => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
  on(event: 'open', cb: () => void): void;
  send(data: unknown): void;
  close(): void;
  readonly open: boolean;
}

interface PeerJSInstance {
  on(event: 'connection', cb: (conn: PeerJSDataConnection) => void): void;
  on(event: 'open', cb: (id: string) => void): void;
  on(event: 'error', cb: (err: { type: string }) => void): void;
  connect(id: string, options?: { reliable?: boolean }): PeerJSDataConnection;
  disconnect(): void;
  destroy(): void;
}

declare const Peer: new (id?: string) => PeerJSInstance;
