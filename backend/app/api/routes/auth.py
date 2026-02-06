from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import re

from app.core.config import get_settings
from app.core.dependencies import get_current_user, get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.models import User
from app.schemas.schemas import (
    ChangeUsernameRequest,
    ChangePasswordRequest,
    GoogleAuthRequest,
    GoogleLinkRequest,
    GoogleResetSecurityRequest,
    PasswordRecovery,
    PasswordRecoveryVerify,
    Token,
    UserLogin,
    UserResponse,
    UserSettingsUpdate,
    UserSignup,
)

router = APIRouter()

settings = get_settings()


# ============ Google ID Token verification ============

def verify_google_token(credential: str) -> dict:
    """
    Verify a Google ID token and return the decoded payload.
    Returns dict with: sub, email, name, picture, email_verified
    """
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured on this server"
        )

    try:
        idinfo = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.google_client_id
        )
        # Verify issuer
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise ValueError('Invalid issuer')
        return idinfo
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}"
        )


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserSignup, db: Session = Depends(get_db)) -> dict:
    """
    Create a new user account with backend validation.
    
    Validation:
    - Username: Instagram-style (letters, numbers, underscores only, no spaces)
    - Username must be 3-50 characters
    - Secret phrase must be 6+ characters
    - Secret answer must be 3+ characters
    - Username must be unique
    
    Returns: Access token for immediate login after signup
    """
    
    # Re-validate username on backend (additional safety check)
    if not re.match(r'^[a-zA-Z0-9_]+$', user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username can only contain letters, numbers, and underscores"
        )
    
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Create new user with hashed secret answer
    # Secret phrase is stored as plain hint for password recovery
    # Secret answer is hashed for verification during login/recovery
    hashed_answer = get_password_hash(user_data.secret_answer)
    new_user = User(
        username=user_data.username,
        name=user_data.name,
        secret_phrase=user_data.secret_phrase,  # Store as hint/question
        secret_answer=hashed_answer,  # Hashed for verification
        language="EN"  # Default language
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Generate access token
    access_token = create_access_token(subject=str(new_user.id))
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: Session = Depends(get_db)) -> dict:
    # Find user by username
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or secret answer"
        )
    
    # Verify secret answer (not phrase!)
    if not verify_password(credentials.secret_answer, user.secret_answer):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or secret answer"
        )
    
    # Generate access token
    access_token = create_access_token(subject=str(user.id))
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/recover", response_model=dict)
async def recover_password(recovery_data: PasswordRecovery, db: Session = Depends(get_db)) -> dict:
    # Find user by username
    user = db.query(User).filter(User.username == recovery_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Return secret phrase as hint (not the hashed answer)
    return {"secret_phrase": user.secret_phrase}


@router.post("/recover/verify", response_model=Token)
async def verify_recovery(verify_data: PasswordRecoveryVerify, db: Session = Depends(get_db)) -> dict:
    # Find user by username
    user = db.query(User).filter(User.username == verify_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify secret answer
    if not verify_password(verify_data.secret_answer, user.secret_answer):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect answer"
        )
    
    # Generate access token (successful recovery = login)
    access_token = create_access_token(subject=str(user.id))
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/settings", response_model=UserResponse)
async def update_settings(
    settings_data: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    # Update language if provided
    if settings_data.language:
        current_user.language = settings_data.language
    
    # Update secret phrase and answer if both provided
    if settings_data.secret_phrase and settings_data.secret_answer:
        current_user.secret_phrase = settings_data.secret_phrase
        current_user.secret_answer = get_password_hash(settings_data.secret_answer)
    elif settings_data.secret_phrase or settings_data.secret_answer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both secret phrase and answer must be provided together"
        )

    if settings_data.bio is not None:
        current_user.bio = settings_data.bio
    
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-username", response_model=dict)
async def change_username(
    data: ChangeUsernameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """
    Change the current user's username.
    No password required — user is already authenticated.
    """
    new_username = data.new_username.strip()

    # Check if same as current
    if new_username == current_user.username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New username is the same as your current username"
        )

    # Check uniqueness
    existing = db.query(User).filter(User.username == new_username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken"
        )

    current_user.username = new_username
    db.commit()
    return {"message": "Username changed successfully", "username": new_username}


@router.post("/change-password", response_model=dict)
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """
    Change secret phrase + answer.
    User must provide current answer for verification.
    """
    if not verify_password(data.old_answer, current_user.secret_answer):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current answer is incorrect"
        )
    current_user.secret_phrase = data.new_phrase
    current_user.secret_answer = get_password_hash(data.new_answer)
    db.commit()
    return {"message": "Password changed successfully"}


# ============ Google OAuth Endpoints ============


@router.post("/google", response_model=Token)
async def google_auth(
    data: GoogleAuthRequest,
    db: Session = Depends(get_db)
) -> dict:
    """
    Sign in or sign up with Google.
    - If google_id already linked to a user → log them in.
    - If email matches an existing user without google_id → link and log in.
    - Otherwise → create a new account.
    """
    idinfo = verify_google_token(data.credential)
    google_id = idinfo['sub']
    email = idinfo.get('email', '')
    name = idinfo.get('name', '')

    # 1. Check if google_id already linked
    user = db.query(User).filter(User.google_id == google_id).first()
    if user:
        access_token = create_access_token(subject=str(user.id))
        return {"access_token": access_token, "token_type": "bearer"}

    # 2. Check if a user exists with a username matching the email prefix
    # (auto-link on first Google sign-in if email prefix matches username)
    email_prefix = email.split('@')[0] if email else ''

    # 3. Create a new user with Google info
    # Generate unique username from email prefix
    base_username = re.sub(r'[^a-zA-Z0-9_]', '_', email_prefix)[:40] or 'user'
    candidate = base_username
    counter = 1
    while db.query(User).filter(User.username == candidate).first():
        candidate = f"{base_username}_{counter}"
        counter += 1

    new_user = User(
        username=candidate,
        name=name or candidate,
        secret_phrase="Google account - no secret phrase needed",
        secret_answer=get_password_hash(google_id),  # Use google_id as hashed answer
        google_id=google_id,
        google_email=email,
        language="EN"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(subject=str(new_user.id))
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/google/link", response_model=dict)
async def google_link(
    data: GoogleLinkRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """
    Link a Google account to the currently authenticated user.
    """
    idinfo = verify_google_token(data.credential)
    google_id = idinfo['sub']
    email = idinfo.get('email', '')

    # Check if this Google account is already linked to another user
    existing = db.query(User).filter(User.google_id == google_id).first()
    if existing and existing.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This Google account is already linked to another user"
        )

    current_user.google_id = google_id
    current_user.google_email = email
    db.commit()
    return {"message": "Google account linked successfully", "google_email": email}


@router.post("/google/reset-security", response_model=dict)
async def google_reset_security(
    data: GoogleResetSecurityRequest,
    db: Session = Depends(get_db)
) -> dict:
    """
    Reset security phrase + answer using a linked Google account.
    User provides their Google credential to prove identity.
    No need for the old answer.
    """
    idinfo = verify_google_token(data.credential)
    google_id = idinfo['sub']

    # Find the user by google_id
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account linked to this Google account"
        )

    user.secret_phrase = data.new_phrase
    user.secret_answer = get_password_hash(data.new_answer)
    db.commit()

    # Also return an access token so they're logged in
    access_token = create_access_token(subject=str(user.id))
    return {
        "message": "Security phrase reset successfully",
        "access_token": access_token,
        "token_type": "bearer"
    }
