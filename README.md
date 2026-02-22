# kettujakaniini

A browser-based two-player tic-tac-toe game (Fox vs Rabbit / Kettu ja Kaniini) that supports both local and WebRTC peer-to-peer multiplayer.

## Playing

Open `index.html` in a browser or **[play it online](https://nanonyme.github.io/kettujakaniini/)**.

### Local game
Both players share the same device. Click **Paikallinen peli**.

### Multiplayer (WebRTC)
1. One player clicks **Moninpeli → Luo peli**. A shareable link is generated and a 15-minute countdown starts.
2. The link is copied or shared to the second player. The session token lives **only in the URL fragment (`#`)** and is never sent to any server.
3. The second player opens the link and clicks **Liity**. A direct peer-to-peer WebRTC connection is established — no game data passes through any server.
4. Each player is shown their role (🦊 Kettu / 🐰 Kaniini). The starting player alternates every round. The board is locked while it is the opponent's turn.
5. If the connection drops the game ends; there is no reconnection.

## License

This project is licensed under the **Apache License 2.0** — see [LICENSE](LICENSE).

## Third-party dependencies

| Dependency | Version | License | Compatibility |
|------------|---------|---------|---------------|
| [PeerJS](https://github.com/peers/peerjs) | 1.5.5 | MIT | ✅ MIT is fully compatible with Apache 2.0 |

PeerJS is loaded from the jsDelivr CDN at runtime:

```
https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js
```

The MIT license text for PeerJS is reproduced below in accordance with its terms:

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
