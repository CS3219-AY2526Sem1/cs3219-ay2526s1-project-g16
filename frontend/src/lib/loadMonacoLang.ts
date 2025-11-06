export async function ensureMonacoLanguage(lang: "java" | "python") {
  if (lang === "java") {
    await import("monaco-editor/esm/vs/basic-languages/java/java.contribution");
  } else {
    await import("monaco-editor/esm/vs/basic-languages/python/python.contribution");
  }
}