# DevOps Interview Questions - With Project Context

These are real questions asked in DevOps interviews. I've provided answers using **your SayTruth project** as examples.

---

## 1. Explain Your Architecture

**Question:** "Can you explain the architecture of your current project?"

**Good Answer:**
```
SayTruth uses a microservices architecture deployed on Kubernetes:

Frontend Layer:
- React SPA built with Vite
- Runs on port 5173 (dev) / served through Kong (prod)
- Communicates with backend via REST API

API Gateway Layer:
- Kong in DB-less mode
- Routes /api/* to backend and /* to frontend
- Handles rate limiting, authentication, CORS

Backend Layer:
- FastAPI Python application on port 8000
- Handles business logic, authentication, database queries
- Stateless: can scale horizontally

Database Layer:
- PostgreSQL StatefulSet with persistent storage
- One primary instance (replicas can be added for HA)
- 5Gi storage for dev, 100Gi for prod

Networking:
- Kubernetes Services for internal communication
- Traefik Ingress for external access
- Kong service routes traffic

This architecture allows:
- Independent scaling of each component
- Easy updates without downtime
- High availability potential
- Clear separation of concerns
```

---

## 2. Database Design

**Question:** "How do you design databases for scalability?"

**Good Answer:**
```
In SayTruth, we:

1. Normalization:
   - Users table (normalized): id, email, username, password_hash
   - Separate tables for Messages, Links, Follows (no denormalization)
   - Foreign keys maintain referential integrity
   - No duplicate data

2. Indexing Strategy:
   CREATE INDEX idx_users_email ON users(email);
   - Emails are searched frequently → indexed
   - Foreign keys automatically indexed
   - Primary keys indexed by default

3. Connection Pooling:
   - SQLAlchemy pool_size=10, max_overflow=20
   - Prevents connection exhaustion
   - Reuses connections efficiently

4. Scaling Approach:
   - PostgreSQL StatefulSet (single instance for now)
   - Can add read replicas for scaling reads
   - Sharding not needed yet (data fits on one server)

5. Backup Strategy:
   - Daily automated backups (CronJob)
   - WAL archiving for point-in-time recovery
   - Test restore procedures monthly

6. Monitoring:
   - Query performance tracking
   - Connection pool utilization
   - Storage usage trending
```

---

## 3. Container Security

**Question:** "How do you ensure container security?"

**Good Answer:**
```
For SayTruth backend container:

1. Image Security:
   - Use specific version tags: postgres:15-alpine (not "latest")
   - Alpine Linux base image (smaller attack surface)
   - Scan images: docker scan saytruth-backend
   - Regular updates: docker pull/rebuild

2. Runtime Security:
   - Non-root user in Dockerfile:
     RUN adduser -D appuser
     USER appuser
   - Read-only filesystem where possible
   - Drop unnecessary capabilities

3. Secret Management:
   - Passwords stored in Kubernetes Secrets (not ConfigMaps)
   - Secrets encrypted at rest (etcd encryption)
   - Never commit secrets to Git
   - Rotate passwords monthly

4. Network Security:
   - NetworkPolicies restrict traffic
   - Only backend can access PostgreSQL
   - Kong handles external traffic
   - TLS/HTTPS for external communication

5. Vulnerability Scanning:
   - Use trivy: trivy image saytruth-backend:latest
   - Automated scans in CI/CD
   - Update base images regularly

6. Supply Chain:
   - Use known registries (Docker Hub, ECR)
   - Verify image signatures
   - Track dependency versions
```

---

## 4. Kubernetes StatefulSet vs Deployment

**Question:** "What's the difference between StatefulSet and Deployment? When to use each?"

**Good Answer:**
```
Deployment:
✓ Stateless applications
✓ Pod names change (random suffixes)
✓ Any pod can handle request
✓ Horizontal scaling easy
✓ Use for: Backend, Frontend, Kong

Example: backend-7595df4f7c-ndvd5 (name changes)

StatefulSet:
✓ Stateful applications (databases, caches)
✓ Pod names stable (postgres-0, postgres-1)
✓ Persistent volumes attached to specific pod
✓ Ordered scaling (0→1→2)
✓ Use for: PostgreSQL, MongoDB, Redis

Example: postgres-0 (name is stable)

In SayTruth:
- Backend: Deployment (stateless, scales to 3 instances)
- Frontend: Deployment (static files, served by Kong)
- Kong: Deployment (stateless, routes requests)
- PostgreSQL: StatefulSet (stateful, one primary instance)

Why PostgreSQL is StatefulSet:
- Database data must persist in specific pod
- Pod name postgres-0 consistent across restarts
- PersistentVolume attached to postgres-0
- If pod dies, data restored when new pod takes its identity
```

---

## 5. Horizontal Pod Autoscaling (HPA)

**Question:** "How do you scale applications automatically in Kubernetes?"

**Good Answer:**
```
Horizontal Pod Autoscaling (HPA) automatically creates/removes pods:

Concept:
Monitor CPU/Memory → If high → Create pods → If low → Remove pods

Example for SayTruth Backend:
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70  # Scale up when CPU > 70%
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80

This means:
- Minimum 1 backend pod always running
- If CPU usage goes above 70%, create new pods
- If CPU drops below 70%, remove pods
- Maximum 10 pods total

Scaling Timeline:
0s: Pod 1 at 100% CPU
30s: HPA detects high CPU
60s: New pod created (Pod 2)
90s: Pod 1 and 2 share load, CPU drops to 50%
120s: HPA happy, waits for scale-down

Important Notes:
- Requires Metrics Server in cluster
- HPA checks metrics every 15 seconds
- Scale-up faster than scale-down (prevents thrashing)
- Need to define resource requests:
  resources:
    requests:
      cpu: "100m"
      memory: "128Mi"

Without requests defined:
- HPA cannot calculate percentages
- Autoscaling won't work!
```

---

## 6. Rolling Updates & Blue-Green Deployment

**Question:** "How do you deploy new versions without downtime?"

**Good Answer:**
```
Method 1: Rolling Updates (Default in Kubernetes)

Process:
1. Old: 3 pods (v1)
2. Create 1 new pod (v2) → Now: 3 old, 1 new
3. Delete 1 old pod → Now: 2 old, 1 new
4. Create 1 new pod (v2) → Now: 2 old, 2 new
5. Delete 1 old pod → Now: 1 old, 2 new
6. Create 1 new pod (v2) → Now: 1 old, 3 new
7. Delete 1 old pod → Now: 3 new (v2)

Requests always served: No downtime ✅

Configuration:
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Create 1 extra pod (3+1=4 max)
      maxUnavailable: 0  # Keep all pods available

Benefits:
✓ No downtime
✓ Easy rollback: kubectl rollout undo
✓ Default behavior

Risks:
✗ Running 2 versions temporarily
✗ Database migrations might break


Method 2: Blue-Green Deployment

Setup:
- Blue: Existing v1 (3 pods, receiving traffic)
- Green: New v2 (3 pods, not receiving traffic)

Process:
1. Deploy Green v2 (no traffic)
2. Test Green thoroughly
3. Switch load balancer → all traffic to Green
4. Verify everything works
5. Delete Blue (if needed for rollback)

Benefits:
✓ No overlapping versions
✓ Instant rollback (switch back to Blue)
✓ Full testing before switching
✓ Safe for database migrations

Risks:
✗ Requires 2x resources temporarily
✗ Manual switch required

Implementation (Kong):
Old: service_v1 receives traffic
New: service_v2 deployed (no traffic)

# After testing v2:
curl -X PUT http://kong-admin:8001/services/api/routes/0 \
  -d upstream_url=http://backend-v2:8000

# Now all traffic goes to v2


Method 3: Canary Deployment

Gradual traffic shift:
- 90% traffic to v1
- 10% traffic to v2

Monitor v2 metrics. If good:
- 70% v1, 30% v2
- 50% v1, 50% v2
- 0% v1, 100% v2

Benefits:
✓ Gradual rollout
✓ Easy rollback (stop sending traffic)
✓ Early detection of issues

Risks:
✗ Complex to implement
✗ Need advanced load balancer (Kong Upstream)
```

---

## 7. Monitoring & Observability

**Question:** "How do you monitor production systems?"

**Good Answer:**
```
Three Pillars of Observability:

1. Metrics (Numbers over time)
CPU usage, memory, request count, response time

Tools in SayTruth:
- Kubernetes metrics: kubectl top nodes/pods
- Custom metrics: prometheus-client library

Example Backend Code:
from prometheus_client import Counter, Histogram

request_count = Counter('requests_total', 'Total requests')
request_duration = Histogram('request_duration', 'Request time')

@app.get("/api/users")
def get_users():
    request_count.inc()
    with request_duration.time():
        # Handle request
        pass


2. Logs (Detailed events)
What happened and when

Example Backend Logging:
import logging

logger = logging.getLogger(__name__)

@app.post("/api/auth/login")
def login(credentials):
    logger.info(f"Login attempt: {credentials.email}")
    try:
        user = db.query(User).filter(User.email == credentials.email).first()
        if not user:
            logger.warning(f"Failed login: user not found")
            return {"error": "Invalid credentials"}
        logger.info(f"Login successful: {credentials.email}")
        return {"token": generate_token(user)}
    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
        raise


3. Traces (Request flow through system)
Follow a single request

Example: User creates message
Start (Frontend) → POST /api/messages
         ↓ (Kong routing, 1ms)
     Backend receives
         ↓ (Auth check, 2ms)
     PostgreSQL query
         ↓ (Insert message, 5ms)
     Return response (1ms)
         ↓
Response back to Frontend
Total time: 9ms

Tools:
- Jaeger for distributed tracing
- Trace ID in logs for correlation


Implementation in SayTruth:

# 1. Metrics (Prometheus)
from prometheus_client import start_http_server

# Expose metrics on port 8001
start_http_server(8001)

# Access: http://backend:8001/metrics


# 2. Logs (ELK Stack)
curl http://elasticsearch:9200/_search?q=error

# Or view in real-time:
kubectl logs -n saytruth-dev -l app=backend -f


# 3. Traces (Jaeger)
from jaeger_client import Config

config = Config(
    config={'sampler': {'type': 'const', 'param': 1}},
    service_name='backend'
)
tracer = config.initialize_tracer()

with tracer.start_active_span('create_message') as scope:
    # Your code here
    pass


Common Queries:

Alert when:
- CPU > 80%
- Memory > 90%
- Request latency > 1 second
- Error rate > 1%
- Pod crashes > 3 times

Example Prometheus Alert Rule:
- alert: HighErrorRate
  expr: rate(requests_total{status=~"5.."}[5m]) > 0.01
  for: 5m
  annotations:
    summary: "High error rate detected"
```

---

## 8. ConfigMap vs Secret

**Question:** "When do you use ConfigMap vs Secret?"

**Good Answer:**
```
ConfigMap: Non-sensitive configuration data
Secret: Sensitive data (passwords, tokens)

SayTruth Example:

ConfigMap (backend-configmap):
- DB_HOST: "postgres-service.saytruth-dev.svc.cluster.local"
- DB_PORT: "5432"
- DB_NAME: "saytruth_db"
- DEBUG: "true"
- LOG_LEVEL: "INFO"
- ENVIRONMENT: "development"

Why ConfigMap?
✓ Non-sensitive
✓ Can be viewed, okay if exposed
✓ Shared by multiple pods
✓ Easy to change without image rebuild

Secret (backend-secret):
- DB_USER: "saytruth_user"
- DB_PASSWORD: "DevSecurePass123!@#"
- JWT_SECRET: "Z6BkzaWcF7r5cC-VMAumjpBpudSyjGskQ0ObquGJhG0="
- ENCRYPTION_KEY: "Vv3oE5-p_z1rM3DqK_u_M-7yY_X8z3R_L_k9wB-nS8E="

Why Secret?
✗ Sensitive data
✗ Must be encrypted at rest
✗ Restricted access
✗ Never committed to Git

Best Practice Rules:

❌ WRONG:
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  DATABASE_URL: "postgresql://user:password@host:5432/db"
  # PASSWORD EXPOSED!

✅ CORRECT:
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "saytruth_db"

---

apiVersion: v1
kind: Secret
metadata:
  name: app-secret
type: Opaque
stringData:
  DB_USER: "user"
  DB_PASSWORD: "password"  # ENCRYPTED!


Usage in Pod:
containers:
- name: backend
  envFrom:
  - configMapRef:
      name: app-config      # Load ConfigMap
  - secretRef:
      name: app-secret      # Load Secret

Both become environment variables:
- $DB_HOST (from ConfigMap)
- $DB_PASSWORD (from Secret)


Security Notes:

1. By default Secrets stored unencrypted!
   Fix: Enable encryption
   apiVersion: apiserver.config.k8s.io/v1
   kind: EncryptionConfiguration
   resources:
   - resources:
     - secrets
     providers:
     - aescbc:
         keys:
         - name: key1
           secret: <64-character-base64-key>

2. RBAC restrict access:
   - Who can view Secrets?
   - Only backend pods should access db password

3. Rotate secrets regularly:
   - Change DB password monthly
   - Update Kubernetes Secret
   - Restart pods

4. Audit access:
   - Log who accessed which Secrets
   - Alert on unusual access
```

---

## 9. Troubleshooting: Pod not starting

**Question:** "Your pod is in CrashLoopBackOff. How do you debug?"

**Good Answer:**
```
CrashLoopBackOff means:
Pod starts → Application exits → Kubernetes restarts → Repeat

Debugging Process:

Step 1: Check Pod Status
kubectl describe pod -n saytruth-dev backend-7595df4f7c-ndvd5

Look for:
- Events section (what happened)
- Last State: Reason (why did it crash)
- Container logs (if available)


Step 2: View Logs
kubectl logs -n saytruth-dev backend-7595df4f7c-ndvd5

# Example output:
# Traceback (most recent call last):
#   File "app/main.py", line 5, in <module>
#     from app.db.database import engine
# ModuleNotFoundError: No module named 'app'
# → Missing dependencies!

# Another example:
# could not translate host name "postgres-service" to address
# → DNS resolution failure


Step 3: Get Previous Logs (if pod restarted)
kubectl logs -n saytruth-dev backend-7595df4f7c-ndvd5 --previous

# Shows logs from previous container instance


Step 4: Check Environment Variables
kubectl exec -n saytruth-dev backend-7595df4f7c-ndvd5 -- env

Look for:
- DB_HOST: "postgres-service.saytruth-dev.svc.cluster.local"
- DB_USER: "saytruth_user"
- DB_PASSWORD: "DevSecurePass123!@#"

If missing → ConfigMap/Secret not loaded


Step 5: Test Connectivity
# Can pod reach database?
kubectl exec -n saytruth-dev backend-7595df4f7c-ndvd5 -- \
  python3 -c "
import socket
s = socket.socket()
result = s.connect_ex(('postgres-service', 5432))
print('Connected' if result == 0 else f'Failed: {result}')
"


Common Causes & Solutions:

1. IMAGE PULL ERROR
Error: ImagePullBackOff
Cause: Image not found in registry
Solution:
- Check image name: docker images | grep saytruth
- Check imagePullPolicy: should be Never (local)
- Import image: docker save img.tar && ctr import img.tar

2. MISSING DEPENDENCIES
Error: ModuleNotFoundError: No module named 'psycopg2'
Cause: requirements.txt not installed
Solution:
- Add to requirements.txt: psycopg2-binary==2.9.9
- Rebuild Docker image
- Redeploy

3. DATABASE CONNECTION FAILURE
Error: could not translate host name
Cause: PostgreSQL not reachable
Solution:
- Check PostgreSQL pod running: kubectl get pods | grep postgres
- Check network policy allows access
- Check DNS: kubectl run -it --image=busybox sh
  # nslookup postgres-service

4. ENVIRONMENT VARIABLES NOT SET
Error: KeyError: DB_PASSWORD
Cause: Secret not mounted
Solution:
- Check Secret exists: kubectl get secrets
- Check ConfigMap referenced correctly
- Check Pod envFrom section

5. OUT OF MEMORY
Error: OOMKilled
Cause: Pod memory limit too low
Solution:
- Increase limit in deployment:
  resources:
    limits:
      memory: "512Mi"  # Was 256Mi
- Restart pod


Complete Debugging Flow:

kubectl describe pod <pod> ← See events
    ↓
kubectl logs <pod> ← See crash reason
    ↓
kubectl logs <pod> --previous ← If restarted
    ↓
kubectl exec <pod> -- env ← Check environment
    ↓
kubectl exec <pod> -- /bin/sh ← Interactive shell
    ↓
Test manually (curl, python, etc.)


Prevention:

1. Test locally first:
   docker run -it saytruth-backend:latest

2. Use livenessProbe to catch issues:
   livenessProbe:
     httpGet:
       path: /health
       port: 8000
     initialDelaySeconds: 20

3. Use initContainers to check prerequisites:
   initContainers:
   - name: wait-for-db
     image: busybox
     command: ['sh', '-c', 'until nslookup postgres-service; do sleep 1; done']

4. Monitor events:
   kubectl get events -n saytruth-dev --sort-by='.lastTimestamp'
```

---

## 10. Infrastructure as Code (IaC)

**Question:** "Why is Infrastructure as Code important?"

**Good Answer:**
```
IaC means: Define infrastructure in code files (usually YAML)

Benefits:

1. Version Control
✓ Track changes: git log k3s/backend/deployment.yaml
✓ Review changes: git diff before merging
✓ Rollback: git checkout previous version
✓ Audit trail: Who changed what and when

2. Reproducibility
✓ Same infrastructure everywhere
✓ dev, staging, prod all identical
✓ New team member: git clone → helm deploy
✓ Disaster recovery: Redeploy from Git

3. Automation
✓ No manual clicking UI
✓ Deploy with one command: helm install
✓ CI/CD pipeline: auto-deploy on merge
✓ Consistent: No human error

4. Documentation
✓ Code is documentation
✓ Running 3 backend pods? See in deployment.yaml
✓ Database size? See in postgres-pvc.yaml
✓ Rate limit policy? See in kong-configmap.yaml

SayTruth Example:

Git Repository:
backend/
frontend/
k3s/
  ├── namespaces/
  ├── backend/
  │   ├── deployment.yaml
  │   ├── service.yaml
  │   ├── configmap.yaml
  │   └── secret.yaml
  ├── postgres/
  └── kong/

Workflow:
1. Developer changes code
2. Developer updates k3s/backend/deployment.yaml (new image version)
3. Commit: git add k3s/backend/deployment.yaml
4. PR review: teammate reviews YAML changes
5. Merge to main
6. CI/CD pipeline:
   - Runs tests
   - Builds Docker image
   - Pushes to registry
   - Applies kubectl with new YAML
   - Verifies deployment

Result: Automated, audited, reproducible deployment!


Best Practices:

1. Store EVERYTHING in Git
- K8s manifests ✓
- Helm values ✓
- Docker Compose files ✓
- Documentation ✓
- Scripts ✓

Don't store in Git:
- Secrets (use external vault)
- Build artifacts (use registry)
- Large files (use Git LFS)

2. Use templating (Helm, Kustomize)
- Avoid copy-paste of YAML
- Generate env-specific configs
- Reduce errors

3. Implement GitOps
- Git as single source of truth
- Changes to Git → auto-deployed
- Tools: ArgoCD, Flux

4. Code Review Infrastructure
- All infrastructure changes via PR
- At least 2 approvals before merge
- Changes tracked in commit history

5. Test infrastructure
apiVersion: v1
kind: Pod
metadata:
  name: backend-test
spec:
  containers:
  - name: test
    image: saytruth-backend:test
    command: ["pytest", "tests/"]

6. Monitoring infrastructure
- Alert on deployment failures
- Track deployment frequency
- Measure time-to-production
- Monitor rollback rate


Comparison: Manual vs IaC

Manual Deployment:
1. SSH into server
2. Run docker pull
3. Run docker run
4. Configure networking
5. Setup load balancer
6. Wait 30 mins
7. Hope you didn't forget anything
8. Can't audit changes
9. Can't reproduce

IaC Deployment:
1. Make YAML changes
2. Git push
3. CI/CD runs automatically
4. 5 minutes later: deployed
5. All changes tracked
6. Can reproduce 100% of the time
7. Easy rollback


This is why DevOps teams use IaC for everything!
```

---

## 11. Kubernetes Resource Quotas & Limits

**Question:** "How do you prevent one team from consuming all cluster resources?"

**Good Answer:**
```
ResourceQuota: Limit total resources per namespace
LimitRange: Limit per-pod resources

SayTruth Example:

Scenario:
- Multiple teams share one K3s cluster
- Team-backend (SayTruth) shouldn't use all CPU
- Team-frontend (mobile app) shouldn't run out of resources

Solution 1: ResourceQuota per namespace

apiVersion: v1
kind: Namespace
metadata:
  name: saytruth-dev
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: saytruth-dev-quota
  namespace: saytruth-dev
spec:
  hard:
    requests.cpu: "2"           # Max 2 CPU cores total
    requests.memory: "4Gi"      # Max 4Gi memory total
    limits.cpu: "4"             # Max 4 CPU total
    limits.memory: "8Gi"        # Max 8Gi memory total
    pods: "20"                  # Max 20 pods
    services: "10"
    persistentvolumeclaims: "5"

This means:
- All pods in saytruth-dev combined
- Cannot exceed 2 CPU (requests)
- Cannot exceed 4Gi memory (requests)
- Cannot exceed 20 pods

Check usage:
kubectl describe quota -n saytruth-dev
# ResourceQuota
# Resource          Requests        Limits
# --------          ---------        ------
# cpu               550m (28%)       500m (13%)
# memory            512Mi (13%)      2Gi (26%)
# pods              4 (20%)          -


Solution 2: LimitRange per pod

apiVersion: v1
kind: LimitRange
metadata:
  name: saytruth-limits
  namespace: saytruth-dev
spec:
  limits:
  - max:
      cpu: "1"
      memory: "1Gi"
    min:
      cpu: "50m"
      memory: "64Mi"
    default:
      cpu: "500m"
      memory: "256Mi"
    defaultRequest:
      cpu: "100m"
      memory: "128Mi"
    type: Container

This means:
- Each container must request 50m-1000m CPU
- Each container must request 64Mi-1Gi memory
- If not specified: default 500m CPU, 256Mi memory


SayTruth Deployment with ResourceQuota:

apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: saytruth-dev
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend
        image: saytruth-backend:latest
        resources:
          requests:        # Guaranteed allocation
            cpu: "100m"    # 0.1 cores
            memory: "128Mi"
          limits:          # Maximum can use
            cpu: "500m"    # 0.5 cores
            memory: "512Mi"

With ResourceQuota: saytruth-dev-quota
- Max 2 CPU (requests)
- 3 pods × 100m = 300m CPU requested ✓ (under 2000m limit)
- 3 pods × 128Mi = 384Mi memory ✓ (under 4Gi limit)

If backend tries to add 10 more replicas:
- 13 pods × 100m = 1.3 CPU requested ✓ Still ok
- 13 pods × 128Mi = 1.664Gi ✓ Still ok

If tries 20 pods:
- 20 pods × 100m = 2 CPU (equals limit) ✓ At limit
- Next pod creation: REJECTED (quota exceeded)


Monitoring Quotas:

kubectl get resourcequota -n saytruth-dev
NAME                   AGE       REQUEST LIMITS
saytruth-dev-quota     10d       requests.cpu: 300m/2, limits.cpu: 500m/4

If seeing 500m/4 limits:
- Backend using 500m of 4000m limit (12.5%)
- Still room to scale


Best Practices:

1. Set ResourceQuota per environment
- dev: 2 CPU, 4Gi memory
- staging: 4 CPU, 8Gi memory
- prod: 16 CPU, 64Gi memory

2. Set LimitRange for safety
- Prevents runaway pods
- Ensures fair distribution

3. Monitor and adjust
- Watch actual usage over time
- Adjust quotas based on demand
- Test scaling scenarios

4. Use PriorityClasses
- Mark critical pods as high priority
- Low priority pods evicted first if needed

Example:
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000
globalDefault: false
description: "Critical backend services"

---

# Use in pod:
priorityClassName: high-priority

Benefits:
- If node runs out of resources
- Backend (high priority) keeps running
- Non-critical tasks get evicted
```

---

## 12. Final Advice

**Question:** "What's the most important thing to know about DevOps?"

**Great Answer:**
```
The most important principle:

"Infrastructure is Code"

This means:
1. Everything is version controlled
2. Everything is reproducible
3. Everything is automated
4. Everything is documented
5. Everyone can review changes

Practice:
- Write YAML instead of clicking UI
- Use Git for everything
- Automate repetitive tasks
- Test before production
- Learn from failures (post-mortems)

Start with simple setups:
✓ Docker Compose locally
✓ Single Kubernetes cluster
✓ Manual deployments with Helm
✓ Add monitoring later
✓ Add autoscaling when needed

Avoid common mistakes:
✗ Storing secrets in Git
✗ Manual deployments
✗ No version control for infrastructure
✗ No testing before production
✗ Ignoring logs and monitoring
✗ Skipping documentation

Your SayTruth project covers:
✓ Containerization (Docker)
✓ Orchestration (K3s)
✓ Configuration Management (ConfigMaps, Secrets, Helm)
✓ Networking (Kong, Kubernetes Services)
✓ Storage (PersistentVolumes, PostgreSQL)
✓ Monitoring (Logging, Health Checks)

This gives you solid foundation for:
- DevOps engineer roles
- SRE positions
- Cloud architect opportunities

Keep learning:
- Docker: Advanced image optimization
- Kubernetes: RBAC, NetworkPolicies, CRDs
- Observability: Prometheus, Grafana, ELK
- IaC: Terraform, Pulumi
- GitOps: ArgoCD, Flux
```

---

## Practice Questions

Try answering these on your own:

1. "Explain your deployment process"
2. "How do you handle database migrations in K8s?"
3. "What's your disaster recovery plan?"
4. "How do you secure your Kubernetes cluster?"
5. "Describe your monitoring strategy"
6. "How do you troubleshoot network issues in K8s?"
7. "What are the tradeoffs between StatefulSet and Deployment?"
8. "How do you implement high availability?"
9. "Explain your CI/CD pipeline"
10. "What's your rollback strategy if deployment fails?"

---

Good luck with your interviews! 🚀
