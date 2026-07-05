/**
 * WebWorker for secure JavaScript/TypeScript code execution in isolated thread.
 * Uses Sucrase for TypeScript transpilation.
 * 
 * @file jsWorker.ts
 * @location frontend/src/workers/jsWorker.ts
 */

import { transform } from "sucrase";
import { instrumentJS } from "../lib/jsTracer";
import { TraceEvent } from "../hooks/useTimelineEngine";

self.addEventListener("message", async (event) => {
  const { id, code, action } = event.data;

  let output = "";
  let error = null;
  const traceEvents: TraceEvent[] = [];
  let stepCounter = 0;

interface WorkerResponse {
  id: string;
  type: 'result' | 'error' | 'timeout' | 'console' | 'warning';
  results?: string;
  error?: string;
  executionTime?: number;
  method?: string;
  args?: any[];
  message?: string;
}

  const customConsole = {
    log: intercept(),
    info: intercept(),
    warn: intercept(),
    error: intercept(),
    debug: intercept(),
    clear: () => {
      output = "";
    },
  };

// ============================================================
// Console Interceptor
// ============================================================

    if (action === "execute_trace") {
      // 2a. Instrument for tracing
      const instrumented = instrumentJS(compiled);
      
      const __trace = (line: number, locals: Record<string, unknown>) => {
        // Only record the variable values, filtering out functions for cleaner display
        const cleanLocals: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(locals)) {
          if (typeof val !== "function" && val !== undefined) {
            cleanLocals[key] = val;
          }
        }
        
        traceEvents.push({
          step: stepCounter++,
          line,
          event: "line",
          locals: cleanLocals,
          stdout: output, // capture stdout up to this point
        });
      };

      const executionFn = new Function(
        "console",
        "__trace",
        `
        return (async () => {
          try {
            ${instrumented}
          } catch (e) {
            throw e;
          }
        })();
        `,
      );

      await executionFn(customConsole, __trace);
      
      // Send back trace results instead of just string
      self.postMessage({ id, trace_events: traceEvents, error });
    } else {
      // 2b. Normal execution
      const executionFn = new Function(
        "console",
        `
        return (async () => {
          try {
            ${compiled}
          } catch (e) {
            throw e;
          }
        })();
        `,
      );

      await executionFn(customConsole);
      self.postMessage({ id, results: output, error });
    }
  } catch (err: unknown) {
    error = err instanceof Error ? err.toString() : String(err);
    if (action === "execute_trace") {
      // Append the error to the last trace event if exists, or create one
      if (traceEvents.length > 0) {
        traceEvents[traceEvents.length - 1].error = error;
      } else {
        traceEvents.push({
          step: stepCounter++,
          line: 0,
          event: "error",
          locals: {},
          stdout: output,
          error,
        });
      }
      self.postMessage({ id, trace_events: traceEvents, error });
    } else {
      self.postMessage({ id, results: output, error });
    }
  }
});

// ============================================================
// Error Handlers
// ============================================================

self.addEventListener('error', (error: ErrorEvent) => {
  self.postMessage({
    type: 'error',
    error: error.message || 'Worker error occurred',
  } as WorkerResponse);
});

self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  self.postMessage({
    type: 'error',
    error: event.reason?.message || 'Unhandled promise rejection',
  } as WorkerResponse);
});

// ============================================================
// Export for TypeScript
// ============================================================

export type { WorkerMessage, WorkerResponse };