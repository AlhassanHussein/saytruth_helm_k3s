#!/bin/bash

# 1. Configuration
NS="saytruth-dev"
SERVICE=$1  # This catches the word you type after the script name

# 2. Check if the user actually typed frontend or backend
if [[ "$SERVICE" != "frontend" && "$SERVICE" != "backend" ]]; then
    echo "❌ Usage: ./dev.sh [frontend|backend]"
    exit 1
fi

echo "🚀 Starting deployment for: $SERVICE"

# 3. The Workflow
# Build it
docker build -t saytruth/$SERVICE:latest ./$SERVICE/

# Move it to K3s (using the faster pipe method)
docker save saytruth/$SERVICE:latest | sudo k3s ctr images import -

# Restart it
kubectl rollout restart deployment/$SERVICE -n $NS

# Watch it
echo "👀 Watching pods... (Press Ctrl+C to stop)"
kubectl get pods -n $NS -w

