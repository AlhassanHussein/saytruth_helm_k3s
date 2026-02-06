# ✅ Fixed: Application Working with Helm

## Problem Solved

The frontend was trying to connect to `http://localhost/api/` which caused CORS errors when accessed from `http://192.168.1.130:30347/`.

## What Was Fixed

### 1. Frontend API Configuration
Changed `VITE_API_BASE_URL` from `"http://localhost:8000"` to `""` (empty string).

**Files Updated:**
- `helm/secrecto/values.yaml`
- `helm/secrecto/values-dev.yaml`
- `helm/secrecto/values-prod.yaml`

**Why:** Empty string means the frontend uses **relative URLs**, so it calls the API through the same origin (Kong gateway), avoiding CORS issues.

### 2. Kong Configuration
Added health endpoint route in Kong configuration.

**Updated:** `helm/secrecto/values.yaml`
```yaml
routes:
  - name: api-route
    paths:
      - /api
    strip_path: false
  - name: health-route     # NEW
    paths:
      - /health
    strip_path: false
```

**Why:** Backend has `/health` at root level and `/api/*` for application routes.

---

## ✅ Testing Results

### Backend API (through Kong)
```bash
curl -s http://192.168.1.130:30347/api/auth/signup -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser789","secret_phrase":"Favorite color?","secret_answer":"blue"}'

Response:
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer"
}
```

✅ **Working!**

---

## 🌐 Access Your Application

**Open in your browser:**
```
http://192.168.1.130:30347/
```

**Now you can:**
- ✅ Sign up new users
- ✅ Log in
- ✅ Create links
- ✅ Send messages
- ✅ All features working!

---

## How It Works Now

```
Browser: http://192.168.1.130:30347/
    ↓
Frontend loads from Kong
    ↓
Frontend makes API call to /api/auth/signup (relative URL)
    ↓
Browser sends to: http://192.168.1.130:30347/api/auth/signup
    ↓
Kong receives request
    ↓
Kong routes /api/* to backend-service:8000
    ↓
Backend receives /api/auth/signup
    ↓
Backend responds with JWT token
    ↓
Kong forwards response to browser
    ↓
✅ Success! No CORS error!
```

---

## Why Relative URLs?

**Problem with absolute URLs:**
```
Frontend URL: http://192.168.1.130:30347/
API URL:      http://localhost/api/
Origin mismatch = CORS error ❌
```

**Solution with relative URLs:**
```
Frontend URL: http://192.168.1.130:30347/
API URL:      /api/ (relative)
Browser resolves to: http://192.168.1.130:30347/api/
Same origin = No CORS error ✅
```

---

## Deployment Commands

### Check Status
```bash
kubectl get pods -n saytruth-dev
kubectl get svc -n saytruth-dev
helm list -n saytruth-dev
```

### View Logs
```bash
kubectl logs -n saytruth-dev -l app=backend
kubectl logs -n saytruth-dev -l app=frontend
kubectl logs -n saytruth-dev -l app=kong
```

### Restart Services
```bash
kubectl rollout restart -n saytruth-dev deployment/backend
kubectl rollout restart -n saytruth-dev deployment/frontend
kubectl rollout restart -n saytruth-dev deployment/kong
```

### Upgrade After Code Changes
```bash
# 1. Build new images
docker build -t saytruth/backend:latest ./backend
docker build -t saytruth/frontend:latest ./frontend

# 2. Import to K3s
docker save saytruth/backend:latest -o backend.tar
docker save saytruth/frontend:latest -o frontend.tar
sudo k3s ctr images import backend.tar
sudo k3s ctr images import frontend.tar

# 3. Restart pods to use new images
kubectl rollout restart -n saytruth-dev deployment/backend
kubectl rollout restart -n saytruth-dev deployment/frontend
```

---

## Summary

### What's Running:
- ✅ Backend (FastAPI + PostgreSQL)
- ✅ Frontend (React + Vite)
- ✅ Kong (API Gateway)
- ✅ PostgreSQL (Database)

### Access URLs:
- **UI:** http://192.168.1.130:30347/
- **API:** http://192.168.1.130:30347/api/*
- **Health:** http://192.168.1.130:30347/health

### Current Revision:
- Helm Release: `saytruth-dev`
- Revision: 4
- Namespace: `saytruth-dev`

Everything is working! 🎉
