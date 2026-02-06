# Quick Reference - Local Development Setup

Fast start guide to run SayTruth locally without Kubernetes.

---

## ⚡ 30-Second Start

```bash
# Terminal 1: PostgreSQL
docker run -d -e POSTGRES_USER=saytruth_user -e POSTGRES_PASSWORD=DevSecurePass123!@# \
  -e POSTGRES_DB=saytruth_db -p 5432:5432 postgres:15-alpine

# Terminal 2: Backend
cd backend
pip install -r requirements.txt
cat > .env << 'EOF'
DB_HOST=localhost
DB_PORT=5432
DB_NAME=saytruth_db
DB_USER=saytruth_user
DB_PASSWORD=DevSecurePass123!@#
DEBUG=true
EOF
uvicorn app.main:app --reload --port 8000

# Terminal 3: Frontend
cd frontend
npm install
npm run dev

# Visit http://localhost:5173
```

---

## 📋 File Reference

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [README.md](README.md) | Overview & learning paths | 5 min |
| [BACKEND.md](BACKEND.md) | FastAPI, SQLAlchemy, databases | 15 min |
| [FRONTEND.md](FRONTEND.md) | React, Vite, HMR | 15 min |
| [KONG.md](KONG.md) | **API Gateway** (most important!) | 20 min |
| [POSTGRES.md](POSTGRES.md) | PostgreSQL, StatefulSet, persistence | 15 min |
| [HELM.md](HELM.md) | Package manager for K8s | 15 min |
| [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) | Run without K3s (faster!) | 20 min |
| [DEVOPS_INTERVIEW_QUESTIONS.md](DEVOPS_INTERVIEW_QUESTIONS.md) | Interview prep | 30 min |

---

## 🚀 Choose Your Path

### Backend Developer
```bash
# 1. Learn backend concepts
less docs/BACKEND.md

# 2. Set up locally
cd backend && pip install -r requirements.txt
# Edit .env file with database credentials
uvicorn app.main:app --reload

# 3. Make changes - auto-reload!
vim app/api/routes/auth.py
# Changes applied instantly
```

### Frontend Developer
```bash
# 1. Learn frontend concepts
less docs/FRONTEND.md

# 2. Set up locally
cd frontend && npm install
npm run dev

# 3. Make changes - HMR updates!
vim src/components/LoginPage.jsx
# Changes appear in browser (no reload)
```

### DevOps Engineer
```bash
# 1. Start with API Gateway
less docs/KONG.md

# 2. Then database & persistence
less docs/POSTGRES.md

# 3. Then deployment automation
less docs/HELM.md

# 4. Interview prep
less docs/DEVOPS_INTERVIEW_QUESTIONS.md

# 5. Practice locally
cd backend && uvicorn app.main:app --reload &
cd frontend && npm run dev &
docker run -d -p 5432:5432 postgres:15-alpine &
```

---

## 🎯 Common Tasks

### Running Backend Locally
```bash
cd backend
pip install -r requirements.txt

# Set environment
export DB_HOST=localhost
export DB_USER=saytruth_user
export DB_PASSWORD=DevSecurePass123!@#

# Start with auto-reload
uvicorn app.main:app --reload

# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### Running Frontend Locally
```bash
cd frontend
npm install
npm run dev

# Access at http://localhost:5173
# HMR updates automatically
```

### Starting PostgreSQL
```bash
# Option 1: Docker
docker run -d --name postgres \
  -e POSTGRES_USER=saytruth_user \
  -e POSTGRES_PASSWORD=DevSecurePass123!@# \
  -e POSTGRES_DB=saytruth_db \
  -p 5432:5432 \
  postgres:15-alpine

# Option 2: Docker Compose
docker-compose up postgres

# Option 3: Local install
psql -U saytruth_user -d saytruth_db
```

### Testing API
```bash
# Health check
curl http://localhost:8000/health

# With httpie (better UX)
http POST localhost:8000/api/auth/signup \
  email=test@example.com password=password123

# View API docs
open http://localhost:8000/docs
```

### Debugging
```bash
# Backend logs (watch auto-reload)
tail -f /tmp/backend.log

# Frontend console (DevTools F12)
# Backend debugger
import pdb; pdb.set_trace()  # Add in Python

# Database queries
psql -U saytruth_user -d saytruth_db
SELECT * FROM users;
```

---

## 🔧 Configuration

### Backend (.env file)
```
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=saytruth_db
DB_USER=saytruth_user
DB_PASSWORD=DevSecurePass123!@#

# App
DEBUG=true
ENVIRONMENT=development
LOG_LEVEL=INFO
```

### Frontend (.env.local)
```
# API Base URL
VITE_API_BASE=http://localhost:8000/api
VITE_DEBUG=true
```

---

## 📊 Performance Tips

| Task | Without Local Dev | With Local Dev |
|------|------------------|----------------|
| Change Python file | 5-7 minutes | <1 second |
| Change React component | 5-7 minutes | <1 second |
| Test API | Manual deploy | Instant |
| Run tests | Manual deploy | Instant |

**Time saved per day:** 1-2 hours ⏰

---

## 🆘 Troubleshooting

### Backend won't start
```bash
# Check port 8000 not in use
lsof -i :8000

# Check dependencies installed
pip install -r requirements.txt

# Check database connection
python -c "import psycopg2; psycopg2.connect('dbname=saytruth_db user=saytruth_user password=DevSecurePass123!@# host=localhost')"
```

### Frontend won't connect to backend
```bash
# Check vite.config.js proxy
cat frontend/vite.config.js | grep -A 5 proxy

# Check backend running
curl http://localhost:8000/health

# Check CORS headers
curl -i http://localhost:8000/api/users
```

### Database connection failed
```bash
# Check PostgreSQL running
docker ps | grep postgres

# Check port 5432 accessible
telnet localhost 5432

# Check credentials
psql -h localhost -U saytruth_user -d saytruth_db
```

---

## 🎓 Next Learning Steps

1. **Start here**: Read [README.md](README.md) (5 minutes)
2. **Pick your role**: Backend/Frontend/DevOps
3. **Read relevant docs**: 15-30 minutes each
4. **Set up locally**: 10 minutes
5. **Make changes**: Start developing!
6. **Study for interviews**: [DEVOPS_INTERVIEW_QUESTIONS.md](DEVOPS_INTERVIEW_QUESTIONS.md)

---

## 💡 Pro Tips

✅ **Always run locally first** - Fast feedback loop  
✅ **Use git branches** - Experiment safely  
✅ **Read the docs** - They have real examples  
✅ **Ask questions** - Check documentation first  
✅ **Practice Helm** - Next phase after local dev  
✅ **Monitor early** - Set up logging/metrics  

---

## 📚 Study Order for DevOps Students

1. **Week 1**: [KONG.md](KONG.md) + [BACKEND.md](BACKEND.md) + [FRONTEND.md](FRONTEND.md)
   - Understand: API Gateway, app layers, routing

2. **Week 2**: [POSTGRES.md](POSTGRES.md) + [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)
   - Understand: Databases, persistent storage, local workflow

3. **Week 3**: [HELM.md](HELM.md)
   - Understand: Kubernetes package management, templating

4. **Week 4**: [DEVOPS_INTERVIEW_QUESTIONS.md](DEVOPS_INTERVIEW_QUESTIONS.md)
   - Practice: Interview answers, architecture explanation

5. **Week 5+**: Build & deploy
   - Project: Convert YAML to Helm charts
   - Project: Set up CI/CD pipeline
   - Project: Add monitoring stack

---

Happy learning! 🚀
