// zero-clip signaling server — Node.js reference implementation
// Implements the signaling protocol from protocol.md

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const MAX_PEERS_PER_ROOM = parseInt(process.env.MAX_PEERS) || 10;
const ROOM_GC_INTERVAL = 60_000;

// Room state: Map<room_token, Map<peer_id, ws>>
const rooms = new Map();

// Peer state: Map<ws, { peer_id, room_token }>
const peers = new Map();

// Serve static files
const CLIENT_PATH = path.join(__dirname, '..', '..', 'client', 'index.html');

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(CLIENT_PATH, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Could not load client');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  } else if (req.url === '/health') {
    const roomCount = rooms.size;
    let peerCount = 0;
    rooms.forEach(r => peerCount += r.size);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: roomCount, peers: peerCount }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'join': handleJoin(ws, msg); break;
      case 'signal': handleSignal(ws, msg); break;
      case 'relay': handleRelay(ws, msg); break;
      case 'leave': handleLeave(ws); break;
    }
  });

  ws.on('close', () => handleLeave(ws));
  ws.on('error', () => handleLeave(ws));
});

function handleJoin(ws, msg) {
  const { room_token, peer_id } = msg;
  if (!room_token || !peer_id) return sendError(ws, 'Missing room_token or peer_id', 'INVALID');

  // Leave any existing room first
  handleLeave(ws);

  // Get or create room
  if (!rooms.has(room_token)) rooms.set(room_token, new Map());
  const room = rooms.get(room_token);

  if (room.size >= MAX_PEERS_PER_ROOM) {
    return sendError(ws, 'Room is full', 'ROOM_FULL');
  }

  // Add peer to room
  room.set(peer_id, ws);
  peers.set(ws, { peer_id, room_token });

  // Notify existing peers
  for (const [id, sock] of room) {
    if (id !== peer_id) {
      send(sock, { type: 'peer_joined', peer_id, peer_count: room.size });
    }
  }

  // Tell the new peer about existing peers
  for (const [id] of room) {
    if (id !== peer_id) {
      send(ws, { type: 'peer_joined', peer_id: id, peer_count: room.size });
    }
  }

  console.log(`[join] peer=${peer_id.slice(0,8)} room=${room_token.slice(0,8)}… peers=${room.size}`);
}

function handleSignal(ws, msg) {
  const peer = peers.get(ws);
  if (!peer) return;

  const room = rooms.get(peer.room_token);
  if (!room) return;

  const target = room.get(msg.to);
  if (target) {
    send(target, { type: 'signal', from: peer.peer_id, payload: msg.payload });
  }
}

function handleRelay(ws, msg) {
  const peer = peers.get(ws);
  if (!peer) return;

  const room = rooms.get(peer.room_token);
  if (!room) return;

  if (msg.to) {
    // Send to specific peer
    const target = room.get(msg.to);
    if (target) {
      send(target, { type: 'relay', from: peer.peer_id, payload: msg.payload });
    }
  } else {
    // Broadcast to all peers in room
    for (const [id, sock] of room) {
      if (id !== peer.peer_id) {
        send(sock, { type: 'relay', from: peer.peer_id, payload: msg.payload });
      }
    }
  }
}

function handleLeave(ws) {
  const peer = peers.get(ws);
  if (!peer) return;

  const room = rooms.get(peer.room_token);
  if (room) {
    room.delete(peer.peer_id);

    // Notify remaining peers
    for (const [id, sock] of room) {
      send(sock, { type: 'peer_left', peer_id: peer.peer_id, peer_count: room.size });
    }

    console.log(`[leave] peer=${peer.peer_id.slice(0,8)} room=${peer.room_token.slice(0,8)}… peers=${room.size}`);
  }

  peers.delete(ws);
}

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

function sendError(ws, message, code) {
  send(ws, { type: 'error', message, code });
}

// Garbage-collect empty rooms
setInterval(() => {
  for (const [token, room] of rooms) {
    if (room.size === 0) {
      rooms.delete(token);
    }
  }
}, ROOM_GC_INTERVAL);

server.listen(PORT, () => {
  console.log(`zero-clip server listening on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});
