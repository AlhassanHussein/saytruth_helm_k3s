import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from datetime import datetime, timezone

from app.api.routes import auth, links, messages, users
from app.core.config import get_settings
from app.db.database import Base, engine, SessionLocal
from app.db.init_db import init_db
from app.models.models import Link, LinkMessage, LinkStatus

logger = logging.getLogger(__name__)

settings = get_settings()
app = FastAPI(title="SayTruth API", version="2.0.0")

# Initialize database tables on startup
init_db()

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware to allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(messages.router, prefix="/api/messages", tags=["messages"])
app.include_router(links.router, prefix="/api/links", tags=["links"])
app.include_router(users.router, prefix="/api/users", tags=["users"])


# ─── Background cleanup task ───────────────────────────────────────
CLEANUP_INTERVAL_SECONDS = 60 * 30  # Every 30 minutes


async def _cleanup_expired_links_task():
    """Background task that hard-deletes expired links and their messages."""
    while True:
        try:
            await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
            db = SessionLocal()
            try:
                now = datetime.now(timezone.utc)
                expired = db.query(Link).filter(
                    Link.expires_at.isnot(None),
                    Link.expires_at <= now,
                ).all()
                count = 0
                for link in expired:
                    db.delete(link)  # cascade removes LinkMessages
                    count += 1
                if count:
                    db.commit()
                    logger.info(f"Cleanup: removed {count} expired links")
            finally:
                db.close()
        except Exception:
            logger.exception("Error in cleanup task")


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(_cleanup_expired_links_task())


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok"}
