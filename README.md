# kettujakaniini

A browser-based two-player tic-tac-toe game (Fox vs Rabbit / Kettu ja Kaniini) that supports both local and WebRTC peer-to-peer multiplayer.

## Playing

Open `index.html` in a browser or **[play it online](https://nanonyme.github.io/kettujakaniini/)**.

### Local game
Both players share the same device. Click **Paikallinen peli**.

### Multiplayer (WebRTC)
1. One player clicks **Moninpeli → Luo peli**. A shareable link is generated and a 15-minute countdown starts.
2. The link is copied or emailed to the second player. The session token lives **only in the URL fragment (`#`)** and is never sent to any server.
3. The second player opens the link and clicks **Liity**. A direct peer-to-peer WebRTC connection is established — no game data passes through any server.
4. Each player is shown their role (🦊 Kettu / 🐰 Kaniini). The starting player alternates every round. The board is locked while it is the opponent's turn.
5. If the connection drops the game ends; there is no reconnection.

> **Multiplayer URL stability**: the share link always reflects the current deployment origin, so stable players always connect to stable and preview players always connect to the same preview — the two are never mixed.

## Development

### Prerequisites

- Node.js 20+

### Build

```
npm install
npm run build
```

The build bundles TypeScript sources and the PeerJS dependency into `dist/` using [esbuild](https://esbuild.github.io/). The `dist/` directory is not committed and is produced by CI.

### Type-check only

```
npm run typecheck
```

## Deployment

The project is deployed via GitHub Pages using the native GitHub Actions deployment system (`actions/deploy-pages`). Each deployment is an immutable artifact managed by GitHub — no `gh-pages` branch is involved.

- **Stable**: every push to `main` builds and deploys to the `github-pages` environment.
- **PR preview**: every pull request builds and deploys to a `pr-preview/{number}` environment via `actions/deploy-pages` with `preview: true`. GitHub provides an isolated preview URL, which is posted as a comment on the PR. The preview deployment is deactivated automatically when the PR is closed.

> **Note**: GitHub Pages must be configured to deploy from **GitHub Actions** (Settings → Pages → Source → GitHub Actions).

## License

This project is licensed under the **Apache License 2.0** — see [LICENSE](LICENSE).

## Third-party dependencies

| Dependency | Version | License | Compatibility |
|------------|---------|---------|---------------|
| [PeerJS](https://github.com/peers/peerjs) | 1.5.5 | MIT | ✅ MIT is fully compatible with Apache 2.0 |

PeerJS is bundled into the build output by esbuild. The MIT license text for PeerJS is reproduced below in accordance with its terms:

```
Copyright (c) 2015 Michelle Bu and Eric Zhang, http://peerjs.com

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```