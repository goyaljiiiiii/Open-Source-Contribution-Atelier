/**
 * WebWorker for secure JavaScript/TypeScript code execution in isolated thread.
 * Uses Sucrase for TypeScript transpilation.
 * 
 * @file jsWorker.ts
 * @location frontend/src/workers/jsWorker.ts
 */

import { transform } from "sucrase";

// ============================================================
// Types
// ============================================================

interface WorkerMessage {
  id: string;
  code: string;
  timeout?: number;
}

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

interface ConsoleOutput {
  type: 'log' | 'error' | 'warn' | 'info' | 'debug' | 'table' | 'clear' | 'time' | 'timeEnd' | 'group' | 'groupEnd' | 'trace';
  args: any[];
}

// ============================================================
// Console Interceptor
// ============================================================

class ConsoleInterceptor {
  private output: string = '';
  private timers: Map<string, number> = new Map();
  private groups: string[] = [];

  /**
   * Format an argument for console output.
   */
  private formatArg(arg: any): string {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number') return String(arg);
    if (typeof arg === 'boolean') return String(arg);
    if (typeof arg === 'function') {
      return `[Function: ${arg.name || 'anonymous'}]`;
    }
    if (typeof arg === 'symbol') return arg.toString();
    if (arg instanceof Date) return arg.toISOString();
    if (arg instanceof RegExp) return arg.toString();
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
    }
    if (Array.isArray(arg)) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return '[Array]';
      }
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return '[Object]';
      }
    }
    return String(arg);
  }

  /**
   * Format multiple arguments for console output.
   */
  private formatArgs(args: any[]): string {
    return args.map(arg => this.formatArg(arg)).join(' ');
  }

  /**
   * Get the current output.
   */
  getOutput(): string {
    return this.output;
  }

  /**
   * Clear the output.
   */
  clearOutput(): void {
    this.output = '';
  }

  /**
   * Create a console method interceptor.
   */
  private createInterceptor(method: ConsoleOutput['type']) {
    return (...args: any[]): void => {
      const formatted = this.formatArgs(args);
      const prefix = this.groups.length > 0 ? '  '.repeat(this.groups.length) : '';
      this.output += `${prefix}${formatted}\n`;
      
      // Send to main thread for real-time display
      self.postMessage({
        type: 'console',
        method,
        args: args.map(a => this.formatArg(a)),
      } as WorkerResponse);
    };
  }

  /**
   * Get the custom console object.
   */
  getConsole(): Console {
    const consoleObj: any = {
      log: this.createInterceptor('log'),
      info: this.createInterceptor('info'),
      warn: this.createInterceptor('warn'),
      error: this.createInterceptor('error'),
      debug: this.createInterceptor('debug'),
      clear: () => {
        this.clearOutput();
        self.postMessage({
          type: 'console',
          method: 'clear',
          args: [],
        } as WorkerResponse);
      },
      table: (data: any) => {
        const formatted = this.formatArg(data);
        this.output += `${formatted}\n`;
        self.postMessage({
          type: 'console',
          method: 'table',
          args: [formatted],
        } as WorkerResponse);
      },
      time: (label: string = 'default') => {
        this.timers.set(label, performance.now());
        const formatted = `Timer "${label}" started`;
        this.output += `${formatted}\n`;
        self.postMessage({
          type: 'console',
          method: 'time',
          args: [formatted],
        } as WorkerResponse);
      },
      timeEnd: (label: string = 'default') => {
        const start = this.timers.get(label);
        if (start) {
          const duration = performance.now() - start;
          const formatted = `Timer "${label}" ended: ${duration.toFixed(2)}ms`;
          this.output += `${formatted}\n`;
          self.postMessage({
            type: 'console',
            method: 'timeEnd',
            args: [formatted],
          } as WorkerResponse);
          this.timers.delete(label);
        } else {
          const formatted = `Timer "${label}" does not exist`;
          this.output += `${formatted}\n`;
          self.postMessage({
            type: 'console',
            method: 'warn',
            args: [formatted],
          } as WorkerResponse);
        }
      },
      group: (label: string = '') => {
        this.groups.push(label);
        const formatted = label ? `Group: ${label}` : 'Group:';
        this.output += `${formatted}\n`;
        self.postMessage({
          type: 'console',
          method: 'group',
          args: [formatted],
        } as WorkerResponse);
      },
      groupEnd: () => {
        if (this.groups.length > 0) {
          this.groups.pop();
        }
        this.output += `Group ended\n`;
        self.postMessage({
          type: 'console',
          method: 'groupEnd',
          args: ['Group ended'],
        } as WorkerResponse);
      },
      groupCollapsed: (label: string = '') => {
        // Same as group for now (could be expanded)
        this.groups.push(label);
        const formatted = label ? `Group collapsed: ${label}` : 'Group collapsed:';
        this.output += `${formatted}\n`;
        self.postMessage({
          type: 'console',
          method: 'groupCollapsed',
          args: [formatted],
        } as WorkerResponse);
      },
      trace: (...args: any[]) => {
        const formatted = this.formatArgs(args);
        const stack = new Error().stack || '';
        const traceOutput = `Trace: ${formatted}\n${stack}`;
        this.output += `${traceOutput}\n`;
        self.postMessage({
          type: 'console',
          method: 'trace',
          args: [traceOutput],
        } as WorkerResponse);
      },
      count: (label: string = 'default') => {
        // Simple count implementation
        const count = (this as any)._counts?.[label] || 0;
        const newCount = count + 1;
        (this as any)._counts = { ...((this as any)._counts || {}), [label]: newCount };
        const formatted = `${label}: ${newCount}`;
        this.output += `${formatted}\n`;
        self.postMessage({
          type: 'console',
          method: 'log',
          args: [formatted],
        } as WorkerResponse);
      },
      countReset: (label: string = 'default') => {
        if ((this as any)._counts?.[label]) {
          delete (this as any)._counts[label];
          const formatted = `${label}: 0`;
          this.output += `${formatted}\n`;
          self.postMessage({
            type: 'console',
            method: 'log',
            args: [formatted],
          } as WorkerResponse);
        }
      },
    };

    return consoleObj as Console;
  }
}

// ============================================================
// Execution Function
// ============================================================

async function executeCode(
  code: string,
  executionId: string,
  timeoutMs: number = 5000
): Promise<void> {
  const startTime = performance.now();
  let timeoutId: number | null = null;
  const consoleInterceptor = new ConsoleInterceptor();

  try {
    // Set execution timeout
    timeoutId = setTimeout(() => {
      self.postMessage({
        id: executionId,
        type: 'timeout',
        error: `Execution timed out after ${timeoutMs}ms`,
      } as WorkerResponse);
      self.close();
    }, timeoutMs);

    // 1. Transpile TypeScript to JavaScript using Sucrase
    let compiledCode: string;
    try {
      const result = transform(code, {
        transforms: ['typescript', 'jsx'],
        production: true,
      });
      compiledCode = result.code;
    } catch (transpileError: any) {
      // Handle transpilation errors
      const errorMessage = `Transpilation error: ${transpileError.message || String(transpileError)}`;
      self.postMessage({
        id: executionId,
        type: 'error',
        error: errorMessage,
        executionTime: performance.now() - startTime,
      } as WorkerResponse);
      return;
    }

    // 2. Block unsafe APIs
    const sandboxContext: Record<string, any> = {
      // Console with interception
      console: consoleInterceptor.getConsole(),
      
      // Block unsafe APIs
      setTimeout: () => {
        self.postMessage({
          id: executionId,
          type: 'warning',
          message: '⛔ setTimeout is not allowed in sandbox for security reasons',
        } as WorkerResponse);
        return null;
      },
      setInterval: () => {
        self.postMessage({
          id: executionId,
          type: 'warning',
          message: '⛔ setInterval is not allowed in sandbox for security reasons',
        } as WorkerResponse);
        return null;
      },
      fetch: () => {
        self.postMessage({
          id: executionId,
          type: 'warning',
          message: '⛔ fetch is not allowed in sandbox for security reasons',
        } as WorkerResponse);
        return null;
      },
      alert: () => {
        self.postMessage({
          id: executionId,
          type: 'warning',
          message: '⛔ alert is not allowed in sandbox for security reasons',
        } as WorkerResponse);
        return null;
      },
      prompt: () => {
        self.postMessage({
          id: executionId,
          type: 'warning',
          message: '⛔ prompt is not allowed in sandbox for security reasons',
        } as WorkerResponse);
        return null;
      },
      confirm: () => {
        self.postMessage({
          id: executionId,
          type: 'warning',
          message: '⛔ confirm is not allowed in sandbox for security reasons',
        } as WorkerResponse);
        return null;
      },
      // Safe built-ins
      Math: Math,
      Date: Date,
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      JSON: JSON,
      parseInt: parseInt,
      parseFloat: parseFloat,
      isNaN: isNaN,
      isFinite: isFinite,
      decodeURI: decodeURI,
      decodeURIComponent: decodeURIComponent,
      encodeURI: encodeURI,
      encodeURIComponent: encodeURIComponent,
      // Additional utilities
      console: consoleInterceptor.getConsole(),
    };

    // 3. Create execution function with context
    const executionFn = new Function(
      ...Object.keys(sandboxContext),
      `
        "use strict";
        return (async () => {
          try {
            ${compiledCode}
          } catch (e) {
            throw e;
          }
        })();
      `
    );

    // 4. Execute with context
    const result = await executionFn(...Object.values(sandboxContext));

    // Clear timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // 5. Send result
    const executionTime = performance.now() - startTime;
    const output = consoleInterceptor.getOutput();
    
    self.postMessage({
      id: executionId,
      type: 'result',
      results: output || (result !== undefined ? String(result) : '✅ Execution completed successfully'),
      executionTime,
    } as WorkerResponse);
    
  } catch (error: any) {
    // Clear timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const executionTime = performance.now() - startTime;
    const errorMessage = error.message || String(error);
    const output = consoleInterceptor.getOutput();

    self.postMessage({
      id: executionId,
      type: 'error',
      error: errorMessage,
      results: output,
      executionTime,
    } as WorkerResponse);
  }
}

// ============================================================
// Message Handler
// ============================================================

self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { id, code, timeout = 5000 } = event.data;

  if (code !== undefined) {
    await executeCode(code, id, timeout);
  } else {
    self.postMessage({
      id,
      type: 'error',
      error: 'No code provided for execution',
    } as WorkerResponse);
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