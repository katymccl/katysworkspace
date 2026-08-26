// =========================
// api/compile.js
// =========================
// Vercel serverless function entry point. Actual compile+run logic lives
// in ./_lib/compileCsharp.js, shared with the Vite dev server middleware
// (see vite.config.ts) so `npm run dev` works the same way locally.

import { compileCsharp } from "./_lib/compileCsharp.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const source = typeof req.body?.source === "string" ? req.body.source : "";
  const { status, body } = await compileCsharp(source);
  res.status(status).json(body);
}
