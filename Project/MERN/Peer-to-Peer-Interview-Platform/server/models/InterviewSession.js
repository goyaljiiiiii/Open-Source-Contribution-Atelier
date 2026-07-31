const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const interviewSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["waiting", "active", "completed"],
      default: "waiting",
    },
    participants: [
      {
        role: { type: String, enum: ["interviewer", "candidate"], required: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    scorecard: {
      rating: { type: Number, min: 1, max: 5 },
      notes: String,
      submittedAt: Date,
    },
  },
  { timestamps: true }
);

const InterviewSession =
  mongoose.models.InterviewSession ||
  mongoose.model("InterviewSession", interviewSessionSchema);

const memoryStore = new Map();
let mongoConnected = false;

async function connectMongo() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/interview-platform";
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    mongoConnected = true;
    console.log("MongoDB connected");
  } catch (err) {
    mongoConnected = false;
    console.warn("MongoDB unavailable — using in-memory store:", err.message);
  }
}

function toPlain(doc) {
  if (!doc) return null;
  return doc.toObject ? doc.toObject() : { ...doc };
}

async function createSessionRecord() {
  const sessionId = uuidv4();
  const payload = {
    sessionId,
    status: "waiting",
    participants: [],
    scorecard: null,
  };

  if (mongoConnected) {
    const doc = await InterviewSession.create(payload);
    return toPlain(doc);
  }

  memoryStore.set(sessionId, { ...payload, createdAt: new Date(), updatedAt: new Date() });
  return memoryStore.get(sessionId);
}

async function getSessionRecord(sessionId) {
  if (mongoConnected) {
    const doc = await InterviewSession.findOne({ sessionId });
    return toPlain(doc);
  }
  return memoryStore.get(sessionId) || null;
}

async function submitScoreRecord(sessionId, { rating, notes }) {
  const scorecard = { rating, notes, submittedAt: new Date() };

  if (mongoConnected) {
    const doc = await InterviewSession.findOneAndUpdate(
      { sessionId },
      { scorecard, status: "completed" },
      { new: true }
    );
    return toPlain(doc);
  }

  const session = memoryStore.get(sessionId);
  if (!session) return null;
  session.scorecard = scorecard;
  session.status = "completed";
  session.updatedAt = new Date();
  memoryStore.set(sessionId, session);
  return session;
}

async function addParticipant(sessionId, role) {
  const participant = { role, joinedAt: new Date() };

  if (mongoConnected) {
    const doc = await InterviewSession.findOneAndUpdate(
      { sessionId },
      { $push: { participants: participant }, status: "active" },
      { new: true }
    );
    return toPlain(doc);
  }

  const session = memoryStore.get(sessionId);
  if (!session) return null;
  session.participants.push(participant);
  session.status = "active";
  session.updatedAt = new Date();
  memoryStore.set(sessionId, session);
  return session;
}

module.exports = {
  connectMongo,
  createSessionRecord,
  getSessionRecord,
  submitScoreRecord,
  addParticipant,
  isMongoConnected: () => mongoConnected,
};
