# PostgreSQL Database - Architecture & Setup

## What is PostgreSQL?

PostgreSQL is an **open-source relational database** that stores structured data in tables with relationships between them.

```
Database (saytruth_db)
├── Table: users
│   ├── id (Primary Key)
│   ├── email (Unique)
│   ├── username
│   ├── hashed_password
│   └── created_at
├── Table: messages
│   ├── id (Primary Key)
│   ├── user_id (Foreign Key → users.id)
│   ├── content
│   └── created_at
├── Table: links
│   ├── id (Primary Key)
│   ├── user_id (Foreign Key → users.id)
│   ├── url
│   └── visibility (public/private)
└── Table: follows
    ├── follower_id (Foreign Key → users.id)
    └── following_id (Foreign Key → users.id)
```

---

## Why PostgreSQL?

| Feature | SQLite | PostgreSQL |
|---------|--------|-----------|
| Multi-user | ❌ | ✅ |
| Concurrent requests | ❌ | ✅ |
| Scalability | Small | Enterprise |
| Transactions | Basic | Advanced (ACID) |
| Data types | Limited | Rich |
| Triggers/Functions | Limited | Full support |
| Production-ready | No | Yes |
| Container friendly | ⚠️ | ✅ |

**Our Project:** Started with SQLite (dev only), now using PostgreSQL (dev + prod ready)

---

## Key PostgreSQL Concepts

### 1. **Tables**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,           -- Auto-incrementing ID
  email VARCHAR(255) UNIQUE,       -- Cannot have duplicates
  username VARCHAR(255),
  hashed_password VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. **Primary Key**
- Unique identifier for each row
- Cannot be NULL
- Used for lookups and relationships

```sql
-- Find user by primary key
SELECT * FROM users WHERE id = 1;
```

### 3. **Foreign Key**
Links rows in one table to another table:

```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),  -- Foreign Key
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**What it means:**
- Every message must belong to an existing user
- Cannot create message with non-existent user_id
- Prevents orphaned records

### 4. **Indexes**
Speed up queries by creating lookup structures:

```sql
CREATE INDEX idx_users_email ON users(email);
-- Now searching by email is fast:
SELECT * FROM users WHERE email = 'user@example.com';
```

### 5. **ACID Transactions**
Ensures data consistency:

```sql
BEGIN;                    -- Start transaction
UPDATE users SET balance = balance - 100 WHERE id = 1;
UPDATE users SET balance = balance + 100 WHERE id = 2;
COMMIT;                   -- Save all or nothing
-- If error: ROLLBACK (undo changes)
```

---

## PostgreSQL in Kubernetes

### StatefulSet Deployment

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres-service
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        - name: POSTGRES_DB
          value: "saytruth_db"
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
```

**Why StatefulSet (not Deployment)?**
- **StatefulSet**: Pod names stay same (postgres-0, postgres-1)
- **StatefulSet**: Persistent volume attached to same pod
- **Deployment**: Pod names change, volume gets lost
- **Database needs**: Stable pod name + persistent storage

---

## Persistence: PersistentVolumeClaim (PVC)

### What is PVC?

```
Pod needs storage → Claims PVC → Storage provisioned
┌──────────────┐
│  postgres-0  │
│   Pod        │
└──────┬───────┘
       │
       ↓ volumeMounts
┌──────────────────────────────────────┐
│  PersistentVolumeClaim (10Gi)        │
│  mountPath: /var/lib/postgresql/data │
└──────┬───────────────────────────────┘
       │
       ↓ backed by
┌──────────────────────────────────────┐
│  PersistentVolume (Actual Storage)   │
│  Host disk: /mnt/lv1/data/           │
└──────────────────────────────────────┘
```

### Why Persistence?

```
Without PVC:
Pod dies → Container restarted → Data LOST ❌

With PVC:
Pod dies → Container restarted → PVC still attached → Data SAVED ✅
```

### Development PVC

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc-dev
  namespace: saytruth-dev
spec:
  accessModes:
    - ReadWriteOnce     # Only one pod can access at a time
  resources:
    requests:
      storage: 5Gi      # Small for development
  storageClassName: local-path
```

### Production PVC

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc-prod
  namespace: saytruth-prod
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi    # Large for production data
  storageClassName: local-path
```

---

## Database Initialization

### init_db.py (Backend)

```python
from sqlalchemy.orm import declarative_base
from app.models import User, Message, Link, Follow

Base = declarative_base()

def init_db():
    # Creates all tables defined in models
    Base.metadata.create_all(bind=engine)
```

**What happens:**
1. Backend starts
2. `init_db()` called in `main.py`
3. SQLAlchemy generates SQL CREATE TABLE statements
4. Executes against PostgreSQL
5. Tables created (if not exist)

**SQL Generated:**
```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR UNIQUE,
  username VARCHAR,
  hashed_password VARCHAR,
  created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  content TEXT,
  created_at TIMESTAMP
);
```

---

## Connection String

```
postgresql://user:password@host:port/database
  │                │      │         │    │
  │                │      │         │    └─ database name
  │                │      │         └────── port (default 5432)
  │                │      └──────────────── hostname/IP
  │                └────────────────────── password
  └─────────────────────────────────────── username
```

### Example URLs

**Local development:**
```
postgresql://postgres:password@localhost:5432/saytruth_db
```

**In Kubernetes (dev):**
```
postgresql://saytruth_user:DevSecurePass123!@#@postgres-service.saytruth-dev.svc.cluster.local:5432/saytruth_db
```

**In Kubernetes (prod):**
```
postgresql://saytruth_user:ProdSecurePass456!@#@postgres-service.saytruth-prod.svc.cluster.local:5432/saytruth_db
```

---

## Accessing PostgreSQL

### 1. From Backend Pod
```bash
# Backend connects using:
# postgresql://saytruth_user:DevSecurePass123!@#@postgres-service:5432/saytruth_db
# (automatic via environment variables)
```

### 2. From kubectl

```bash
# Port-forward PostgreSQL to local machine
kubectl port-forward -n saytruth-dev svc/postgres-service 5432:5432 &

# Connect with psql (local PostgreSQL client)
psql -h localhost -U saytruth_user -d saytruth_db
```

### 3. Inside Postgres Pod

```bash
kubectl exec -it -n saytruth-dev postgres-0 -- psql -U saytruth_user -d saytruth_db

# Inside psql:
\dt                          # List tables
SELECT * FROM users;         # View users
SELECT * FROM messages;      # View messages
\q                          # Quit
```

---

## Common SQL Queries

### Users Table
```sql
-- Create user
INSERT INTO users (email, username, hashed_password) 
VALUES ('user@example.com', 'johndoe', 'hash...');

-- Get user by email
SELECT * FROM users WHERE email = 'user@example.com';

-- Update username
UPDATE users SET username = 'newname' WHERE id = 1;

-- Delete user
DELETE FROM users WHERE id = 1;
```

### Messages Table
```sql
-- Create message
INSERT INTO messages (user_id, content) 
VALUES (1, 'Hello, SayTruth!');

-- Get user's messages
SELECT * FROM messages WHERE user_id = 1 ORDER BY created_at DESC;

-- Get recent messages
SELECT m.*, u.username FROM messages m
JOIN users u ON m.user_id = u.id
ORDER BY m.created_at DESC
LIMIT 10;
```

### With Relationships
```sql
-- Get user and their messages
SELECT u.username, m.content, m.created_at
FROM users u
LEFT JOIN messages m ON u.id = m.user_id
WHERE u.id = 1;

-- Count messages per user
SELECT u.username, COUNT(m.id) as message_count
FROM users u
LEFT JOIN messages m ON u.id = m.user_id
GROUP BY u.username;
```

---

## Backup & Restore

### Backup Database
```bash
# Create backup
pg_dump -h localhost -U saytruth_user saytruth_db > backup.sql

# Compressed backup
pg_dump -h localhost -U saytruth_user saytruth_db | gzip > backup.sql.gz
```

### Restore Database
```bash
# From SQL file
psql -h localhost -U saytruth_user saytruth_db < backup.sql

# From compressed
gunzip -c backup.sql.gz | psql -h localhost -U saytruth_user saytruth_db
```

### Automated Backup (K8s CronJob)
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15-alpine
            command:
            - /bin/sh
            - -c
            - |
              pg_dump -h postgres-service -U saytruth_user saytruth_db \
              | gzip > /backups/backup-$(date +%Y%m%d).sql.gz
            volumeMounts:
            - name: backups
              mountPath: /backups
          volumes:
          - name: backups
            persistentVolumeClaim:
              claimName: backup-pvc
```

---

## Performance & Monitoring

### Query Optimization

```sql
-- Slow (without index)
SELECT * FROM messages WHERE content LIKE '%hello%';

-- Fast (with index)
CREATE INDEX idx_messages_content ON messages USING gin(to_tsvector('english', content));

-- Find slow queries
SELECT query, calls, mean_time FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;
```

### Connection Pooling

In Kubernetes, Pod handles own connections:
```python
# Each pod has max_overflow connections
engine = create_engine(
    DATABASE_URL,
    pool_size=10,        # Connections in pool
    max_overflow=20,     # Additional connections if needed
    pool_pre_ping=True   # Test connection before use
)
```

### Monitoring

```bash
# Check database size
SELECT pg_size_pretty(pg_database_size('saytruth_db'));

# Active connections
SELECT * FROM pg_stat_activity;

# Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname != 'pg_catalog' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Security Best Practices

### 1. **Strong Passwords**
```yaml
# In Kubernetes Secret
DB_PASSWORD: "ProdSecurePass456!@#"  # Strong: 20+ chars, mixed case, numbers, symbols
```

### 2. **Connection Limits**
```sql
ALTER USER saytruth_user CONNECTION LIMIT 50;
```

### 3. **Encryption at Rest**
```yaml
# Use encrypted storage class
storageClassName: encrypted-storage
```

### 4. **Network Policies**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-access
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - protocol: TCP
      port: 5432
```

---

## Next Steps for Learning

1. **Install PostgreSQL locally**: https://www.postgresql.org/download/
2. **Learn SQL fundamentals**: JOINs, indexes, transactions
3. **Understand database normalization**: 1NF, 2NF, 3NF
4. **Study replication**: Master-slave setup for high availability
5. **Learn monitoring**: Use pgAdmin for visual management
