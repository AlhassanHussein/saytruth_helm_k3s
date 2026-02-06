# Backend Architecture - SayTruth API

## Overview
The SayTruth backend is a **FastAPI** application that serves as the API layer for the entire platform. It handles user authentication, message management, link sharing, and user profiles.

**Technology Stack:**
- **Framework**: FastAPI (Python web framework - modern, fast, easy to learn)
- **Database ORM**: SQLAlchemy (maps Python objects to database tables)
- **Database**: PostgreSQL (production-grade relational database)
- **Server**: Uvicorn (ASGI server - asynchronous)
- **Authentication**: JWT tokens (secure stateless authentication)
- **Rate Limiting**: SlowAPI (prevents API abuse)

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                 # Entry point, FastAPI app setup
│   ├── core/
│   │   ├── config.py           # Configuration management (DB connection, settings)
│   │   ├── security.py         # Authentication logic (JWT, hashing)
│   │   └── dependencies.py     # Dependency injection (reusable functions)
│   ├── db/
│   │   ├── database.py         # Database engine setup, session management
│   │   └── init_db.py          # Initialize database tables
│   ├── models/
│   │   └── models.py           # SQLAlchemy ORM models (User, Message, Link, etc.)
│   ├── schemas/
│   │   └── schemas.py          # Pydantic schemas (request/response validation)
│   └── api/
│       └── routes/
│           ├── auth.py         # Login, signup, token refresh
│           ├── users.py        # User profile, follow/unfollow
│           ├── messages.py     # Create, read messages
│           └── links.py        # Create, manage shared links
├── Dockerfile                   # Container image definition
├── requirements.txt             # Python dependencies
└── start.sh                     # Script to start the server
```

---

## Key Components Explained

### 1. **config.py** - Configuration Management
```python
# Reads environment variables and sets up database URL
DATABASE_URL = "postgresql://user:password@host:port/dbname"
DB_HOST = "postgres-service.saytruth-dev.svc.cluster.local"  # K8s DNS name
DB_USER = "saytruth_user"
DB_PASSWORD = "DevSecurePass123!@#"  # From Kubernetes Secret
```

**Why this matters:**
- Different configurations for dev/prod (localhost vs production)
- Secrets stored in Kubernetes Secrets (not in code)
- Connection string built dynamically for flexibility

### 2. **database.py** - Database Connection
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine(DATABASE_URL)  # Creates connection pool
SessionLocal = sessionmaker(bind=engine)  # Session factory
```

**What it does:**
- `engine`: Manages database connection pool (reuses connections)
- `SessionLocal()`: Creates a new database session for each request
- Sessions are automatically closed after request completes

**How queries work:**
```python
db = SessionLocal()  # Get a session
user = db.query(User).filter(User.email == "user@example.com").first()
db.close()  # Release back to pool
```

### 3. **models.py** - Database Schema (ORM)
```python
from sqlalchemy import Column, String, Integer
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True)
    username = Column(String)
    hashed_password = Column(String)
```

**SQLAlchemy creates SQL automatically:**
- Python class → Database table
- Class attributes → Table columns
- `declarative_base()` → Tracks all models
- `init_db()` → Runs `CREATE TABLE` statements

### 4. **security.py** - Authentication
```python
from jose import jwt
import bcrypt

# Hash password with bcrypt (salted, one-way)
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())

# Create JWT token
token = jwt.encode({"sub": user_id}, SECRET_KEY, algorithm="HS256")

# Verify token
payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
user_id = payload["sub"]
```

**Security concepts:**
- **Hashing**: One-way function (cannot reverse) for passwords
- **JWT**: Stateless tokens (no server-side session needed)
- **Salt**: Random data in hash prevents rainbow tables

### 5. **schemas.py** - Request/Response Validation
```python
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    # Note: password NOT included in response
```

**Why schemas?**
- Validate input (email format, required fields)
- Convert between Python types and JSON
- Generate OpenAPI documentation automatically
- Prevent invalid data from reaching database

### 6. **Routes** - API Endpoints

#### Auth Route (`/api/auth`)
```python
@router.post("/signup")
def signup(user: UserCreate, db: Session):
    # 1. Validate email not exists
    # 2. Hash password
    # 3. Create user in DB
    # 4. Return JWT token
    return {"access_token": token}
```

#### Users Route (`/api/users`)
```python
@router.get("/{user_id}")
def get_user(user_id: int, db: Session):
    # Fetch user profile
    user = db.query(User).get(user_id)
    return user
```

#### Messages Route (`/api/messages`)
```python
@router.post("/")
def create_message(msg: MessageCreate, current_user: User, db: Session):
    # Only authenticated users can create
    message = Message(content=msg.content, user_id=current_user.id)
    db.add(message)
    db.commit()
    return message
```

---

## Database Flow (with PostgreSQL)

```
Client Request
    ↓
FastAPI Route Handler
    ↓
Get Database Session (from pool)
    ↓
SQLAlchemy ORM Query
    ↓
PostgreSQL Server
    ↓
Return data → Convert to Pydantic schema
    ↓
Return JSON to client
    ↓
Close database session (return to pool)
```

---

## Environment Variables (From K8s ConfigMap & Secret)

| Variable | Source | Value |
|----------|--------|-------|
| DB_HOST | ConfigMap | postgres-service.saytruth-dev.svc.cluster.local |
| DB_PORT | ConfigMap | 5432 |
| DB_NAME | ConfigMap | saytruth_db |
| DB_USER | Secret | saytruth_user |
| DB_PASSWORD | Secret | DevSecurePass123!@# |
| JWT_SECRET | Secret | (secure random string) |

**Why separated?**
- ConfigMap: Non-sensitive config (everyone can see)
- Secret: Passwords/tokens (encrypted in etcd)

---

## Startup Sequence

1. **Build Docker image** → Installs requirements.txt, copies app code
2. **Run container** → Executes `uvicorn app.main:app`
3. **Initialize DB** → `init_db()` creates tables if they don't exist
4. **Start server** → Listen on port 8000
5. **Ready for requests** → `/health` endpoint returns 200 OK

---

## API Documentation

FastAPI automatically generates interactive docs:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

These are auto-generated from your Python type hints!

---

## Rate Limiting

```python
from slowapi import Limiter

# Limit to 100 requests per minute
@router.post("/auth/login", rate_limit="100/minute")
def login():
    pass
```

**Why?** Prevents brute force attacks and abuse

---

## CORS (Cross-Origin Resource Sharing)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In prod: specific domains
    allow_credentials=True,
    allow_methods=["*"],
)
```

**Why?** Allows frontend (different port/domain) to call backend API

---

## Common Errors & Debugging

### Error: "could not translate host name"
- **Cause**: Database host not reachable
- **Solution**: Check ConfigMap DB_HOST value, verify PostgreSQL pod running

### Error: "relation 'users' does not exist"
- **Cause**: Database tables not created
- **Solution**: `init_db()` didn't run, check backend logs

### Error: "permission denied for schema public"
- **Cause**: Wrong database user/password
- **Solution**: Verify Secret values match PostgreSQL credentials

---

## Next Steps for Learning

1. Read about **SQLAlchemy ORM** to understand table relationships
2. Learn **async/await** in Python (FastAPI is async-first)
3. Study **JWT tokens** for stateless authentication
4. Understand **database indexing** for performance
