# Kong API Gateway - Complete Guide

## What is Kong?

Kong is an **API Gateway** - a server that sits between clients and backend services. It acts as a single entry point for all API requests.

```
┌────────────┐
│  Browser   │
│ (Frontend) │
└─────┬──────┘
      │ HTTP Request
      ↓
┌──────────────────────────────────────┐
│        KONG API GATEWAY              │
│  (Port 80/443)                       │
│                                      │
│  - Authentication                    │
│  - Rate Limiting                     │
│  - Request Routing                   │
│  - TLS/HTTPS Termination            │
│  - Load Balancing                    │
└────┬──────────────────────┬──────────┘
     │                      │
     ↓                      ↓
┌─────────────┐      ┌─────────────────┐
│  Backend    │      │  Frontend (SPA) │
│  Port 8000  │      │  Port 5173      │
└─────────────┘      └─────────────────┘
```

---

## Key Responsibilities of Kong

### 1. **Request Routing**
Direct requests to correct backend service based on path:
```
/api/*        → Backend (port 8000)
/*            → Frontend (port 5173)
```

### 2. **TLS/SSL Termination**
```
HTTPS request → Kong (decrypt) → HTTP request to backend
```
- Browser: Secure HTTPS connection to Kong
- Backend: Simple HTTP (Kong handles encryption)

### 3. **Rate Limiting**
```
Block requests if user exceeds limit:
- 100 requests per minute per user
- 1000 requests per hour globally
```

### 4. **Authentication**
```
Check if request has valid token before forwarding:
Authorization: Bearer <JWT_TOKEN>
```

### 5. **CORS Headers**
```
Add headers to allow cross-origin requests:
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
```

### 6. **Load Balancing**
```
Multiple backend instances:
Kong → backend-1
    → backend-2
    → backend-3
(Distributes requests evenly)
```

---

## Kong Architecture

### DB-less Mode (What We Use)
```
Traditional Kong:                 DB-less Kong (Our Setup):
┌──────────┐                      ┌──────────┐
│ Kong     │                      │ Kong     │
│ Instance │←→ PostgreSQL DB      │ Instance │ (No database!)
└──────────┘                      └──────────┘
                                       ↑
                                 kong.yaml config
                                 (mounted as ConfigMap)
```

**Why DB-less?**
- ✅ Simpler to deploy (no database dependency)
- ✅ Declarative config (version control friendly)
- ✅ Easier for development/testing
- ✅ Stateless (can scale horizontally)

**Disadvantage:**
- ❌ Cannot add routes dynamically (must restart Kong)
- ❌ No runtime configuration via Admin API (read-only mode)

---

## Kong Configuration (kong.yaml)

```yaml
_format_version: "2.1"

services:
  # Backend service
  - name: backend-service
    url: http://backend-service:8000
    routes:
      - name: api-route
        paths:
          - /api
        strip_path: false  # Keep /api in path
    
  # Frontend service
  - name: frontend-service
    url: http://frontend-service:5173
    routes:
      - name: frontend-route
        paths:
          - /
        strip_path: false  # Keep path as-is

# Example with rate limiting and auth
plugins:
  - name: rate-limiting
    service: backend-service
    config:
      minute: 100         # 100 requests per minute
      hour: 1000
  
  - name: jwt
    service: backend-service
    config:
      key_claim_name: "sub"
      cookie_names:
        - "jwt"
```

**YAML Concepts:**
```yaml
# Top-level items
services:        # API services to proxy to
plugins:         # Middleware/policies
routes:          # URL paths
upstreams:       # Load balancing targets
```

---

## How Kong Processes a Request

### Step 1: Request Arrives
```
Browser sends: GET http://localhost/api/users
```

### Step 2: Matching
Kong checks configured routes:
```yaml
routes:
  - paths: ["/api"]        # Does request path match?
    service: backend-service
```
✅ Path `/api/users` matches `/api` → Forward to backend

### Step 3: Plugins
Apply middleware (rate limiting, auth, logging):
```
1. Authentication → Check JWT token valid? → No? Reject
2. Rate Limiting → Exceeded limit? → No? Continue
3. CORS Headers → Add headers
4. Logging → Log the request
```

### Step 4: Forward
```
Kong sends: GET http://backend-service:8000/api/users
```

### Step 5: Response
```
Backend responds with JSON
Kong forwards response + headers back to browser
```

---

## Kong in Kubernetes

### Service Discovery
Kong automatically discovers services via DNS:

```yaml
url: http://backend-service:8000
# Kubernetes resolves to:
# backend-service.saytruth-dev.svc.cluster.local:8000
```

**Inside the cluster:**
- DNS: `backend-service` → resolves to service IP
- Service IP routes to pod
- Each pod has its own IP address

### Multiple Replicas
```yaml
services:
  - name: backend-service
    url: http://backend-service:8000
    # If 3 backend pods running:
    # Service automatically load balances across all 3
```

---

## Kong Ports

```
Port 8000  - HTTP proxy (default traffic)
Port 8443  - HTTPS proxy (SSL/TLS)
Port 8001  - Admin API (management, read-only in DB-less)
Port 8444  - Admin HTTPS
```

**In Kubernetes:**
```yaml
service:
  ports:
    - port: 80
      targetPort: 8000  # HTTP traffic
    - port: 443
      targetPort: 8443  # HTTPS traffic
```

---

## Kong Plugins Explained

### 1. Rate Limiting Plugin
```yaml
- name: rate-limiting
  service: backend-service
  config:
    minute: 100    # 100/min per consumer
    hour: 1000     # 1000/hour per consumer
    policy: local  # Or "redis" for distributed
```

**What it does:**
```
Request 1-100 → ✅ Allowed
Request 101   → ❌ HTTP 429 Too Many Requests
(Reset after 1 minute)
```

### 2. JWT Authentication Plugin
```yaml
- name: jwt
  service: backend-service
  config:
    key_claim_name: "sub"      # User ID stored in "sub"
    secret_is_base64: false
```

**What it does:**
```
Request with valid token    → ✅ Forward to backend
Request without token       → ❌ HTTP 401 Unauthorized
Request with invalid token  → ❌ HTTP 401 Unauthorized
```

### 3. CORS Plugin
```yaml
- name: cors
  config:
    origins:
      - "http://localhost:3000"
      - "https://saytruth.duckdns.org"
    methods:
      - GET
      - POST
      - PUT
      - DELETE
    headers:
      - Authorization
      - Content-Type
    credentials: true
    max_age: 3600
```

**What it does:**
```
Browser sends: Origin: http://localhost:3000
Kong responds:
  Access-Control-Allow-Origin: http://localhost:3000
  Access-Control-Allow-Methods: GET, POST, PUT, DELETE
```

### 4. Logging Plugin
```yaml
- name: file-log
  service: backend-service
  config:
    path: "/var/log/kong/api.log"
```

---

## Kong vs Kubernetes Ingress

### Kubernetes Ingress (Built-in)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kong-ingress
spec:
  ingressClassName: traefik  # Uses Traefik controller
  rules:
    - host: localhost
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: kong-service
                port:
                  number: 80
```

**Traefik** (built into K3s):
- Routes HTTP traffic to services
- Can do TLS termination
- Can do basic routing
- Limited features (no rate limiting, auth, etc.)

### Kong API Gateway
```yaml
url: http://backend-service:8000
plugins:
  - rate-limiting
  - jwt-auth
  - cors
```

**Advantages:**
- Rich plugin ecosystem
- Advanced routing
- Purpose-built for APIs
- Better rate limiting, auth, etc.

**Disadvantage:**
- Added complexity
- Extra layer of routing

---

## Common Kong Patterns

### Pattern 1: Versioning
```yaml
services:
  - name: api-v1
    url: http://backend-v1:8000
    routes:
      - paths: ["/api/v1"]
  
  - name: api-v2
    url: http://backend-v2:8000
    routes:
      - paths: ["/api/v2"]
```

### Pattern 2: Canary Deployment
```yaml
upstreams:
  - name: backend
    targets:
      - target: "backend-old:8000"
        weight: 90
      - target: "backend-new:8000"
        weight: 10    # 10% traffic to new version
```

### Pattern 3: Request Transformation
```yaml
plugins:
  - name: request-transformer
    service: backend-service
    config:
      add:
        headers:
          - "X-Forwarded-User: request_user_id"
```

---

## Debugging Kong Issues

### 1. Check Kong Pod is Running
```bash
kubectl get pods -n saytruth-dev -l app=kong
# Should show 1/1 Running
```

### 2. Check Kong Logs
```bash
kubectl logs -n saytruth-dev -l app=kong | grep -i error
```

### 3. Test Kong Connectivity
```bash
kubectl exec -n saytruth-dev deployment/backend -- \
  python3 -c "import socket; \
  s=socket.socket(); \
  result=s.connect_ex(('kong-service',80)); \
  print('Kong reachable' if result==0 else f'Failed: {result}')"
```

### 4. View Kong Admin API (Read-only)
```bash
kubectl port-forward -n saytruth-dev svc/kong-service 8001:8001
# Visit http://localhost:8001
```

### 5. Test Route
```bash
kubectl exec -n saytruth-dev deployment/backend -- \
  python3 -c "
import requests
try:
  r = requests.get('http://kong-service/api/health', timeout=5)
  print(f'Status: {r.status_code}')
except Exception as e:
  print(f'Error: {e}')
"
```

---

## Kong vs Other API Gateways

| Feature | Kong | Traefik | NGINX | AWS API Gateway |
|---------|------|---------|-------|-----------------|
| Rate Limiting | ✅ | ⚠️ | ✅ | ✅ |
| JWT Auth | ✅ | ⚠️ | ⚠️ | ✅ |
| Plugins | ✅✅✅ | ⚠️ | ✅ | ⚠️ |
| DB-less Mode | ✅ | ❌ | ❌ | N/A |
| Easy Setup | ✅ | ✅ | ❌ | ✅ |
| Self-hosted | ✅ | ✅ | ✅ | ❌ |
| Cost | Free | Free | Free | $$ |

---

## Next Steps

1. **Read Kong documentation**: https://docs.konghq.com/
2. **Experiment with plugins**: Try adding new plugins to kong.yaml
3. **Monitor real traffic**: Use Kong Admin API to see live stats
4. **Learn Lua scripting**: Advanced Kong plugins use Lua
5. **Explore Kong Enterprise**: Advanced features for production
