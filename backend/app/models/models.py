"""
Production-ready models with UUID primary keys, proper indexes,
cascade deletes, and unique constraints.
"""
from datetime import datetime
import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class MessageStatus(str, enum.Enum):
    inbox = "inbox"
    public = "public"
    favorite = "favorite"


class LinkStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    deleted = "deleted"


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    bio = Column(String(500), nullable=True)
    secret_phrase = Column(String(255), nullable=False)
    secret_answer = Column(String(255), nullable=False)
    language = Column(String(5), nullable=False, default="EN")
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    google_email = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships for cascade deletes
    received_messages = relationship("Message", back_populates="receiver", cascade="all, delete-orphan", passive_deletes=True)
    links = relationship("Link", back_populates="owner", cascade="all, delete-orphan", passive_deletes=True)


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    receiver_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    status = Column(Enum(MessageStatus), nullable=False, default=MessageStatus.inbox, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    receiver = relationship("User", back_populates="received_messages")


class Link(Base):
    __tablename__ = "links"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    public_id = Column(String(36), unique=True, nullable=False, default=generate_uuid, index=True)
    private_id = Column(String(36), unique=True, nullable=False, default=generate_uuid, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    display_name = Column(String(255), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    status = Column(Enum(LinkStatus), nullable=False, default=LinkStatus.active, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="links")
    messages = relationship("LinkMessage", back_populates="link", cascade="all, delete-orphan", passive_deletes=True)


class LinkMessage(Base):
    __tablename__ = "link_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    link_id = Column(String(36), ForeignKey("links.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    status = Column(Enum(MessageStatus), nullable=False, default=MessageStatus.inbox)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    link = relationship("Link", back_populates="messages")


class Follow(Base):
    __tablename__ = "follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="uq_follow_pair"),
    )

    id = Column(String(36), primary_key=True, default=generate_uuid)
    follower_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    following_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
