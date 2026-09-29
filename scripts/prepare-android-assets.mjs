import { cp, mkdir, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webBuild = path.join(repositoryRoot, "dist");
const androidAssets = path.join(repositoryRoot, "android", "app", "src", "main", "assets", "www");

try {
  const index = await stat(path.join(webBuild, "index.html"));
  if (!index.isFile()) throw new Error();
} catch {
  throw new Error("The web build is missing. Run `pnpm build` before preparing Android assets.");
}

await rm(androidAssets, { recursive: true, force: true });
await mkdir(path.dirname(androidAssets), { recursive: true });
await cp(webBuild, androidAssets, { recursive: true });
console.log(`Copied the production web app to ${path.relative(repositoryRoot, androidAssets)}`);
