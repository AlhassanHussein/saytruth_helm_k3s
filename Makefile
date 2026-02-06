# Variables to save typing
NS = saytruth-dev
IMAGES = frontend backend

# Generic build and load target
# Usage: make load-frontend or make load-backend
load-%:
	docker build -t saytruth/$*:latest ./$*/
	docker save saytruth/$*:latest | sudo k3s ctr images import -
	kubectl rollout restart deployment/$* -n $(NS)
	kubectl get pods -n $(NS) -w

# Shortcuts
frontend: load-frontend
backend: load-backend

# Build everything at once
all: load-frontend load-backend

