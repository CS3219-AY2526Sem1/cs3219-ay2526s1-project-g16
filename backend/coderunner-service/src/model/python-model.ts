import { spawn } from "child_process";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { RunResult } from "./coderunner-model.ts";

async function runCommand(
  cmd: string,
  args: string[],
  timeoutMs = 5000
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });

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

export async function runPython(code: string): Promise<RunResult> {
  const file = join(tmpdir(), `user_${Date.now()}.py`);
  await fs.writeFile(file, code, "utf8");
  return runCommand("python3", [file]);
}
