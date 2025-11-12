import { runPython } from "./python-model.ts";
import { runJava } from "./java-model.ts";

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export type Language = "python" | "java";

export async function runUserCode(lang: Language, code: string): Promise<RunResult> {
  if (lang === "python") return runPython(code);
  if (lang === "java") return runJava(code);
  throw new Error(`Unsupported language: ${lang}`);
}
