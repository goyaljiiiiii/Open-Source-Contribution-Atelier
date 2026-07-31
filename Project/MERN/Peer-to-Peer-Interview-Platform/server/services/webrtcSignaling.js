const { addParticipant } = require("../models/InterviewSession");

function attachWebRTCSignaling(io) {
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join-session", async ({ sessionId, role }) => {
      if (!sessionId) return;
      socket.join(sessionId);
      socket.data.sessionId = sessionId;
      socket.data.role = role;

      if (role === "interviewer" || role === "candidate") {
        await addParticipant(sessionId, role);
      }

      socket.to(sessionId).emit("peer-joined", { role, socketId: socket.id });
    });

    socket.on("webrtc-offer", ({ sessionId, offer }) => {
      if (!sessionId || !offer) return;
      socket.to(sessionId).emit("webrtc-offer", { offer, from: socket.id });
    });

    socket.on("webrtc-answer", ({ sessionId, answer }) => {
      if (!sessionId || !answer) return;
      socket.to(sessionId).emit("webrtc-answer", { answer, from: socket.id });
    });

    socket.on("webrtc-ice-candidate", ({ sessionId, candidate }) => {
      if (!sessionId || !candidate) return;
      socket.to(sessionId).emit("webrtc-ice-candidate", { candidate, from: socket.id });
    });

    socket.on("code-update", ({ sessionId, code }) => {
      if (!sessionId) return;
      socket.to(sessionId).emit("code-update", { code, from: socket.id });
    });

    socket.on("disconnect", () => {
      const { sessionId, role } = socket.data;
      if (sessionId) {
        socket.to(sessionId).emit("peer-left", { role, socketId: socket.id });
      }
      console.log("Client disconnected:", socket.id);
    });
  });
}

module.exports = { attachWebRTCSignaling };
