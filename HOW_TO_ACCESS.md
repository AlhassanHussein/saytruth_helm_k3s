# How to Access Your Application

## ✅ Your Deployment Status

All pods are running in namespace: `saytruth-dev`

```
✅ backend-5d95554c7b-tt4wp    1/1 Running
✅ frontend-78698bc6b5-z8px9   1/1 Running  
✅ kong-5bccfdf5c-8svwt        1/1 Running
✅ postgres-0                  1/1 Running
```

---

## 🌐 How to Access the Application

### Method 1: Through Kong (NodePort) - RECOMMENDED

Kong API Gateway is exposed as NodePort on your server IP.

**Your Server IP:** `192.168.1.130`
**Kong NodePort:** `30347` (HTTP)

**Access URLs:**

```bash
# Frontend (Web UI)
http://192.168.1.130:30347/

# Backend API
http://192.168.1.130:30347/api/health
```

**Open in your browser:**
```
http://192.168.1.130:30347/
```

This will show the SayTruth application UI.

---

### Method 2: Port Forwarding (For Testing)

If you're on the same machine as the Kubernetes cluster, use port forwarding:

#### Option A: Forward Kong to localhost
```bash
kubectl port-forward -n saytruth-dev svc/kong-service 8080:80
```
Then access: http://localhost:8080/

#### Option B: Forward Frontend Directly
```bash
kubectl port-forward -n saytruth-dev svc/frontend-service 5173:5173
```
Then access: http://localhost:5173/

#### Option C: Forward Backend Directly  
```bash
kubectl port-forward -n saytruth-dev svc/backend-service 8000:8000
```
Then access API: http://localhost:8000/docs

---

### Method 3: Change Service Type to LoadBalancer (For External Access)

If you want to access from another computer on your network:

1. Kong is already LoadBalancer type
2. The NodePort (30347) allows access from any machine on your network
3. Access from any device: `http://192.168.1.130:30347/`

---

## 📋 Service Details

```
NAME               TYPE           PORT(S)                    
====               ====           =======
kong-service       LoadBalancer   80:30347/TCP, 443:32567/TCP
frontend-service   ClusterIP      5173/TCP (internal only)
backend-service    ClusterIP      8000/TCP (internal only)
postgres-service   ClusterIP      5432/TCP (internal only)
```

**How it works:**
```
Your Browser (http://192.168.1.130:30347/)
     ↓
Kong API Gateway (routes requests)
     ↓
     ├─→ /api/*    → Backend (port 8000)
     └─→ /*        → Frontend (port 5173)
```

---

## 🧪 Test Your Deployment

### Test Backend Health
```bash
curl http://192.168.1.130:30347/api/health
# Should return: {"status":"ok"}
```

### Test Frontend
```bash
curl http://192.168.1.130:30347/ | head -10
# Should return HTML with <!doctype html>
```

### Test from Another Computer on Your Network
From any device connected to the same WiFi/network:
```
http://192.168.1.130:30347/
```

---

## 🔧 Troubleshooting

### Can't Access from Browser?

**1. Check if Kong pod is running:**
```bash
kubectl get pods -n saytruth-dev -l app=kong
```

**2. Check Kong logs:**
```bash
kubectl logs -n saytruth-dev -l app=kong
```

**3. Verify NodePort is open:**
```bash
# Check if port is listening
sudo netstat -tlnp | grep 30347
# Or
sudo ss -tlnp | grep 30347
```

**4. Check firewall (if enabled):**
```bash
# Ubuntu/Debian
sudo ufw status
sudo ufw allow 30347/tcp

# CentOS/RHEL
sudo firewall-cmd --add-port=30347/tcp --permanent
sudo firewall-cmd --reload
```

**5. Test from the server itself:**
```bash
curl http://localhost:30347/
```

### Kong Returns "Not Found" for API?

Check Kong configuration:
```bash
kubectl get configmap -n saytruth-dev kong-config -o yaml
```

Make sure routes are configured:
```yaml
routes:
  - name: api-route
    paths:
      - /api
```

### Frontend Shows But API Calls Fail?

Check frontend environment variables:
```bash
kubectl get configmap -n saytruth-dev frontend-config -o yaml
```

Should show:
```yaml
VITE_API_BASE_URL: "http://192.168.1.130:30347"
# or relative path: ""
```

---

## 📱 Access from Different Devices

### From the Server (localhost)
```bash
# Port forward
kubectl port-forward -n saytruth-dev svc/kong-service 8080:80
# Access: http://localhost:8080/
```

### From Your Laptop/Desktop (same network)
```
http://192.168.1.130:30347/
```

### From Your Phone (same WiFi)
```
http://192.168.1.130:30347/
```

### From the Internet (requires setup)
You need to:
1. Configure port forwarding on your router: External Port → 192.168.1.130:30347
2. Use dynamic DNS (DuckDNS, No-IP, etc.) for your public IP
3. Set up HTTPS with cert-manager and Let's Encrypt

---

## 🎯 Quick Access Commands

```bash
# 1. Check everything is running
kubectl get all -n saytruth-dev

# 2. Get access URL
echo "Access your app at: http://$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[0].address}'):$(kubectl get svc -n saytruth-dev kong-service -o jsonpath='{.spec.ports[0].nodePort}')/"

# 3. Port forward for local testing
kubectl port-forward -n saytruth-dev svc/kong-service 8080:80
# Then open: http://localhost:8080/

# 4. Check logs
kubectl logs -n saytruth-dev -l app=backend
kubectl logs -n saytruth-dev -l app=frontend
kubectl logs -n saytruth-dev -l app=kong

# 5. Restart a service
kubectl rollout restart -n saytruth-dev deployment/backend
kubectl rollout restart -n saytruth-dev deployment/frontend
kubectl rollout restart -n saytruth-dev deployment/kong
```

---

## 🌍 Production Setup (External Access)

For production with a domain name:

1. **Get a domain** (example: saytruth.duckdns.org)

2. **Point domain to your server:**
   ```
   A Record: saytruth.duckdns.org → YOUR_PUBLIC_IP
   ```

3. **Configure router port forwarding:**
   ```
   External 80/443 → Internal 192.168.1.130:30347/32567
   ```

4. **Update Kong service:**
   ```yaml
   # helm/secrecto/values-prod.yaml
   kong:
     service:
       type: LoadBalancer
       # Or use Ingress with TLS
   ```

5. **Install cert-manager for HTTPS:**
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
   ```

6. **Create Ingress with TLS:**
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: saytruth-ingress
     annotations:
       cert-manager.io/cluster-issuer: letsencrypt-prod
   spec:
     tls:
       - hosts:
           - saytruth.duckdns.org
         secretName: saytruth-tls
     rules:
       - host: saytruth.duckdns.org
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

---

## 📝 Summary

**Your application is now accessible at:**

# 🎉 http://192.168.1.130:30347/

**What each port does:**
- `30347` - HTTP traffic (your UI and API)
- `32567` - HTTPS traffic (when TLS is configured)

**Next steps:**
1. Open browser to http://192.168.1.130:30347/
2. Try signing up and logging in
3. Test all features

If you want to access from `localhost`, use port forwarding:
```bash
kubectl port-forward -n saytruth-dev svc/kong-service 8080:80
# Then access: http://localhost:8080/
```
