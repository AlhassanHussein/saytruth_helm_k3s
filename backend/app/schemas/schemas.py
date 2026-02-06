from datetime import datetime
from typing import Generic, List, Optional, TypeVar
import re

from pydantic import BaseModel, Field, field_validator


# ============ Generic Pagination ============

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated response wrapper."""
    items: List[T]
    total: int
    limit: int
    offset: int
    has_more: bool


# ============ Auth Schemas ============

class UserSignup(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    name: Optional[str] = Field(None, max_length=100)
    secret_phrase: str = Field(..., min_length=6)
    secret_answer: str = Field(..., min_length=3)

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        """Validate username: Instagram-style (letters, numbers, underscores only, no spaces)"""
        if not v or not v.strip():
            raise ValueError('Username cannot be empty')
        if ' ' in v:
            raise ValueError('Username cannot contain spaces')
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username can only contain letters, numbers, and underscores')
        return v.strip()


class UserLogin(BaseModel):
    username: str
    secret_answer: str


class PasswordRecovery(BaseModel):
    username: str


class PasswordRecoveryVerify(BaseModel):
    username: str
    secret_answer: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    username: str
    name: Optional[str]
    bio: Optional[str] = None
    language: str
    secret_phrase: Optional[str] = None
    google_email: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserSettingsUpdate(BaseModel):
    language: Optional[str] = Field(None, pattern="^(EN|AR|ES)$")
    secret_phrase: Optional[str] = Field(None, min_length=6)
    secret_answer: Optional[str] = Field(None, min_length=3)
    bio: Optional[str] = Field(None, max_length=500)


class ChangeUsernameRequest(BaseModel):
    new_username: str = Field(..., min_length=3, max_length=50)

    @field_validator('new_username')
    @classmethod
    def validate_username(cls, v):
        if not v or not v.strip():
            raise ValueError('Username cannot be empty')
        if ' ' in v:
            raise ValueError('Username cannot contain spaces')
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username can only contain letters, numbers, and underscores')
        return v.strip()


class ChangePasswordRequest(BaseModel):
    old_answer: str = Field(..., min_length=1)
    new_phrase: str = Field(..., min_length=6)
    new_answer: str = Field(..., min_length=3)


class GoogleAuthRequest(BaseModel):
    """Google ID token from frontend Google Sign-In."""
    credential: str = Field(..., description="Google ID token (JWT)")


class GoogleLinkRequest(BaseModel):
    """Link Google account to existing user."""
    credential: str = Field(..., description="Google ID token (JWT)")


class GoogleResetSecurityRequest(BaseModel):
    """Reset security phrase via linked Google account."""
    credential: str = Field(..., description="Google ID token (JWT)")
    new_phrase: str = Field(..., min_length=6)
    new_answer: str = Field(..., min_length=3)


# ============ Message Schemas ============

class MessageCreate(BaseModel):
    receiver_username: str
    content: str = Field(..., min_length=1, max_length=5000)


class MessageResponse(BaseModel):
    id: str
    receiver_id: str
    content: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class MessageStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(inbox|public|deleted)$")


# ============ Link Schemas ============

class LinkCreate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    expiration_option: str = Field(default="24h", pattern="^(6h|12h|24h|7d|30d|permanent)$")


class LinkResponse(BaseModel):
    id: str
    public_id: str
    private_id: str
    display_name: Optional[str]
    expires_at: Optional[datetime]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class LinkPublicInfo(BaseModel):
    public_id: str
    display_name: Optional[str]
    expires_at: Optional[datetime]
    status: str

    class Config:
        from_attributes = True


class LinkMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)


class LinkMessageResponse(BaseModel):
    id: str
    content: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class LinkMessagesWithMeta(BaseModel):
    messages: List[LinkMessageResponse]
    total: int
    has_more: bool
    display_name: Optional[str]
    expires_at: Optional[datetime]
    status: str


# ============ User/Follow Schemas ============

class UserSearch(BaseModel):
    username: str = Field(..., min_length=1)


class UserPublicProfile(BaseModel):
    id: str
    username: str
    name: Optional[str]
    bio: Optional[str] = None
    public_messages: List['MessageResponse']
    total_public_messages: int = 0
    has_more_messages: bool = False
    is_following: bool = False

    class Config:
        from_attributes = True


class FollowResponse(BaseModel):
    id: str
    follower_id: str
    following_id: str
    created_at: datetime

    class Config:
        from_attributes = True
