require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { connectMongo } = require("./models/InterviewSession");
const interviewController = require("./controllers/interviewController");
const executeController = require("./controllers/executeController");
const { attachWebRTCSignaling } = require("./services/webrtcSignaling");

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "interview-platform" });
});

app.post("/api/sessions", interviewController.createSession);
app.get("/api/sessions/:id", interviewController.getSession);
app.post("/api/sessions/:id/score", interviewController.submitScore);
app.post("/api/execute", executeController.executeCode);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
});

attachWebRTCSignaling(io);

async function start() {
  await connectMongo();
  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
