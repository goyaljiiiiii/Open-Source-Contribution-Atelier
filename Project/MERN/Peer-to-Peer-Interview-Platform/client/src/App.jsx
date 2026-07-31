import { useCallback, useEffect, useState } from "react";
import VideoWindow from "./components/VideoWindow.jsx";
import CodeRunner from "./components/CodeRunner.jsx";
import Scorecard from "./components/Scorecard.jsx";
import { useSocket } from "./hooks/useSocket.js";
import { useWebRTC } from "./hooks/useWebRTC.js";

export default function App() {
  const [sessionId, setSessionId] = useState("");
  const [role, setRole] = useState("interviewer");
  const [joined, setJoined] = useState(false);
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [scorecard, setScorecard] = useState(null);
  const [error, setError] = useState(null);

  const { socket, connected } = useSocket();

  const isInitiator = role === "interviewer";
  const webrtc = useWebRTC({ socket, sessionId, role, isInitiator: joined && isInitiator });

  const createSession = async () => {
    setError(null);
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create session");
      setSessionId(data.sessionId);
    } catch (err) {
      setError(err.message);
    }
  };

  const joinSession = () => {
    if (!socket || !sessionId) return;
    socket.emit("join-session", { sessionId, role });
    setJoined(true);
  };

  const handleCodeChange = useCallback(
    (newCode) => {
      setCode(newCode);
      if (socket && sessionId && joined) {
        socket.emit("code-update", { sessionId, code: newCode });
      }
    },
    [socket, sessionId, joined]
  );

  const handleRunCode = async (source) => {
    setRunning(true);
    setOutput("");
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Execution failed");

      const lines = [];
      if (data.output) lines.push(data.output);
      if (data.result !== null && data.result !== undefined) {
        lines.push(`→ ${data.result}`);
      }
      if (data.error) lines.push(`Error: ${data.error}`);
      setOutput(lines.join("\n") || "(no output)");
    } catch (err) {
      setOutput(`Error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (!socket) return;
    const onCodeUpdate = ({ code: peerCode }) => {
      if (peerCode !== undefined) setCode(peerCode);
    };
    socket.on("code-update", onCodeUpdate);
    return () => socket.off("code-update", onCodeUpdate);
  }, [socket]);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.scorecard?.rating) setScorecard(data.scorecard);
      })
      .catch(() => {});
  }, [sessionId]);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Peer-to-Peer Interview Platform</h1>
        <p className="text-slate-400 text-sm mt-1">
          WebRTC video + live code + scorecard
        </p>
      </header>

      {!joined ? (
        <div className="max-w-lg bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
          <div>
            <label className="text-sm block mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-950 border border-slate-600 rounded px-3 py-2 text-sm"
            >
              <option value="interviewer">Interviewer (creates offer)</option>
              <option value="candidate">Candidate</option>
            </select>
          </div>

          <div>
            <label className="text-sm block mb-1">Session ID</label>
            <div className="flex gap-2">
              <input
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="Paste or create a session ID"
                className="flex-1 bg-slate-950 border border-slate-600 rounded px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={createSession}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm whitespace-nowrap"
              >
                New Session
              </button>
            </div>
          </div>

          {error && <p className="text-rose-400 text-sm">{error}</p>}

          <button
            onClick={joinSession}
            disabled={!sessionId || !connected}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded font-medium"
          >
            Join Interview
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-8rem)]">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 min-h-[320px]">
            <VideoWindow
              localVideoRef={webrtc.localVideoRef}
              remoteVideoRef={webrtc.remoteVideoRef}
              mediaError={webrtc.mediaError}
              connected={connected}
              role={role}
            />
          </div>

          <div className="flex flex-col gap-4 min-h-[320px]">
            <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-4 min-h-0">
              <CodeRunner
                code={code}
                onCodeChange={handleCodeChange}
                onRun={handleRunCode}
                output={output}
                running={running}
              />
            </div>

            {role === "interviewer" && (
              <Scorecard
                sessionId={sessionId}
                submittedScore={scorecard}
                onSubmit={(data) => setScorecard(data.scorecard)}
              />
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500 mt-4">
        Session: {sessionId || "—"} · Role: {role}
      </p>
    </div>
  );
}
