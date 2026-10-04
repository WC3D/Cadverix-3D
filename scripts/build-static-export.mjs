import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generateServiceWorker } from "./generate-service-worker.mjs";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const webRoot = join(repositoryRoot, "apps", "web");
const exportRoot = join(webRoot, ".next-export");
const nextCli = join(repositoryRoot, "node_modules", "next", "dist", "bin", "next");
const nextEnvPath = join(webRoot, "next-env.d.ts");
const originalNextEnv = await readFile(nextEnvPath, "utf8");

// Never allow the verifier to accept files left by an earlier successful build.
await rm(exportRoot, { recursive: true, force: true });

const build = spawnSync(process.execPath, [nextCli, "build", webRoot, "--webpack"], {
  cwd: repositoryRoot,
  env: { ...process.env, STATIC_EXPORT: "true" },
  stdio: "inherit",
});

// Next rewrites this tracked development helper even when using a separate
// export distDir. Keep static builds from dirtying the worktree.
await writeFile(nextEnvPath, originalNextEnv);

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

await import("./verify-static-worker-assets.mjs");
await generateServiceWorker(exportRoot);
