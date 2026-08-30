import { loadPyodide, PyodideInterface } from "pyodide";

let pyodideReadyPromise: Promise<PyodideInterface> | null = null;

async function initPyodide() {
  if (pyodideReadyPromise) return pyodideReadyPromise;

  pyodideReadyPromise = loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/",
  });

  const pyodide = await pyodideReadyPromise;

  // We can pre-load standard packages here if needed.
  // await pyodide.loadPackage("numpy");

  return pyodide;
}

// Ensure it starts loading immediately
initPyodide();

self.onmessage = async (event) => {
  const { id, pythonCode, timeoutMs = 5000 } = event.data;

  let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

  try {
    const pyodide = await initPyodide();

    // Set up Pyodide interrupt buffer if SharedArrayBuffer is available
    let interruptBuffer: Int32Array | null = null;
    try {
      if (
        typeof SharedArrayBuffer !== "undefined" &&
        pyodide.setInterruptBuffer
      ) {
        interruptBuffer = new Int32Array(new SharedArrayBuffer(4));
        pyodide.setInterruptBuffer(interruptBuffer);
      }
    } catch {
      // Ignore if SharedArrayBuffer is unsupported in current environment
    }

    // 5-second execution watchdog timer
    watchdogTimer = setTimeout(() => {
      if (interruptBuffer) {
        interruptBuffer[0] = 2; // SIGINT
      }
      self.postMessage({
        id,
        results: "",
        error:
          "Execution Timeout: The code took too long to run and was terminated.",
      });
      self.close();
    }, timeoutMs);

    // Redirect stdout and stderr
    let output = "";
    let errorOutput = "";

    pyodide.setStdout({
      batched: (msg) => {
        output += msg + "\n";
      },
    });
    pyodide.setStderr({
      batched: (msg) => {
        errorOutput += msg + "\n";
      },
    });

    // Execute the code
    await pyodide.runPythonAsync(pythonCode);

    if (watchdogTimer !== null) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }

    self.postMessage({
      id,
      results: output,
      error: errorOutput ? errorOutput : null,
    });
  } catch (error: unknown) {
    if (watchdogTimer !== null) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
    self.postMessage({ id, error: (error as Error).message });
  }
};
