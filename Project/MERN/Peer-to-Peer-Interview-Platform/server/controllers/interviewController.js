const {
  createSessionRecord,
  getSessionRecord,
  submitScoreRecord,
} = require("../models/InterviewSession");

async function createSession(_req, res) {
  try {
    const session = await createSessionRecord();
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getSession(req, res) {
  try {
    const session = await getSessionRecord(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function submitScore(req, res) {
  try {
    const { rating, notes } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const session = await submitScoreRecord(req.params.id, { rating, notes: notes || "" });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { createSession, getSession, submitScore };
