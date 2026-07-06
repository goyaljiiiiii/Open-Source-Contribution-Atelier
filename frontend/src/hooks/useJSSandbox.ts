/**
 * React hook for JavaScript sandbox execution using WebWorkers.
 * 
 * @file useJSSandbox.ts
 * @location frontend/src/hooks/useJSSandbox.ts
 */

import { TraceEvent } from "./useTimelineEngine";

export interface JSExecutionResult {
  output: string;
  error: string | null;
  trace_events?: TraceEvent[];
}

export interface UseJSSandboxOptions {
  timeout?: number;
  maxWorkers?: number;
  autoInit?: boolean;
}

export interface UseJSSandboxReturn {
  // State
  isExecuting: boolean;
  isReady: boolean;
  status: 'idle' | 'running' | 'completed' | 'error' | 'timeout';
  executionTime: number | null;
  error: string | null;
  output: SandboxOutput[];
  workerStatus: WorkerStatus;
  
  // Actions
  runJSCode: (code: string, timeoutMs?: number) => Promise<JSExecutionResult>;
  clearOutput: () => void;
  stopExecution: () => void;
  resetSandbox: () => void;
  loadExample: (exampleCode: string) => string;
}

// ============================================================
// Example Codes
// ============================================================

export const EXAMPLES: Record<string, string> = {
  'Hello World': `// Hello World Example
console.log('Hello, World!');
console.log('Welcome to the Open Source Contribution Atelier!');

// Simple calculation
const sum = 5 + 3;
console.log('5 + 3 =', sum);

// String concatenation
const greeting = 'Hello ' + 'Developer!';
console.log(greeting);`,

  'Functions': `// Functions Example
function calculateSum(a, b) {
  return a + b;
}

function calculateProduct(a, b) {
  return a * b;
}

function greet(name) {
  return \`Hello, \${name}!\`;
}

const sum = calculateSum(5, 3);
const product = calculateProduct(5, 3);
const message = greet('Student');

console.log('Sum:', sum);
console.log('Product:', product);
console.log('Greeting:', message);

console.log('Sum + Product:', sum + product);`,

  'Arrays': `// Array Operations Example
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

console.log('Original array:', numbers);

// Map: square each number
const squared = numbers.map(n => n * n);
console.log('Squared:', squared);

// Filter: even numbers only
const even = numbers.filter(n => n % 2 === 0);
console.log('Even numbers:', even);

// Reduce: sum all numbers
const sum = numbers.reduce((acc, n) => acc + n, 0);
console.log('Sum of all numbers:', sum);

// Chaining operations
const result = numbers
  .filter(n => n > 5)
  .map(n => n * 2)
  .reduce((acc, n) => acc + n, 0);
console.log('Result (filter > 5, double, sum):', result);`,

  'Objects': `// Objects and Destructuring Example
const user = {
  name: 'Alice',
  age: 30,
  skills: ['JavaScript', 'Python', 'React'],
  address: {
    city: 'San Francisco',
    country: 'USA',
    zip: '94105'
  },
  isActive: true
};

console.log('User object:', user);
console.log('Name:', user.name);
console.log('Age:', user.age);
console.log('Skills:', user.skills.join(', '));
console.log('City:', user.address.city);

// Destructuring
const { name, age, skills } = user;
console.log(\`\${name} is \${age} years old and knows \${skills.join(', ')}\`);

// Object spread
const userWithId = { id: 1, ...user };
console.log('User with ID:', userWithId);`,

  'Async/Await': `// Async/Await Example
async function fetchData() {
  console.log('Fetching data...');
  
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return { 
    data: 'Sample data', 
    timestamp: new Date().toISOString() 
  };
}

async function main() {
  console.log('Starting main function...');
  
  try {
    const result = await fetchData();
    console.log('Data received:', result);
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  }
}

main();`,

  'Error Handling': `// Error Handling Example
try {
  console.log('Attempting to divide by zero...');
  const result = 10 / 0;
  console.log('Result:', result);
  
  console.log('Attempting to access undefined property...');
  const obj = {};
  console.log(obj.nonexistent.property);
} catch (error) {
  console.error('Error caught:', error.message);
  console.log('Error stack:', error.stack);
} finally {
  console.log('Finally block always runs!');
}

console.log('Program continues...');

// Custom error
try {
  throw new Error('This is a custom error!');
} catch (error) {
  console.error('Custom error caught:', error.message);
}`,
};

// ============================================================
// Hook Implementation
// ============================================================

/**
 * Hook for using the JavaScript sandbox with WebWorker support.
 * 
 * @param options - Configuration options
 * @returns Sandbox state and actions
 * 
 * @example
 * ```tsx
 * const { runJSCode, isExecuting, isReady, status, output } = useJSSandbox({
 *   timeout: 5000,
 *   maxWorkers: 4,
 * });
 * ```
 */
export function useJSSandbox(options: UseJSSandboxOptions = {}): UseJSSandboxReturn {
  const {
    timeout: defaultTimeout = 5000,
    maxWorkers = 4,
    autoInit = true,
  } = options;

  // State
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error' | 'timeout'>('idle');
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<SandboxOutput[]>([]);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>({
    totalWorkers: 0,
    busyWorkers: 0,
    availableWorkers: 0,
    activeExecutions: 0,
  });

  // Refs
  const manager = useRef(sandboxManager);
  const isMounted = useRef<boolean>(true);
  const statusInterval = useRef<number | null>(null);

  // ============================================================
  // Initialize Sandbox
  // ============================================================

  useEffect(() => {
    isMounted.current = true;

    if (autoInit) {
      manager.current.init(maxWorkers);
      setIsReady(true);
    }

    // Update worker status periodically
    statusInterval.current = window.setInterval(() => {
      if (isMounted.current) {
        setWorkerStatus(manager.current.getStatus());
      }
    }, 2000);


    setIsReady(true);

    return () => {
      isMounted.current = false;
      if (statusInterval.current) {
        clearInterval(statusInterval.current);
      }
      manager.current.cleanup();
    };
  }, [autoInit, maxWorkers]);

  // ============================================================
  // Core Functions
  // ============================================================

  /**
   * Run JavaScript code in the sandbox.
   */
  const runJSCode = useCallback(
    async (code: string, timeoutMs: number = defaultTimeout): Promise<JSExecutionResult> => {
      if (!code.trim()) {
        return { output: '', error: 'No code to execute' };
      }

      setIsExecuting(true);
      setStatus('running');
      setError(null);
      setExecutionTime(null);

      const timestamp = new Date().toLocaleTimeString();
      setOutput((prev) => [
        ...prev,
        { type: 'info', content: '▶️ Running code...', timestamp } as SandboxOutput,
      ]);

      try {
        const result = await manager.current.execute(code, timeoutMs);

        if (!isMounted.current) {
          return result;
        }

        setExecutionTime(result.executionTime || null);
        setIsExecuting(false);

        if (result.error) {
          setStatus('error');
          setError(result.error);
          setOutput((prev) => [
            ...prev,
            {
              type: 'error',
              content: `❌ ${result.error}`,
              timestamp: new Date().toLocaleTimeString(),
            } as SandboxOutput,
          ]);
        } else {
          setStatus('completed');
          setOutput((prev) => [
            ...prev,
            {
              type: 'info',
              content: `✅ Execution completed in ${(result.executionTime || 0).toFixed(2)}ms`,
              timestamp: new Date().toLocaleTimeString(),
            } as SandboxOutput,
            {
              type: 'result',
              content: result.output || '✅ Execution completed (no output)',
              timestamp: new Date().toLocaleTimeString(),
            } as SandboxOutput,
          ]);
        }

        return result;
      } catch (err: any) {
        if (!isMounted.current) {
          return { output: '', error: err.message };
        }

        const errorMessage = err.message || 'Unknown error occurred';
        setStatus('timeout');
        setError(errorMessage);
        setIsExecuting(false);

        setOutput((prev) => [
          ...prev,
          {
            type: 'timeout',
            content: `⏰ ${errorMessage}`,
            timestamp: new Date().toLocaleTimeString(),
          } as SandboxOutput,
        ]);

      }
    },
    [defaultTimeout]
  );

  const traceJSCode = useCallback(
    (code: string, timeoutMs: number = 10000): Promise<TraceEvent[]> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve([]);
          return;
        }

        const executionId = Date.now().toString();

        const cleanup = () => {
          if (workerRef.current) {
            workerRef.current.removeEventListener("message", handleMessage);
          }
          if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
          }
        };

        const handleMessage = (event: MessageEvent) => {
          if (event.data.id === executionId) {
            cleanup();
            resolve(event.data.trace_events || []);
          }
        };

        timeoutRef.current = window.setTimeout(() => {
          if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = new Worker(
              new URL("../workers/jsWorker.ts", import.meta.url),
              { type: "module" },
            );
          }
          cleanup();
          resolve([{
            step: 0,
            line: 0,
            event: "error",
            locals: {},
            stdout: "",
            error: "Execution Timeout: Code took too long to run."
          }]);
        }, timeoutMs);

        workerRef.current.postMessage({ id: executionId, code, action: "execute_trace" });
      });
    },
    []
  );

  return { runJSCode, traceJSCode, isExecuting, isReady };
}

export default useJSSandbox;