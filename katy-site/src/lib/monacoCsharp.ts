// =========================
// lib/monacoCsharp.ts
// =========================
// Loads the Monaco editor directly from a CDN via its AMD loader so the
// (fairly large) editor package never has to be bundled with the rest of
// the site. Also registers a small, hand-picked C# completion provider —
// just keywords and a handful of common snippets, similar to what you'd
// get in a lightweight "interview style" code editor rather than full
// C# IntelliSense.
//
// We deliberately avoid depending on the "monaco-editor" npm package for
// types: it's a large package and is only ever loaded from the CDN at
// runtime, never bundled. `MonacoApi` below is an intentionally loose
// alias for the global `window.monaco` object.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MonacoApi = any;

declare global {
  interface Window {
    monaco?: MonacoApi;
    require?: {
      config: (options: { paths: Record<string, string> }) => void;
      (deps: string[], callback: () => void, errback?: (err: unknown) => void): void;
    };
  }
}

const MONACO_VERSION = "0.52.2";
const MONACO_CDN_BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs`;
const LOADER_SCRIPT_ID = "monaco-amd-loader";

let monacoPromise: Promise<MonacoApi> | null = null;

export function loadMonaco(): Promise<MonacoApi> {
  if (window.monaco) {
    return Promise.resolve(window.monaco);
  }

  if (monacoPromise) {
    return monacoPromise;
  }

  monacoPromise = new Promise<MonacoApi>((resolve, reject) => {
    const initialize = () => {
      try {
        const amdRequire = window.require;
        if (!amdRequire) {
          reject(new Error("The AMD loader didn't attach to window.require."));
          return;
        }
        amdRequire.config({ paths: { vs: MONACO_CDN_BASE } });
        amdRequire(
          ["vs/editor/editor.main"],
          () => {
            if (window.monaco) {
              resolve(window.monaco);
            } else {
              reject(new Error("Monaco loaded but window.monaco was not set."));
            }
          },
          (err: unknown) => reject(err instanceof Error ? err : new Error("Failed to load Monaco.")),
        );
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Failed to initialize Monaco."));
      }
    };

    const existingLoader = document.getElementById(LOADER_SCRIPT_ID);

    if (existingLoader) {
      if (window.require) {
        initialize();
      } else {
        existingLoader.addEventListener("load", initialize, { once: true });
        existingLoader.addEventListener(
          "error",
          () => reject(new Error("Failed to load the editor from the CDN.")),
          { once: true },
        );
      }
      return;
    }

    const script = document.createElement("script");
    script.id = LOADER_SCRIPT_ID;
    script.src = `${MONACO_CDN_BASE}/loader.js`;
    script.async = true;
    script.onload = initialize;
    script.onerror = () => reject(new Error("Failed to load the editor from the CDN."));
    document.body.appendChild(script);
  });

  return monacoPromise;
}

const CSHARP_KEYWORDS = [
  "abstract", "as", "base", "bool", "break", "byte", "case", "catch", "char",
  "checked", "class", "const", "continue", "decimal", "default", "delegate",
  "do", "double", "else", "enum", "event", "explicit", "extern", "false",
  "finally", "fixed", "float", "for", "foreach", "goto", "if", "implicit",
  "in", "int", "interface", "internal", "is", "lock", "long", "namespace",
  "new", "null", "object", "operator", "out", "override", "params",
  "private", "protected", "public", "readonly", "ref", "return", "sbyte",
  "sealed", "short", "sizeof", "stackalloc", "static", "string", "struct",
  "switch", "this", "throw", "true", "try", "typeof", "uint", "ulong",
  "unchecked", "unsafe", "ushort", "using", "var", "virtual", "void",
  "volatile", "while", "async", "await", "get", "set", "record", "init",
];

let completionProviderRegistered = false;

export function registerCsharpBasics(monaco: MonacoApi): void {
  if (completionProviderRegistered) {
    return;
  }
  completionProviderRegistered = true;

  monaco.languages.registerCompletionItemProvider("csharp", {
    triggerCharacters: ["."],
    provideCompletionItems(model: MonacoApi, position: MonacoApi) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const keywordSuggestions = CSHARP_KEYWORDS.map((keyword) => ({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: keyword,
        range,
      }));

      const snippetSuggestions = [
        {
          label: "cw",
          detail: "Console.WriteLine();",
          insertText: 'Console.WriteLine(${1:"$0"});',
        },
        {
          label: "using System",
          detail: "using System;",
          insertText: "using System;",
        },
        {
          label: "main",
          detail: "static void Main entry point",
          insertText:
            "class Program\n{\n    static void Main(string[] args)\n    {\n        $0\n    }\n}",
        },
        {
          label: "for",
          detail: "for loop",
          insertText: "for (int ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++)\n{\n    $0\n}",
        },
        {
          label: "foreach",
          detail: "foreach loop",
          insertText: "foreach (var ${1:item} in ${2:collection})\n{\n    $0\n}",
        },
        {
          label: "if",
          detail: "if statement",
          insertText: "if (${1:condition})\n{\n    $0\n}",
        },
        {
          label: "trycatch",
          detail: "try / catch",
          insertText: "try\n{\n    $0\n}\ncatch (Exception ex)\n{\n    Console.WriteLine(ex.Message);\n}",
        },
        {
          label: "class",
          detail: "class declaration",
          insertText: "class ${1:Name}\n{\n    $0\n}",
        },
      ].map((snippet) => ({
        label: snippet.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        detail: snippet.detail,
        insertText: snippet.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      }));

      return { suggestions: [...keywordSuggestions, ...snippetSuggestions] };
    },
  });
}
