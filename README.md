# 📹 meet.io

> **A real-time, peer-to-peer video meeting platform built with modern Neo-Brutalist design, WebRTC, and FastAPI + python-socketio.**

[![Python Version](https://img.shields.io/badge/python-3.14%2B-blue.svg?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-ASGI-black.svg?style=flat-square&logo=socketdotio&logoColor=white)](https://python-socketio.readthedocs.io/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P%20Mesh-blue.svg?style=flat-square&logo=webrtc&logoColor=white)](https://webrtc.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Design](https://img.shields.io/badge/Style-Neo--Brutalism-purple.svg?style=flat-square)](#-neo-brutalist-design-tokens)

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
| **Backend** | Python 3.14+, FastAPI, Uvicorn (ASGI) |
| **Realtime Signaling** | `python-socketio` (ASGI mode, WebSockets + polling fallback) |
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
│   ├── socket.io/
│   │   └── socket.io.min.js   # Vendored Socket.IO client library (ASGI served)
│   ├── index.html             # Pre-call landing page & camera/mic preview
│   └── room.html              # Main meeting stage & floating studio controls
├── main.py                    # FastAPI server & python-socketio signaling relay
├── requirements.txt           # Python dependencies (FastAPI, Uvicorn, python-socketio)
├── server.js                  # Legacy Node.js Express server (optional / fallback)
├── package.json               # Project manifest & npm runner scripts
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Python** 3.10+ (Python 3.14 recommended)
- **pip** (Python package manager)
- A webcam and microphone (for testing media streams)
- *(Optional)* **Node.js** (v18+) if you wish to run the legacy `server.js` or use npm scripts

### Installation & Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/meet-io.git
   cd meet-io
   ```

2. **Set up a Python virtual environment (recommended):**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the FastAPI server:**
   ```bash
   # Using Uvicorn with hot-reload (recommended for development):
   uvicorn main:socket_app --host 0.0.0.0 --port 3000 --reload

   # Or via Python main entrypoint:
   python main.py

   # Or via npm script:
   npm start
   # or
   npm run start:uvicorn
   ```

5. **Open in browser:**
   ```text
   http://localhost:3000
   ```

---

## ⚙️ Environment Configuration

Create an optional `.env` file in the root directory:

```env
# Server Port (default: 3000)
PORT=3000

# Server Host (default: 0.0.0.0)
HOST=0.0.0.0
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
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:socket_app --host 0.0.0.0 --port $PORT`
5. Click **Create Web Service**. Render provides free automatic **HTTPS/SSL** and WebSocket support.

### Option 2: Deploy on Railway.app
1. Go to [Railway.app](https://railway.app) and create a new project from your GitHub repo.
2. Railway will auto-detect Python from `requirements.txt`.
3. Set the custom start command under service settings:
   ```bash
   uvicorn main:socket_app --host 0.0.0.0 --port $PORT
   ```
4. Railway deploys with persistent WebSocket support and automatic SSL.

### Option 3: VPS / Linux (Systemd & Nginx Reverse Proxy)
For self-hosting on DigitalOcean, AWS EC2, or Hetzner:

1. **Install dependencies and clone repo:**
   ```bash
   sudo apt update && sudo apt install -y python3-pip python3-venv nginx
   git clone https://github.com/your-username/meet-io.git /var/www/meet-io
   cd /var/www/meet-io
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Create a Systemd Service** (`/etc/systemd/system/meet-io.service`):
   ```ini
   [Unit]
   Description=meet.io FastAPI Video Service
   After=network.target

   [Service]
   User=www-data
   WorkingDirectory=/var/www/meet-io
   ExecStart=/var/www/meet-io/venv/bin/uvicorn main:socket_app --host 127.0.0.1 --port 3000 --workers 1
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```
   Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now meet-io
   ```

3. **Configure Nginx Reverse Proxy** with WebSocket support (`/etc/nginx/sites-available/meet-io`):
   ```nginx
   server {
       server_name meet.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
           proxy_read_timeout 86400s;
           proxy_send_timeout 86400s;
       }
   }
   ```
   Link and reload Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/meet-io /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

4. **Issue free SSL certificate with Certbot:**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d meet.yourdomain.com
   ```

### Option 4: Docker Container
You can containerize `meet.io` with a lightweight Python image:

1. **Dockerfile:**
   ```dockerfile
   FROM python:3.14-slim

   WORKDIR /app

   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt

   COPY . .

   EXPOSE 3000

   CMD ["uvicorn", "main:socket_app", "--host", "0.0.0.0", "--port", "3000"]
   ```

2. **Build and run:**
   ```bash
   docker build -t meet-io .
   docker run -d -p 3000:3000 --name meet-io meet-io
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
