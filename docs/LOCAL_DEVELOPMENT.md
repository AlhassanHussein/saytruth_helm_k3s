# Local Development - Run Without Kubernetes

## Problem

Running K3s for every code change takes **too long**:
- Rebuild Docker image: 2-3 min
- Import to K3s: 1-2 min
- Pod restart: 1-2 min
- Total: **5-7 minutes** per test ❌

**Big companies use:** Run services locally with hot-reload for **instant feedback**.

---

## Solution: Local Development Stack

```
┌─────────────────────────────────────────────────────┐
│  Your Local Machine                                 │
├─────────────────────────────────────────────────────┤
│  Backend:                                           │
│  ├─ uvicorn (Python dev server)                    │
│  ├─ Auto-reload on code change                     │
│  └─ Port 8000                                      │
│                                                     │
│  Frontend:                                          │
│  ├─ Vite dev server                               │
│  ├─ HMR (hot module replacement)                  │
│  └─ Port 5173                                      │
│                                                     │
│  PostgreSQL:                                        │
│  ├─ Docker container                              │
│  ├─ Port 5432                                      │
│  └─ Persistent volume                             │
│                                                     │
│  Kong (Optional):                                   │
│  ├─ Docker container                              │
│  └─ Port 8000 (routes to backend)                 │
└─────────────────────────────────────────────────────┘

Flow:
Browser (localhost:5173) → Vite (HMR updates)
     ↓ API calls to /api
Vite proxy → backend (localhost:8000)
     ↓ SQL queries
PostgreSQL (localhost:5432)
```

---

## Setup Backend (Uvicorn)

### Step 1: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**What gets installed:**
```
fastapi==0.109.0        # FastAPI framework
uvicorn[standard]==0.27.0  # ASGI server (auto-reload)
sqlalchemy==2.0.23      # ORM
psycopg2-binary==2.9.9  # PostgreSQL driver
python-jose==3.3.0      # JWT tokens
bcrypt==4.1.1           # Password hashing
slowapi==0.1.9          # Rate limiting
pydantic==2.5.0         # Data validation
```

### Step 2: Set Environment Variables

```bash
# Create .env file
cat > backend/.env << 'EOF'
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=saytruth_db
DB_USER=saytruth_user
DB_PASSWORD=DevSecurePass123!@#

# App
DEBUG=true
ENVIRONMENT=development
LOG_LEVEL=INFO
ACCESS_TOKEN_EXPIRE_MINUTES=1440
EOF
```

### Step 3: Start PostgreSQL (Docker)

```bash
# If not running K3s, start PostgreSQL locally
docker run -d \
  --name postgres \
  -e POSTGRES_USER=saytruth_user \
  -e POSTGRES_PASSWORD=DevSecurePass123!@# \
  -e POSTGRES_DB=saytruth_db \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine

# Verify running
docker ps | grep postgres
```

### Step 4: Start Backend with Auto-reload

```bash
cd backend

# Option 1: Direct uvicorn (manual reload)
uvicorn app.main:app --reload --port 8000

# Option 2: Use development script
python app/main.py

# Option 3: With custom settings
uvicorn app.main:app \
  --reload \
  --port 8000 \
  --host 0.0.0.0 \
  --log-level info
```

**What happens:**
```
✓ Starting Uvicorn ASGI server process
✓ Application startup complete
✓ Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
✓ Started file watcher (watchfiles)

# Edit a Python file
# Watch for changes...
# Auto-reloads in 0-2 seconds!
```

### Step 5: Test Backend

```bash
# Terminal 2 - Test API
curl http://localhost:8000/health
# Response: {"status":"ok"}

# Test with auth
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## Setup Frontend (Vite)

### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

**What gets installed:**
```
react@18.2.0             # UI library
react-dom@18.2.0         # React DOM renderer
vite@5.0.0               # Build tool
@vitejs/plugin-react     # React support
eslint                   # Code quality
```

### Step 2: Set Environment Variables

```bash
# Create .env.local file
cat > frontend/.env.local << 'EOF'
# API Base URL (proxy through Vite)
VITE_API_BASE=http://localhost:8000/api

# Dev settings
VITE_DEBUG=true
EOF
```

### Step 3: Update vite.config.js (Proxy Setup)

```javascript
// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',  // Backend URL
        changeOrigin: true,                // Modify headers
        rewrite: (path) => path            // Keep /api
      }
    },
    watch: {
      usePolling: true
    },
    hmr: {
      host: 'localhost',
      port: 5173,
      protocol: 'http'
    }
  }
})
```

**Proxy explains:**
```
Browser: GET http://localhost:5173/api/users
    ↓ (Vite proxy intercepts)
Vite: GET http://localhost:8000/api/users
    ↓ (Backend responds)
Response back to browser
```

### Step 4: Start Frontend Dev Server

```bash
cd frontend

# Start Vite
npm run dev

# Output:
# VITE v5.0.0 ready in 500 ms
# ➜  Local:   http://localhost:5173/
# ➜  use --host to expose

# Open http://localhost:5173
```

**What happens:**
```
✓ HMR server listening on http://localhost:5173
✓ Edit a React component
✓ Changes appear in browser instantly (no page reload)!
```

---

## Complete Setup Script

```bash
#!/bin/bash
# setup-local-dev.sh

echo "Setting up local development environment..."

# 1. Start PostgreSQL
echo "✓ Starting PostgreSQL..."
docker run -d \
  --name postgres \
  -e POSTGRES_USER=saytruth_user \
  -e POSTGRES_PASSWORD=DevSecurePass123!@# \
  -e POSTGRES_DB=saytruth_db \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine

sleep 5  # Wait for DB

# 2. Start Backend
echo "✓ Starting Backend..."
cd backend
pip install -r requirements.txt
cat > .env << 'EOF'
DB_HOST=localhost
DB_PORT=5432
DB_NAME=saytruth_db
DB_USER=saytruth_user
DB_PASSWORD=DevSecurePass123!@#
DEBUG=true
ENVIRONMENT=development
EOF

uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

sleep 3  # Wait for backend

# 3. Start Frontend
echo "✓ Starting Frontend..."
cd ../frontend
npm install
npm run dev &
FRONTEND_PID=$!

# 4. Print URLs
echo ""
echo "═══════════════════════════════════════════"
echo "Local Development Started!"
echo "═══════════════════════════════════════════"
echo ""
echo "Backend:     http://localhost:8000"
echo "Frontend:    http://localhost:5173"
echo "PostgreSQL:  localhost:5432"
echo ""
echo "API Docs:    http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"
echo "═══════════════════════════════════════════"
echo ""

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker stop postgres 2>/dev/null; exit" SIGINT

# Keep script running
wait
```

**Run it:**
```bash
chmod +x setup-local-dev.sh
./setup-local-dev.sh
```

---

## Docker Compose for Local Dev

```yaml
# docker-compose.yml (Local)
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: saytruth_user
      POSTGRES_PASSWORD: DevSecurePass123!@#
      POSTGRES_DB: saytruth_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U saytruth_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Optional: Kong in local dev
  kong:
    image: kong:alpine
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /etc/kong/kong.yaml
    volumes:
      - ./kong-config.yaml:/etc/kong/kong.yaml
    ports:
      - "8000:8000"
      - "8001:8001"
    depends_on:
      - backend
      - frontend

volumes:
  postgres_data:
```

**Run:**
```bash
docker-compose up -d
# Only PostgreSQL starts (backend/frontend run locally)
```

---

## Development Workflow

### Timeline: Code Change → Test

#### Without Local Dev (K3s)
```
0:00 - Edit Python file
0:03 - Rebuild Docker image (docker build)
0:05 - Import to K3s (docker save | ctr import)
0:07 - Pod restarts (image pull, container start)
0:10 - Finally test the change ❌ SLOW

Total: 10 minutes!
```

#### With Local Dev (Uvicorn + Vite)
```
0:00 - Edit Python file
0:01 - Backend auto-reloads
0:01 - Test immediately ✅ FAST

Total: 1 second!
```

### Recommended Workflow

```bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: PostgreSQL
docker run -d \
  -e POSTGRES_USER=saytruth_user \
  -e POSTGRES_PASSWORD=DevSecurePass123!@# \
  -e POSTGRES_DB=saytruth_db \
  -p 5432:5432 \
  postgres:15-alpine

# Terminal 4: Make changes, test
vim backend/app/main.py
# Watch: Backend auto-reloads instantly

# When ready to test in K3s:
docker build -t saytruth-backend:latest backend/
# Deploy to K3s
```

---

## Testing Locally

### 1. **Test Backend Only**
```bash
# Create test file
cat > test_api.py << 'EOF'
import requests

BASE_URL = "http://localhost:8000/api"

def test_health():
    r = requests.get("http://localhost:8000/health")
    assert r.status_code == 200

def test_signup():
    r = requests.post(f"{BASE_URL}/auth/signup", json={
        "email": "test@example.com",
        "password": "password123"
    })
    assert r.status_code in [200, 201]
    assert "access_token" in r.json()

if __name__ == "__main__":
    test_health()
    test_signup()
    print("✓ All tests passed!")
EOF

python test_api.py
```

### 2. **Test Frontend Only**
```bash
# Open browser to http://localhost:5173
# Check Console for errors
# Test UI interactions
# Make code changes, watch HMR instant reload
```

### 3. **Integration Test (Full Flow)**
```bash
# 1. Start all services locally
./setup-local-dev.sh

# 2. Open http://localhost:5173

# 3. Manual test flow:
# - Click "Sign Up"
# - Fill form, submit
# - Should login
# - Create message
# - See message in feed
# - Follow user
# - Search messages

# 4. Check backend logs (Terminal 1)
# 5. Check frontend console (Browser DevTools)
# 6. Query database if needed
```

---

## Common Issues & Solutions

### Issue: "Connection refused" to PostgreSQL
```bash
# Check if container running
docker ps | grep postgres

# If not, start it
docker run -d --name postgres \
  -e POSTGRES_USER=saytruth_user \
  -e POSTGRES_PASSWORD=DevSecurePass123!@# \
  -e POSTGRES_DB=saytruth_db \
  -p 5432:5432 \
  postgres:15-alpine
```

### Issue: Backend port 8000 already in use
```bash
# Find process using port 8000
lsof -i :8000

# Kill it
kill -9 <PID>

# Or use different port
uvicorn app.main:app --port 8001
```

### Issue: Frontend won't connect to backend
```bash
# Check proxy config in vite.config.js
server: {
  proxy: {
    '/api': 'http://localhost:8000'  # Must match backend URL
  }
}

# Restart Vite
npm run dev
```

### Issue: Vite HMR not working
```javascript
// Ensure HMR config in vite.config.js
hmr: {
  host: 'localhost',
  port: 5173,
  protocol: 'http'
}

// Restart dev server
```

---

## Tips for Productivity

### 1. **Use VS Code Extensions**
- REST Client: Test APIs in editor
- Thunder Client: API testing
- PostgreSQL Explorer: Browse database

### 2. **Debug Python**
```python
# Use pdb (Python debugger)
import pdb; pdb.set_trace()  # Breakpoint
# Type: n (next), s (step), c (continue), p (print)
```

### 3. **Debug Frontend**
```javascript
// Use browser DevTools
console.log("Debug:", variable);  // Log to console
debugger;                        // Breakpoint
// Type: F12 to open DevTools
```

### 4. **Quick API Testing**
```bash
# Use httpie (better than curl)
pip install httpie

http POST localhost:8000/api/auth/signup \
  email=test@example.com \
  password=password123
```

---

## When to Use K3s

Local dev is for **rapid iteration**. Use K3s to test:
- ✅ Docker image builds
- ✅ Kubernetes deployments
- ✅ Multi-pod communication
- ✅ Persistence volumes
- ✅ TLS/HTTPS
- ✅ Production-like setup

---

## Next Steps

1. Set up local development environment
2. Get code changes working quickly
3. Practice Docker, K3s changes infrequently
4. Use this workflow for all future development
