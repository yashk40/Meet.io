// room.js - Core WebRTC mesh engine with bulletproof screen sharing, dynamic layouts, and pinning
const socket = io();

// Extract room ID from URL /room/:roomId or /r/:roomId or ?room=xxx
let roomId = 'default-room';
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('room')) {
  roomId = urlParams.get('room');
} else {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (lastPart !== 'room.html' && lastPart !== 'room' && lastPart !== 'r') {
      roomId = lastPart;
    }
  }
}

// Current user state
let userName = localStorage.getItem('meet_userName') || '';
if (!userName.trim()) {
  userName = prompt('Enter your name to join the meeting:', 'Guest') || 'Guest';
  localStorage.setItem('meet_userName', userName);
}

let localStream = null;
let screenStream = null;
let isSharingScreen = false;
let isMicMuted = sessionStorage.getItem('meet_initMicMuted') === 'true';
let isCamMuted = sessionStorage.getItem('meet_initCamMuted') === 'true';
let isHandRaised = false;

// Screen Share Audio Mixer State
let screenAudioMixerContext = null;
let screenAudioSourceNode = null;
let micAudioSourceNode = null;
let micGainNode = null;
let screenGainNode = null;
let mixedAudioTrack = null;

// Mobile Loudspeaker / Media Mode Output State
let loudspeakerAudioCtx = null;
let loudspeakerSource = null;
let isLoudspeakerEnabled = true;

// Layout & Pinning state
let currentLayout = 'auto'; // 'auto' | 'tiled' | 'spotlight' | 'sidebar'
let pinnedTarget = null; // null | 'local' | 'presentation' | socketId
let audienceFocusWhilePresenting = true;
let pipEnabled = true;

// Peer Connections Map: socketId -> { pc, user, stream, candidateQueue }
const peers = new Map();

// WebRTC Configuration with public STUN servers
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

// DOM References
const displayRoomId = document.getElementById('displayRoomId');
const footerRoomCode = document.getElementById('footerRoomCode');
const callTimer = document.getElementById('callTimer');
const btnCopyInvite = document.getElementById('btnCopyInvite');
const btnDrawerCopyLink = document.getElementById('btnDrawerCopyLink');

const stageContainer = document.getElementById('stageContainer');
const presentationArea = document.getElementById('presentationArea');
const presentationVideo = document.getElementById('presentationVideo');
const presenterNameTag = document.getElementById('presenterNameTag');
const screenShareBanner = document.getElementById('screenShareBanner');
const screenShareText = document.getElementById('screenShareText');
const btnPresentationPin = document.getElementById('btnPresentationPin');
const btnPresentationFullscreen = document.getElementById('btnPresentationFullscreen');
const btnToggleSpeaker = document.getElementById('btnToggleSpeaker');
const mirrorWarning = document.getElementById('mirrorWarning');
const btnTapToPlayScreen = document.getElementById('btnTapToPlayScreen');
const btnTapToPlayAudio = document.getElementById('btnTapToPlayAudio');

const pinnedBanner = document.getElementById('pinnedBanner');
const pinnedTargetName = document.getElementById('pinnedTargetName');
const btnUnpinTop = document.getElementById('btnUnpinTop');

const videoGrid = document.getElementById('videoGrid');
const localTile = document.getElementById('localTile');
const localVideo = document.getElementById('localVideo');
const localAvatar = document.getElementById('localAvatar');
const localInitial = document.getElementById('localInitial');
const localNameTag = document.getElementById('localNameTag');
const localMicBadge = document.getElementById('localMicBadge');
const localHandBadge = document.getElementById('localHandBadge');
const selfScreenPip = document.getElementById('selfScreenPip');
const pipVideo = document.getElementById('pipVideo');
const btnTogglePipSize = document.getElementById('btnTogglePipSize');

const btnToggleMic = document.getElementById('btnToggleMic');
const btnToggleCam = document.getElementById('btnToggleCam');
const btnToggleScreen = document.getElementById('btnToggleScreen');
const btnRaiseHand = document.getElementById('btnRaiseHand');
const btnLeaveCall = document.getElementById('btnLeaveCall');

const btnReactionTrigger = document.getElementById('btnReactionTrigger');
const reactionPicker = document.getElementById('reactionPicker');
const reactionOverlay = document.getElementById('reactionOverlay');

const btnToggleChat = document.getElementById('btnToggleChat');
const btnCloseChat = document.getElementById('btnCloseChat');
const chatDrawer = document.getElementById('chatDrawer');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const chatUnreadBadge = document.getElementById('chatUnreadBadge');
const btnToggleChatSound = document.getElementById('btnToggleChatSound');

const iosChatNotification = document.getElementById('iosChatNotification');
const iosBannerAvatar = document.getElementById('iosBannerAvatar');
const iosBannerSender = document.getElementById('iosBannerSender');
const iosBannerMessage = document.getElementById('iosBannerMessage');

let isMessageSoundEnabled = true;
let unreadMessagesCount = 0;
let iosBannerTimeout = null;

const btnTogglePeople = document.getElementById('btnTogglePeople');
const btnClosePeople = document.getElementById('btnClosePeople');
const peopleDrawer = document.getElementById('peopleDrawer');
const peopleList = document.getElementById('peopleList');
const peopleCount = document.getElementById('peopleCount');
const footerPeopleBadge = document.getElementById('footerPeopleBadge');

const btnLayoutMenu = document.getElementById('btnLayoutMenu');
const layoutModal = document.getElementById('layoutModal');
const btnCloseLayoutModal = document.getElementById('btnCloseLayoutModal');
const chkAudienceFocus = document.getElementById('chkAudienceFocus');
const chkPipSelf = document.getElementById('chkPipSelf');

const toastContainer = document.getElementById('toastContainer');

// Initialize Room UI
if (displayRoomId) displayRoomId.textContent = 'Copy Code';
const roomPill = document.getElementById('roomPill') || document.querySelector('.room-pill');
if (roomPill) roomPill.title = `Meeting Code: ${roomId} • Click to copy link`;
if (footerRoomCode) footerRoomCode.textContent = roomId;
if (localNameTag) localNameTag.textContent = `${userName} (You)`;
if (localInitial) localInitial.textContent = userName ? userName[0].toUpperCase() : 'Y';

const btnHeaderPeople = document.getElementById('btnHeaderPeople');
btnHeaderPeople?.addEventListener('click', () => {
  const isHidden = peopleDrawer.classList.contains('hidden');
  peopleDrawer.classList.toggle('hidden', !isHidden);
  btnTogglePeople?.classList.toggle('active', isHidden);
  if (isHidden) {
    chatDrawer.classList.add('hidden');
    btnToggleChat?.classList.remove('active');
    renderPeopleList();
  }
});

// Initialize Lucide icons on boot
if (window.lucide) {
  window.lucide.createIcons();
}

// Meeting call timer
let callSeconds = 0;
setInterval(() => {
  callSeconds++;
  const mins = String(Math.floor(callSeconds / 60)).padStart(2, '0');
  const secs = String(callSeconds % 60).padStart(2, '0');
  callTimer.textContent = `${mins}:${secs}`;
}, 1000);

// Toast notification helper
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3000);
}

// Copy Invite link (Short & Clean URL)
let copyFeedbackTimeout = null;
function copyMeetingLink() {
  const shortUrl = `${window.location.origin}/r/${roomId}`;
  navigator.clipboard.writeText(shortUrl).then(() => {
    showToast('Meeting link copied: ' + shortUrl);
    if (displayRoomId) {
      displayRoomId.textContent = 'Copied!';
      const pillIcon = document.getElementById('pillCopyIcon');
      if (pillIcon) {
        pillIcon.setAttribute('data-lucide', 'check');
        if (window.lucide) window.lucide.createIcons();
      }
      clearTimeout(copyFeedbackTimeout);
      copyFeedbackTimeout = setTimeout(() => {
        if (displayRoomId) displayRoomId.textContent = 'Copy Code';
        if (pillIcon) {
          pillIcon.setAttribute('data-lucide', 'copy');
          if (window.lucide) window.lucide.createIcons();
        }
      }, 2000);
    }
  }).catch(() => {
    prompt('Copy this meeting link:', shortUrl);
  });
}
roomPill?.addEventListener('click', copyMeetingLink);
roomPill?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    copyMeetingLink();
  }
});
btnDrawerCopyLink?.addEventListener('click', copyMeetingLink);

// ==========================================
// 1. PINNING & LAYOUT ENGINE
// ==========================================

window.togglePinTile = function(targetId) {
  if (pinnedTarget === targetId) {
    unpinCurrent();
  } else {
    pinTile(targetId);
  }
};

function pinTile(targetId) {
  pinnedTarget = targetId;

  // Clear previous pinned classes
  document.querySelectorAll('.video-tile').forEach(t => t.classList.remove('is-pinned'));

  let targetDisplayName = 'Alex';
  if (targetId === 'local') {
    localTile.classList.add('is-pinned');
    targetDisplayName = 'You';
  } else if (targetId === 'presentation') {
    targetDisplayName = 'Presentation';
    presentationArea.classList.remove('hidden');
  } else {
    const tile = document.getElementById(`tile-${targetId}`);
    if (tile) tile.classList.add('is-pinned');
    const peerData = peers.get(targetId);
    targetDisplayName = peerData?.user?.userName || 'Participant';
  }

  pinnedBanner.classList.remove('hidden');
  pinnedTargetName.textContent = targetDisplayName;

  showToast(`Pinned ${targetDisplayName} to main view`);
  applyLayoutClasses();
}

function unpinCurrent() {
  if (!pinnedTarget) return;
  pinnedTarget = null;
  document.querySelectorAll('.video-tile').forEach(t => t.classList.remove('is-pinned'));
  pinnedBanner.classList.add('hidden');
  showToast('Unpinned tile');
  applyLayoutClasses();
}

btnUnpinTop?.addEventListener('click', unpinCurrent);

btnPresentationPin?.addEventListener('click', () => {
  if (pinnedTarget === 'presentation') {
    unpinCurrent();
    btnPresentationPin.textContent = '📌 Pin';
  } else {
    pinTile('presentation');
    btnPresentationPin.textContent = '📌 Unpin';
  }
});

const btnExitFullscreen = document.getElementById('btnExitFullscreen');
const btnToggleThumbnails = document.getElementById('btnToggleThumbnails');

function togglePresentationFullscreen() {
  const isImmersive = presentationArea.classList.contains('is-immersive-fullscreen');
  const isDocFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);

  if (isImmersive || isDocFullscreen) {
    exitPresentationFullscreen();
  } else {
    enterPresentationFullscreen();
  }
}

function enterPresentationFullscreen() {
  // 1. Try native iOS video fullscreen if on iPhone/iPad
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS && presentationVideo.webkitEnterFullscreen) {
    try {
      presentationVideo.webkitEnterFullscreen();
      return;
    } catch (e) {
      console.log('webkitEnterFullscreen fallback to CSS fullscreen', e);
    }
  }

  // 2. Standard Fullscreen API with fallback to Immersive In-App Fullscreen
  if (presentationArea.requestFullscreen) {
    presentationArea.requestFullscreen().catch(() => {
      enableImmersiveCSSFullscreen();
    });
  } else if (presentationArea.webkitRequestFullscreen) {
    presentationArea.webkitRequestFullscreen().catch(() => {
      enableImmersiveCSSFullscreen();
    });
  } else {
    enableImmersiveCSSFullscreen();
  }
}

function enableImmersiveCSSFullscreen() {
  presentationArea.classList.add('is-immersive-fullscreen');
  btnExitFullscreen?.classList.remove('hidden');
  document.body.classList.add('fullscreen-mode-active');
  showToast('Entered Fullscreen. Double-tap or tap Exit to return.');
}

function exitPresentationFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    document.exitFullscreen?.() || document.webkitExitFullscreen?.();
  }
  presentationArea.classList.remove('is-immersive-fullscreen');
  btnExitFullscreen?.classList.add('hidden');
  document.body.classList.remove('fullscreen-mode-active');
}

btnPresentationFullscreen?.addEventListener('click', togglePresentationFullscreen);
btnExitFullscreen?.addEventListener('click', exitPresentationFullscreen);

// Double-tap or double-click video to toggle fullscreen
presentationVideo?.addEventListener('dblclick', togglePresentationFullscreen);

// Listen for browser fullscreen exits
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    presentationArea.classList.remove('is-immersive-fullscreen');
    btnExitFullscreen?.classList.add('hidden');
    document.body.classList.remove('fullscreen-mode-active');
  }
});
document.addEventListener('webkitfullscreenchange', () => {
  if (!document.webkitFullscreenElement) {
    presentationArea.classList.remove('is-immersive-fullscreen');
    btnExitFullscreen?.classList.add('hidden');
    document.body.classList.remove('fullscreen-mode-active');
  }
});

// Mobile thumbnail toggle during presentation
let areThumbnailsHiddenOnMobile = false;
btnToggleThumbnails?.addEventListener('click', () => {
  areThumbnailsHiddenOnMobile = !areThumbnailsHiddenOnMobile;
  videoGrid.classList.toggle('mobile-thumbnails-hidden', areThumbnailsHiddenOnMobile);
  btnToggleThumbnails.textContent = areThumbnailsHiddenOnMobile ? '👥 Show' : '👥 Faces';
});

// Loudspeaker (Media Mode) toggle for phone speakers
function routeAudioToLoudspeaker(stream) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!loudspeakerAudioCtx || loudspeakerAudioCtx.state === 'closed') {
      loudspeakerAudioCtx = new AudioContextClass({ latencyHint: 'playback' });
    }
    if (loudspeakerAudioCtx.state === 'suspended') {
      loudspeakerAudioCtx.resume().catch(() => {});
    }

    if (loudspeakerSource) {
      try { loudspeakerSource.disconnect(); } catch (e) {}
      loudspeakerSource = null;
    }

    if (stream && stream.getAudioTracks().length > 0) {
      loudspeakerSource = loudspeakerAudioCtx.createMediaStreamSource(stream);
      loudspeakerSource.connect(loudspeakerAudioCtx.destination);
      console.log('[LOUDSPEAKER] Remote audio routed to Web Audio Loudspeaker destination (Media Mode)');
    }
  } catch (err) {
    console.warn('[LOUDSPEAKER] Routing error:', err);
  }
}

function updateSpeakerButtonUI(enabled) {
  if (!btnToggleSpeaker) return;
  btnToggleSpeaker.innerHTML = enabled 
    ? '<i data-lucide="volume-2"></i><span class="hide-mobile">Speaker</span>' 
    : '<i data-lucide="volume-x"></i><span class="hide-mobile">Earpiece</span>';
  btnToggleSpeaker.classList.toggle('speaker-active', enabled);
  btnToggleSpeaker.title = enabled ? 'Loudspeaker active (tap for earpiece)' : 'Earpiece active (tap for loudspeaker)';
  if (window.lucide) window.lucide.createIcons({ root: btnToggleSpeaker });
}

function toggleLoudspeaker(enable) {
  isLoudspeakerEnabled = enable !== undefined ? enable : !isLoudspeakerEnabled;
  if (!isLoudspeakerEnabled) {
    if (loudspeakerSource) {
      try { loudspeakerSource.disconnect(); } catch (e) {}
      loudspeakerSource = null;
    }
    document.querySelectorAll('audio').forEach(a => {
      a.muted = false;
      a.volume = 1.0;
      a.play().catch(() => {});
    });
    showToast('🔈 Switched to Call / Earpiece mode');
  } else {
    for (const [peerId, peerData] of peers.entries()) {
      if (peerData.stream && peerData.stream.getAudioTracks().length > 0) {
        routeAudioToLoudspeaker(peerData.stream);
      }
    }
    showToast('🔊 Switched to Loudspeaker (Media Mode)');
  }
  updateSpeakerButtonUI(isLoudspeakerEnabled);
}

btnToggleSpeaker?.addEventListener('click', () => toggleLoudspeaker());


// Layout options modal
btnLayoutMenu?.addEventListener('click', () => {
  layoutModal.classList.remove('hidden');
});

btnCloseLayoutModal?.addEventListener('click', () => {
  layoutModal.classList.add('hidden');
});

layoutModal?.addEventListener('click', (e) => {
  if (e.target === layoutModal) layoutModal.classList.add('hidden');
});

document.querySelectorAll('.layout-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.layout-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    currentLayout = card.dataset.layout;
    applyLayoutClasses();
    showToast(`Switched layout to ${card.querySelector('h4').textContent}`);
    layoutModal.classList.add('hidden');
  });
});

chkAudienceFocus?.addEventListener('change', (e) => {
  audienceFocusWhilePresenting = e.target.checked;
  applyLayoutClasses();
});

chkPipSelf?.addEventListener('change', (e) => {
  pipEnabled = e.target.checked;
  if (!pipEnabled) {
    selfScreenPip.classList.add('hidden');
  } else if (isSharingScreen) {
    selfScreenPip.classList.remove('hidden');
  }
});

btnTogglePipSize?.addEventListener('click', (e) => {
  e.stopPropagation();
  selfScreenPip.classList.toggle('pip-large');
});

function applyLayoutClasses() {
  stageContainer.className = `stage-container layout-${currentLayout}`;

  const isAnyPresenting = !presentationArea.classList.contains('hidden');
  if (isAnyPresenting) {
    stageContainer.classList.add('sharing-active');
  }

  updateGridLayout();
}

// ==========================================
// 2. CLOUDFLARE CALLS (SFU) & LOCAL MEDIA SETUP
// ==========================================
const CALLS_API_BASE = window.CF_WORKER_URL || localStorage.getItem('CF_WORKER_URL') || '';
let isSfuActive = false;
let cfClient = null;

class CloudflareCallsClient {
  constructor() {
    this.sessionId = null;
    this.publishPc = null;
    this.subscribePcs = new Map(); // socketId -> RTCPeerConnection
    this.publishedTracks = [];
  }

  async initSession() {
    try {
      const res = await fetch(`${CALLS_API_BASE}/api/calls/sessions/new`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.sessionId) {
        this.sessionId = data.sessionId;
        console.log('[CF-CALLS] Session established with Cloudflare Anycast SFU:', this.sessionId);
        return true;
      }
    } catch (e) {
      console.warn('[CF-CALLS] Session init failed, falling back to P2P mesh:', e.message);
    }
    return false;
  }

  async publish(stream) {
    if (!this.sessionId || !stream) return;
    try {
      if (this.publishPc) {
        try { this.publishPc.close(); } catch (e) {}
      }
      this.publishPc = new RTCPeerConnection(rtcConfig);

      const tracksToPublish = [];
      stream.getTracks().forEach(track => {
        const transceiver = this.publishPc.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
        tracksToPublish.push({
          location: 'local',
          mid: transceiver.mid,
          trackName: track.kind === 'video' ? 'video' : 'audio',
          kind: track.kind
        });
      });

      const offer = await this.publishPc.createOffer();
      await this.publishPc.setLocalDescription(offer);

      const res = await fetch(`${CALLS_API_BASE}/api/calls/sessions/${this.sessionId}/tracks/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionDescription: {
            type: 'offer',
            sdp: this.publishPc.localDescription.sdp
          },
          tracks: tracksToPublish.map(t => ({ location: 'local', mid: t.mid, trackName: t.trackName }))
        })
      });

      const data = await res.json();
      if (data.sessionDescription) {
        await this.publishPc.setRemoteDescription(new RTCSessionDescription(data.sessionDescription));
        this.publishedTracks = data.tracks || [];
        console.log('[CF-CALLS] Published tracks to Cloudflare SFU:', this.publishedTracks);

        socket.emit('tracks-published', {
          callsSessionId: this.sessionId,
          tracks: this.publishedTracks
        });
      }
    } catch (err) {
      console.error('[CF-CALLS] Failed to publish tracks:', err);
    }
  }

  async replaceVideoTrack(newTrack) {
    if (!this.publishPc || !newTrack) return;
    try {
      const senders = this.publishPc.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video') || senders.find(s => !s.track);
      if (videoSender) {
        await videoSender.replaceTrack(newTrack);
        console.log('[CF-CALLS] Video track replaced on SFU publisher');
      }
    } catch (e) {
      console.warn('[CF-CALLS] replaceVideoTrack error:', e);
    }
  }

  async replaceAudioTrack(newTrack) {
    if (!this.publishPc || !newTrack) return;
    try {
      const senders = this.publishPc.getSenders();
      const audioSender = senders.find(s => s.track && s.track.kind === 'audio') || senders.find(s => !s.track);
      if (audioSender) {
        await audioSender.replaceTrack(newTrack);
        console.log('[CF-CALLS] Audio track replaced on SFU publisher');
      }
    } catch (e) {
      console.warn('[CF-CALLS] replaceAudioTrack error:', e);
    }
  }

  async subscribe(remoteUser, availableTracks) {
    if (!this.sessionId || !remoteUser.callsSessionId || remoteUser.socketId === socket.id) return;
    try {
      let subPc = this.subscribePcs.get(remoteUser.socketId);
      if (subPc) {
        try { subPc.close(); } catch (e) {}
      }

      subPc = new RTCPeerConnection(rtcConfig);
      this.subscribePcs.set(remoteUser.socketId, subPc);

      const remoteStream = new MediaStream();

      subPc.ontrack = (event) => {
        console.log(`[CF-CALLS] Received remote SFU track (${event.track.kind}) from ${remoteUser.userName}`);
        remoteStream.addTrack(event.track);

        if (event.track.kind === 'audio') {
          let audioEl = document.getElementById(`audio-${remoteUser.socketId}`);
          if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.id = `audio-${remoteUser.socketId}`;
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            document.body.appendChild(audioEl);
          }
          audioEl.srcObject = remoteStream;
          audioEl.play().catch(() => {});
        }

        renderOrUpdateRemoteTile(remoteUser.socketId, remoteUser.userName, remoteStream);
      };

      subPc.addTransceiver('audio', { direction: 'recvonly' });
      subPc.addTransceiver('video', { direction: 'recvonly' });

      const offer = await subPc.createOffer();
      await subPc.setLocalDescription(offer);

      const tracksToPull = (availableTracks && availableTracks.length > 0)
        ? availableTracks.map(t => ({ location: 'remote', sessionId: remoteUser.callsSessionId, trackName: t.trackName || t }))
        : [
            { location: 'remote', sessionId: remoteUser.callsSessionId, trackName: 'audio' },
            { location: 'remote', sessionId: remoteUser.callsSessionId, trackName: 'video' }
          ];

      const res = await fetch(`${CALLS_API_BASE}/api/calls/sessions/${this.sessionId}/tracks/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionDescription: {
            type: 'offer',
            sdp: subPc.localDescription.sdp
          },
          tracks: tracksToPull
        })
      });

      const data = await res.json();
      if (data.sessionDescription) {
        await subPc.setRemoteDescription(new RTCSessionDescription(data.sessionDescription));
        console.log(`[CF-CALLS] Successfully subscribed to ${remoteUser.userName} via Cloudflare SFU!`);
      }
    } catch (err) {
      console.error(`[CF-CALLS] Error subscribing to ${remoteUser.userName}:`, err);
    }
  }

  cleanup(remoteSocketId) {
    if (this.subscribePcs.has(remoteSocketId)) {
      try {
        this.subscribePcs.get(remoteSocketId).close();
      } catch (e) {}
      this.subscribePcs.delete(remoteSocketId);
    }
  }

  close() {
    if (this.publishPc) {
      try { this.publishPc.close(); } catch (e) {}
      this.publishPc = null;
    }
    for (const [id, pc] of this.subscribePcs.entries()) {
      try { pc.close(); } catch (e) {}
    }
    this.subscribePcs.clear();
  }
}

async function initLocalMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });

    localVideo.srcObject = localStream;

    // Apply pre-call mute settings
    if (isMicMuted) {
      localStream.getAudioTracks().forEach(t => t.enabled = false);
      updateMicButtonUI(true);
    }
    if (isCamMuted) {
      localStream.getVideoTracks().forEach(t => t.enabled = false);
      updateCamButtonUI(true);
    }

    // Check Cloudflare Calls SFU availability
    try {
      const configRes = await fetch(`${CALLS_API_BASE}/api/calls/config`).catch(() => null);
      if (configRes && configRes.ok) {
        const config = await configRes.json();
        if (config.sfuEnabled) {
          cfClient = new CloudflareCallsClient();
          isSfuActive = await cfClient.initSession();
          if (isSfuActive) {
            console.log('[ENGINE] Connected to Cloudflare Calls (Anycast SFU)!');
            showToast('Connected to Cloudflare Calls SFU');
          }
        }
      }
    } catch (cfErr) {
      console.warn('[ENGINE] Cloudflare Calls check failed, falling back to P2P:', cfErr);
    }

    if (!isSfuActive) {
      console.log('[ENGINE] Running in P2P Mesh WebRTC Mode');
    }

    // Connect to Room via Socket.IO
    socket.emit('join-room', {
      roomId,
      userId: socket.id,
      userName,
      callsSessionId: cfClient ? cfClient.sessionId : null
    });

    if (isSfuActive && cfClient) {
      await cfClient.publish(localStream);
    }

    initLocalAudioVisualizer(localStream);

  } catch (err) {
    console.error('Error getting local media:', err);
    showToast('Camera/Mic permission needed. Running in audio-only or fallback mode.');
    // Create empty audio stream fallback
    socket.emit('join-room', { roomId, userId: socket.id, userName });
  }
}

// Visualizer for speaking indicator
function initLocalAudioVisualizer(stream) {
  try {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    function checkSpeaking() {
      if (!isMicMuted) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        if (avg > 25) {
          localTile.classList.add('speaking');
        } else {
          localTile.classList.remove('speaking');
        }
      } else {
        localTile.classList.remove('speaking');
      }
      requestAnimationFrame(checkSpeaking);
    }
    checkSpeaking();
  } catch (e) {
    console.warn('AudioContext speaking meter disabled:', e);
  }
}

// ==========================================
// 3. WEBRTC MULTI-PEER SIGNALING
// ==========================================

// Existing users in the room when we join
socket.on('all-users', (users) => {
  console.log('[WEBRTC] Existing room users:', users);
  users.forEach(user => {
    if (user.socketId !== socket.id) {
      if (isSfuActive && user.callsSessionId && cfClient) {
        // Cloudflare Calls SFU subscription
        cfClient.subscribe(user, user.publishedTracks);
      } else {
        // P2P Mesh peer connection
        const pc = createPeerConnection(user.socketId, user.userName, true);
        peers.set(user.socketId, {
          pc,
          user,
          stream: new MediaStream(),
          candidateQueue: []
        });

        // Existing user creates the offer
        initiateOffer(user.socketId, pc);
      }

      // If an existing user is already sharing screen, show presentation stage immediately!
      if (user.isSharingScreen) {
        console.log(`[SYNC] ${user.userName} is currently sharing screen!`);
        presentationArea.classList.remove('hidden');
        const audioLabel = user.hasScreenAudio ? ' (with Audio 🔊)' : '';
        presenterNameTag.textContent = `${user.userName} is presenting${audioLabel}`;
        screenShareBanner.classList.remove('hidden');
        screenShareText.textContent = `${user.userName} is presenting${audioLabel}`;
        mirrorWarning?.classList.add('hidden');
      }
    }
  });
  updateParticipantCount();
});

// A new user joined the room
socket.on('user-joined', (user) => {
  console.log('[WEBRTC] New user joined:', user);
  showToast(`${user.userName} joined the meeting`);

  if (isSfuActive && user.callsSessionId && cfClient) {
    // Cloudflare Calls SFU subscription
    cfClient.subscribe(user, user.publishedTracks);
  } else {
    // P2P Mesh peer connection
    const pc = createPeerConnection(user.socketId, user.userName, false);
    peers.set(user.socketId, {
      pc,
      user,
      stream: new MediaStream(),
      candidateQueue: []
    });
  }

  updateParticipantCount();
  applyLayoutClasses();
});

// When a remote peer publishes new tracks to Cloudflare Calls
socket.on('user-tracks-available', ({ socketId, userName, callsSessionId, tracks }) => {
  if (isSfuActive && cfClient && socketId !== socket.id) {
    console.log(`[CF-CALLS] User ${userName} published new tracks:`, tracks);
    cfClient.subscribe({ socketId, userName, callsSessionId }, tracks);
  }
});

// Active Media Track Getters (dynamically handles screen share with audio mixing)
function getActiveAudioTrack() {
  if (isSharingScreen && mixedAudioTrack && mixedAudioTrack.readyState === 'live') {
    return mixedAudioTrack;
  }
  if (isSharingScreen && screenStream && screenStream.getAudioTracks().length > 0) {
    const sat = screenStream.getAudioTracks()[0];
    if (sat.readyState === 'live') return sat;
  }
  if (localStream && localStream.getAudioTracks().length > 0) {
    const mat = localStream.getAudioTracks()[0];
    if (mat.readyState === 'live') return mat;
  }
  return null;
}

function getActiveVideoTrack() {
  if (isSharingScreen && screenStream && screenStream.getVideoTracks().length > 0) {
    const svt = screenStream.getVideoTracks()[0];
    if (svt.readyState === 'live') return svt;
  }
  if (localStream && localStream.getVideoTracks().length > 0) {
    const lvt = localStream.getVideoTracks()[0];
    if (lvt.readyState === 'live') return lvt;
  }
  return null;
}

// Create RTCPeerConnection for a peer
function createPeerConnection(remoteSocketId, remoteUserName, isInitiator) {
  const pc = new RTCPeerConnection(rtcConfig);

  // 1. Always provision Audio Channel (Track or Transceiver)
  const currentAudioTrack = getActiveAudioTrack();
  if (currentAudioTrack) {
    pc.addTrack(currentAudioTrack, localStream || screenStream);
  } else {
    pc.addTransceiver('audio', { direction: 'sendrecv' });
  }

  // 2. Always provision Video Channel (Track or Transceiver)
  const currentVideoTrack = getActiveVideoTrack();
  if (currentVideoTrack) {
    pc.addTrack(currentVideoTrack, localStream || screenStream);
  } else {
    pc.addTransceiver('video', { direction: 'sendrecv' });
  }

  // ICE Candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', {
        to: remoteSocketId,
        signal: { candidate: event.candidate }
      });
    }
  };

  // Remote Tracks arrived
  pc.ontrack = (event) => {
    const incomingTrack = event.track;
    console.log(`[WEBRTC] Received remote track (${incomingTrack.kind}, id: ${incomingTrack.id}) from ${remoteUserName}`);
    const peerData = peers.get(remoteSocketId);
    if (!peerData) return;

    // Use native WebRTC MediaStream provided by the browser (required for iOS Safari video decoding)
    if (event.streams && event.streams[0]) {
      peerData.stream = event.streams[0];
    } else {
      if (!peerData.stream) peerData.stream = new MediaStream();
      peerData.stream.addTrack(incomingTrack);
    }

    // 1. Dedicated audio element for remote audio (voice + screen audio)
    let audioEl = document.getElementById(`audio-${remoteSocketId}`);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = `audio-${remoteSocketId}`;
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.muted = false;
      audioEl.volume = 1.0;
      audioEl.setAttribute('playsinline', 'true');
      audioEl.setAttribute('webkit-playsinline', 'true');
      document.body.appendChild(audioEl);
    }

    if (incomingTrack.kind === 'audio') {
      audioEl.srcObject = peerData.stream;
      const p = audioEl.play();
      if (p !== undefined) {
        p.catch(err => {
          console.log(`[AUTOPLAY] Audio blocked on mobile for ${remoteUserName}, showing tap helper:`, err);
          btnTapToPlayAudio?.classList.remove('hidden');
        });
      }
      if (isLoudspeakerEnabled) {
        routeAudioToLoudspeaker(peerData.stream);
      }
    }

    // 2. Render/update remote tile
    renderOrUpdateRemoteTile(remoteSocketId, remoteUserName, peerData.stream);

    // 3. If this peer is presenting, bind video to presentation stage directly
    if (peerData.user?.isSharingScreen || presenterNameTag.textContent.includes(remoteUserName)) {
      presentationArea.classList.remove('hidden');
      presentationVideo.muted = true;
      presentationVideo.setAttribute('playsinline', 'true');
      presentationVideo.setAttribute('webkit-playsinline', 'true');
      presentationVideo.srcObject = peerData.stream;
      const p = presentationVideo.play();
      if (p !== undefined) {
        p.catch(err => {
          console.log('[AUTOPLAY] Presentation blocked, showing tap button:', err);
          btnTapToPlayScreen?.classList.remove('hidden');
        });
      }
      if (audioEl) {
        audioEl.play().catch(() => {});
      }
    }

    // 4. Ensure playback when track un-mutes / recovers
    incomingTrack.onunmute = () => {
      console.log(`[WEBRTC] Track ${incomingTrack.kind} unmuted from ${remoteUserName}`);
      if (incomingTrack.kind === 'audio') {
        const aEl = document.getElementById(`audio-${remoteSocketId}`);
        if (aEl) aEl.play().catch(() => {});
      } else {
        if (!presentationArea.classList.contains('hidden') && (peerData.user?.isSharingScreen || presenterNameTag.textContent.includes(remoteUserName))) {
          presentationVideo.srcObject = peerData.stream;
          presentationVideo.play().catch(() => {});
        } else {
          const tile = document.getElementById(`tile-${remoteSocketId}`);
          tile?.querySelector('video')?.play().catch(() => {});
        }
      }
    };
  };

  return pc;
}

// Function to munge SDP for high-fidelity stereo Opus audio (128 kbps full-band)
function enableStereoOpusInSdp(sdp) {
  if (!sdp) return sdp;
  const opusMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000\/2/i);
  if (!opusMatch) return sdp;
  const pt = opusMatch[1];

  const fmtpRegex = new RegExp(`a=fmtp:${pt}\\s+([^\\r\\n]*)`, 'i');
  if (fmtpRegex.test(sdp)) {
    return sdp.replace(fmtpRegex, (match, params) => {
      let updated = params;
      if (!updated.includes('stereo=')) updated += ';stereo=1';
      if (!updated.includes('sprop-stereo=')) updated += ';sprop-stereo=1';
      if (!updated.includes('maxaveragebitrate=')) updated += ';maxaveragebitrate=128000';
      if (!updated.includes('cbr=')) updated += ';cbr=1';
      return `a=fmtp:${pt} ${updated}`;
    });
  } else {
    return sdp.replace(
      new RegExp(`(a=rtpmap:${pt}\\s+opus\/48000\/2\\r?\\n)`, 'i'),
      `$1a=fmtp:${pt} minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1;maxaveragebitrate=128000;cbr=1\r\n`
    );
  }
}

// Create and send offer
async function initiateOffer(toSocketId, pc) {
  try {
    const offer = await pc.createOffer();
    const modifiedSdp = enableStereoOpusInSdp(offer.sdp);
    await pc.setLocalDescription(new RTCSessionDescription({ type: offer.type, sdp: modifiedSdp }));
    socket.emit('signal', {
      to: toSocketId,
      signal: { description: pc.localDescription }
    });
  } catch (err) {
    console.error('[WEBRTC] Failed to create offer:', err);
  }
}

// Handle incoming WebRTC signals
socket.on('signal', async ({ from, fromUser, signal }) => {
  let peerData = peers.get(from);
  if (!peerData) {
    const pc = createPeerConnection(from, fromUser ? fromUser.userName : 'Guest', false);
    peerData = {
      pc,
      user: fromUser || { socketId: from, userName: 'Guest' },
      stream: new MediaStream(),
      candidateQueue: []
    };
    peers.set(from, peerData);
    updateParticipantCount();
  }

  const { pc } = peerData;

  try {
    // 1. Handle SDP (Offer or Answer)
    if (signal.description) {
      const desc = new RTCSessionDescription(signal.description);
      await pc.setRemoteDescription(desc);

      // Flush any queued ICE candidates
      if (peerData.candidateQueue && peerData.candidateQueue.length > 0) {
        for (const cand of peerData.candidateQueue) {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        }
        peerData.candidateQueue = [];
      }

      // If we received an offer, send an answer back
      if (desc.type === 'offer') {
        const answer = await pc.createAnswer();
        const modifiedSdp = enableStereoOpusInSdp(answer.sdp);
        await pc.setLocalDescription(new RTCSessionDescription({ type: answer.type, sdp: modifiedSdp }));
        socket.emit('signal', {
          to: from,
          signal: { description: pc.localDescription }
        });
      }
    }

    // 2. Handle ICE Candidate
    if (signal.candidate) {
      if (pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } else {
        peerData.candidateQueue.push(signal.candidate);
      }
    }
  } catch (err) {
    console.error('[WEBRTC] Signal processing error:', err);
  }
});

// A user left the room
socket.on('user-left', ({ socketId, userName: leftUserName }) => {
  console.log(`[WEBRTC] ${leftUserName} left`);
  showToast(`${leftUserName} left the meeting`);
  removeRemoteTile(socketId);
  if (isSfuActive && cfClient) {
    cfClient.cleanup(socketId);
  }
  if (peers.has(socketId)) {
    const { pc } = peers.get(socketId);
    pc.close();
    peers.delete(socketId);
  }
  if (pinnedTarget === socketId) {
    unpinCurrent();
  }
  updateParticipantCount();
  applyLayoutClasses();
});

// Log client errors to server
window.addEventListener('error', (e) => {
  socket.emit('client-log', { type: 'uncaught-error', msg: e.message, line: e.lineno });
});
window.addEventListener('unhandledrejection', (e) => {
  socket.emit('client-log', { type: 'unhandled-rejection', reason: String(e.reason) });
});

// ==========================================
// 4. BULLETPROOF SCREEN SHARING ENGINE (VIDEO + AUDIO MIXING)
// ==========================================

// Web Audio Mixing Engine for Screen Share + Microphone
function setupScreenAudioMixing(screenAudioTrack) {
  if (!screenAudioTrack) return null;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return screenAudioTrack;

    cleanupScreenAudioMixing();

    screenAudioMixerContext = new AudioContextClass();
    if (screenAudioMixerContext.state === 'suspended') {
      screenAudioMixerContext.resume().catch(e => console.warn('AudioContext resume warning:', e));
    }

    const destination = screenAudioMixerContext.createMediaStreamDestination();
    destination.channelCount = 2;
    destination.channelCountMode = 'explicit';
    destination.channelInterpretation = 'speakers';

    // 1. Screen Audio Source (computer / tab audio)
    const screenMediaStream = new MediaStream([screenAudioTrack]);
    screenAudioSourceNode = screenAudioMixerContext.createMediaStreamSource(screenMediaStream);
    screenGainNode = screenAudioMixerContext.createGain();
    screenGainNode.channelCount = 2;
    screenGainNode.channelCountMode = 'explicit';
    screenGainNode.channelInterpretation = 'speakers';
    screenGainNode.gain.setValueAtTime(1.0, screenAudioMixerContext.currentTime);
    screenAudioSourceNode.connect(screenGainNode);
    screenGainNode.connect(destination);

    // 2. Local Microphone Source (presenter can speak while sharing video)
    const micTrack = localStream?.getAudioTracks()[0];
    if (micTrack) {
      const micMediaStream = new MediaStream([micTrack]);
      micAudioSourceNode = screenAudioMixerContext.createMediaStreamSource(micMediaStream);
      micGainNode = screenAudioMixerContext.createGain();
      micGainNode.gain.setValueAtTime(isMicMuted ? 0.0 : 1.0, screenAudioMixerContext.currentTime);
      micAudioSourceNode.connect(micGainNode);
      micGainNode.connect(destination);
    }

    mixedAudioTrack = destination.stream.getAudioTracks()[0];
    console.log('[SCREEN AUDIO] Web Audio mixed track created successfully');
    return mixedAudioTrack;
  } catch (err) {
    console.error('[SCREEN AUDIO] Web Audio mix error, falling back to direct screen audio track:', err);
    return screenAudioTrack;
  }
}

function cleanupScreenAudioMixing() {
  if (mixedAudioTrack) {
    try { mixedAudioTrack.stop(); } catch (e) {}
    mixedAudioTrack = null;
  }
  if (screenAudioSourceNode) {
    try { screenAudioSourceNode.disconnect(); } catch (e) {}
    screenAudioSourceNode = null;
  }
  if (micAudioSourceNode) {
    try { micAudioSourceNode.disconnect(); } catch (e) {}
    micAudioSourceNode = null;
  }
  if (screenGainNode) {
    try { screenGainNode.disconnect(); } catch (e) {}
    screenGainNode = null;
  }
  if (micGainNode) {
    try { micGainNode.disconnect(); } catch (e) {}
    micGainNode = null;
  }
  if (screenAudioMixerContext && screenAudioMixerContext.state !== 'closed') {
    try { screenAudioMixerContext.close(); } catch (e) {}
    screenAudioMixerContext = null;
  }
}

btnToggleScreen?.addEventListener('click', async () => {
  if (isSharingScreen) {
    stopScreenShare();
  } else {
    await startScreenShare();
  }
});

async function startScreenShare() {
  try {
    // 1. Multi-tier capture with high fidelity audio constraints & systemAudio
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        systemAudio: 'include'
      });
    } catch (optErr) {
      console.warn('Advanced display media options not supported, falling back to standard audio: true', optErr);
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true
        });
      } catch (audioErr) {
        console.warn('Screen share with audio not supported, falling back to video only:', audioErr);
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' }
        });
      }
    }

    if (!screenStream) return;

    const screenTrack = screenStream.getVideoTracks()[0];
    if (!screenTrack) return;

    const screenAudioTrack = screenStream.getAudioTracks()[0];
    const hasAudio = !!screenAudioTrack;
    console.log(`[SCREEN SHIELD] Screen share started. Video: ${screenTrack.label}, Audio: ${hasAudio ? screenAudioTrack.label : 'none'}`);

    isSharingScreen = true;

    // 2. Mix microphone + tab/system audio so participants hear both voice & screen sound
    let outgoingAudioTrack = null;
    if (hasAudio) {
      outgoingAudioTrack = setupScreenAudioMixing(screenAudioTrack);
    }

    // Update Cloudflare Calls SFU publisher if active
    if (isSfuActive && cfClient) {
      cfClient.replaceVideoTrack(screenTrack);
      if (outgoingAudioTrack) {
        cfClient.replaceAudioTrack(outgoingAudioTrack);
      }
    }

    // 3. Update all active peer connections with video and audio tracks
    for (const [peerId, peerData] of peers.entries()) {
      try {
        const { pc } = peerData;
        const senders = pc.getSenders();

        // Update Video Sender
        let videoSender = senders.find(s => s.track && s.track.kind === 'video') ||
                          senders.find(s => !s.track);
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack).catch(err => {
            console.warn(`[SCREEN SHIELD] replaceTrack video failed for peer ${peerId}:`, err);
          });
        } else {
          try {
            pc.addTrack(screenTrack, screenStream);
          } catch (trackAddErr) {
            console.warn(`[SCREEN SHIELD] addTrack video failed for peer ${peerId}:`, trackAddErr);
          }
        }

        // Update Audio Sender if mixed audio exists
        if (outgoingAudioTrack) {
          let audioSender = senders.find(s => s.track && s.track.kind === 'audio') ||
                            senders.find(s => !s.track);
          if (audioSender) {
            console.log(`[SCREEN AUDIO] Replacing audio track on peer ${peerId} with mixed audio`);
            await audioSender.replaceTrack(outgoingAudioTrack).catch(err => {
              console.warn(`[SCREEN AUDIO] replaceTrack audio failed for peer ${peerId}:`, err);
            });
          } else {
            try {
              pc.addTrack(outgoingAudioTrack, screenStream);
            } catch (audioAddErr) {
              console.warn(`[SCREEN AUDIO] addTrack audio failed for peer ${peerId}:`, audioAddErr);
            }
          }
        }

        // Send renegotiation offer so remote decoders cleanly refresh
        initiateOffer(peerId, pc);
      } catch (peerErr) {
        console.warn(`[SCREEN SHIELD] Peer track update error for ${peerId}:`, peerErr);
      }
    }

    // 4. Watchdog: Browser native "Stop Sharing" button listener
    screenTrack.onended = () => {
      console.log('[SCREEN SHIELD] Native browser stop detected. Restoring camera cleanly...');
      stopScreenShare();
    };

    if (screenAudioTrack) {
      screenAudioTrack.onended = () => {
        console.log('[SCREEN AUDIO] Screen audio track ended');
      };
    }

    // 5. Update local UI
    btnToggleScreen.classList.add('sharing-active');
    const subText = btnToggleScreen.querySelector('.btn-subtext');
    if (subText) subText.textContent = 'Stop Sharing';
    screenShareBanner.classList.remove('hidden');
    screenShareText.textContent = hasAudio 
      ? 'You are presenting with Audio (Stream Shield ON)' 
      : 'You are presenting (Stream Shield ON)';

    // 6. Presentation area on stage for presenter
    presentationVideo.muted = true;
    presentationVideo.srcObject = screenStream;
    presentationArea.classList.remove('hidden');
    presenterNameTag.textContent = hasAudio ? 'You are presenting (with Audio 🔊)' : 'You are presenting';
    mirrorWarning?.classList.remove('hidden');
    presentationVideo.play().catch(e => {});

    // 7. Show Self-Screen PIP monitor if enabled
    pipVideo.srcObject = screenStream;
    if (pipEnabled) {
      selfScreenPip.classList.remove('hidden');
    }

    // 8. Notify peers via Socket.IO
    socket.emit('screen-share-status', { isSharing: true, hasAudio });

    if (hasAudio) {
      showToast('🔊 Screen & Audio sharing active (Tab/System audio ON)');
    } else {
      showToast('📺 Screen sharing active (Tip: In browser picker, select "Chrome Tab" and check "Share audio" to broadcast sound)');
    }
    applyLayoutClasses();

  } catch (err) {
    console.error('Screen share error:', err);
    socket.emit('client-log', { type: 'screen-share-error', error: err.message, name: err.name });
    if (err.name !== 'NotAllowedError') {
      showToast(`Could not share: ${err.message || 'Permission denied'}`);
    }
  }
}

async function stopScreenShare() {
  if (!isSharingScreen) return;
  isSharingScreen = false;

  // 1. Cleanup audio mixing
  cleanupScreenAudioMixing();

  // 2. Stop screen stream tracks
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }

  // 3. Restore camera video track and microphone audio track on all peer connections
  const camTrack = (localStream && !isCamMuted && localStream.getVideoTracks().length > 0)
    ? localStream.getVideoTracks()[0]
    : null;
  const micTrack = (localStream && localStream.getAudioTracks().length > 0)
    ? localStream.getAudioTracks()[0]
    : null;

  for (const [peerId, peerData] of peers.entries()) {
    try {
      const { pc } = peerData;
      const senders = pc.getSenders();

      // Restore Video Sender
      const videoSender = senders.find(s => s.track && s.track.kind === 'video') ||
                          senders.find(s => !s.track);
      if (videoSender && camTrack) {
        await videoSender.replaceTrack(camTrack).catch(err => console.warn(err));
      }

      // Restore Audio Sender
      const audioSender = senders.find(s => s.track && s.track.kind === 'audio') ||
                          senders.find(s => !s.track);
      if (audioSender && micTrack) {
        await audioSender.replaceTrack(micTrack).catch(err => console.warn(err));
      }

      // Renegotiate back to camera and mic
      initiateOffer(peerId, pc);
    } catch (err) {
      console.warn(`[SCREEN SHIELD] Error restoring cam/mic for peer ${peerId}:`, err);
    }
  }

  // Restore Cloudflare Calls SFU publisher tracks if active
  if (isSfuActive && cfClient) {
    if (camTrack) cfClient.replaceVideoTrack(camTrack);
    if (micTrack) cfClient.replaceAudioTrack(micTrack);
  }

  // 4. Hide PIP & presentation stage
  selfScreenPip.classList.add('hidden');
  pipVideo.srcObject = null;
  presentationArea.classList.add('hidden');
  presentationVideo.srcObject = null;
  mirrorWarning?.classList.add('hidden');
  btnTapToPlayScreen?.classList.add('hidden');
  btnTapToPlayAudio?.classList.add('hidden');

  // 5. Update button & banner UI
  btnToggleScreen.classList.remove('sharing-active');
  const subText = btnToggleScreen.querySelector('.btn-subtext');
  if (subText) subText.textContent = 'Share';
  screenShareBanner.classList.add('hidden');

  // 6. Notify peers via Socket.IO
  socket.emit('screen-share-status', { isSharing: false, hasAudio: false });
  showToast('Screen sharing stopped. Camera & mic restored.');
  applyLayoutClasses();
}

// Remote user screen share status update
socket.on('user-screen-share', ({ socketId, isSharing, hasAudio }) => {
  const peerData = peers.get(socketId);
  if (peerData?.user) {
    peerData.user.isSharingScreen = isSharing;
    peerData.user.hasScreenAudio = hasAudio;
  }
  const presenterName = peerData?.user?.userName || 'A participant';

  if (isSharing) {
    // Show presentation stage
    presentationArea.classList.remove('hidden');
    const audioLabel = hasAudio ? ' (with Audio 🔊)' : '';
    presenterNameTag.textContent = `${presenterName} is presenting${audioLabel}`;
    screenShareBanner.classList.remove('hidden');
    screenShareText.textContent = `${presenterName} is presenting${audioLabel}`;
    mirrorWarning?.classList.add('hidden'); // Viewers don't see the mirror tip

    if (peerData && peerData.stream) {
      presentationVideo.muted = true;
      presentationVideo.setAttribute('playsinline', 'true');
      presentationVideo.setAttribute('webkit-playsinline', 'true');
      presentationVideo.srcObject = peerData.stream;
      const p = presentationVideo.play();
      if (p !== undefined) {
        p.catch(err => {
          console.log('[AUTOPLAY] Presentation blocked, showing tap button:', err);
          btnTapToPlayScreen?.classList.remove('hidden');
        });
      }
    }

    // Ensure remote audio is playing
    const audioEl = document.getElementById(`audio-${socketId}`);
    if (audioEl) {
      audioEl.muted = false;
      audioEl.volume = 1.0;
      audioEl.play().catch(e => {
        console.log('Audio autoplay blocked, showing tap helper:', e);
        btnTapToPlayAudio?.classList.remove('hidden');
      });
    }

    if (isLoudspeakerEnabled && peerData?.stream) {
      routeAudioToLoudspeaker(peerData.stream);
    }
    updateSpeakerButtonUI(isLoudspeakerEnabled);

    // Update tile to avatar mode while presenting to free mobile hardware video decoder
    renderOrUpdateRemoteTile(socketId, presenterName, peerData?.stream);

    showToast(`${presenterName} started presenting${audioLabel}`);
  } else {
    // Hide presentation stage
    presentationArea.classList.add('hidden');
    presentationVideo.srcObject = null;
    screenShareBanner.classList.add('hidden');
    btnTapToPlayScreen?.classList.add('hidden');
    btnTapToPlayAudio?.classList.add('hidden');
    if (pinnedTarget === 'presentation') {
      unpinCurrent();
    }
    // Restore video on tile
    renderOrUpdateRemoteTile(socketId, presenterName, peerData?.stream);
    showToast(`${presenterName} stopped presenting`);
  }
  applyLayoutClasses();
});

// ==========================================
// 5. REMOTE VIDEO TILES & GRID LAYOUT
// ==========================================

function renderOrUpdateRemoteTile(remoteSocketId, remoteUserName, stream) {
  let tile = document.getElementById(`tile-${remoteSocketId}`);

  // Dedicated audio element for remote voice & screen share audio
  let audioEl = document.getElementById(`audio-${remoteSocketId}`);
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = `audio-${remoteSocketId}`;
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.muted = false;
    audioEl.volume = 1.0;
    audioEl.setAttribute('playsinline', 'true');
    audioEl.setAttribute('webkit-playsinline', 'true');
    document.body.appendChild(audioEl);
  }

  // Only bind/update if stream has an audio track and audioEl isn't already playing it
  const incomingAudioTracks = stream?.getAudioTracks() || [];
  if (incomingAudioTracks.length > 0) {
    const currentAudioTrack = incomingAudioTracks[0];
    if (!audioEl.srcObject || audioEl.srcObject.getAudioTracks()[0]?.id !== currentAudioTrack.id) {
      audioEl.srcObject = stream;
      const p = audioEl.play();
      if (p !== undefined) {
        p.catch(e => {
          console.log(`[AUTOPLAY] Audio play pending user tap for ${remoteUserName}:`, e);
          btnTapToPlayAudio?.classList.remove('hidden');
        });
      }
    }
  }

  if (!tile) {
    tile = document.createElement('div');
    tile.id = `tile-${remoteSocketId}`;
    tile.className = 'video-tile';
    tile.setAttribute('data-socket-id', remoteSocketId);

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true; // Video element MUST be muted for mobile autoplay!
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');

    const avatar = document.createElement('div');
    avatar.className = 'avatar-fallback hidden';
    avatar.id = `avatar-${remoteSocketId}`;
    const initialSpan = document.createElement('span');
    initialSpan.textContent = remoteUserName ? remoteUserName[0].toUpperCase() : 'U';
    avatar.appendChild(initialSpan);

    // Hover / Touch action overlay for Pinning
    const actionOverlay = document.createElement('div');
    actionOverlay.className = 'tile-actions';
    const pinBtn = document.createElement('button');
    pinBtn.className = 'btn-tile-pin';
    pinBtn.title = 'Pin to stage';
    pinBtn.innerHTML = '<i data-lucide="pin"></i>';
    pinBtn.onclick = (e) => {
      e.stopPropagation();
      togglePinTile(remoteSocketId);
    };
    actionOverlay.appendChild(pinBtn);

    const bottomBar = document.createElement('div');
    bottomBar.className = 'tile-bottom-bar';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'participant-name';
    nameSpan.textContent = remoteUserName;

    const statusIcons = document.createElement('div');
    statusIcons.className = 'tile-status';

    const handBadge = document.createElement('span');
    handBadge.className = 'status-icon hand-active hidden';
    handBadge.id = `hand-${remoteSocketId}`;
    handBadge.innerHTML = '<i data-lucide="hand"></i>';

    const micBadge = document.createElement('span');
    micBadge.className = 'status-icon';
    micBadge.id = `mic-${remoteSocketId}`;
    micBadge.innerHTML = '<i data-lucide="mic" class="mic-on-icon"></i><i data-lucide="mic-off" class="mic-off-icon hidden"></i>';

    statusIcons.appendChild(handBadge);
    statusIcons.appendChild(micBadge);
    bottomBar.appendChild(nameSpan);
    bottomBar.appendChild(statusIcons);

    tile.appendChild(video);
    tile.appendChild(avatar);
    tile.appendChild(actionOverlay);
    tile.appendChild(bottomBar);

    videoGrid.appendChild(tile);
    if (window.lucide) window.lucide.createIcons({ root: tile });
  }

  const peerData = peers.get(remoteSocketId);
  const isPresenting = peerData?.user?.isSharingScreen;
  const videoElement = tile.querySelector('video');
  const avatar = tile.querySelector('.avatar-fallback');

  if (isPresenting) {
    // When presenting, free the hardware decoder pipeline for presentationVideo on mobile!
    if (videoElement) {
      videoElement.srcObject = null;
    }
    avatar?.classList.remove('hidden');
  } else {
    if (videoElement && stream) {
      videoElement.muted = true;
      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
      videoElement.play().catch(e => console.log('Tile video play waiting for interaction'));
    }
    if (!peerData?.user?.videoMuted) {
      avatar?.classList.add('hidden');
    }
  }

  applyLayoutClasses();
}

function removeRemoteTile(socketId) {
  const tile = document.getElementById(`tile-${socketId}`);
  if (tile && tile.parentNode) {
    tile.parentNode.removeChild(tile);
  }
  const audioEl = document.getElementById(`audio-${socketId}`);
  if (audioEl && audioEl.parentNode) {
    audioEl.parentNode.removeChild(audioEl);
  }
}

// User tap-to-play listeners for mobile browsers
btnTapToPlayScreen?.addEventListener('click', () => {
  presentationVideo.play().then(() => {
    btnTapToPlayScreen.classList.add('hidden');
  }).catch(e => console.log(e));
});

btnTapToPlayAudio?.addEventListener('click', () => {
  document.querySelectorAll('audio').forEach(a => {
    a.muted = false;
    a.volume = 1.0;
    a.play().catch(e => console.log('Tap play audio error:', e));
  });
  btnTapToPlayAudio.classList.add('hidden');
  showToast('Audio playback enabled');
});

document.addEventListener('touchstart', () => {
  if (loudspeakerAudioCtx && loudspeakerAudioCtx.state === 'suspended') {
    loudspeakerAudioCtx.resume().catch(() => {});
  }
  document.querySelectorAll('audio').forEach(a => a.play().catch(() => {}));
  btnTapToPlayAudio?.classList.add('hidden');
  if (presentationVideo.srcObject) {
    presentationVideo.play().then(() => {
      btnTapToPlayScreen?.classList.add('hidden');
    }).catch(() => {});
  }
}, { passive: true });

document.addEventListener('click', () => {
  if (loudspeakerAudioCtx && loudspeakerAudioCtx.state === 'suspended') {
    loudspeakerAudioCtx.resume().catch(() => {});
  }
  document.querySelectorAll('audio').forEach(a => a.play().catch(() => {}));
  btnTapToPlayAudio?.classList.add('hidden');
  if (presentationVideo.srcObject) {
    presentationVideo.play().then(() => {
      btnTapToPlayScreen?.classList.add('hidden');
    }).catch(() => {});
  }
}, { passive: true });

// Dynamically scale video tiles based on participant count
function updateGridLayout() {
  const totalTiles = videoGrid.children.length;
  videoGrid.classList.remove('grid-1', 'grid-2', 'grid-3', 'grid-4', 'grid-5', 'grid-6');

  if (totalTiles <= 1) {
    videoGrid.classList.add('grid-1');
  } else if (totalTiles === 2) {
    videoGrid.classList.add('grid-2');
  } else if (totalTiles <= 4) {
    videoGrid.classList.add('grid-4');
  } else {
    videoGrid.classList.add('grid-6');
  }
}

// ==========================================
// 6. MIC & CAMERA TOGGLES
// ==========================================

function updateMicButtonUI(muted) {
  btnToggleMic?.classList.toggle('active-off', muted);
  btnToggleMic?.querySelector('.icon-on')?.classList.toggle('hidden', muted);
  btnToggleMic?.querySelector('.icon-off')?.classList.toggle('hidden', !muted);
  if (localMicBadge) {
    localMicBadge.classList.toggle('muted', muted);
    localMicBadge.querySelector('.mic-on-icon')?.classList.toggle('hidden', muted);
    localMicBadge.querySelector('.mic-off-icon')?.classList.toggle('hidden', !muted);
  }
}

btnToggleMic?.addEventListener('click', () => {
  isMicMuted = !isMicMuted;
  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !isMicMuted;
    });
  }
  // Adjust screen share audio mix gain smoothly
  if (micGainNode && screenAudioMixerContext) {
    try {
      micGainNode.gain.setValueAtTime(isMicMuted ? 0.0 : 1.0, screenAudioMixerContext.currentTime);
    } catch (e) {
      micGainNode.gain.value = isMicMuted ? 0.0 : 1.0;
    }
  }
  updateMicButtonUI(isMicMuted);
  socket.emit('toggle-audio', { isMuted: isMicMuted });
  showToast(isMicMuted ? 'Microphone muted' : 'Microphone turned on');
});

function updateCamButtonUI(off) {
  btnToggleCam?.classList.toggle('active-off', off);
  btnToggleCam?.querySelector('.icon-on')?.classList.toggle('hidden', off);
  btnToggleCam?.querySelector('.icon-off')?.classList.toggle('hidden', !off);
  localAvatar?.classList.toggle('hidden', !off);
}

btnToggleCam?.addEventListener('click', () => {
  isCamMuted = !isCamMuted;
  if (localStream) {
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !isCamMuted;
    });
  }
  updateCamButtonUI(isCamMuted);
  socket.emit('toggle-video', { isVideoOff: isCamMuted });
  showToast(isCamMuted ? 'Camera turned off' : 'Camera turned on');
});

socket.on('user-audio-toggle', ({ socketId, isMuted }) => {
  const badge = document.getElementById(`mic-${socketId}`);
  if (badge) {
    badge.classList.toggle('muted', isMuted);
    badge.querySelector('.mic-on-icon')?.classList.toggle('hidden', isMuted);
    badge.querySelector('.mic-off-icon')?.classList.toggle('hidden', !isMuted);
  }
});

socket.on('user-video-toggle', ({ socketId, isVideoOff }) => {
  const avatar = document.getElementById(`avatar-${socketId}`);
  if (avatar) avatar.classList.toggle('hidden', !isVideoOff);
});

// ==========================================
// 7. HAND RAISE & REACTIONS
// ==========================================

btnRaiseHand?.addEventListener('click', () => {
  isHandRaised = !isHandRaised;
  localHandBadge?.classList.toggle('hidden', !isHandRaised);
  btnRaiseHand.classList.toggle('active-warning', isHandRaised);
  socket.emit('raise-hand', { isRaised: isHandRaised });
  showToast(isHandRaised ? 'Hand raised' : 'Hand lowered');
});

socket.on('user-hand-toggle', ({ socketId, userName: handUser, isRaised }) => {
  if (socketId !== socket.id) {
    const badge = document.getElementById(`hand-${socketId}`);
    if (badge) badge.classList.toggle('hidden', !isRaised);
    if (isRaised) showToast(`${handUser} raised their hand`);
  }
});

btnReactionTrigger?.addEventListener('click', (e) => {
  e.stopPropagation();
  reactionPicker.classList.toggle('hidden');
});

document.addEventListener('click', () => {
  reactionPicker.classList.add('hidden');
});

document.querySelectorAll('.reaction-opt').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const emoji = btn.dataset.emoji;
    triggerReactionAnimation(emoji);
    socket.emit('send-reaction', { emoji });
    reactionPicker.classList.add('hidden');
  });
});

socket.on('receive-reaction', ({ userName: sender, emoji }) => {
  triggerReactionAnimation(emoji);
});

function triggerReactionAnimation(emoji) {
  const el = document.createElement('div');
  el.className = 'floating-emoji';
  el.textContent = emoji;
  el.style.left = `${Math.floor(Math.random() * 120) + 20}px`;
  reactionOverlay.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 3000);
}

// ==========================================
// 8. IN-CALL CHAT & VOICE ANNOUNCEMENTS
// ==========================================

function openChatDrawer() {
  chatDrawer.classList.remove('hidden');
  btnToggleChat.classList.add('active');
  peopleDrawer.classList.add('hidden');
  btnTogglePeople.classList.remove('active');
  unreadMessagesCount = 0;
  chatUnreadBadge.textContent = '0';
  chatUnreadBadge.classList.add('hidden');
  chatMessages.scrollTop = chatMessages.scrollHeight;
  setTimeout(() => chatInput?.focus(), 150);
}

function closeChatDrawer() {
  chatDrawer.classList.add('hidden');
  btnToggleChat.classList.remove('active');
}

btnToggleChat?.addEventListener('click', () => {
  const isHidden = chatDrawer.classList.contains('hidden');
  if (isHidden) {
    openChatDrawer();
  } else {
    closeChatDrawer();
  }
});

btnCloseChat?.addEventListener('click', closeChatDrawer);

btnToggleChatSound?.addEventListener('click', () => {
  isMessageSoundEnabled = !isMessageSoundEnabled;
  btnToggleChatSound.classList.toggle('active', isMessageSoundEnabled);
  btnToggleChatSound.innerHTML = isMessageSoundEnabled 
    ? '<i data-lucide="bell" id="soundToggleIcon"></i><span id="soundToggleText">Sound</span>' 
    : '<i data-lucide="bell-off" id="soundToggleIcon"></i><span id="soundToggleText">Muted</span>';
  if (window.lucide) window.lucide.createIcons({ root: btnToggleChatSound });
  showToast(isMessageSoundEnabled ? 'Message sound enabled' : 'Message sound muted');
});

// Crisp "tilink" notification chime on incoming chat message
function playMessageChime() {
  if (!isMessageSoundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const t = ctx.currentTime;
    
    // First bell tone ("ti-"): high crisp bell (C6 - 1046.5 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, t);
    gain1.gain.setValueAtTime(0.18, t);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.22);

    // Second bell tone ("-link"): sparkling higher chime (G6 - 1567.98 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1567.98, t + 0.07);
    gain2.gain.setValueAtTime(0.2, t + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.07);
    osc2.stop(t + 0.45);

    setTimeout(() => {
      try { ctx.close(); } catch(e) {}
    }, 600);
  } catch (err) {
    console.warn('[AUDIO CHIME] Notification chime failed:', err);
  }
}

// Apple iOS Floating Notification Banner
function showIOSChatBanner(sender, text) {
  if (!iosChatNotification) return;

  if (iosBannerSender) iosBannerSender.textContent = sender;
  if (iosBannerMessage) iosBannerMessage.textContent = text;
  if (iosBannerAvatar) {
    iosBannerAvatar.textContent = (sender || 'U').charAt(0).toUpperCase();
  }

  iosChatNotification.classList.remove('hidden');
  // Trigger DOM reflow to guarantee CSS transition plays
  void iosChatNotification.offsetWidth;
  iosChatNotification.classList.add('banner-visible');

  if (navigator.vibrate) {
    try { navigator.vibrate([20, 40, 20]); } catch (e) {}
  }

  if (iosBannerTimeout) clearTimeout(iosBannerTimeout);
  iosBannerTimeout = setTimeout(() => {
    hideIOSChatBanner();
  }, 4500);
}

function hideIOSChatBanner() {
  if (!iosChatNotification) return;
  iosChatNotification.classList.remove('banner-visible');
  setTimeout(() => {
    if (!iosChatNotification.classList.contains('banner-visible')) {
      iosChatNotification.classList.add('hidden');
    }
  }, 350);
}

// Clicking notification banner opens chat drawer directly
iosChatNotification?.addEventListener('click', () => {
  hideIOSChatBanner();
  openChatDrawer();
});

chatInput?.addEventListener('focus', () => {
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatForm?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, 250);
});

chatForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) {
    socket.emit('send-message', { message: text });
    chatInput.value = '';
  }
});

socket.on('receive-message', (item) => {
  const isMine = item.socketId === socket.id;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${isMine ? 'mine' : 'other'}`;

  bubble.innerHTML = `
    <div class="chat-meta">
      <span>${isMine ? 'You' : item.sender}</span>
      <span>${item.time}</span>
    </div>
    <div class="chat-text">${escapeHtml(item.text)}</div>
  `;

  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (!isMine) {
    // 1. Play crisp "tilink" audio chime
    playMessageChime();

    // 2. Show notification banner and update unread count if chat is closed
    if (chatDrawer.classList.contains('hidden')) {
      unreadMessagesCount++;
      chatUnreadBadge.textContent = unreadMessagesCount > 9 ? '9+' : unreadMessagesCount;
      chatUnreadBadge.classList.remove('hidden');
      showIOSChatBanner(item.sender, item.text);
    }
  }
});

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==========================================
// 9. PARTICIPANTS DRAWER
// ==========================================

btnTogglePeople?.addEventListener('click', () => {
  const isHidden = peopleDrawer.classList.contains('hidden');
  peopleDrawer.classList.toggle('hidden', !isHidden);
  btnTogglePeople.classList.toggle('active', isHidden);
  if (isHidden) {
    chatDrawer.classList.add('hidden');
    btnToggleChat.classList.remove('active');
    renderPeopleList();
  }
});

btnClosePeople?.addEventListener('click', () => {
  peopleDrawer.classList.add('hidden');
  btnTogglePeople.classList.remove('active');
});

function updateParticipantCount() {
  const count = peers.size + 1;
  if (peopleCount) peopleCount.textContent = count;
  if (footerPeopleBadge) footerPeopleBadge.textContent = count;
  const headerParticipantCount = document.getElementById('headerParticipantCount');
  if (headerParticipantCount) headerParticipantCount.textContent = count;
  renderPeopleList();
}

function renderPeopleList() {
  if (!peopleList) return;
  peopleList.innerHTML = '';

  const selfDiv = document.createElement('div');
  selfDiv.className = 'participant-row';
  selfDiv.innerHTML = `
    <div class="participant-info">
      <div class="participant-avatar-mini">${(userName || 'Y')[0].toUpperCase()}</div>
      <div class="participant-name-text">${userName} (You)</div>
    </div>
    <div class="participant-badges">
      ${isSharingScreen ? '<span title="Sharing screen" class="chip-status"><i data-lucide="monitor"></i></span>' : ''}
      ${isHandRaised ? '<span title="Hand raised" class="chip-status"><i data-lucide="hand"></i></span>' : ''}
      <button class="btn-icon-chip" title="Pin user" onclick="togglePinTile('local')">
        <i data-lucide="pin"></i>
      </button>
    </div>
  `;
  peopleList.appendChild(selfDiv);

  for (const [socketId, peerData] of peers.entries()) {
    const peerName = peerData.user?.userName || 'Guest';
    const pDiv = document.createElement('div');
    pDiv.className = 'participant-row';
    pDiv.innerHTML = `
      <div class="participant-info">
        <div class="participant-avatar-mini">${(peerName || 'G')[0].toUpperCase()}</div>
        <div class="participant-name-text">${peerName}</div>
      </div>
      <div class="participant-badges">
        ${peerData.user?.isSharingScreen ? '<span title="Sharing screen" class="chip-status"><i data-lucide="monitor"></i></span>' : ''}
        ${peerData.user?.isHandRaised ? '<span title="Hand raised" class="chip-status"><i data-lucide="hand"></i></span>' : ''}
        <button class="btn-icon-chip" title="Pin user" onclick="togglePinTile('${socketId}')">
          <i data-lucide="pin"></i>
        </button>
      </div>
    `;
    peopleList.appendChild(pDiv);
  }

  if (window.lucide) window.lucide.createIcons({ root: peopleList });
}

// ==========================================
// 10. KEYBOARD SHORTCUTS & LEAVE CALL
// ==========================================

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    btnToggleMic.click();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
    e.preventDefault();
    btnToggleCam.click();
  }
  if (e.key === 'Escape') {
    chatDrawer.classList.add('hidden');
    peopleDrawer.classList.add('hidden');
    reactionPicker.classList.add('hidden');
    layoutModal.classList.add('hidden');
  }
});

btnLeaveCall?.addEventListener('click', () => {
  if (confirm('Leave this meeting?')) {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    peers.forEach(({ pc }) => pc.close());
    socket.disconnect();
    window.location.href = '/';
  }
});

// Start media setup on page load
window.addEventListener('DOMContentLoaded', initLocalMedia);
