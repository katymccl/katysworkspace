// =========================
// api/_lib/compileCsharp.js
// =========================
// Shared compile+run logic, used by both the Vercel serverless function
// (api/compile.js, for production) and the Vite dev server middleware
// (vite.config.ts, so `npm run dev` works too without needing `vercel dev`).
//
// Proxies to the Compiler Explorer (godbolt.org) public API, server-to-
// server, so the browser never talks to a third party directly. It's a
// free, community-run service with no uptime guarantee for anonymous use,
// so failures are surfaced to the caller rather than retried.

const COMPILER_ID = "dotnet80csharpcoreclr"; // .NET 8.0, CoreCLR (supports execution)
const CE_ENDPOINT = `https://godbolt.org/api/compiler/${COMPILER_ID}/compile`;
const MAX_SOURCE_LENGTH = 20000;
const REQUEST_TIMEOUT_MS = 20000;

function linesToText(lines) {
  if (!Array.isArray(lines)) return "";
  return lines.map((line) => (line && typeof line.text === "string" ? line.text : "")).join("\n");
}

/**
 * @param {string} source
 * @returns {Promise<{ status: number, body: Record<string, unknown> }>}
 */
export async function compileCsharp(source) {
  if (typeof source !== "string" || !source.trim()) {
    return { status: 400, body: { error: "Missing source code." } };
  }

  if (source.length > MAX_SOURCE_LENGTH) {
    return {
      status: 400,
      body: { error: `Source is too long (max ${MAX_SOURCE_LENGTH} characters).` },
    };
  }

  const payload = {
    source,
    compiler: COMPILER_ID,
    options: {
      userArguments: "",
      compilerOptions: {
        executorRequest: true,
      },
      filters: {
        execute: true,
        binary: false,
      },
      executeParameters: {
        args: [],
        stdin: "",
      },
      tools: [],
      libraries: [],
    },
    lang: "csharp",
    allowStoreCodeDebug: true,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const ceResponse = await fetch(CE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!ceResponse.ok) {
      return { status: 502, body: { error: `Compiler service returned ${ceResponse.status}.` } };
    }

    const data = await ceResponse.json();

    const compileOutput = [linesToText(data.stdout), linesToText(data.stderr)]
      .filter(Boolean)
      .join("\n");

    // Compiler Explorer nests execution results under `execResult` in the
    // common case, but fall back to top-level fields defensively in case a
    // given compiler backend reports execution differently.
    const execResult = data.execResult ?? (data.didExecute ? data : null);
    const compiled = typeof data.code === "number" ? data.code === 0 : Boolean(execResult);

    const body = {
      compiled,
      compileOutput,
      stdout: execResult ? linesToText(execResult.stdout) : "",
      stderr: execResult ? linesToText(execResult.stderr) : "",
      exitCode: execResult && typeof execResult.code === "number" ? execResult.code : null,
      didExecute: Boolean(data.didExecute) || Boolean(data.execResult),
    };

    return { status: 200, body };
  } catch (err) {
    clearTimeout(timeout);
    const timedOut = err && err.name === "AbortError";
    return {
      status: 504,
      body: {
        error: timedOut
          ? "The compiler took too long to respond. Try again."
          : "Couldn't reach the compiler service. Try again in a moment.",
      },
    };
  }
}
