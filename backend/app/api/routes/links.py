from datetime import datetime, timedelta, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_current_user_optional, get_db
from app.core.security import decrypt_message, encrypt_message
from app.models.models import Link, LinkMessage, LinkStatus, MessageStatus, User
from app.schemas.schemas import (
    LinkCreate,
    LinkResponse,
    LinkPublicInfo,
    LinkMessageCreate,
    LinkMessageResponse,
    LinkMessagesWithMeta,
)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# Default pagination
DEFAULT_LIMIT = 20
MAX_LIMIT = 100

# Mapping of expiration options to hours
EXPIRATION_MAP = {
    "6h": 6,
    "12h": 12,
    "24h": 24,
    "7d": 7 * 24,
    "30d": 30 * 24,
    "permanent": None,
}


def normalize_expires_at(expires_at: Optional[datetime]) -> Optional[datetime]:
    if not expires_at:
        return None
    if expires_at.tzinfo is None:
        return expires_at.replace(tzinfo=timezone.utc)
    return expires_at.astimezone(timezone.utc)


def _check_link_expired(link: Link, db: Session) -> bool:
    """Return True if the link is expired. Marks it deleted in DB as side-effect."""
    expires_at = normalize_expires_at(link.expires_at)
    if expires_at and datetime.now(timezone.utc) > expires_at:
        link.status = LinkStatus.deleted
        db.commit()
        return True
    return link.status == LinkStatus.deleted


@router.post("/create", response_model=LinkResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/hour")
async def create_link(
    request: Request,
    link_data: LinkCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
) -> Link:
    """Create a temporary anonymous messaging link."""
    expires_at = None
    if link_data.expiration_option != "permanent":
        hours = EXPIRATION_MAP.get(link_data.expiration_option, 24)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=hours)

    new_link = Link(
        user_id=current_user.id if current_user else None,
        display_name=link_data.display_name,
        expires_at=expires_at,
        status=LinkStatus.active
    )
    db.add(new_link)
    db.commit()
    db.refresh(new_link)
    return new_link


@router.get("/{public_id}/info", response_model=LinkPublicInfo)
async def get_link_info(
    public_id: str,
    db: Session = Depends(get_db)
) -> Link:
    """Get public info about a link. No auth required."""
    link = db.query(Link).filter(Link.public_id == public_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    if _check_link_expired(link, db):
        raise HTTPException(status_code=404, detail="Link expired")

    return link


@router.post("/{public_id}/send", response_model=dict, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def send_message_to_link(
    request: Request,
    public_id: str,
    message_data: LinkMessageCreate,
    db: Session = Depends(get_db)
) -> dict:
    """Send an anonymous message to a public link. No auth required."""
    link = db.query(Link).filter(Link.public_id == public_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    if _check_link_expired(link, db):
        raise HTTPException(status_code=404, detail="Link expired")

    encrypted_content = encrypt_message(message_data.content)
    new_message = LinkMessage(
        link_id=link.id,
        content=encrypted_content,
        status=MessageStatus.inbox
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    return {"message_id": new_message.id, "status": "created"}


@router.get("/{private_id}/messages", response_model=LinkMessagesWithMeta)
async def get_link_messages(
    private_id: str,
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
) -> dict:
    """Get paginated messages sent to a private link."""
    link = db.query(Link).filter(Link.private_id == private_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    if _check_link_expired(link, db):
        raise HTTPException(status_code=404, detail="Link expired")

    if link.user_id and current_user and link.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    q = db.query(LinkMessage).filter(LinkMessage.link_id == link.id).order_by(LinkMessage.created_at.desc())
    total = q.count()
    messages = q.offset(offset).limit(limit).all()

    for message in messages:
        message.content = decrypt_message(message.content)

    return {
        "messages": messages,
        "total": total,
        "has_more": (offset + limit) < total,
        "display_name": link.display_name,
        "expires_at": link.expires_at,
        "status": link.status,
    }


@router.patch("/{private_id}/messages/{message_id}/make-public", response_model=LinkMessageResponse)
async def make_link_message_public(
    private_id: str,
    message_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
) -> LinkMessage:
    link = db.query(Link).filter(Link.private_id == private_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    if link.user_id and current_user and link.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    message = db.query(LinkMessage).filter(
        LinkMessage.id == message_id,
        LinkMessage.link_id == link.id
    ).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    message.status = MessageStatus.public
    db.commit()
    db.refresh(message)
    message.content = decrypt_message(message.content)
    return message


@router.patch("/{private_id}/messages/{message_id}/make-private", response_model=LinkMessageResponse)
async def make_link_message_private(
    private_id: str,
    message_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
) -> LinkMessage:
    link = db.query(Link).filter(Link.private_id == private_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    if link.user_id and current_user and link.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    message = db.query(LinkMessage).filter(
        LinkMessage.id == message_id,
        LinkMessage.link_id == link.id
    ).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    message.status = MessageStatus.inbox
    db.commit()
    db.refresh(message)
    message.content = decrypt_message(message.content)
    return message


@router.delete("/{private_id}/messages/{message_id}", status_code=status.HTTP_200_OK)
async def delete_link_message(
    private_id: str,
    message_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
) -> dict:
    link = db.query(Link).filter(Link.private_id == private_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    if link.user_id and current_user and link.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    message = db.query(LinkMessage).filter(
        LinkMessage.id == message_id,
        LinkMessage.link_id == link.id
    ).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    db.delete(message)
    db.commit()
    return {"message": "Message deleted"}


@router.get("/my-links", response_model=List[LinkResponse])
async def get_my_links(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Link]:
    """Get all active links created by the authenticated user."""
    # Mark any expired links
    now = datetime.now(timezone.utc)
    db.query(Link).filter(
        Link.user_id == current_user.id,
        Link.expires_at.isnot(None),
        Link.expires_at <= now,
        Link.status == LinkStatus.active
    ).update({"status": LinkStatus.expired}, synchronize_session="fetch")
    db.commit()

    links = db.query(Link).filter(
        Link.user_id == current_user.id,
        Link.status == LinkStatus.active
    ).order_by(Link.created_at.desc()).all()
    return links


@router.delete("/{link_id}/delete", status_code=status.HTTP_200_OK)
async def delete_link(
    link_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """Delete a link. Cascade will remove its messages automatically."""
    link = db.query(Link).filter(
        Link.id == link_id,
        Link.user_id == current_user.id
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Link not found or unauthorized")

    db.delete(link)
    db.commit()
    return {"message": "Link and all messages deleted successfully"}
