// =========================
// pages/PlaygroundPage.tsx
// =========================
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, RotateCcw, TerminalSquare } from "lucide-react";
import { loadMonaco, registerCsharpBasics, type MonacoApi } from "../lib/monacoCsharp";
import "../styles/playground.css";

const STARTER_CODE = `using System;

int[] numbers = { 3, 1, 4, 1, 5, 9 };
int total = 0;

foreach (int n in numbers)
{
    total += n;
}

Console.WriteLine($"Sum: {total}");
Console.WriteLine("Hello from the playground!");
`;

type RunStatus = "idle" | "running" | "done" | "error";
type OutputKind = "neutral" | "success" | "error";

interface CompileResponse {
  compiled: boolean;
  compileOutput: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  didExecute: boolean;
  error?: string;
}

export default function PlaygroundPage(): JSX.Element {
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<MonacoApi>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [outputKind, setOutputKind] = useState<OutputKind>("neutral");
  const [output, setOutput] = useState<string>("Press Run to compile and execute your code.");

  const runCode = useCallback(async (): Promise<void> => {
    const editor = editorRef.current;
    if (!editor) return;
    const source = editor.getValue() as string;

    if (!source.trim()) {
      setOutputKind("error");
      setOutput("Write some code first.");
      return;
    }

    setStatus("running");
    setOutputKind("neutral");
    setOutput("Compiling and running…");

    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });

      const data: CompileResponse = await res.json();

      if (!res.ok) {
        setStatus("error");
        setOutputKind("error");
        setOutput(data.error ?? "Something went wrong compiling your code.");
        return;
      }

      if (!data.compiled) {
        setStatus("error");
        setOutputKind("error");
        setOutput(data.compileOutput || "Compilation failed.");
        return;
      }

      const parts: string[] = [];
      if (data.stdout) parts.push(data.stdout);
      if (data.stderr) parts.push(`\n[stderr]\n${data.stderr}`);
      if (parts.length === 0) parts.push("(no output)");
      if (data.exitCode !== null && data.exitCode !== 0) {
        parts.push(`\nProcess exited with code ${data.exitCode}`);
      }

      setStatus("done");
      setOutputKind(!data.exitCode ? "success" : "error");
      setOutput(parts.join("\n"));
    } catch {
      setStatus("error");
      setOutputKind("error");
      setOutput("Couldn't reach the compile service. Try again in a moment.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadMonaco()
      .then((monaco) => {
        if (cancelled || !editorHostRef.current) return;
        registerCsharpBasics(monaco);

        const editor = monaco.editor.create(editorHostRef.current, {
          value: STARTER_CODE,
          language: "csharp",
          theme: "vs-dark",
          fontSize: 14,
          minimap: { enabled: false },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          tabSize: 4,
          padding: { top: 16, bottom: 16 },
          quickSuggestions: { other: true, comments: false, strings: false },
        });

        editorRef.current = editor;
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
          void runCode();
        });

        setEditorReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setEditorError(err instanceof Error ? err.message : "Couldn't load the code editor.");
      });

    return () => {
      cancelled = true;
      editorRef.current?.dispose?.();
      editorRef.current = null;
    };
  }, [runCode]);

  function resetCode() {
    editorRef.current?.setValue(STARTER_CODE);
    setStatus("idle");
    setOutputKind("neutral");
    setOutput("Press Run to compile and execute your code.");
  }

  return (
    <div className="playground-page-shell">
      <div className="playground-page-frame">
        <header className="art-page-header">
          <Link to="/" className="art-back-link">
            <ArrowLeft size={16} />
            Back
          </Link>

          <div className="art-page-title-block">
            <div className="art-page-icon-wrap">
              <TerminalSquare size={22} />
            </div>
            <div>
              <p className="eyebrow-text">Interactive</p>
              <h1 className="art-page-title">C# Playground</h1>
            </div>
          </div>

          <p className="art-page-subtitle">
            A small in-browser C# editor. Write a snippet, hit Run, and it compiles and executes
            for real, no project setup required. Autocomplete here is intentionally minimal:
            keywords and a handful of snippets, the way you'd get in a quick interview-style code
            editor, not full IntelliSense.
          </p>
        </header>

        <div className="playground-toolbar">
          <button
            type="button"
            className="button button-primary playground-run-btn"
            onClick={() => void runCode()}
            disabled={!editorReady || status === "running"}
          >
            <Play size={16} />
            {status === "running" ? "Running…" : "Run"}
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={resetCode}
            disabled={!editorReady}
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <span className="playground-hint">Ctrl / Cmd + Enter to run</span>
        </div>

        <div className="playground-editor-wrap glass-panel">
          {!editorReady && (
            <div className="playground-editor-loading">
              {editorError ? editorError : "Loading editor…"}
            </div>
          )}
          <div ref={editorHostRef} className="playground-editor-host" />
        </div>

        <div className="playground-output-wrap glass-panel">
          <p className="playground-output-label">Output</p>
          <pre className={`playground-output playground-output-${outputKind}`}>{output}</pre>
        </div>
      </div>
    </div>
  );
}
