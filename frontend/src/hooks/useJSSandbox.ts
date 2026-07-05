import { useCallback } from "react";
import { useSandboxCore } from "./useSandboxCore";
import { TraceEvent } from "./useTimelineEngine";

export interface JSExecutionResult {
  output: string;
  error: string | null;
  trace_events?: TraceEvent[];
}

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

export function useJSSandbox() {
  const createWorker = useCallback(
    () =>
      new Worker(new URL("../workers/jsWorker.ts", import.meta.url), {
        type: "module",
      }),
    []
  );

  const { executeCode, isExecuting, isReady } = useSandboxCore(createWorker);

  const runJSCode = useCallback(
    (code: string, timeoutMs: number = 5000): Promise<JSExecutionResult> => {
      return executeCode<JSExecutionResult>(
        { code, action: "execute_code" },
        timeoutMs,
        (data) => ({
          output: data.output || data.results || "",
          error: data.error || null,
        }),
        {
          output: "",
          error: "Execution Timeout: The code took too long to run and was terminated.",
        }
      );
    },
    [executeCode]
  );

  const traceJSCode = useCallback(
    (code: string, timeoutMs: number = 10000): Promise<TraceEvent[]> => {
      return executeCode<TraceEvent[]>(
        { code, action: "execute_trace" },
        timeoutMs,
        (data) => data.trace_events || [],
        [{
          step: 0,
          line: 0,
          event: "error",
          locals: {},
          stdout: "",
          error: "Execution Timeout: Code took too long to run."
        }]
      );
    },
    [executeCode]
  );

  return { runJSCode, traceJSCode, isExecuting, isReady };
}

export default useJSSandbox;