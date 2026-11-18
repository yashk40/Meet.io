# Cloudflare Calls (SFU) Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Cloudflare Calls (Anycast WebRTC SFU) into `meet.io`, enabling ultra-scalable, low-latency group video calling (50+ participants) with a hybrid dual-engine architecture: when Cloudflare credentials are configured in `.env`, the app runs on Cloudflare SFU; otherwise, it smoothly falls back to the existing P2P Mesh engine.

**Architecture:**
- **Backend Proxy (`server.js`)**: Secure proxy endpoints (`/api/calls/...`) communicate with `https://rtc.live.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}` using the secret token (`CLOUDFLARE_APP_SECRET`), preventing secret leakage to the browser.
- **Signaling Layer (Socket.IO)**: Tracks user entry/exit, room membership, chat, reactions, and broadcasts publisher `sessionId` and track statuses.
- **Client WebRTC Engine (`public/js/room.js`)**: Implements dual-mode WebRTC handling:
  - When SFU mode is active: creates local peer connection with Cloudflare Calls edge endpoint, publishes local audio/video/screen tracks, and subscribes to remote participant tracks.
  - When in P2P fallback: uses existing direct peer-to-peer signaling.
- **Frontend UI (`public/room.html`, `public/css/style.css`)**: 100% preserved Neo-Brutalist design. Adds a small status badge or log indicating whether meeting is running on Cloudflare Edge SFU or P2P.

**Tech Stack:** Node.js, Express, Socket.IO, WebRTC (`RTCPeerConnection`, `MediaStreamTrack`), Cloudflare Calls REST API v1 (`https://rtc.live.cloudflare.com/v1`).

## Global Constraints

- **Security**: `CLOUDFLARE_APP_SECRET` must NEVER be exposed to the client. All Calls API requests must be routed via `server.js` endpoints.
- **Zero Regression**: Existing chat, emoji reactions, mic/camera toggles, participant lists, screen sharing, and Neo-Brutalist styling must continue working without any bugs.
- **Hybrid Graceful Fallback**: If `CLOUDFLARE_APP_ID` or `CLOUDFLARE_APP_SECRET` is unset, the application automatically uses the P2P Mesh engine with a clean notification.
- **Configuration**: Uses `.env` and `.env.example` with documented keys:
  - `CLOUDFLARE_APP_ID`
  - `CLOUDFLARE_APP_SECRET`

## Review Focus

1. **Token Protection**: Verify no Cloudflare API keys or bearer tokens are sent in client-facing responses or accessible in client scripts.
2. **Dual-Mode Switching**: Verify the app detects presence/absence of Cloudflare keys on server startup and client boot, seamlessly switching modes.
3. **Audio/Video Track Publication**: Verify local camera and microphone tracks are properly offered to Cloudflare Calls with correct `mid` and `trackName`.
4. **Subscription Fan-Out**: When Peer B joins, Peer B subscribes to Peer A's published session tracks, and Peer A subscribes to Peer B's tracks via Cloudflare Calls.
5. **Tile Lifecycle & Teardown**: Closing or leaving a call cleanly closes session tracks on Cloudflare and destroys video tile elements in the DOM.

---

### Task 1: Environment Configuration & Cloudflare Calls Backend Proxy

**Files:**
- Create: `.env.example`
- Modify: `server.js`

- [ ] **Step 1: Create `.env.example` template**
  Document `CLOUDFLARE_APP_ID`, `CLOUDFLARE_APP_SECRET`, and `PORT`.

- [ ] **Step 2: Add Cloudflare Calls Proxy Endpoints in `server.js`**
  - Check if `CLOUDFLARE_APP_ID` and `CLOUDFLARE_APP_SECRET` are configured:
    - Route `GET /api/calls/config`: returns `{ sfuEnabled: boolean, mode: 'sfu' | 'p2p' }`.
    - Route `POST /api/calls/sessions/new`: calls Cloudflare `POST https://rtc.live.cloudflare.com/v1/apps/{appId}/sessions/new`.
    - Route `POST /api/calls/sessions/:sessionId/tracks/new`: calls Cloudflare `POST https://rtc.live.cloudflare.com/v1/apps/{appId}/sessions/{sessionId}/tracks/new`.
    - Route `PUT /api/calls/sessions/:sessionId/renegotiate`: calls Cloudflare `PUT https://rtc.live.cloudflare.com/v1/apps/{appId}/sessions/{sessionId}/renegotiate`.
    - Route `PUT /api/calls/sessions/:sessionId/tracks/close`: calls Cloudflare `PUT https://rtc.live.cloudflare.com/v1/apps/{appId}/sessions/{sessionId}/tracks/close`.
  - Add error handling: If Cloudflare returns an error or keys are missing, return appropriate HTTP status and message.

- [ ] **Step 3: Update Socket.IO user state in `server.js`**
  - In `join-room`, accept optional `callsSessionId` and store in `currentUser`.
  - Broadcast `user-joined` with `callsSessionId`.

- [ ] **Step 4: Verify backend syntax & routes**
  - Test `node -c server.js`
  - Verify `/api/calls/config` returns expected JSON.

---

### Task 2: Client Cloudflare Calls Engine & Dual-Mode Orchestration

**Files:**
- Modify: `public/js/room.js`

- [ ] **Step 1: Check SFU availability on room boot**
  - Fetch `/api/calls/config`.
  - If `sfuEnabled === true`, initialize `CloudflareCallsEngine`.
  - If `sfuEnabled === false`, log info and use existing P2P mesh logic.

- [ ] **Step 2: Implement `CloudflareCallsEngine` class in `public/js/room.js`**
  - Methods:
    - `initSession()`: requests `/api/calls/sessions/new` to obtain a `sessionId`.
    - `publishTracks(audioTrack, videoTrack)`: creates local `RTCPeerConnection`, creates offer with transceivers, sends to `/api/calls/sessions/:sessionId/tracks/new`, and sets remote description with Cloudflare's answer SDP.
    - `subscribeToUser(remoteUser)`: creates subscriber `RTCPeerConnection` for remote user's audio and video tracks via `/api/calls/sessions/:subscriberSessionId/tracks/new`, handling `ontrack` to attach remote media stream to participant video tile.
    - `publishScreenTrack(screenTrack)`: publishes screen stream track to Cloudflare.
    - `closeTrack(trackName)`: notifies Cloudflare to close track on mute or screen share stop.

- [ ] **Step 3: Wire Socket.IO events to SFU Engine**
  - On `all-users`: if SFU mode, subscribe to each existing user's Cloudflare tracks; if P2P mode, initiate mesh peer connections.
  - On `user-joined`: if SFU mode, subscribe to new user's tracks.
  - On `user-left`: cleanup remote peer connection and remove tile.

- [ ] **Step 4: Verify JS syntax & integrity**
  - Test `node -c public/js/room.js`
  - Confirm all DOM manipulation and existing functions continue working without errors.

---

### Task 3: Testing, Verification & Documentation

**Files:**
- Modify: `README.md` (or instructions)
- Verify: Both P2P fallback and Cloudflare Calls modes

- [ ] **Step 1: Test P2P Fallback (without `.env` keys)**
  - Start server and join `/r/test-meeting`.
  - Confirm video preview, local media, timer, audio/video toggles, and chat work 100%.

- [ ] **Step 2: Add `.env` documentation guide**
  - Add instructions on how to create the Cloudflare Calls App ID and API Token in Cloudflare Dashboard and put them into `.env`.

- [ ] **Step 3: Commit and Verify Git Cleanliness**
  - Run `git status` and commit changes.
