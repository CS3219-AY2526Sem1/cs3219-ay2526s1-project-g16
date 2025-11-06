import type { Request, Response } from "express";
import { runUserCode } from "../model/coderunner-model.ts";
import type { Language } from "../model/coderunner-model.ts";

export async function runCodeHandler(req: Request, res: Response) {
  const { language, code } = req.body as { language?: string; code?: string };

  if (!language || !code) {
    return res.status(400).json({ error: "Missing 'language' or 'code'." });
  }

  const lang = language.toLowerCase() as Language;
  if (lang !== "python" && lang !== "java") {
    return res.status(400).json({ error: "Unsupported language. Use 'python' or 'java'." });
  }

  try {
    const result = await runUserCode(lang, code);
    res.json(result);
  } catch (err: any) {
    console.error("[CodeRunner Error]", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
}
