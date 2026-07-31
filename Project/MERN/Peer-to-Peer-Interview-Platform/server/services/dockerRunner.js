const vm = require("vm");

const TIMEOUT_MS = 2000;
const MAX_OUTPUT_LENGTH = 4000;

/**
 * Demo sandbox: evaluates simple JavaScript only via Node vm module.
 * No child_process or shell — user input never touches the OS.
 */
function runJavaScript(code) {
  const logs = [];
  const sandbox = {
    console: {
      log: (...args) => {
        logs.push(
          args
            .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
            .join(" ")
        );
      },
    },
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Date,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
  };

  const context = vm.createContext(sandbox);

  try {
    const wrapped = `(function() {\n${code}\n})();`;
    const script = new vm.Script(wrapped, { timeout: TIMEOUT_MS });
    const returnValue = script.runInContext(context, { timeout: TIMEOUT_MS });

    const output = logs.join("\n").slice(0, MAX_OUTPUT_LENGTH);
    const result =
      returnValue === undefined
        ? null
        : typeof returnValue === "object"
          ? JSON.stringify(returnValue)
          : String(returnValue);

    return { success: true, output, result, error: null };
  } catch (err) {
    return {
      success: false,
      output: logs.join("\n").slice(0, MAX_OUTPUT_LENGTH),
      result: null,
      error: err.message,
    };
  }
}

module.exports = { runJavaScript };
