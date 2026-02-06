# Complete Guide: Local Testing to Helm Deployment

## Table of Contents
1. [Understanding Storage (PV, PVC, StatefulSet)](#understanding-storage)
2. [Understanding Docker Images](#understanding-docker-images)
3. [Local Testing Workflow](#local-testing-workflow)
4. [Building Docker Images](#building-docker-images)
5. [Deploying with Helm](#deploying-with-helm)
6. [Missing Components (cert-manager)](#missing-components)

---

## 1. Understanding Storage (PV, PVC, StatefulSet) {#understanding-storage}

### What is PV, PVC, and StatefulSet?

**PersistentVolume (PV)**: Physical storage on the server (like a hard drive folder)
**PersistentVolumeClaim (PVC)**: A request for storage (like asking for 5GB of space)
**StatefulSet**: Like a Deployment but for stateful apps that need persistent storage

### How Does the Pod See the Storage?

```
┌─────────────────────────────────────────────────────────────┐
│  1. You create PVC (asking for 5GB storage)                 │
│     File: helm/secrecto/templates/postgres/pvc.yaml         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  2. K3s local-path provisioner automatically creates PV     │
│     (creates folder: /var/lib/rancher/k3s/storage/...)      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  3. StatefulSet mounts PVC into the pod                     │
│     File: helm/secrecto/templates/postgres/statefulset.yaml │
│     volumeMounts:                                           │
│       - name: postgres-storage                              │
│         mountPath: /var/lib/postgresql/data                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Pod sees it as /var/lib/postgresql/data folder          │
│     PostgreSQL writes data there, it persists on server     │
└─────────────────────────────────────────────────────────────┘
```

### Why You Don't See PV in Helm Templates

**You DON'T create PV manually** - K3s creates it automatically!

When you create a PVC in Helm:
```yaml
# helm/secreto/templates/postgres/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: local-path  # <-- This tells K3s to auto-create PV
```

K3s sees `storageClassName: local-path` and automatically:
1. Creates a folder on your server at `/var/lib/rancher/k3s/storage/pvc-xxxxx/`
2. Creates a PV pointing to that folder
3. Binds the PV to your PVC

**To verify this worked:**
```bash
# See the PVC (your request)
kubectl get pvc -n saytruth-dev

# See the PV (auto-created by K3s)
kubectl get pv

# See what folder was created on the server
ls -la /var/lib/rancher/k3s/storage/
```

---

## 2. Understanding Docker Images {#understanding-docker-images}

### The Critical Concept: Helm and K3s Need Docker Images

**When you run locally with Python/Node directly:**
- Backend: `python -m uvicorn app.main:app`
- Frontend: `npm run dev`
- You run the code directly from files

**When you run with Helm/K3s:**
- Backend: Kubernetes pulls image `saytruth/backend:latest`
- Frontend: Kubernetes pulls image `saytruth/frontend:latest`
- You DON'T run files - you run pre-built Docker images!

### Where Are Images Defined in Helm?

```yaml
# helm/secreto/values-dev.yaml
backend:
  image:
    repository: saytruth/backend
    tag: latest
    pullPolicy: IfNotPresent

frontend:
  image:
    repository: saytruth/frontend
    tag: latest
    pullPolicy: IfNotPresent
```

**These images MUST exist before Helm can deploy!**

---

## 3. Local Testing Workflow (WITHOUT Helm) {#local-testing-workflow}

### Option A: Test with Docker Compose (RECOMMENDED)

This tests the SAME images that Helm will use, but locally with Docker Compose.

```bash
# Step 1: Build Docker images
cd /mnt/lv1/live-project/secrecto_web_live_docker
docker-compose build

# Step 2: Start all services
docker-compose up -d

# Step 3: Check logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Step 4: Test the application
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
curl http://localhost:8000/health

# Step 5: Stop when done
docker-compose down
```

**Files used:**
- `docker-compose.yml` - Defines all services
- `backend/Dockerfile` - How to build backend image
- `frontend/Dockerfile` - How to build frontend image

### Option B: Test Each Service Manually (Development)

This is for rapid development when you're changing code frequently.

**Terminal 1 - PostgreSQL:**
```bash
docker run -d --name postgres \
  -e POSTGRES_USER=saytruth_user \
  -e POSTGRES_PASSWORD='DevSecurePass123!@#' \
  -e POSTGRES_DB=saytruth_db \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine
```

**Terminal 2 - Backend:**
```bash
cd /mnt/lv1/live-project/secrecto_web_live_docker/backend

# Activate Python virtual environment
source ../.venv/bin/activate

# Install dependencies (if not already done)
pip install -r requirements.txt

# Run with auto-reload (for development)
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 3 - Frontend:**
```bash
cd /mnt/lv1/live-project/secrecto_web_live_docker/frontend

# Install dependencies (if not already done)
npm install

# Run dev server with hot reload
npm run dev
```

**Test the services:**
- Backend: http://localhost:8000/docs (FastAPI Swagger UI)
- Frontend: http://localhost:5173

### Which Option to Choose?

| Method | When to Use | Pros | Cons |
|--------|------------|------|------|
| **Docker Compose** | Final testing before Helm | Tests actual Docker images | Slower rebuild |
| **Manual (Python/Node)** | Active development | Fast, auto-reload | Doesn't test Dockerfiles |

**RECOMMENDED WORKFLOW:**
1. Develop with Manual method (fast iteration)
2. Test with Docker Compose (verify Dockerfiles work)
3. Deploy with Helm (production-like environment)

---

## 4. Building Docker Images for Helm {#building-docker-images}

Before you can use Helm, you MUST build Docker images.

### Step 1: Build Images Locally

```bash
cd /mnt/lv1/live-project/secrecto_web_live_docker

# Build backend image
docker build -t saytruth/backend:latest ./backend

# Build frontend image
docker build -t saytruth/frontend:latest ./frontend

# Build database image (if custom)
docker build -t saytruth/database:latest ./database

# Verify images were created
docker images | grep saytruth
```

### Step 2: Make Images Available to K3s

K3s needs to see these images. You have 3 options:

**Option A: Import to K3s (EASIEST for local testing)**
```bash
# Save images to tar files
docker save saytruth/backend:latest -o backend.tar
docker save saytruth/frontend:latest -o frontend.tar

# Import into K3s
sudo k3s ctr images import backend.tar
sudo k3s ctr images import frontend.tar

# Verify K3s can see them
sudo k3s ctr images list | grep saytruth
```

**Option B: Use local Docker daemon (if K3s configured to use it)**
```bash
# K3s can use local Docker images if configured
# Just build the images and they're available
```

**Option C: Push to Registry (for production)**
```bash
# Push to Docker Hub (requires docker login)
docker push saytruth/backend:latest
docker push saytruth/frontend:latest

# Or push to private registry
docker tag saytruth/backend:latest registry.example.com/backend:latest
docker push registry.example.com/backend:latest
```

### Step 3: Verify Images Exist

```bash
# List images available to K3s
sudo k3s ctr images list | grep saytruth

# Should show:
# saytruth/backend:latest
# saytruth/frontend:latest
```

---

## 5. Deploying with Helm {#deploying-with-helm}

### Prerequisites Checklist

Before running Helm, ensure:
- [ ] K3s is running: `kubectl get nodes`
- [ ] Docker images are built: `docker images | grep saytruth`
- [ ] Images are available to K3s: `sudo k3s ctr images list | grep saytruth`
- [ ] Helm is installed: `helm version`

### Step-by-Step Helm Deployment

**1. Install to Development Environment:**
```bash
cd /mnt/lv1/live-project/secrecto_web_live_docker

# Deploy with Helm
helm upgrade --install secrecto-dev \
  ./helm/secrecto \
  -f ./helm/secrecto/values-dev.yaml \
  -n saytruth-dev \
  --create-namespace

# Wait for pods to be ready (takes 30-60 seconds)
kubectl get pods -n saytruth-dev -w
# Press Ctrl+C when all show 1/1 Running
```

**2. Verify Deployment:**
```bash
# Check all resources
kubectl get all -n saytruth-dev

# Check pod status
kubectl get pods -n saytruth-dev

# Check logs
kubectl logs -n saytruth-dev deploy/backend
kubectl logs -n saytruth-dev deploy/frontend

# Check storage
kubectl get pvc -n saytruth-dev
kubectl get pv
```

**3. Access the Application:**
```bash
# Get Kong service IP (API Gateway)
kubectl get svc -n saytruth-dev kong-service

# If LoadBalancer shows <pending>, use port-forward:
kubectl port-forward -n saytruth-dev svc/kong-service 8000:80

# Test backend through Kong
curl http://localhost:8000/api/health

# Test frontend through Kong
curl http://localhost:8000/
```

**4. Make Changes and Update:**
```bash
# After changing code, rebuild images
docker build -t saytruth/backend:latest ./backend
sudo k3s ctr images import backend.tar

# Update Helm deployment
helm upgrade secrecto-dev \
  ./helm/secrecto \
  -f ./helm/secrecto/values-dev.yaml \
  -n saytruth-dev

# Or force pod restart to pull new image
kubectl rollout restart -n saytruth-dev deployment/backend
```

**5. Clean Up:**
```bash
# Remove Helm release
helm uninstall secrecto-dev -n saytruth-dev

# Delete namespace (removes everything)
kubectl delete namespace saytruth-dev
```

### Common Helm Commands

```bash
# List installed releases
helm list -n saytruth-dev

# See what Helm will create (dry-run)
helm template secrecto-dev ./helm/secrecto -f ./helm/secrecto/values-dev.yaml

# Check Helm chart for errors
helm lint ./helm/secrecto

# Get release history
helm history secrecto-dev -n saytruth-dev

# Rollback to previous version
helm rollback secrecto-dev 1 -n saytruth-dev
```

---

## 6. Missing Components (cert-manager) {#missing-components}

### Why cert-manager is in k3s/ but not helm/?

**k3s/ folder**: Old way of deploying - individual YAML files
**helm/ folder**: New way - templated, reusable charts

cert-manager was not migrated to Helm because it's typically installed once per cluster, not per application.

### Should We Add cert-manager to Helm?

**Option A: Install cert-manager separately (RECOMMENDED)**
```bash
# Install cert-manager in its own namespace (once per cluster)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Then configure certificates in your Helm chart
```

**Option B: Include cert-manager in Helm (not recommended)**
- Makes the chart complex
- cert-manager should be cluster-wide, not per-app

### Do You Need cert-manager?

Only if you want **HTTPS with automatic SSL certificates**.

For local testing: **NO**, you don't need it.
For production with domain name: **YES**, you should add it.

**If you want to add cert-manager for production, let me know and I'll create the templates!**

---

## Complete Testing Workflow (START TO FINISH)

### Phase 1: Local Development Testing

```bash
# 1. Start PostgreSQL
docker run -d --name postgres \
  -e POSTGRES_USER=saytruth_user \
  -e POSTGRES_PASSWORD='DevSecurePass123!@#' \
  -e POSTGRES_DB=saytruth_db \
  -p 5432:5432 \
  postgres:15-alpine

# 2. Test Backend
cd backend
source ../.venv/bin/activate
python -m uvicorn app.main:app --reload

# In another terminal: test
curl http://localhost:8000/health

# 3. Test Frontend
cd ../frontend
npm run dev

# Open browser: http://localhost:5173
```

**When development is working, proceed to Phase 2.**

### Phase 2: Docker Image Testing

```bash
# 1. Stop manual services
# Ctrl+C in backend and frontend terminals
docker stop postgres

# 2. Test with Docker Compose
docker-compose build
docker-compose up -d

# 3. Verify services
docker-compose ps
docker-compose logs backend
docker-compose logs frontend

# 4. Test application
curl http://localhost:8000/health
# Open browser: http://localhost:5173

# 5. Clean up
docker-compose down
```

**When Docker Compose works, proceed to Phase 3.**

### Phase 3: Helm Deployment

```bash
# 1. Build and import images to K3s
docker build -t saytruth/backend:latest ./backend
docker build -t saytruth/frontend:latest ./frontend
docker save saytruth/backend:latest -o backend.tar
docker save saytruth/frontend:latest -o frontend.tar
sudo k3s ctr images import backend.tar
sudo k3s ctr images import frontend.tar

# 2. Deploy with Helm
helm upgrade --install secrecto-dev \
  ./helm/secrecto \
  -f ./helm/secrecto/values-dev.yaml \
  -n saytruth-dev \
  --create-namespace

# 3. Wait and verify
kubectl get pods -n saytruth-dev -w
# Wait for all 1/1 Running

# 4. Test through Kubernetes
kubectl port-forward -n saytruth-dev svc/kong-service 8000:80
curl http://localhost:8000/api/health
```

**When Helm deployment works in dev, deploy to prod:**

```bash
helm upgrade --install secrecto-prod \
  ./helm/secrecto \
  -f ./helm/secrecto/values-prod.yaml \
  -n saytruth-prod \
  --create-namespace
```

---

## Troubleshooting Guide

### Problem: Pods show ImagePullBackOff

```bash
# Check error
kubectl describe pod -n saytruth-dev <pod-name>

# Common causes:
# 1. Image doesn't exist
docker images | grep saytruth

# 2. Image not imported to K3s
sudo k3s ctr images import backend.tar

# 3. Wrong image name in values.yaml
# Check: helm/secrecto/values-dev.yaml
```

### Problem: Pod is CrashLoopBackOff

```bash
# Check logs
kubectl logs -n saytruth-dev <pod-name>

# Common causes:
# 1. Database connection failed - check DATABASE_URL
# 2. Missing environment variables - check configmap/secret
# 3. Application error - fix code and rebuild image
```

### Problem: Can't access the application

```bash
# Check services
kubectl get svc -n saytruth-dev

# Use port-forward for local access
kubectl port-forward -n saytruth-dev svc/kong-service 8000:80

# Or check service type in values.yaml
# NodePort: Access via node IP and port
# LoadBalancer: Access via external IP (may be pending on K3s)
```

---

## Quick Reference

### Test Locally (No Kubernetes)
```bash
docker-compose up -d
```

### Build Images for Helm
```bash
docker build -t saytruth/backend:latest ./backend
docker build -t saytruth/frontend:latest ./frontend
docker save saytruth/backend:latest -o backend.tar
sudo k3s ctr images import backend.tar
```

### Deploy with Helm
```bash
helm upgrade --install secrecto-dev ./helm/secrecto \
  -f ./helm/secrecto/values-dev.yaml -n saytruth-dev --create-namespace
```

### Check Status
```bash
kubectl get pods -n saytruth-dev
kubectl logs -n saytruth-dev deploy/backend
```

### Access Application
```bash
kubectl port-forward -n saytruth-dev svc/kong-service 8000:80
```

---

## Summary

1. **Local Testing**: Use `docker-compose` or manual Python/Node
2. **Build Images**: Required before Helm deployment
3. **Import to K3s**: Make images available to Kubernetes
4. **Deploy with Helm**: `helm upgrade --install`
5. **Storage (PV/PVC)**: K3s auto-creates PV, you just create PVC
6. **cert-manager**: Install separately, not in app Helm chart

**The key difference**: Local testing runs code directly, Helm runs Docker images in Kubernetes.
