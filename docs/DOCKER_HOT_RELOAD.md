# Local Development with Docker Compose Hot-Reloading

This guide explains how to set up live code hot-reloading for local development when running the full stack inside Docker Compose.

---

## Overview

By default, `docker-compose.yml` configures production-ready container images. For active feature development and debugging inside containers, you want changes to your local source files in `frontend/` and `backend/` to immediately reflect without manually rebuilding container images each time.

Docker Compose automatically reads `docker-compose.override.yml` if present in the project root directory and merges it with `docker-compose.yml`.

---

## Quickstart

### 1. Copy the Override Template
In the repository root, copy the example override template:

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
```

> [!NOTE]
> `docker-compose.override.yml` is listed in `.gitignore` so your local development configurations won't accidentally be committed.

### 2. Boot the Development Stack
Start the containers with the override enabled:

```bash
docker compose up --build
```

### 3. Verify Hot-Reloading
- **Frontend**: Open `http://localhost:5173/` in your browser. Edit any file in `frontend/src/` (e.g. `App.tsx`) — Vite Hot Module Replacement (HMR) will update the page instantly.
- **Backend**: Edit any Python file in `backend/apps/` (e.g. `views.py`) — Django's `runserver` autoreloader will detect the file change and reload the application server automatically.

---

## Configuration Deep-Dive

Here is the default `docker-compose.override.yml` configuration:

```yaml
version: '3.8'

services:
  backend:
    command: >
      sh -c "python manage.py migrate &&
             python manage.py runserver 0.0.0.0:8000"
    volumes:
      - ./backend:/app:delegated
    environment:
      - DEBUG=True
      - PYTHONUNBUFFERED=1

  worker:
    volumes:
      - ./backend:/app:delegated
    environment:
      - DEBUG=True

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: builder
    command: npm run dev -- --host 0.0.0.0
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app:delegated
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:8000
      - CHOKIDAR_USEPOLLING=true
      - WATCHPACK_POLLING=true
```

---

## Key Development Components

### 1. Backend Autoreload & Volumes
- **Volume Mount**: `./backend:/app` binds your host `backend/` directory directly into the `/app` container path.
- **Development Server**: Overrides the production `daphne` runner with `python manage.py runserver 0.0.0.0:8000`, which enables Django's internal file watch autoreloader.
- **Environment**: Sets `DEBUG=True` to provide detailed traceback errors in your browser console and logs.

### 2. Frontend Vite HMR & Anonymous Volume
- **Volume Mount**: `./frontend:/app` binds your host `frontend/` directory into `/app`.
- **Node Modules Protection**: `- /app/node_modules` creates an anonymous volume preventing host `node_modules` from clobbering pre-installed container npm packages.
- **Vite Dev Server**: Overrides the production Nginx stage with the Vite development server (`npm run dev -- --host 0.0.0.0`).
- **WebSocket HMR Port**: Maps host port `5173:5173` so Vite's Hot Module Replacement WebSocket connection communicates directly with your browser.

### 3. File System Polling (Windows / Docker Desktop / macOS)
If file change events are not firing in Docker Desktop (especially on Windows WSL2 or macOS virtualized drives):
- `CHOKIDAR_USEPOLLING=true` and `WATCHPACK_POLLING=true` configure Vite and Node file watchers to use polling mode.
- `:delegated` volume flags optimize file read/write performance on macOS file mounts.

---

## Useful Development Commands

### View Live Container Logs
```bash
# Stream all logs
docker compose logs -f

# Stream frontend or backend logs only
docker compose logs -f backend
docker compose logs -f frontend
```

### Run Django Migrations & Management Commands
```bash
# Run database migrations
docker compose exec backend python manage.py migrate

# Seed initial curriculum data
docker compose exec backend python manage.py seed_lessons
```

### Execute Tests inside Containers
```bash
# Run Django backend unit tests
docker compose exec backend pytest

# Run frontend Vitest unit tests
docker compose exec frontend npm run test
```

### Access Container Shell
```bash
# Open interactive shell in backend container
docker compose exec backend bash

# Open interactive shell in frontend container
docker compose exec frontend sh
```
