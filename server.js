const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static assets
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

// In-memory room management
// roomId -> { [socketId]: { userId, userName, audioMuted, videoMuted, isSharingScreen, isHandRaised } }
const rooms = new Map();

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentUser = null;

  socket.on('join-room', ({ roomId, userId, userName }) => {
    currentRoom = roomId;
    currentUser = {
      socketId: socket.id,
      userId: userId || socket.id,
      userName: userName || 'Guest',
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

  // WebRTC Signaling: offer, answer, ICE candidate relay
  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', {
      from: socket.id,
      fromUser: currentUser,
      signal
    });
  });

  // Screen share state update
  socket.on('screen-share-status', ({ isSharing, hasAudio }) => {
    if (currentUser) {
      currentUser.isSharingScreen = isSharing;
      currentUser.hasScreenAudio = !!hasAudio;
      socket.to(currentRoom).emit('user-screen-share', {
        socketId: socket.id,
        isSharing,
        hasAudio: !!hasAudio
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
        userName: currentUser ? currentUser.userName : 'A participant'
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
