# Helm - Package Manager for Kubernetes

## What is Helm?

Helm is the **package manager for Kubernetes** - similar to `npm` for Node.js or `pip` for Python.

```
What Helm solves:
❌ Without Helm:
   - 30+ YAML files to manage manually
   - Copy-paste errors
   - Hard to maintain different configurations (dev/prod)
   - Difficult to share applications
   - Version control nightmare

✅ With Helm:
   - Single `Chart.yaml` package
   - Templated values (reusable)
   - Environment-specific `values.yaml`
   - One command deploy: helm install
   - Easy rollback: helm rollback
```

---

## Helm Architecture

```
┌──────────────────────────────┐
│      Helm Chart              │
│  (Package with templates)    │
├──────────────────────────────┤
│  Chart.yaml                  │
│  values.yaml                 │
│  values-dev.yaml             │
│  values-prod.yaml            │
│  templates/                  │
│    ├── backend-deployment    │
│    ├── backend-service       │
│    ├── backend-configmap     │
│    ├── frontend-deployment   │
│    ├── kong-deployment       │
│    └── postgres-statefulset  │
└──────────────────────────────┘
         │
         │ helm install -f values-dev.yaml
         ↓
┌──────────────────────────────┐
│  Rendered Kubernetes YAMLs   │
│  (Templated with values)     │
├──────────────────────────────┤
│  backend-deployment.yaml     │
│  backend-service.yaml        │
│  backend-configmap.yaml      │
│  frontend-deployment.yaml    │
│  kong-deployment.yaml        │
│  postgres-statefulset.yaml   │
└──────────────────────────────┘
         │
         │ Apply to cluster
         ↓
    Kubernetes Resources
    (Deployed!)
```

---

## Key Helm Concepts

### 1. **Chart**
A package containing Kubernetes manifests:

```
secrecto-chart/
├── Chart.yaml                 # Chart metadata
├── values.yaml               # Default values
├── values-dev.yaml           # Dev environment
├── values-prod.yaml          # Production environment
└── templates/                # K8s manifest templates
    ├── backend-deployment.yaml
    ├── backend-service.yaml
    ├── frontend-deployment.yaml
    ├── kong-deployment.yaml
    └── postgres-statefulset.yaml
```

### 2. **Template**
YAML file with placeholders:

```yaml
# templates/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Values.backend.name }}
  namespace: {{ .Values.namespace }}
spec:
  replicas: {{ .Values.backend.replicas }}
  template:
    spec:
      containers:
      - name: backend
        image: {{ .Values.backend.image }}:{{ .Values.backend.tag }}
        ports:
        - containerPort: {{ .Values.backend.port }}
        resources:
          requests:
            memory: {{ .Values.backend.resources.requests.memory }}
```

**Syntax:**
- `{{ .Values.backend.name }}` - Replace with value from values.yaml
- `{{ .Values.namespace }}` - Environment-specific value

### 3. **Values**
Configuration for templates:

```yaml
# values.yaml (default)
namespace: default
replicas: 1

backend:
  name: backend
  image: saytruth-backend
  tag: latest
  port: 8000
  resources:
    requests:
      memory: "128Mi"
      cpu: "50m"
    limits:
      memory: "512Mi"
      cpu: "500m"

frontend:
  name: frontend
  image: saytruth-frontend
  tag: latest
  port: 5173
```

```yaml
# values-dev.yaml (override for dev)
namespace: saytruth-dev
replicas: 1

backend:
  image: saytruth-backend
  tag: dev
  
frontend:
  image: saytruth-frontend
  tag: dev
```

```yaml
# values-prod.yaml (override for prod)
namespace: saytruth-prod
replicas: 3  # High availability

backend:
  image: saytruth-backend
  tag: v1.0.0  # Specific version
  resources:
    requests:
      memory: "512Mi"
      cpu: "200m"
    limits:
      memory: "2Gi"
      cpu: "1000m"
```

---

## Helm Commands

### Install (Deploy)
```bash
# Install with default values
helm install secrecto ./helm/secrecto

# Install with dev environment
helm install secrecto-dev ./helm/secrecto -f values-dev.yaml -n saytruth-dev

# Install with production environment
helm install secrecto-prod ./helm/secrecto -f values-prod.yaml -n saytruth-prod
```

### Update (Modify)
```bash
# Update to new values
helm upgrade secrecto-dev ./helm/secrecto -f values-dev.yaml -n saytruth-dev

# Dry-run (see what would change)
helm upgrade secrecto-dev ./helm/secrecto -f values-dev.yaml --dry-run
```

### Rollback
```bash
# See history
helm history secrecto-dev -n saytruth-dev

# Rollback to previous version
helm rollback secrecto-dev 1 -n saytruth-dev  # revision 1
```

### Uninstall
```bash
# Remove all resources
helm uninstall secrecto-dev -n saytruth-dev
```

### Debugging
```bash
# See generated YAML (dry-run)
helm template secrecto ./helm/secrecto -f values-dev.yaml

# Check what will be deployed
helm install secrecto ./helm/secrecto --dry-run --debug

# List releases
helm list -n saytruth-dev

# Get values
helm get values secrecto-dev -n saytruth-dev
```

---

## Migration from Manual YAML to Helm

### Before (Manual)
```bash
# Deploy manually, each file separately
kubectl apply -f k3s/namespaces/dev-namespace.yaml
kubectl apply -f k3s/postgres/postgres-secret.yaml
kubectl apply -f k3s/postgres/postgres-pvc.yaml
kubectl apply -f k3s/postgres/postgres-service.yaml
kubectl apply -f k3s/postgres/postgres-statefulset.yaml
kubectl apply -f k3s/backend/backend-configmap.yaml
kubectl apply -f k3s/backend/backend-secret.yaml
kubectl apply -f k3s/backend/backend-service.yaml
kubectl apply -f k3s/backend/backend-deployment.yaml
# ... 20+ more files
```

### After (Helm)
```bash
# Deploy everything with one command
helm install secrecto-dev ./helm/secrecto -f values-dev.yaml
```

### Why Helm?
✅ One command  
✅ Reproducible  
✅ Environment-specific configs  
✅ Easy rollback  
✅ Version control friendly  

---

## Chart Structure

### Chart.yaml
```yaml
apiVersion: v2
name: secrecto
description: SayTruth API Platform
type: application
version: 1.0.0          # Chart version
appVersion: "1.0.0"     # App version
maintainers:
  - name: Your Name
    email: you@example.com
```

### Directory Structure
```
secrecto/
├── Chart.yaml                           # Metadata
├── values.yaml                          # Default values
├── values-dev.yaml                      # Dev overrides
├── values-prod.yaml                     # Prod overrides
├── templates/
│   ├── NOTES.txt                        # Post-install message
│   ├── _helpers.tpl                     # Shared template functions
│   ├── backend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── secret.yaml
│   ├── frontend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   ├── kong/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── ingress.yaml
│   ├── postgres/
│   │   ├── statefulset.yaml
│   │   ├── service.yaml
│   │   ├── pvc.yaml
│   │   └── secret.yaml
│   └── namespaces/
│       └── namespace.yaml
└── README.md
```

---

## Template Helpers (_helpers.tpl)

Reusable functions to avoid duplication:

```yaml
{{- define "secrecto.labels" -}}
app.kubernetes.io/name: secrecto
app.kubernetes.io/version: {{ .Chart.AppVersion }}
{{- end }}

{{- define "secrecto.commonLabels" }}
{{ include "secrecto.labels" . }}
app.kubernetes.io/managed-by: Helm
{{- end }}
```

Usage in templates:
```yaml
metadata:
  labels:
    {{- include "secrecto.commonLabels" . | nindent 4 }}
```

---

## Conditional Values (if/else)

```yaml
# templates/backend-deployment.yaml
spec:
  replicas: {{ .Values.backend.replicas }}
  template:
    spec:
      containers:
      - name: backend
        image: {{ .Values.backend.image }}:{{ .Values.backend.tag }}
        {{- if .Values.backend.resources }}
        resources:
          {{- toYaml .Values.backend.resources | nindent 10 }}
        {{- end }}
        {{- if .Values.backend.env }}
        env:
          {{- toYaml .Values.backend.env | nindent 10 }}
        {{- end }}
```

**If statement:**
- `{{ if condition }}` - Include if true
- `{{ else }}` - Alternative
- `{{ end }}` - Close block

---

## Loops (Range)

```yaml
# templates/backend-deployment.yaml
ports:
{{- range .Values.backend.ports }}
- containerPort: {{ . }}
{{- end }}
```

**values.yaml:**
```yaml
backend:
  ports:
    - 8000
    - 8001
```

**Result:**
```yaml
ports:
- containerPort: 8000
- containerPort: 8001
```

---

## Helm Best Practices

### 1. **Use Semantic Versioning**
```yaml
# Chart.yaml
version: 1.0.0  # MAJOR.MINOR.PATCH
```

### 2. **Provide Defaults**
```yaml
# values.yaml - Always include sensible defaults
replicas: 1
```

### 3. **Document Values**
```yaml
# values.yaml
# Number of replicas for the backend
# Options: 1 (dev), 3 (prod)
replicas: 1
```

### 4. **Use Namespaces**
```yaml
# Separate dev and prod
helm install -n saytruth-dev
helm install -n saytruth-prod
```

### 5. **Version Control**
```bash
# Store Helm charts in Git
git add helm/
git commit -m "Update Helm chart to v1.0.0"
git tag helm-v1.0.0
```

---

## Helm vs Other Tools

| Tool | Purpose | Complexity | Learning |
|------|---------|-----------|----------|
| Helm | Package manager | Medium | Moderate |
| Kustomize | Template customization | Low | Easy |
| Operators | App management | High | Hard |
| Terraform | Infrastructure | High | Hard |
| Docker Compose | Local development | Low | Easy |

---

## Deployment Workflow

### 1. Development
```bash
# Test locally
helm template secrecto ./helm/secrecto -f values-dev.yaml

# Deploy to dev cluster
helm install secrecto-dev ./helm/secrecto -f values-dev.yaml -n saytruth-dev
```

### 2. Testing
```bash
# Check pods running
kubectl get pods -n saytruth-dev

# Test API
kubectl exec -n saytruth-dev deployment/backend -- curl http://localhost:8000/health
```

### 3. Production
```bash
# Deploy to prod cluster
helm install secrecto-prod ./helm/secrecto -f values-prod.yaml -n saytruth-prod

# Verify
helm get values secrecto-prod -n saytruth-prod
```

### 4. Update
```bash
# Change value, update chart
helm upgrade secrecto-prod ./helm/secrecto -f values-prod.yaml -n saytruth-prod
```

---

## Common Helm Patterns

### Pattern 1: Feature Flags
```yaml
# values-prod.yaml
features:
  rateLimiting: true
  caching: true
  authentication: true
```

```yaml
# templates/backend-deployment.yaml
{{- if .Values.features.rateLimiting }}
- name: RATE_LIMITING_ENABLED
  value: "true"
{{- end }}
```

### Pattern 2: Multi-environment
```bash
helm install env1 ./chart -f values-dev.yaml
helm install env2 ./chart -f values-staging.yaml
helm install env3 ./chart -f values-prod.yaml
```

### Pattern 3: Release Names
```bash
helm install release-name ./chart
helm get manifest release-name    # See what was deployed
helm history release-name          # See change history
```

---

## Helm Security

### 1. **Verify Chart Signature**
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo verify bitnami
```

### 2. **Scan for Vulnerabilities**
```bash
# Use tools like trivy
trivy helm ./helm/secrecto
```

### 3. **Secrets Management**
```yaml
# DON'T put secrets in values.yaml
# Instead use Kubernetes Secrets or external vault

# values.yaml
postgresql:
  existingSecret: postgres-credentials
  secretKey: password
```

---

## Next Steps

1. Create `helm/secrecto/` directory structure
2. Convert YAML files to Helm templates
3. Create `values-dev.yaml` and `values-prod.yaml`
4. Test: `helm template secrecto ./helm/secrecto -f values-dev.yaml`
5. Deploy: `helm install secrecto-dev ./helm/secrecto -f values-dev.yaml -n saytruth-dev`
6. Learn: Study Helm documentation for advanced features
