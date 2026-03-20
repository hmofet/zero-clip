# zero-clip

Zero-knowledge encrypted clipboard sharing between your devices.

Share clipboard content across devices — across the room or across the internet — with end-to-end encryption. The server never sees your content. All encryption happens in the browser using the Web Crypto API.

## How it works

1. Open `https://your-server.com` — a link is generated with a random room + passphrase
2. Open that link on another device
3. Paste content — it's encrypted in your browser and sent to the other device
4. The server only sees ciphertext it cannot decrypt

Everything after `#` in the URL is the **fragment** — browsers never send it to the server. The encryption key is derived from this fragment. The server literally cannot decrypt your content.

## Architecture

```
Browser A ◄══════ WebRTC P2P (direct) ══════► Browser B
    │                                              │
    └──── WebSocket ────► Server ◄──── WebSocket ──┘
                      (signaling only)
```

**Connection tiers** (automatic fallback):

| Tier | Method | Server role |
|------|--------|-------------|
| 1 | WebRTC direct (LAN) | Signaling only |
| 2 | WebRTC via STUN | Signaling + STUN |
| 3 | Encrypted relay | Relays ciphertext (zero knowledge) |

## Quick start (Node.js)

```bash
git clone https://github.com/hmofet/zero-clip.git
cd zero-clip/servers/node
npm install
node server.js
# Open http://localhost:8080
```

## Server distributions

| Server | Language | Transport | Best for |
|--------|----------|-----------|----------|
| `servers/node/` | Node.js | WebSocket | Glitch, Render, Fly.io, any VPS |
| `servers/python/` | Python/Flask | WebSocket | PythonAnywhere, Render |
| `servers/php/` | PHP | SSE+POST | Any shared hosting |
| `servers/go/` | Go | WebSocket | Self-hosted (single binary + GUI) |
| `servers/cloudflare-worker/` | JS | WebSocket | Cloudflare Workers (paid) |

All servers implement the same [signaling protocol](protocol.md). The client auto-negotiates transport.

## Security

- **AES-256-GCM** encryption with keys derived via **PBKDF2** (100k iterations)
- Keys derived from URL fragment — never sent to server
- No accounts, no persistent storage, no tracking
- Full details: [SECURITY.md](SECURITY.md)

## License

MIT
