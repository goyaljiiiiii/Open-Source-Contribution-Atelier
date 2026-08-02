#!/usr/bin/env bash
# docker-dev.sh — Launch Atelier Docker Dev Environment with health probes and ready banners.

set -e

echo "🚀 Starting Atelier Docker Development Environment..."

# Ensure environment file exists
if [ ! -f .env ]; then
  if [ -f backend/.env.example ]; then
    cp backend/.env.example .env
    echo "📋 Copied backend/.env.example to .env"
  fi
fi

# Launch Docker Compose with optional redis profile if requested
if [ "$1" = "--with-redis" ] || [ "$REDIS_ENABLED" = "true" ]; then
  echo "📦 Launching containers with Redis profile..."
  docker compose --profile redis up -d --build
else
  echo "⚡ Launching lightweight containers (Redis optional/in-memory)..."
  docker compose up -d --build
fi

echo ""
echo "⏳ Waiting for services to initialize..."

# Health check helper function
check_health() {
  local url="$1"
  local name="$2"
  local max_retries="${3:-30}"
  local count=0

  until curl -s -f "$url" > /dev/null 2>&1; do
    count=$((count + 1))
    if [ "$count" -ge "$max_retries" ]; then
      echo "⚠️ Timeout waiting for $name at $url (service may still be initializing)"
      return 0
    fi
    sleep 2
  done
  echo "✅ $name is Ready!"
}

# Check health of Backend and Frontend
check_health "http://localhost:8000/api/" "Backend API" 30
check_health "http://localhost:5173/" "Frontend Dev Server" 30

echo ""
echo "=========================================================="
echo "🎉 Atelier Docker Development Environment Ready!"
echo "----------------------------------------------------------"
echo "  • Frontend Dev Server : http://localhost:5173"
echo "  • Backend REST API    : http://localhost:8000/api/"
echo "  • Traefik Proxy       : http://localhost:8000"
echo "  • Traefik Dashboard   : http://localhost:8080"
echo "=========================================================="
