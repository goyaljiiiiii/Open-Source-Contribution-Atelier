import { useState } from "react";

const DEFAULT_CODE = `// Write JavaScript below. console.log() prints to output.
function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}

console.log(twoSum([2, 7, 11, 15], 9));
return twoSum([3, 2, 4], 6);
`;

export default function CodeRunner({ code, onCodeChange, onRun, output, running }) {
  const [localCode, setLocalCode] = useState(code || DEFAULT_CODE);

  const handleChange = (e) => {
    setLocalCode(e.target.value);
    onCodeChange?.(e.target.value);
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Code Editor</h2>
        <button
          onClick={() => onRun(localCode)}
          disabled={running}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-sm font-medium"
        >
          {running ? "Running…" : "Run Code"}
        </button>
      </div>

      <textarea
        value={localCode}
        onChange={handleChange}
        spellCheck={false}
        className="flex-1 min-h-[200px] font-mono text-sm bg-slate-950 border border-slate-700 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 min-h-[100px]">
        <p className="text-xs text-slate-400 mb-1">Output</p>
        <pre className="text-sm font-mono whitespace-pre-wrap text-emerald-300">
          {output || "Run code to see output…"}
        </pre>
      </div>
    </div>
  );
}
