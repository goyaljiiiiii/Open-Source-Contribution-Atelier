import { useState } from "react";

export default function Scorecard({ sessionId, onSubmit, submittedScore }) {
  const [rating, setRating] = useState(3);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sessionId) return;

    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      setStatus("Score submitted!");
      onSubmit?.(data);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (submittedScore) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">Scorecard</h2>
        <p className="text-sm">
          Rating: <span className="text-amber-400">{submittedScore.rating}/5</span>
        </p>
        {submittedScore.notes && (
          <p className="text-sm text-slate-300 mt-1">{submittedScore.notes}</p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col gap-3"
    >
      <h2 className="text-lg font-semibold">Scorecard</h2>

      <label className="text-sm">
        Rating (1–5)
        <input
          type="range"
          min="1"
          max="5"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="w-full mt-1"
        />
        <span className="text-amber-400">{rating}</span>
      </label>

      <label className="text-sm">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Communication, problem solving, code quality…"
          className="w-full mt-1 bg-slate-950 border border-slate-600 rounded p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </label>

      <button
        type="submit"
        disabled={loading || !sessionId}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded text-sm font-medium"
      >
        {loading ? "Submitting…" : "Submit Score"}
      </button>

      {status && (
        <p className={`text-xs ${status.includes("submitted") ? "text-emerald-400" : "text-rose-400"}`}>
          {status}
        </p>
      )}
    </form>
  );
}
