# FastAPI Backend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the `meet.io` backend from Node.js (`server.js`) to Python / FastAPI (`main.py`) using `python-socketio` (ASGI mode) and `uvicorn`, preserving 100% frontend WebRTC compatibility, room routing, in-memory peer signaling, and chat/reaction events.

**Architecture:** A FastAPI application combined with an asynchronous `socketio.AsyncServer(async_mode='asgi')` mounted as an ASGI application via `socketio.ASGIApp(sio, app)`. Static files in `public/` are mounted with `StaticFiles`. HTTP endpoints serve `index.html` (Lobby), `room.html` (Meeting Room), and `/api/new-room` (room generator). All WebRTC signaling events are relayed in-memory identically to `server.js`.

**Tech Stack:** Python 3.14+, FastAPI 0.140+, Uvicorn 0.51+, python-socketio 5.18+, Vanilla JS / WebSockets frontend.

**Spec:** User architectural request: "tech stak python rkhnan hai backend ka".

## Global Constraints

- Port: 3000 (configurable via `PORT` environment variable, defaulting to 3000).
- Zero frontend breaking changes: All existing socket event names (`join-room`, `signal`, `screen-share-status`, `toggle-audio`, `toggle-video`, `raise-hand`, `send-reaction`, `send-message`, `all-users`, `user-joined`, `user-left`, `user-screen-share`, `user-audio-toggle`, `user-video-toggle`, `user-hand-toggle`, `receive-reaction`, `receive-message`) must remain 100% identical.
- In-memory room state: Map of `roomId` -> `{ socketId: { userId, userName, audioMuted, videoMuted, isSharingScreen, isHandRaised } }`.
- Platform: Windows (Python run via `py` or `python`).

## Review Focus

1. **Socket.IO Event Parity**: Every socket event in `server.js` has an identical handler in `main.py` with matching payload shapes.
2. **Static & Dynamic Routing**: `/`, `/r/{room_id}`, and `/room/{room_id}` cleanly serve `public/index.html` and `public/room.html` with correct MIME types for CSS/JS.
3. **Room Code Generation**: `/api/new-room` returns JSON `{ "roomId": "xxx-yyyy-zzz" }` matching the standard Google Meet pattern.
4. **Peer Cleanup on Disconnect**: When a socket disconnects, other peers in the room receive `user-left`, and empty rooms are removed from memory.
5. **Uvicorn Daemon Execution**: The FastAPI server starts cleanly on port 3000 and serves both local and public tunnel traffic.

---

### Task 1: Create Requirements & Core FastAPI Application (`main.py`)

**Files:**
- Create: `requirements.txt`
- Create: `main.py`
- Test: Verify HTTP endpoints via Python `urllib` / `requests`

**Interfaces:**
- Consumes: `public/index.html`, `public/room.html`, `public/css/`, `public/js/`
- Produces: FastAPI app with static mount, `/`, `/r/{room_id}`, `/room/{room_id}`, and `/api/new-room`

- [ ] **Step 1: Write `requirements.txt`**
  ```text
  fastapi>=0.115.0
  uvicorn[standard]>=0.30.0
  python-socketio>=5.11.0
  ```

- [ ] **Step 2: Create `main.py` with FastAPI & Route Handlers**
  - Implement `generate_room_code()` returning format `xxx-yyyy-zzz`.
  - Add route `@app.get("/")` returning `FileResponse("public/index.html")`.
  - Add routes `@app.get("/r/{room_id}")` and `@app.get("/room/{room_id}")` returning `FileResponse("public/room.html")`.
  - Add route `@app.get("/api/new-room")` returning JSON `{"roomId": generate_room_code()}`.
  - Mount `/` to `StaticFiles(directory="public")`.

- [ ] **Step 3: Test HTTP routes**
  - Run quick test server and verify `GET /` returns 200, `GET /api/new-room` returns room ID JSON, and `GET /r/test-meeting` returns 200.

---

### Task 2: Implement Async WebRTC Signaling & Room Management in `main.py`

**Files:**
- Modify: `main.py`
- Test: Socket.IO connection and event relay test script

**Interfaces:**
- Consumes: Socket.IO client connections from `public/js/lobby.js` and `public/js/room.js`
- Produces: Fully functional async signaling relay for WebRTC mesh

- [ ] **Step 1: Setup `python-socketio` AsyncServer**
  - Configure `sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')`.
  - Wrap with `socket_app = socketio.ASGIApp(sio, app)`.
  - Maintain in-memory room tracking: `rooms: dict[str, dict[str, dict]] = {}` and session map `socket_rooms: dict[str, str] = {}`.

- [ ] **Step 2: Implement Socket Events**
  - `connect`: log connection.
  - `join-room`: add socket to room, emit `all-users` to joined socket, emit `user-joined` to others in the room.
  - `signal`: relay `{from, fromUser, signal}` to target `to` socket.
  - `screen-share-status`: broadcast `user-screen-share` to room.
  - `toggle-audio`: broadcast `user-audio-toggle` to room.
  - `toggle-video`: broadcast `user-video-toggle` to room.
  - `raise-hand`: emit `user-hand-toggle` to entire room.
  - `send-reaction`: emit `receive-reaction` to entire room.
  - `send-message`: generate message item with ID and timestamp, emit `receive-message` to entire room.
  - `client-log`: log client debug messages.
  - `disconnect`: cleanup user from room, broadcast `user-left`, delete empty room.

- [ ] **Step 3: Write and run an automated test script**
  - Test Socket.IO join-room, signaling relay, and disconnect logic using a Python test client.

---

### Task 3: Switch Server from Node to FastAPI & End-to-End Verification

**Files:**
- Modify: background server process
- Test: End-to-end browser check on `http://localhost:3000` and public Cloudflare tunnel

- [ ] **Step 1: Stop Node.js server process (task-555)**
- [ ] **Step 2: Start FastAPI server with Uvicorn on port 3000**
  - `py -m uvicorn main:socket_app --host 0.0.0.0 --port 3000`
- [ ] **Step 3: Verify live endpoints and Cloudflare tunnel**
  - Check `GET http://localhost:3000/`
  - Check `GET http://localhost:3000/api/new-room`
  - Check `GET http://localhost:3000/r/test-meeting`
  - Verify WebRTC room UI loads in browser via Cloudflare tunnel URL.

---

### Task 4: Documentation & Repository Updates

**Files:**
- Modify: `README.md`
- Modify: `package.json` (optional npm scripts for python runner)
- Test: `git status`, commit and push to GitHub

- [ ] **Step 1: Update `README.md`**
  - Update tech stack table (FastAPI, Python 3.14+, Uvicorn, python-socketio).
  - Update local setup instructions (`pip install -r requirements.txt`, `uvicorn main:socket_app --reload`).
  - Update deployment guides (Render / Railway / VPS with Python).
- [ ] **Step 2: Commit and push changes to GitHub**
