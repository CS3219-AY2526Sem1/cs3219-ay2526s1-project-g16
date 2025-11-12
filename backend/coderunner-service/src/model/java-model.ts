import { spawn } from "child_process";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { RunResult } from "./coderunner-model.ts";

async function runCommand(
  cmd: string,
  args: string[],
  cwd?: string,
  timeoutMs = 5000
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        child.kill("SIGKILL");
        reject(new Error("Execution timed out"));
      }
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code });
    });
  });
}

export async function runJava(code: string): Promise<RunResult> {
  const baseDir = join(tmpdir(), `java_${Date.now()}`);
  await fs.mkdir(baseDir, { recursive: true });

  const javaFile = join(baseDir, "Main.java");
  await fs.writeFile(javaFile, code, "utf8");

  const compile = await runCommand("javac", [javaFile], baseDir);
  if (compile.exitCode !== 0) return compile;

  return runCommand("java", ["-cp", baseDir, "Main"], baseDir);
}
