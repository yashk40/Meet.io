# 📹 meet.io

> **A real-time, peer-to-peer video meeting platform built with modern Neo-Brutalist design, WebRTC, and Socket.IO.**

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Design](https://img.shields.io/badge/Style-Neo--Brutalism-purple.svg?style=flat-square)](#-neo-brutalist-design-system)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P%20Mesh-blue.svg?style=flat-square)](https://webrtc.org/)

---

## ✨ Features

- **⚡ Ultra-Low Latency Video & Audio**: Real-time peer-to-peer communication powered by WebRTC.
- **🖥️ Zero-Drop Screen Sharing**: Full HD display sharing with optional internal audio capture and Picture-in-Picture (PIP) monitor.
- **🎨 Neo-Brutalist Aesthetic**: Dark studio theme (`#0D0E15`), crisp high-contrast white borders, lavender-purple (`#A78BFA`) 3D offset plates, and electric neon lime (`#D4FF00`) accents.
- **📱 100% Mobile & Tablet Responsive**:
  - Auto-stacking portrait video grid
  - Floating minimal island with compact touch buttons
  - Native-like bottom sheet drawers (`75dvh` with drag grabber)
- **💬 Real-Time In-Call Chat**: Instant text messaging with audio chimes, unread counter badges, and XSS sanitization.
- **🎉 Floating Emoji Reactions**: Expressive interactive reactions (👍, 👏, ❤️, 🎉, 😂, 🔥) with animated floating physics.
- **👥 Active Speaker & Participant Controls**:
  - Dynamic active speaker spotlighting (electric lime glow)
  - Tile pinning to primary stage
  - Raise hand indicator with status priority
  - In-meeting participant list with link sharing
- **📋 1-Click Code & Link Copy**: Tap "Copy Code" in the header for instant clipboard copying with visual confirmation.
- **🔒 Privacy First & In-Memory**: Ephemeral rooms managed strictly in memory; zero video/audio streams pass through or are saved on the server.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | Node.js, Express.js |
| **Realtime Signaling** | Socket.IO (WebSockets) |
| **Media Transport** | WebRTC (`RTCPeerConnection`, `MediaStream` API, STUN/TURN) |
| **Frontend** | Vanilla JavaScript (ES6+), Semantic HTML5, Pure CSS3 |
| **Icons** | Lucide Icons |
| **Styling** | Custom Neo-Brutalist CSS Engine (Zero heavyweight UI frameworks) |

---

## 📁 Project Structure

```text
meet/
├── public/
│   ├── css/
│   │   └── style.css          # Neo-brutalist stylesheet (lobby, room, responsive)
│   ├── js/
│   │   ├── lobby.js           # Media permissions, webcam preview & room creator
│   │   ├── room.js            # WebRTC mesh engine, signaling, chat & reactions
│   │   └── lucide.min.js      # Vector icon bundle
│   ├── index.html             # Pre-call landing page & camera/mic preview
│   └── room.html              # Main meeting stage & floating studio controls
├── server.js                  # Express server & Socket.IO signaling relay
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18.x or higher)
- **npm** (v9.x or higher)
- A webcam and microphone (for testing media streams)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/meet-io.git
   cd meet-io
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the application:**
   ```bash
   npm start
   # or
   node server.js
   ```

4. **Open in browser:**
   ```text
   http://localhost:3000
   ```

---

## ⚙️ Environment Configuration

Create an optional `.env` file in the root directory:

```env
# Server Port (default: 3000)
PORT=3000

# Optional: Environment Mode
NODE_ENV=production
```

---

## 🌐 Production Deployment Guide

> [!IMPORTANT]
> WebRTC camera and microphone access (`navigator.mediaDevices.getUserMedia`) **requires a secure context (HTTPS)** in production. Browsers block media devices on insecure `http://` URLs (except `localhost`).

### Option 1: Deploy on Render.com (Recommended Free/Easy)
1. Fork or push this repository to GitHub.
2. Go to [Render.com](https://render.com) and create a **New Web Service**.
3. Connect your GitHub repository.
4. Set the following settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Click **Create Web Service**. Render provides free automatic **HTTPS/SSL** and WebSocket support.

### Option 2: Deploy on Railway.app
1. Go to [Railway.app](https://railway.app) and create a new project from your GitHub repo.
2. Railway will auto-detect Node.js and deploy with persistent WebSocket support and automatic SSL.

### Option 3: VPS / Ubuntu (Docker & Nginx)
For self-hosting on DigitalOcean, AWS EC2, or Hetzner:
1. Run server with **PM2**:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "meet-io"
   pm2 startup
   ```
2. Configure **Nginx Reverse Proxy** with WebSocket upgrade:
   ```nginx
   server {
       server_name meet.yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
3. Issue free SSL with **Certbot**:
   ```bash
   sudo certbot --nginx -d meet.yourdomain.com
   ```

---

## 📶 WebRTC NAT & STUN/TURN Setup

By default, `meet.io` uses Google's public STUN servers for NAT traversal:
- `stun:stun.l.google.com:19302`

For strict enterprise firewalls and mobile carrier networks (Jio / Airtel 4G/5G Symmetric NAT), configure a free **TURN relay server** in `public/js/room.js`:

```javascript
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // Add your TURN server (e.g. from Metered.ca, Twilio, or Coturn):
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: 'YOUR_USERNAME',
      credential: 'YOUR_CREDENTIAL'
    }
  ]
};
```

---

## 🎨 Neo-Brutalist Design Tokens

| Token | Hex Value | Usage |
| :--- | :--- | :--- |
| **Canvas Background** | `#0D0E15` | Studio dark room canvas |
| **Container Surface** | `#141622` | Footer island, drawers, modal cards |
| **Control Surface** | `#1E2130` | Rounded-square buttons, input boxes |
| **Accent Primary** | `#A78BFA` | 3D offset backing shadow plates |
| **Accent Highlight** | `#D4FF00` | Electric neon lime (Layout CTA, active speaker, badge) |
| **Danger / Muted** | `#FF4D4D` | Coral red leave-call button & muted indicators |
| **Borders** | `#FFFFFF` / `#000000` | High-contrast 2px - 2.5px solid borders |

---

## 🤝 Contributing

Contributions, feature requests, and suggestions are welcome!
1. Fork the repo.
2. Create your feature branch (`git checkout -b feat/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: add amazing feature'`).
4. Push to the branch (`git push origin feat/amazing-feature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
