# Security Model

## Encryption

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key derivation**: PBKDF2 with 100,000 iterations, SHA-256, room-specific salt
- **Key material**: Passphrase from URL fragment (never sent to server)
- **IV**: Random 96-bit nonce per message (crypto.getRandomValues)
- **Implementation**: Browser-native Web Crypto API (no JS crypto libraries)

## What the server sees

| Data | Server sees? | Notes |
|------|-------------|-------|
| Room token (hash) | Yes | SHA-256 hash — cannot reverse to room name or passphrase |
| SDP offers/answers | Yes | Contains ICE candidates (IPs), not user content |
| Clipboard content | **Never** | Only ciphertext (Tier 3) or never touches server (Tier 1/2) |
| Passphrase | **Never** | Lives only in URL fragment — browsers never send fragments in HTTP requests |
| Room name | **Never** | Only the derived hash is sent |

## Connection tiers

| Tier | Method | Server involvement |
|------|--------|-------------------|
| 1 | WebRTC direct (LAN) | Signaling only |
| 2 | WebRTC via STUN | Signaling + public STUN |
| 3 | Encrypted relay | Server relays ciphertext — zero knowledge preserved |

Content is always encrypted at the application layer (AES-256-GCM), regardless of tier. Tiers 1 and 2 add DTLS encryption on top (double-encrypted). Tier 3 uses HTTPS transport.

## Threats and mitigations

| Threat | Protection |
|--------|-----------|
| Server operator reading content | AES-256-GCM, key from URL fragment |
| Network eavesdropping | HTTPS + WebRTC DTLS + app-layer AES-GCM |
| Corporate VPN blocking WebRTC | Tier 3 relay via HTTPS |
| Server database dump | No persistent data — rooms are in-memory only |

## Known limitations

| Threat | Why | Mitigation |
|--------|-----|-----------|
| Compromised server serving malicious JS | Server could modify index.html to exfiltrate keys | Self-host, or verify served file matches GitHub source |
| Weak passphrase | Short passphrases can be brute-forced | Auto-generated passphrases are 16 chars. PBKDF2 100k iterations adds cost |
| Browser extensions | Extensions can read page content | Out of scope — compromised browser can read anything |

## Recommendations

- Use the auto-generated URL (strong random passphrase)
- For high-security use: self-host and verify the index.html hash
- Don't share the full URL over an insecure channel
