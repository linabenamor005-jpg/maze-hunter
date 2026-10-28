from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import scan, bugs, sessions
from app.routes import ai_routes   # <-- IMPORT AJOUTÉ

app = FastAPI(title="MAZE HUNTER API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan.router, tags=["Scan"])
app.include_router(bugs.router, tags=["Bugs"])
app.include_router(sessions.router, tags=["Sessions"])
app.include_router(ai_routes.router, tags=["IA"])   # <-- ROUTE AJOUTÉE

@app.get("/")
async def root():
    return {"message": "MAZE HUNTER API en ligne 🦍"}