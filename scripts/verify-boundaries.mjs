import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import process from "node:process";

const repositoryRoot = new URL("../", import.meta.url);

const violations = [];

const trackedFiles = execFileSync("git", ["ls-files"], {
  cwd: repositoryRoot,
  encoding: "utf8",
})
  .split(/\r?\n/u)
  .filter(Boolean);

for (const file of trackedFiles) {
  const normalized = file.replaceAll("\\", "/");
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
  if (basename.startsWith(".env") && basename !== ".env.example") {
    violations.push(`${file}: environment file is tracked`);
  }
}

function sourceFiles(directoryUrl) {
  const directoryPath = directoryUrl.pathname.startsWith("/") && process.platform === "win32"
    ? decodeURIComponent(directoryUrl.pathname.slice(1))
    : decodeURIComponent(directoryUrl.pathname);
  const result = [];

  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const path = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...sourceFiles(new URL(`${entry.name}/`, directoryUrl)));
    } else if ([".ts", ".tsx", ".js", ".mjs"].includes(extname(entry.name))) {
      result.push(path);
    }
  }

  return result;
}

function stripCommentsAndLiterals(contents) {
  return contents
    .replace(/\/\*[\s\S]*?\*\//gu, " ")
    .replace(/\/\/[^\r\n]*/gu, " ")
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/gu, " ");
}

function rejectPatterns(directory, patterns) {
  for (const file of sourceFiles(new URL(directory, repositoryRoot))) {
    const contents = readFileSync(file, "utf8");
    for (const [pattern, message, codeOnly = false] of patterns) {
      if (pattern.test(codeOnly ? stripCommentsAndLiterals(contents) : contents)) {
        violations.push(`${relative(process.cwd(), file)}: ${message}`);
      }
    }
  }
}

rejectPatterns("apps/web/src/", [
  [/SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE|SETUP_TOKEN/u, "server secret referenced by browser source"],
  [/ANTHROPIC_API_KEY|CLAUDE_API_KEY/u, "runtime Claude credential referenced by browser source"],
  [/\bMediaRecorder\b|\bSpeechRecognition\b|\bwebkitSpeechRecognition\b|\bgetUserMedia\b/u, "forbidden voice-input API referenced"],
]);

rejectPatterns("packages/game-core/src/", [
  [/from\s+["'](?:react|next|@babylonjs\/)/u, "pure game core imports a framework"],
  [/\b(?:document|window|HTMLElement|WebGLRenderingContext)\b/u, "pure game core references a browser global", true],
]);

if (violations.length > 0) {
  process.stderr.write(`Repository boundary verification failed:\n- ${violations.join("\n- ")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Repository boundaries verified.\n");
}
