import os
from pathlib import Path
import random
import string

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"

app = FastAPI(title="meet.io")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def generate_room_code() -> str:
    chars = string.ascii_lowercase
    seg = lambda n: "".join(random.choices(chars, k=n))
    return f"{seg(3)}-{seg(4)}-{seg(3)}"


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
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
