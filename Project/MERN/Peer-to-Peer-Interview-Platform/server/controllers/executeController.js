const { runJavaScript } = require("../services/dockerRunner");

async function executeCode(req, res) {
  try {
    const { code } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Missing code string" });
    }
    if (code.length > 8000) {
      return res.status(400).json({ error: "Code exceeds 8000 character limit" });
    }

    const result = runJavaScript(code);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { executeCode };
