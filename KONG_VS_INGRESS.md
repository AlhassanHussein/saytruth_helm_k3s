# Kong vs Ingress - You're Right, It's Redundant!

## Your Question

**"Why add Ingress when Kong already does routing? Kong can do this role, right?"**

**Answer: You're 100% correct!** We have redundant layers.

---

## Current Setup (Redundant)

```
Browser → Traefik Ingress (port 80) → Kong (port 30347) → Backend/Frontend
          ^^^^^^^^^^                   ^^^^
          Layer 1                      Layer 2
```

**Both Traefik and Kong do the same job: routing requests!**

This is like having two security guards at the same door - unnecessary!

---

## What Each Component Does

### Kong (API Gateway)
- ✅ Routes /api/* to backend
- ✅ Routes /* to frontend
- ✅ Can add rate limiting, auth, CORS
- ✅ Can handle HTTPS/TLS
- ✅ Can expose on port 80

### Traefik (Ingress Controller)
- ✅ Routes requests to services
- ✅ Can handle HTTPS/TLS
- ✅ Built into K3s
- ✅ Already using port 80

**They do the SAME thing!** We only need ONE.

---

## Solutions - Pick ONE

### Option 1: Remove Ingress, Use ONLY Kong (Simplest)

**Remove Traefik/Ingress completely:**

```bash
# Delete the Ingress
kubectl delete ingress -n saytruth-dev saytruth-ingress

# Change Kong service to use standard ports
# Edit helm/secrecto/values.yaml
kong:
  service:
    type: NodePort
    ports:
      - name: http
        port: 80
        targetPort: 8000
        nodePort: 80  # <-- Force port 80
      - name: https
        port: 443
        targetPort: 8443
        nodePort: 443  # <-- Force port 443
```

**Problem:** Port 80 is already taken by Traefik!

**Solution:** Disable Traefik in K3s:
```bash
# Reinstall K3s without Traefik
curl -sfL https://get.k3s.io | sh -s - --disable traefik

# Or edit K3s config
sudo nano /etc/systemd/system/k3s.service
# Add: --disable traefik
sudo systemctl daemon-reload
sudo systemctl restart k3s
```

**Result:**
```
Browser → Kong (port 80) → Backend/Frontend
```

✅ **Simpler!**  
✅ **One less component**  
✅ **Kong does everything**

---

### Option 2: Remove Kong, Use ONLY Ingress

**Remove Kong completely, route directly to services:**

```yaml
# New Ingress (without Kong)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: saytruth-ingress
spec:
  rules:
    - http:
        paths:
          # Backend API
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend-service
                port:
                  number: 8000
          # Frontend
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 5173
```

**Result:**
```
Browser → Traefik (port 80) → Backend/Frontend (directly)
```

✅ **Simpler!**  
✅ **Use K3s built-in Traefik**  
✅ **No extra Kong deployment**

**Downside:** Lose Kong's advanced features (rate limiting, plugins, etc.)

---

### Option 3: Keep Both (What We Have Now)

**Reason to keep both:**
- Traefik: Handles HTTPS/TLS termination, Ingress rules
- Kong: Adds API Gateway features (rate limiting, auth, plugins)

**When this makes sense:**
- You want Kong's advanced features (JWT auth, rate limiting, caching)
- You want Traefik for cert-manager integration (automatic HTTPS)
- Production setup with multiple layers of security

```
Browser → Traefik (HTTPS, Ingress) → Kong (Auth, Rate Limit) → Backend/Frontend
          ^^^^^^^^^^^^^^^^^^^^^        ^^^^^^^^^^^^^^^^^^^^^^^
          TLS + Routing                 API Management
```

**Example use case:**
1. Traefik terminates HTTPS with Let's Encrypt cert
2. Traefik routes saytruth.com → Kong
3. Kong checks JWT token, applies rate limits
4. Kong routes to backend/frontend

---

## My Recommendation

### For Your Use Case: **Option 1 (Kong Only)**

**Why?**
- You already configured Kong with routes
- Kong is more powerful than Traefik for APIs
- You don't need Ingress complexity yet
- Simpler = easier to maintain

### How to Implement:

**Step 1: Check if port 80 is available**
```bash
sudo lsof -i :80
```

**Step 2: Stop Traefik**
```bash
# Option A: Disable in K3s startup
sudo systemctl edit k3s
# Add: ExecStart=/usr/local/bin/k3s server --disable traefik

# Option B: Delete Traefik
kubectl delete -n kube-system helmrelease traefik
kubectl delete -n kube-system deployment traefik
kubectl delete -n kube-system service traefik
```

**Step 3: Make Kong use port 80**

Since Kong NodePort is dynamically assigned (30347), and we can't change it to 80 (reserved), we need to use **hostPort**:

Edit `helm/secrecto/templates/kong/deployment.yaml`:
```yaml
spec:
  containers:
    - name: kong
      ports:
        - name: http
          containerPort: 8000
          hostPort: 80        # <-- Bind to host port 80
          protocol: TCP
        - name: https
          containerPort: 8443
          hostPort: 443       # <-- Bind to host port 443
          protocol: TCP
```

**Step 4: Redeploy**
```bash
helm upgrade saytruth-dev ./helm/secreto -f ./helm/secreto/values-dev.yaml -n saytruth-dev
```

**Result:**
```
Access: http://192.168.1.130/
        http://<EC2-IP>/
```

✅ **No port number**  
✅ **No Ingress needed**  
✅ **Just Kong**

---

## Comparison Table

| Approach | Components | Port 80 | Complexity | Best For |
|----------|-----------|---------|------------|----------|
| **Kong Only** | Kong | ✅ | Low | API-focused apps |
| **Ingress Only** | Traefik | ✅ | Low | Simple web apps |
| **Both** | Traefik + Kong | ✅ | High | Enterprise production |

---

## What Should You Do NOW?

### Quick Test: Keep Current Setup

The current setup works! You have:
- Port 80: via Ingress/Traefik → Kong → Apps ✅
- Port 30347: via Kong NodePort → Apps ✅

**Access both:**
```
http://192.168.1.130/         <- Through Ingress (port 80)
http://192.168.1.130:30347/   <- Through Kong NodePort
```

### For Production: Choose One

When you deploy to EC2:

**Option A: Disable Traefik, use Kong on port 80**
- Simpler architecture
- Kong's powerful API features

**Option B: Remove Kong, use only Ingress**
- K3s built-in, no extra deployment
- Simpler for basic web apps

**Option C: Keep both if you need:**
- HTTPS with cert-manager (Traefik)
- AND advanced API features (Kong plugins)

---

## My Opinion

**For your SayTruth app:** Use **Kong only** (Option 1)

**Reasons:**
1. You have API routes (/api/auth, /api/links, etc.)
2. Kong is purpose-built for APIs
3. Kong can handle both routing AND advanced features
4. Simpler than running both

**Implementation:**
```bash
# On EC2 installation
curl -sfL https://get.k3s.io | sh -s - --disable traefik

# Then deploy with Helm (Kong will get port 80)
```

---

## Summary

✅ **You're correct!** Kong can do the routing job  
✅ **We don't need both** Kong and Ingress for your use case  
✅ **Choose one:** Kong (for APIs) or Ingress (for simple routing)  
✅ **Current setup works** but has redundant layers

The best approach: **Disable Traefik and use Kong directly on port 80.**

This is simpler, cleaner, and Kong is more powerful for your API-based application!
