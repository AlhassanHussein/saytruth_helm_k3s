# EC2 Deployment Guide - How to Access Your Application

## Understanding the Problem

**You asked**: "If I upload this code to EC2 and run Helm, everything will work, but EC2 has an IP. How will I or anyone access it if we're using the NodePort IP?"

**Great question!** This is a common confusion about Kubernetes networking. Let me explain:

---

## How Access Works in Different Environments

### Local Development (What You Have Now)
```
Your Computer
    ↓
Server IP: 192.168.1.130
    ↓
NodePort: 30347
    ↓
Access URL: http://192.168.1.130:30347/
```

### EC2 Deployment (What You're Asking About)
```
Anyone on Internet
    ↓
EC2 Public IP: 3.145.123.45 (example)
    ↓  
NodePort: 30347 (SAME as local!)
    ↓
Access URL: http://3.145.123.45:30347/
```

**The NodePort number stays the same! Only the IP address changes.**

---

## Step-by-Step: EC2 Deployment

### 1. Launch EC2 Instance

```bash
# AWS Console:
- AMI: Ubuntu 24.04 LTS
- Instance Type: t3.medium (minimum)
- Storage: 30GB
- Key Pair: Create/Select SSH key
```

**Your EC2 will have:**
- **Private IP**: 172.31.x.x (internal AWS network)
- **Public IP**: 3.145.123.45 (accessible from internet)

### 2. Configure Security Group

**CRITICAL**: Open these ports in EC2 Security Group:

```
Inbound Rules:
┌──────────┬────────────────┬─────────────┬─────────────┐
│ Type     │ Protocol       │ Port Range  │ Source      │
├──────────┼────────────────┼─────────────┼─────────────┤
│ SSH      │ TCP            │ 22          │ Your IP     │
│ HTTP     │ TCP            │ 80          │ 0.0.0.0/0   │
│ HTTPS    │ TCP            │ 443         │ 0.0.0.0/0   │
│ Custom   │ TCP            │ 30347       │ 0.0.0.0/0   │ <- NodePort!
│ Custom   │ TCP            │ 32567       │ 0.0.0.0/0   │ <- HTTPS NodePort
└──────────┴────────────────┴─────────────┴─────────────┘
```

**Important**: NodePort 30347 must be open to the internet (0.0.0.0/0) so anyone can access your app!

### 3. Install K3s on EC2

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@3.145.123.45

# Install K3s
curl -sfL https://get.k3s.io | sh -

# Verify
sudo kubectl get nodes
```

### 4. Upload Your Code to EC2

**Option A: Git Clone (RECOMMENDED)**
```bash
# On EC2
git clone https://github.com/your-username/secrecto_web_live_docker.git
cd secrecto_web_live_docker
```

**Option B: SCP Upload**
```bash
# From your local machine
scp -i your-key.pem -r /mnt/lv1/live-project/secrecto_web_live_docker \
  ubuntu@3.145.123.45:~/
```

### 5. Build Docker Images on EC2

```bash
# On EC2
cd secrecto_web_live_docker

# Build images
docker build -t saytruth/backend:latest ./backend
docker build -t saytruth/frontend:latest ./frontend

# Import to K3s
docker save saytruth/backend:latest -o backend.tar
docker save saytruth/frontend:latest -o frontend.tar
sudo k3s ctr images import backend.tar
sudo k3s ctr images import frontend.tar
```

### 6. Deploy with Helm

```bash
# Install Helm (if not installed)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Deploy
helm upgrade --install saytruth-dev \
  ./helm/secrecto \
  -f ./helm/secrecto/values-dev.yaml \
  -n saytruth-dev \
  --create-namespace

# Wait for pods
kubectl get pods -n saytruth-dev -w
```

### 7. Access Your Application

**From anywhere in the world:**
```
http://3.145.123.45:30347/
```

Replace `3.145.123.45` with your actual EC2 public IP.

---

## How Users Will Access It

### Scenario 1: You Access It
```bash
# Get EC2 public IP
curl http://checkip.amazonaws.com
# Output: 3.145.123.45

# Access in browser
http://3.145.123.45:30347/
```

### Scenario 2: Your Friends Access It
```
You tell them: "Go to http://3.145.123.45:30347/"
They open browser: http://3.145.123.45:30347/
✅ They see your app!
```

### Scenario 3: With a Domain Name (Production)
```
1. Buy domain: saytruth.com
2. Create A Record: saytruth.com → 3.145.123.45
3. Users access: http://saytruth.com:30347/
```

---

## Why NodePort is Consistent

### NodePort Behavior

When you create a Kubernetes Service with `type: LoadBalancer`, K3s:
1. Allocates a **NodePort** (30347 in your case)
2. This port is **static** and **consistent**
3. Kubernetes opens this port on **ALL** nodes in the cluster

**Example:**
```yaml
# helm/secrecto/values.yaml
kong:
  service:
    type: LoadBalancer
    ports:
      - name: http
        port: 80
        targetPort: 8000
        # Kubernetes assigns: nodePort: 30347 (automatically)
```

**Result:**
- Local: `http://192.168.1.130:30347/`
- EC2: `http://3.145.123.45:30347/`
- Another Server: `http://10.20.30.40:30347/`

**Same port (30347), different IP!**

---

## Production Deployment Best Practices

### Option 1: Use NodePort Directly (Simple, What You Have)

**Pros:**
- ✅ Simple to set up
- ✅ Works immediately
- ✅ No additional infrastructure

**Cons:**
- ❌ Port number in URL (ugly)
- ❌ No HTTPS
- ❌ Not standard (users expect port 80/443)

**Use when:** Testing, internal apps, prototypes

### Option 2: Use AWS Load Balancer (Production)

```yaml
# helm/secrecto/values-prod.yaml
kong:
  service:
    type: LoadBalancer
    annotations:
      service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
```

**What happens:**
1. Helm creates Service with LoadBalancer type
2. K3s/K8s requests AWS to create Network Load Balancer
3. AWS creates NLB with public IP
4. NLB forwards traffic to NodePort 30347

**Access:**
```
http://<NLB-DNS-NAME>/
# Example: http://a1b2c3d4e5f6-123456789.us-east-1.elb.amazonaws.com/
```

**Pros:**
- ✅ Standard port (80/443)
- ✅ Can add SSL/TLS
- ✅ Professional

**Cons:**
- ❌ Extra cost (~$16/month for NLB)
- ❌ More complex

### Option 3: Use Ingress with Domain (Best for Production)

**Setup:**
1. Point domain to EC2 IP
2. Create Ingress resource
3. Use cert-manager for HTTPS

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: saytruth-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        - saytruth.com
      secretName: saytruth-tls
  rules:
    - host: saytruth.com
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

**Access:**
```
https://saytruth.com/
```

**Pros:**
- ✅ Professional URL
- ✅ Automatic HTTPS
- ✅ Standard ports
- ✅ Multiple domains supported

**Cons:**
- ❌ Requires domain name
- ❌ More configuration

---

## Current Setup Summary

### What's Running Now (Local)
```
Service: kong-service
Type: LoadBalancer
Port: 80 → NodePort: 30347
Access: http://192.168.1.130:30347/
```

### What Will Run on EC2 (Same Config)
```
Service: kong-service
Type: LoadBalancer
Port: 80 → NodePort: 30347
Access: http://<EC2-PUBLIC-IP>:30347/
```

**The Helm chart is the same! Only the IP changes.**

---

## How Frontend Knows the API URL (Your Other Question)

### The Fix I Just Made

**Before (Broken):**
```javascript
// frontend/src/services/api.js
const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost';
```

**Problem:** When `VITE_API_BASE_URL=""` (empty string), JavaScript treats it as falsy, so it falls back to `'http://localhost'`

**After (Fixed):**
```javascript
const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL !== undefined 
  ? import.meta.env.VITE_API_BASE_URL 
  : 'http://localhost';
```

**Solution:** Check if variable is `undefined` instead of truthy/falsy.

### How It Works Now

**Helm ConfigMap:**
```yaml
# helm/secrecto/values-dev.yaml
frontend:
  config:
    VITE_API_BASE_URL: ""  # Empty string = relative URLs
```

**Frontend Code:**
```javascript
// VITE_API_BASE_URL = ""
const RAW_API_BASE_URL = "";  // Not undefined, so it uses ""
const API_BASE_URL = normalizeBaseUrl("");  // Returns ""

// API call
fetch(`${API_BASE_URL}/api/auth/signup`)
// Becomes: fetch("/api/auth/signup")  <- Relative URL!
```

**Browser Request:**
```
Frontend loaded from: http://192.168.1.130:30347/
API call to: /api/auth/signup
Browser resolves to: http://192.168.1.130:30347/api/auth/signup
✅ Same origin = No CORS error!
```

**On EC2:**
```
Frontend loaded from: http://3.145.123.45:30347/
API call to: /api/auth/signup
Browser resolves to: http://3.145.123.45:30347/api/auth/signup
✅ Same origin = No CORS error!
```

**The frontend automatically uses the correct IP because it uses relative URLs!**

---

## Testing Checklist for EC2

### Before Deploying to EC2

- [ ] Test locally with Helm (✅ You did this)
- [ ] Verify frontend works without CORS errors
- [ ] Verify all features work (signup, login, create link, etc.)

### After Deploying to EC2

```bash
# 1. Get EC2 public IP
EC2_IP=$(curl -s http://checkip.amazonaws.com)
echo "Your EC2 IP: $EC2_IP"

# 2. Get NodePort
NODE_PORT=$(kubectl get svc -n saytruth-dev kong-service -o jsonpath='{.spec.ports[0].nodePort}')
echo "NodePort: $NODE_PORT"

# 3. Test backend
curl http://$EC2_IP:$NODE_PORT/api/health

# 4. Test frontend
curl http://$EC2_IP:$NODE_PORT/ | grep -i "saytruth"

# 5. Open in browser
echo "Access your app at: http://$EC2_IP:$NODE_PORT/"
```

---

## Quick Commands for EC2

### Get Your Access URL
```bash
# On EC2
echo "Access URL: http://$(curl -s http://checkip.amazonaws.com):$(kubectl get svc -n saytruth-dev kong-service -o jsonpath='{.spec.ports[0].nodePort}')/"
```

### Monitor Deployment
```bash
# Watch pods
kubectl get pods -n saytruth-dev -w

# Check logs
kubectl logs -n saytruth-dev -l app=backend --tail=50
kubectl logs -n saytruth-dev -l app=frontend --tail=50
kubectl logs -n saytruth-dev -l app=kong --tail=50
```

### Restart After Code Changes
```bash
# 1. Rebuild images
docker build -t saytruth/backend:latest ./backend
docker build -t saytruth/frontend:latest ./frontend

# 2. Import to K3s
docker save saytruth/backend:latest -o backend.tar
sudo k3s ctr images import backend.tar
docker save saytruth/frontend:latest -o frontend.tar
sudo k3s ctr images import frontend.tar

# 3. Delete pods to force new image
kubectl delete pod -n saytruth-dev -l app=backend
kubectl delete pod -n saytruth-dev -l app=frontend
```

---

## Summary

### Your Questions Answered

**Q: "How will I or anyone access it on EC2 with NodePort?"**
**A:** Same way as local! Just use EC2 public IP instead of local IP:
- Local: `http://192.168.1.130:30347/`
- EC2: `http://<EC2-PUBLIC-IP>:30347/`

**Q: "The backend works with curl but frontend doesn't work from GUI?"**
**A:** Fixed! The problem was:
1. Frontend `api.js` had wrong fallback logic for empty string
2. I fixed it to check `!== undefined` instead of truthy/falsy
3. Rebuilt frontend image
4. Imported to K3s
5. Restarted pod

**Now frontend uses relative URLs, so it works on any IP!**

---

## Next Steps

1. **Test frontend now**: Open `http://192.168.1.130:30347/` and try signup/login
2. **If it works**: Deploy to EC2 following the steps above
3. **For production**: Set up domain name + Ingress + HTTPS

The Helm chart works on **any server** - local, EC2, DigitalOcean, anywhere!
