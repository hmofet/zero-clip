# zero-clip Signaling Protocol Specification

**Version:** 1.0

All server implementations must conform to this spec. Anyone can write a server in any language by implementing it.

## Transport

Servers MUST support at least one of:

- **WebSocket** (preferred): Persistent bidirectional connection at `/ws`
- **SSE + POST** (universal fallback): Server-Sent Events at `/events?peer_id=X&room_token=Y` for server→client, POST to `/signal` for client→server

Clients auto-negotiate: attempt WebSocket first, fall back to SSE+POST if WebSocket connection fails or is rejected.

## Message Format

All messages are JSON objects. Every message has a `type` field.

## Client → Server Messages

### `join` — Join a room

```json
{
  "type": "join",
  "room_token": "<SHA-256 hex string, 64 chars>",
  "peer_id": "<client-generated UUID v4>"
}
```

### `signal` — Relay a WebRTC signaling message to a specific peer

```json
{
  "type": "signal",
  "to": "<target peer_id>",
  "payload": { "type": "offer", "sdp": "..." }
}
```

Payload is opaque to the server — relay verbatim. Contents are SDP offers, SDP answers, or ICE candidates.

### `relay` — Relay encrypted clipboard content to a specific peer (Tier 3 fallback)

```json
{
  "type": "relay",
  "to": "<target peer_id>",
  "payload": "<base64-encoded IV+ciphertext+tag>"
}
```

Server relays verbatim. This is ciphertext.

### `leave` — Disconnect from room

```json
{
  "type": "leave"
}
```

## Server → Client Messages

### `peer_joined` — A new peer entered your room

```json
{
  "type": "peer_joined",
  "peer_id": "<their peer_id>",
  "peer_count": 2
}
```

### `peer_left` — A peer left your room

```json
{
  "type": "peer_left",
  "peer_id": "<their peer_id>",
  "peer_count": 1
}
```

### `signal` — Forwarded signaling message from another peer

```json
{
  "type": "signal",
  "from": "<sender peer_id>",
  "payload": { "..." }
}
```

### `relay` — Forwarded encrypted content from another peer

```json
{
  "type": "relay",
  "from": "<sender peer_id>",
  "payload": "<base64>"
}
```

### `error` — Server error

```json
{
  "type": "error",
  "message": "Room is full",
  "code": "ROOM_FULL"
}
```

## Room Lifecycle

1. Client generates `peer_id` (UUID v4) and computes `room_token` from URL fragment
2. Client sends `join` with `room_token` and `peer_id`
3. Server creates room if it doesn't exist, adds peer
4. Server sends `peer_joined` to all existing peers in room
5. Newest peer initiates WebRTC negotiation (sends SDP offer via `signal`)
6. Peers exchange ICE candidates via `signal` messages
7. Once WebRTC DataChannel opens → direct P2P communication (server is out of the loop)
8. If WebRTC fails (timeout after 10s) → peers fall back to `relay` messages through server
9. On disconnect → server sends `peer_left` to remaining peers
10. Server garbage-collects empty rooms after 60 seconds

## Room Constraints

- Maximum peers per room: **10** (configurable, recommended default)
- No persistence: rooms exist only in memory. Server restart = all rooms gone (peers just reconnect)
- No authentication: anyone with the room token can join. Security comes from the passphrase (which generates the token)
