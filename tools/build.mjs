import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const distDir = path.resolve(projectRoot, "dist");

function assertInsideProject(targetPath) {
  const relative = path.relative(projectRoot, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside project root: ${targetPath}`);
  }
}

async function copyIfPresent(from, to) {
  await cp(path.resolve(projectRoot, from), path.resolve(distDir, to), {
    recursive: true,
    force: true,
  }).catch((error) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
  });
}

assertInsideProject(distDir);
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await copyIfPresent("index.html", "index.html");
await copyIfPresent("styles.css", "styles.css");
await copyIfPresent("src", "src");
await copyIfPresent("privacy.html", "privacy.html");
await copyIfPresent("terms.html", "terms.html");
await copyIfPresent("minigame.config.json", "minigame.config.json");
await copyIfPresent("minis.config.json", "minis.config.json");

await writeFile(
  path.join(distDir, "build-info.json"),
  `${JSON.stringify(
    {
      name: "space-invaders-defense-grid",
      runtime: "html",
      entry: "index.html",
      generatedAt: new Date().toISOString(),
      manualPlaceholders: [
        "TIKTOK_CLIENT_KEY",
        "TIKTOK_REWARDED_AD_UNIT_ID",
        "TRUSTED_API_DOMAINS",
      ],
    },
    null,
    2,
  )}\n`,
);

console.log(`Built TikTok HTML package folder: ${distDir}`);
