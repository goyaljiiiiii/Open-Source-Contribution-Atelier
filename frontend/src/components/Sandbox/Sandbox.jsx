/**
 * Sandbox component for secure code execution.
 * 
 * @file Sandbox.jsx
 * @location frontend/src/components/Sandbox/Sandbox.jsx
 */

import React from 'react';
import useSandbox from '../../hooks/useSandbox';
import './Sandbox.css';

const Sandbox = ({ initialCode = '' }) => {
  const {
    code,
    setCode,
    output,
    isRunning,
    isReady,
    executionTime,
    status,
    error,
    workerStatus,
    outputRef,
    runCode,
    clearOutput,
    stopExecution,
    resetSandbox,
  } = useSandbox(initialCode);

  // Examples
  const examples = {
    'Hello World': `console.log('Hello, World!');
console.log('Welcome to the Open Source Contribution Atelier!');`,

    'Functions': `function calculateSum(a, b) {
  return a + b;
}

function calculateProduct(a, b) {
  return a * b;
}

const sum = calculateSum(5, 3);
const product = calculateProduct(5, 3);

console.log('Sum:', sum);
console.log('Product:', product);
console.log('Sum + Product:', sum + product);`,

    'Arrays': `const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

console.log('Original array:', numbers);

// Map: square each number
const squared = numbers.map(n => n * n);
console.log('Squared:', squared);

// Filter: even numbers
const even = numbers.filter(n => n % 2 === 0);
console.log('Even numbers:', even);

// Reduce: sum
const sum = numbers.reduce((acc, n) => acc + n, 0);
console.log('Sum:', sum);`,

    'Async/Await': `async function fetchData() {
  console.log('Fetching data...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { data: 'Sample data', timestamp: new Date().toISOString() };
}

async function main() {
  console.log('Starting...');
  const result = await fetchData();
  console.log('Data received:', result);
  console.log('Done!');
}

main();`,
  };

  const loadExample = (name) => {
    if (examples[name]) {
      setCode(examples[name]);
      clearOutput();
    }
  };

  if (!isReady) {
    return (
      <div className="sandbox-loading">
        <div className="spinner"></div>
        <p>Initializing sandbox...</p>
      </div>
    );
  }

  return (
    <div className="sandbox-container">
      {/* Header */}
      <div className="sandbox-header">
        <div className="sandbox-title">
          <span className="icon">💻</span>
          <h2>Coding Sandbox</h2>
        </div>
        <div className="sandbox-status">
          <span className={`status-badge ${status}`}>
            {status === 'idle' && '● Idle'}
            {status === 'running' && '● Running...'}
            {status === 'completed' && '✅ Completed'}
            {status === 'error' && '❌ Error'}
            {status === 'timeout' && '⏰ Timeout'}
          </span>
          {executionTime && (
            <span className="execution-time">⏱️ {executionTime.toFixed(2)}ms</span>
          )}
          <span className="worker-status">
            🧵 {workerStatus.availableWorkers || 0}/{workerStatus.totalWorkers || 0}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="sandbox-body">
        {/* Editor */}
        <div className="sandbox-editor">
          <div className="editor-toolbar">
            <div className="examples-dropdown">
              <button className="examples-btn">📚 Examples</button>
              <div className="examples-menu">
                {Object.keys(examples).map((name) => (
                  <button
                    key={name}
                    onClick={() => loadExample(name)}
                    className="example-item"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={resetSandbox}
              className="reset-btn"
              disabled={isRunning}
            >
              🗑️ Reset
            </button>
          </div>
          <textarea
            className="code-editor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            disabled={isRunning}
            placeholder="// Write your JavaScript code here..."
          />
        </div>

        {/* Output */}
        <div className="sandbox-output">
          <div className="output-toolbar">
            <span className="output-title">📋 Console Output</span>
            <div className="output-actions">
              <button
                onClick={clearOutput}
                className="clear-output-btn"
                disabled={isRunning}
              >
                Clear
              </button>
              {isRunning && (
                <button
                  onClick={stopExecution}
                  className="stop-btn"
                >
                  ⏹ Stop
                </button>
              )}
            </div>
          </div>
          <div className="output-content" ref={outputRef}>
            {output.length === 0 && (
              <div className="output-empty">
                <span>▶️ Run your code to see output here</span>
              </div>
            )}
            {output.map((entry, index) => (
              <div
                key={index}
                className={`output-line ${entry.type}`}
              >
                <span className="output-time">[{entry.timestamp}]</span>
                <pre className="output-text">{entry.content}</pre>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="sandbox-footer">
        <div className="sandbox-actions">
          <button
            onClick={runCode}
            disabled={isRunning || !code.trim()}
            className={`run-btn ${isRunning ? 'running' : ''}`}
          >
            {isRunning ? '⏳ Running...' : '▶ Run Code'}
          </button>
          {error && (
            <div className="sandbox-error">
              <span className="error-icon">❌</span>
              <span className="error-text">{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sandbox;