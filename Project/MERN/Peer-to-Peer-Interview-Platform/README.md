# Peer-to-Peer Interview Platform (MERN)

A beginner-friendly scaffold for live technical interviews with WebRTC video, a shared code editor, and a scorecard.

## Prerequisites

- Node.js 18+
- MongoDB (optional — falls back to in-memory storage if unavailable)

## Quick start

### 1. Server

```bash
cd server
npm install
npm start
```

Server runs at `http://localhost:5000`.

Optional env vars (create `server/.env`):

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/interview-platform
CLIENT_ORIGIN=http://localhost:5173
```

### 2. Client

```bash
cd client
npm install
npm run dev
```

Client runs at `http://localhost:5173`.

## Features

- **WebRTC video** — Socket.io signaling for offer/answer/ICE exchange
- **Code runner** — Sandboxed JavaScript execution via Node `vm` (2 s timeout)
- **Scorecard** — Interviewer submits structured feedback per session
- **Sessions** — REST API to create, fetch, and score interview sessions

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sessions` | Create a new interview session |
| GET | `/api/sessions/:id` | Get session details |
| POST | `/api/sessions/:id/score` | Submit scorecard |
| POST | `/api/execute` | Run JS code `{ "code": "..." }` |

## Socket events (signaling)

| Event | Payload | Description |
|-------|---------|-------------|
| `join-session` | `{ sessionId, role }` | Join a room |
| `webrtc-offer` | `{ sessionId, offer }` | Send SDP offer |
| `webrtc-answer` | `{ sessionId, answer }` | Send SDP answer |
| `webrtc-ice-candidate` | `{ sessionId, candidate }` | Send ICE candidate |
