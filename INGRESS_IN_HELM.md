# ✅ Ingress Added to Helm Chart

## What Was Done

Moved the Ingress configuration into the Helm chart structure, just like Kong, Backend, Frontend, and Postgres.

### Files Created/Modified

**1. Created Ingress Template:**
```
helm/secrecto/templates/ingress/ingress.yaml
```

**2. Added Ingress Values:**
- `helm/secrecto/values.yaml` (default values)
- `helm/secrecto/values-dev.yaml` (development config)
- `helm/secrecto/values-prod.yaml` (production config with HTTPS)

**3. Deleted:**
- `ingress.yaml` (old standalone file - no longer needed)

---

## Helm Structure Now

```
helm/secrecto/
├── Chart.yaml
├── values.yaml              <- Ingress config added
├── values-dev.yaml          <- Ingress config added
├── values-prod.yaml         <- Ingress config added (with TLS)
└── templates/
    ├── _helpers.tpl
    ├── backend/
    │   ├── configmap.yaml
    │   ├── secret.yaml
    │   └── deployment.yaml
    ├── frontend/
    │   ├── configmap.yaml
    │   ├── deployment.yaml
    │   └── service.yaml
    ├── kong/
    │   ├── configmap.yaml
    │   ├── deployment.yaml
    │   └── service.yaml
    ├── postgres/
    │   ├── secret.yaml
    │   ├── pvc.yaml
    │   ├── service.yaml
    │   └── statefulset.yaml
    └── ingress/              <- NEW!
        └── ingress.yaml
```

---

## Configuration Options

### Development (values-dev.yaml)

```yaml
ingress:
  enabled: true
  host: ""  # Empty = IP-based access
  annotations: {}
```

**Access:** `http://192.168.1.130/`

### Production (values-prod.yaml)

```yaml
ingress:
  enabled: true
  host: "saytruth.duckdns.org"  # Your domain
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  tls:
    - hosts:
        - saytruth.duckdns.org
      secretName: saytruth-tls
```

**Access:** `https://saytruth.duckdns.org/`

### Disable Ingress (Optional)

```yaml
ingress:
  enabled: false  # Won't create ingress, use NodePort instead
```

---

## How to Use

### Deploy with Ingress (Development)
```bash
helm upgrade --install dev ./helm/secrecto \
  -f ./helm/secrecto/values-dev.yaml \
  -n saytruth-dev \
  --create-namespace
```

**Result:** Access at `http://<SERVER-IP>/`

### Deploy with Ingress + HTTPS (Production)
```bash
# First install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: traefik
EOF

# Deploy with Helm
helm upgrade --install prod ./helm/secrecto \
  -f ./helm/secrecto/values-prod.yaml \
  -n saytruth-prod \
  --create-namespace
```

**Result:** Access at `https://saytruth.duckdns.org/` 🔒

### Deploy WITHOUT Ingress (NodePort only)

Edit `values-dev.yaml`:
```yaml
ingress:
  enabled: false
```

Then deploy:
```bash
helm upgrade --install dev ./helm/secrecto \
  -f ./helm/secrecto/values-dev.yaml \
  -n saytruth-dev
```

**Result:** Access at `http://<SERVER-IP>:30347/`

---

## Ingress Template Features

The Helm template supports:

### 1. IP-based Access (Dev)
```yaml
host: ""  # Empty host = any IP
```

### 2. Domain-based Access (Prod)
```yaml
host: "saytruth.com"
```

### 3. Multiple Paths
```yaml
paths:
  - path: /api
    pathType: Prefix
    serviceName: backend-service
    servicePort: 8000
  - path: /
    pathType: Prefix
    serviceName: frontend-service
    servicePort: 5173
```

### 4. TLS/HTTPS
```yaml
tls:
  - hosts:
      - saytruth.com
    secretName: saytruth-tls
```

### 5. Custom Annotations
```yaml
annotations:
  cert-manager.io/cluster-issuer: letsencrypt-prod
  nginx.ingress.kubernetes.io/rate-limit: "100"
```

---

## Current Status

### Deployed
```bash
$ kubectl get ingress -n saytruth-dev
NAME               CLASS     HOSTS   ADDRESS         PORTS   AGE
saytruth-ingress   traefik   *       192.168.1.130   80      2m
```

### Access
```
http://192.168.1.130/
```

### Helm Release
```bash
$ helm list -n saytruth-dev
NAME    NAMESPACE       REVISION    STATUS      CHART
dev     saytruth-dev    2           deployed    secrecto-1.0.0
```

---

## Advantages of Helm-managed Ingress

### Before (Manual)
```bash
# Create ingress manually
kubectl apply -f ingress.yaml

# Update
kubectl apply -f ingress.yaml

# Delete
kubectl delete -f ingress.yaml

# Deploy to prod
kubectl apply -f ingress-prod.yaml  # Need separate file!
```

### After (Helm)
```bash
# Create with values
helm install dev ./helm/secrecto -f values-dev.yaml

# Update (just upgrade)
helm upgrade dev ./helm/secrecto -f values-dev.yaml

# Delete (removes everything)
helm uninstall dev

# Deploy to prod (same chart, different values!)
helm install prod ./helm/secrecto -f values-prod.yaml
```

✅ **Single source of truth**  
✅ **Version controlled**  
✅ **Easy to switch environments**  
✅ **Consistent with other resources**

---

## Commands

### View Ingress
```bash
kubectl get ingress -n saytruth-dev
kubectl describe ingress -n saytruth-dev saytruth-ingress
```

### Test Access
```bash
# Without port (via Ingress)
curl http://192.168.1.130/

# With port (via NodePort)
curl http://192.168.1.130:30347/
```

### Update Ingress Configuration
```bash
# Edit values-dev.yaml
nano helm/secrecto/values-dev.yaml

# Apply changes
helm upgrade dev ./helm/secrecto -f helm/secrecto/values-dev.yaml -n saytruth-dev
```

### Disable Ingress
```yaml
# In values-dev.yaml
ingress:
  enabled: false
```

---

## Summary

✅ **Ingress is now part of Helm chart**  
✅ **Same structure as Kong, Backend, Frontend, Postgres**  
✅ **Development config: IP-based access (port 80)**  
✅ **Production config: Domain + HTTPS ready**  
✅ **Easy to enable/disable**  
✅ **Managed with single `helm upgrade` command**

Everything is now managed through Helm values files! 🎉
