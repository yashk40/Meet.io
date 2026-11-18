const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

// Zero-dependency .env loader
if (fs.existsSync('.env')) {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.substring(0, idx).trim();
          const value = trimmed.substring(idx + 1).trim().replace(/(^['"]|['"]$)/g, '');
          if (key && !process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  } catch (e) {
    console.warn('[ENV] Could not read .env file:', e.message);
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const CF_APP_ID = process.env.CLOUDFLARE_APP_ID;
const CF_APP_SECRET = process.env.CLOUDFLARE_APP_SECRET;
const isCallsConfigured = !!(CF_APP_ID && CF_APP_SECRET);

console.log(`[ENGINE] WebRTC Mode: ${isCallsConfigured ? 'Cloudflare Calls (SFU) [Active]' : 'P2P Mesh [Active Fallback]'}`);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Short meeting room route /r/:roomId
app.get('/r/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

app.get('/room/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

// Helper to generate meet-like room code: xxx-yyyy-zzz
function generateRoomCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const segment = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${segment(3)}-${segment(4)}-${segment(3)}`;
}

app.get('/api/new-room', (req, res) => {
  res.json({ roomId: generateRoomCode() });
});

// Cloudflare Calls SFU Proxy & Configuration Endpoints
app.get('/api/calls/config', (req, res) => {
  const configured = !!(process.env.CLOUDFLARE_APP_ID && process.env.CLOUDFLARE_APP_SECRET);
  res.json({
    sfuEnabled: configured,
    mode: configured ? 'sfu' : 'p2p',
    appId: configured ? process.env.CLOUDFLARE_APP_ID : null
  });
});

async function callCloudflare(endpoint, method = 'POST', body = null) {
  const appId = process.env.CLOUDFLARE_APP_ID;
  const appSecret = process.env.CLOUDFLARE_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('Cloudflare Calls credentials not configured');
  }

  const url = `https://rtc.live.cloudflare.com/v1/apps/${appId}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${appSecret}`,
    'Content-Type': 'application/json'
  };

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    const errText = data.errors?.[0]?.message || `Cloudflare Calls API Error: ${response.status}`;
    throw new Error(errText);
  }
  return data;
}

// Proxy: Create Session
app.post('/api/calls/sessions/new', async (req, res) => {
  try {
    const data = await callCloudflare('/sessions/new', 'POST');
    res.json(data);
  } catch (err) {
    console.error('[CF-CALLS] Session creation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Proxy: Publish / Subscribe Tracks
app.post('/api/calls/sessions/:sessionId/tracks/new', async (req, res) => {
  try {
    const data = await callCloudflare(`/sessions/${req.params.sessionId}/tracks/new`, 'POST', req.body);
    res.json(data);
  } catch (err) {
    console.error('[CF-CALLS] Tracks/new error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Proxy: Renegotiate
app.put('/api/calls/sessions/:sessionId/renegotiate', async (req, res) => {
  try {
    const data = await callCloudflare(`/sessions/${req.params.sessionId}/renegotiate`, 'PUT', req.body);
    res.json(data);
  } catch (err) {
    console.error('[CF-CALLS] Renegotiate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Proxy: Close Tracks
app.put('/api/calls/sessions/:sessionId/tracks/close', async (req, res) => {
  try {
    const data = await callCloudflare(`/sessions/${req.params.sessionId}/tracks/close`, 'PUT', req.body);
    res.json(data);
  } catch (err) {
    console.error('[CF-CALLS] Tracks/close error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// In-memory room management
// roomId -> { [socketId]: { userId, userName, callsSessionId, publishedTracks, ... } }
const rooms = new Map();

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentUser = null;

  socket.on('join-room', ({ roomId, userId, userName, callsSessionId }) => {
    currentRoom = roomId;
    currentUser = {
      socketId: socket.id,
      userId: userId || socket.id,
      userName: userName || 'Guest',
      callsSessionId: callsSessionId || null,
      publishedTracks: [],
      audioMuted: false,
      videoMuted: false,
      isSharingScreen: false,
      isHandRaised: false
    };

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    const roomUsers = rooms.get(roomId);

    // Send the list of existing users to the newly joined peer
    const existingUsers = Array.from(roomUsers.values());
    socket.emit('all-users', existingUsers);

    // Add current user to room
    roomUsers.set(socket.id, currentUser);

    // Notify other peers in the room
    socket.to(roomId).emit('user-joined', currentUser);

    console.log(`[JOIN] ${currentUser.userName} (${socket.id}) joined room ${roomId}. Total: ${roomUsers.size}`);
  });

  // Cloudflare Calls: user announces newly published tracks
  socket.on('tracks-published', ({ callsSessionId, tracks }) => {
    if (currentUser) {
      currentUser.callsSessionId = callsSessionId;
      currentUser.publishedTracks = tracks;
      socket.to(currentRoom).emit('user-tracks-available', {
        socketId: socket.id,
        userName: currentUser.userName,
        callsSessionId,
        tracks
      });
    }
  });

  // WebRTC Signaling: offer, answer, ICE candidate relay (for P2P Mesh fallback)
  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', {
      from: socket.id,
      fromUser: currentUser,
      signal
    });
  });

  // Screen share state update
  socket.on('screen-share-status', ({ isSharing, hasAudio, screenTrackId }) => {
    if (currentUser) {
      currentUser.isSharingScreen = isSharing;
      currentUser.hasScreenAudio = !!hasAudio;
      socket.to(currentRoom).emit('user-screen-share', {
        socketId: socket.id,
        isSharing,
        hasAudio: !!hasAudio,
        screenTrackId
      });
    }
  });

  // Media state changes
  socket.on('toggle-audio', ({ isMuted }) => {
    if (currentUser) {
      currentUser.audioMuted = isMuted;
      socket.to(currentRoom).emit('user-audio-toggle', {
        socketId: socket.id,
        isMuted
      });
    }
  });

  socket.on('toggle-video', ({ isVideoOff }) => {
    if (currentUser) {
      currentUser.videoMuted = isVideoOff;
      socket.to(currentRoom).emit('user-video-toggle', {
        socketId: socket.id,
        isVideoOff
      });
    }
  });

  // Hand raise
  socket.on('raise-hand', ({ isRaised }) => {
    if (currentUser) {
      currentUser.isHandRaised = isRaised;
      io.in(currentRoom).emit('user-hand-toggle', {
        socketId: socket.id,
        userName: currentUser.userName,
        isRaised
      });
    }
  });

  // Reactions
  socket.on('send-reaction', ({ emoji }) => {
    if (currentRoom && currentUser) {
      io.in(currentRoom).emit('receive-reaction', {
        socketId: socket.id,
        userName: currentUser.userName,
        emoji
      });
    }
  });

  // Chat message
  socket.on('send-message', ({ message }) => {
    if (currentRoom && currentUser) {
      const chatItem = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        socketId: socket.id,
        sender: currentUser.userName,
        text: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      io.in(currentRoom).emit('receive-message', chatItem);
    }
  });

  // Disconnection cleanup
  socket.on('client-log', (data) => {
    console.log(`[CLIENT-LOG] [${socket.id}]`, data);
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const roomUsers = rooms.get(currentRoom);
      roomUsers.delete(socket.id);

      socket.to(currentRoom).emit('user-left', {
        socketId: socket.id,
        userName: currentUser ? currentUser.userName : 'A participant',
        callsSessionId: currentUser ? currentUser.callsSessionId : null
      });

      console.log(`[LEAVE] ${socket.id} left room ${currentRoom}. Remaining: ${roomUsers.size}`);

      if (roomUsers.size === 0) {
        rooms.delete(currentRoom);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`meet.io server running at http://localhost:${PORT}`);
});
