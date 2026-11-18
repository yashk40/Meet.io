// lobby.js - Pre-meeting camera preview, audio meter, room creation
let localStream = null;
let audioContext = null;
let analyser = null;
let micAnimationId = null;

let isMicMuted = false;
let isCamMuted = false;

// DOM Elements
const previewVideo = document.getElementById('previewVideo');
const previewVideoFallback = document.getElementById('previewVideoFallback');
const previewInitials = document.getElementById('previewInitials');
const btnPreviewMic = document.getElementById('btnPreviewMic');
const btnPreviewCam = document.getElementById('btnPreviewCam');
const audioMeterFill = document.getElementById('audioMeterFill');
const userNameInput = document.getElementById('userNameInput');
const btnNewMeeting = document.getElementById('btnNewMeeting');
const roomCodeInput = document.getElementById('roomCodeInput');
const btnJoin = document.getElementById('btnJoin');
const btnJoinPreview = document.getElementById('btnJoinPreview');
const liveClock = document.getElementById('liveClock');

// Update Clock
function updateClock() {
  if (!liveClock) return;
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  liveClock.textContent = `${timeStr} • ${dateStr}`;
}
setInterval(updateClock, 1000);
updateClock();

// Load saved user name
const savedName = localStorage.getItem('meet_userName') || '';
if (userNameInput) {
  userNameInput.value = savedName;
  updateInitials(savedName);
  userNameInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    localStorage.setItem('meet_userName', val);
    updateInitials(val);
  });
}

function updateInitials(name) {
  if (!previewInitials) return;
  previewInitials.textContent = (name && name[0]) ? name[0].toUpperCase() : 'U';
}

// Initialize Local Media Stream
async function initLobbyMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true
    });

    previewVideo.srcObject = localStream;
    previewVideoFallback?.classList.add('hidden');
    initAudioMeter(localStream);
  } catch (err) {
    console.warn('Could not access camera/mic:', err);
    // User might not have camera or permission denied
    previewVideoFallback?.classList.remove('hidden');
  }
}

// Audio level visualizer for mic test
function initAudioMeter(stream) {
  try {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function tickMeter() {
      if (isMicMuted) {
        audioMeterFill.style.width = '0%';
        micAnimationId = requestAnimationFrame(tickMeter);
        return;
      }
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const pct = Math.min(100, Math.round((avg / 128) * 100));
      audioMeterFill.style.width = `${pct}%`;
      micAnimationId = requestAnimationFrame(tickMeter);
    }
    tickMeter();
  } catch (err) {
    console.warn('AudioContext error:', err);
  }
}

// Toggle Mic
btnPreviewMic?.addEventListener('click', () => {
  isMicMuted = !isMicMuted;
  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !isMicMuted;
    });
  }
  btnPreviewMic.classList.toggle('muted', isMicMuted);
  btnPreviewMic.querySelector('.icon-on').classList.toggle('hidden', isMicMuted);
  btnPreviewMic.querySelector('.icon-off').classList.toggle('hidden', !isMicMuted);
  sessionStorage.setItem('meet_initMicMuted', isMicMuted ? 'true' : 'false');
});

// Toggle Cam
btnPreviewCam?.addEventListener('click', () => {
  isCamMuted = !isCamMuted;
  if (localStream) {
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !isCamMuted;
    });
  }
  previewVideoFallback.classList.toggle('hidden', !isCamMuted);
  btnPreviewCam.classList.toggle('muted', isCamMuted);
  btnPreviewCam.querySelector('.icon-on').classList.toggle('hidden', isCamMuted);
  btnPreviewCam.querySelector('.icon-off').classList.toggle('hidden', !isCamMuted);
  sessionStorage.setItem('meet_initCamMuted', isCamMuted ? 'true' : 'false');
});

// Join button validation
roomCodeInput?.addEventListener('input', (e) => {
  const val = e.target.value.trim();
  if (btnJoin) {
    btnJoin.style.opacity = val.length === 0 ? '0.5' : '1';
  }
});

btnJoinPreview?.addEventListener('click', () => {
  const code = (roomCodeInput?.value || '').trim();
  if (code) {
    btnJoin?.click();
  } else {
    btnNewMeeting?.click();
  }
});

// Clean up input code / link
function extractRoomId(raw) {
  let val = raw.trim();
  if (val.includes('/r/')) {
    val = val.split('/r/')[1].split('?')[0].split('#')[0];
  } else if (val.includes('/room/')) {
    val = val.split('/room/')[1].split('?')[0].split('#')[0];
  }
  return val.replace(/[^a-zA-Z0-9-]/g, '');
}

// Start New Meeting
btnNewMeeting?.addEventListener('click', async () => {
  try {
    saveUserName();
    const backendUrl = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1') || window.location.hostname.includes('onrender.com'))
      ? ''
      : 'https://meet-io-aq20.onrender.com';
    let newRoomId = null;
    try {
      const res = await fetch(`${backendUrl}/api/new-room`);
      if (res.ok) {
        const data = await res.json();
        newRoomId = data.roomId;
      }
    } catch (e) {
      console.warn('API new-room fetch fallback:', e);
    }

    if (!newRoomId) {
      // Robust client-side fallback if network or proxy is down
      const chars = 'abcdefghijklmnopqrstuvwxyz';
      const seg = n => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      newRoomId = `${seg(3)}-${seg(4)}-${seg(3)}`;
    }

    cleanupLobby();
    window.location.href = `/r/${newRoomId}`;
  } catch (err) {
    console.error('Failed to create new room:', err);
  }
});

// Join Existing Meeting
btnJoin?.addEventListener('click', () => {
  const code = extractRoomId(roomCodeInput.value);
  if (code) {
    saveUserName();
    cleanupLobby();
    window.location.href = `/r/${code}`;
  }
});

roomCodeInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !btnJoin.disabled) btnJoin.click();
});

function saveUserName() {
  const name = (userNameInput?.value || '').trim() || 'Guest';
  localStorage.setItem('meet_userName', name);
}

function cleanupLobby() {
  if (micAnimationId) cancelAnimationFrame(micAnimationId);
  if (audioContext) audioContext.close();
  if (localStream) localStream.getTracks().forEach(t => t.stop());
}

// Start pre-call camera
window.addEventListener('DOMContentLoaded', initLobbyMedia);
