from datetime import datetime
import os
from pathlib import Path
import random
import string
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import socketio
import uvicorn

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"

app = FastAPI(title="meet.io")

# CORS middleware for FastAPI REST endpoints
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Async Socket.IO server with permissive CORS for WebRTC signaling
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
_sio_app = socketio.ASGIApp(sio, other_asgi_app=app)

SOCKET_IO_CLIENT_DIR = PUBLIC_DIR / "socket.io"

class SocketClientWrapper:
    """ASGI wrapper to serve Socket.IO client script while forwarding WebRTC signaling to python-socketio."""
    def __init__(self, inner_app):
        self.inner_app = inner_app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path in (
                "/socket.io/socket.io.js",
                "/socket.io/socket.io.min.js",
                "/socket.io/socket.io.js.map",
                "/socket.io/socket.io.esm.min.js",
            ):
                file_path = SOCKET_IO_CLIENT_DIR / Path(path).name
                if file_path.is_file():
                    media_type = "application/javascript" if file_path.suffix == ".js" else "application/json"
                    response = FileResponse(file_path, media_type=media_type)
                    return await response(scope, receive, send)
        await self.inner_app(scope, receive, send)

socket_app = SocketClientWrapper(_sio_app)

# In-memory room and user session management
# rooms: roomId -> { socketId: { userId, userName, audioMuted, videoMuted, isSharingScreen, isHandRaised, hasScreenAudio } }
rooms: dict[str, dict[str, dict]] = {}
# user_sessions: socketId -> { "roomId": str, "user": dict }
user_sessions: dict[str, dict] = {}


@sio.event
async def connect(sid, environ, auth=None):
    print(f"[CONNECT] Socket connected: {sid}")


@sio.on("join-room")
async def on_join_room(sid, data):
    data = data or {}
    room_id = data.get("roomId")
    if not room_id:
        return

    user_id = data.get("userId") or sid
    user_name = data.get("userName") or "Guest"

    current_user = {
        "socketId": sid,
        "userId": user_id,
        "userName": user_name,
        "audioMuted": False,
        "videoMuted": False,
        "isSharingScreen": False,
        "isHandRaised": False,
    }

    # If socket was previously registered in another room, clean it up first
    if sid in user_sessions:
        old_room_id = user_sessions[sid].get("roomId")
        if old_room_id and old_room_id != room_id:
            await sio.leave_room(sid, old_room_id)
            if old_room_id in rooms and sid in rooms[old_room_id]:
                del rooms[old_room_id][sid]
                if not rooms[old_room_id]:
                    del rooms[old_room_id]

    user_sessions[sid] = {"roomId": room_id, "user": current_user}
    await sio.enter_room(sid, room_id)

    if room_id not in rooms:
        rooms[room_id] = {}

    room_users = rooms[room_id]

    # Send the list of existing users to the newly joined peer
    existing_users = list(room_users.values())
    await sio.emit("all-users", existing_users, to=sid)

    # Add current user to room
    room_users[sid] = current_user

    # Notify other peers in the room
    await sio.emit("user-joined", current_user, room=room_id, skip_sid=sid)

    print(f"[JOIN] {current_user['userName']} ({sid}) joined room {room_id}. Total: {len(room_users)}")


@sio.on("signal")
async def on_signal(sid, data):
    data = data or {}
    to_sid = data.get("to")
    if not to_sid:
        return
    session = user_sessions.get(sid, {})
    from_user = session.get("user")
    await sio.emit(
        "signal",
        {
            "from": sid,
            "fromUser": from_user,
            "signal": data.get("signal"),
        },
        to=to_sid,
    )


@sio.on("screen-share-status")
async def on_screen_share(sid, data):
    data = data or {}
    session = user_sessions.get(sid)
    if session:
        user = session.get("user")
        room_id = session.get("roomId")
        if user and room_id:
            is_sharing = data.get("isSharing", False)
            has_audio = bool(data.get("hasAudio", False))
            user["isSharingScreen"] = is_sharing
            user["hasScreenAudio"] = has_audio
            await sio.emit(
                "user-screen-share",
                {
                    "socketId": sid,
                    "isSharing": is_sharing,
                    "hasAudio": has_audio,
                },
                room=room_id,
                skip_sid=sid,
            )


@sio.on("toggle-audio")
async def on_toggle_audio(sid, data):
    data = data or {}
    session = user_sessions.get(sid)
    if session:
        user = session.get("user")
        room_id = session.get("roomId")
        if user and room_id:
            is_muted = data.get("isMuted", False)
            user["audioMuted"] = is_muted
            await sio.emit(
                "user-audio-toggle",
                {
                    "socketId": sid,
                    "isMuted": is_muted,
                },
                room=room_id,
                skip_sid=sid,
            )


@sio.on("toggle-video")
async def on_toggle_video(sid, data):
    data = data or {}
    session = user_sessions.get(sid)
    if session:
        user = session.get("user")
        room_id = session.get("roomId")
        if user and room_id:
            is_video_off = data.get("isVideoOff", False)
            user["videoMuted"] = is_video_off
            await sio.emit(
                "user-video-toggle",
                {
                    "socketId": sid,
                    "isVideoOff": is_video_off,
                },
                room=room_id,
                skip_sid=sid,
            )


@sio.on("raise-hand")
async def on_raise_hand(sid, data):
    data = data or {}
    session = user_sessions.get(sid)
    if session:
        user = session.get("user")
        room_id = session.get("roomId")
        if user and room_id:
            is_raised = data.get("isRaised", False)
            user["isHandRaised"] = is_raised
            await sio.emit(
                "user-hand-toggle",
                {
                    "socketId": sid,
                    "userName": user.get("userName"),
                    "isRaised": is_raised,
                },
                room=room_id,
            )


@sio.on("send-reaction")
async def on_send_reaction(sid, data):
    data = data or {}
    session = user_sessions.get(sid)
    if session:
        user = session.get("user")
        room_id = session.get("roomId")
        if user and room_id:
            await sio.emit(
                "receive-reaction",
                {
                    "socketId": sid,
                    "userName": user.get("userName"),
                    "emoji": data.get("emoji"),
                },
                room=room_id,
            )


@sio.on("send-message")
async def on_send_message(sid, data):
    data = data or {}
    session = user_sessions.get(sid)
    if session:
        user = session.get("user")
        room_id = session.get("roomId")
        if user and room_id:
            chat_item = {
                "id": f"{int(time.time() * 1000):x}{random.randint(1000, 9999):x}",
                "socketId": sid,
                "sender": user.get("userName", "Guest"),
                "text": data.get("message", ""),
                "time": datetime.now().strftime("%I:%M %p"),
            }
            await sio.emit("receive-message", chat_item, room=room_id)


@sio.on("client-log")
async def on_client_log(sid, data):
    print(f"[CLIENT-LOG] [{sid}] {data}")


@sio.event
async def disconnect(sid, *args, **kwargs):
    session = user_sessions.pop(sid, None)
    if session:
        room_id = session.get("roomId")
        user = session.get("user")
        user_name = user.get("userName") if user else "A participant"
        if room_id and room_id in rooms:
            room_users = rooms[room_id]
            room_users.pop(sid, None)
            await sio.emit(
                "user-left",
                {
                    "socketId": sid,
                    "userName": user_name,
                },
                room=room_id,
                skip_sid=sid,
            )
            print(f"[LEAVE] {sid} left room {room_id}. Remaining: {len(room_users)}")
            if not room_users:
                rooms.pop(room_id, None)
    print(f"[DISCONNECT] Socket disconnected: {sid}")


def generate_room_code() -> str:
    chars = string.ascii_lowercase
    seg = lambda n: "".join(random.choices(chars, k=n))
    return f"{seg(3)}-{seg(4)}-{seg(3)}"


@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "meet.io", "time": time.time()}


@app.get("/api/new-room")
async def api_new_room():
    return {"roomId": generate_room_code()}


@app.get("/")
async def get_index():
    return FileResponse(PUBLIC_DIR / "index.html")


@app.get("/r/{room_id}")
async def get_room(room_id: str):
    return FileResponse(PUBLIC_DIR / "room.html")


@app.get("/room/{room_id}")
async def get_room_alias(room_id: str):
    return FileResponse(PUBLIC_DIR / "room.html")


# Static files mount for CSS, JS, etc. (defined after explicit routes)
app.mount("/", StaticFiles(directory=str(PUBLIC_DIR), html=False), name="public")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 3000))
    uvicorn.run("main:socket_app", host="0.0.0.0", port=port, reload=True)
