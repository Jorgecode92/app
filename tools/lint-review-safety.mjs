import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const scanRoots = ["index.html", "styles.css", "src", "minigame.config.json", "minis.config.json"];
const allowedExternalScripts = new Set(["https://connect.tiktok-minis.com/game/sdk.js"]);
const findings = [];

async function listFiles(target) {
  const fullPath = path.resolve(projectRoot, target);
  const dirents = await readdir(fullPath, { withFileTypes: true }).catch(() => null);

  if (!dirents) {
    return [fullPath];
  }

  const files = [];
  for (const dirent of dirents) {
    const child = path.join(fullPath, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...(await listFiles(path.relative(projectRoot, child))));
    } else {
      files.push(child);
    }
  }
  return files;
}

function addFinding(file, message) {
  findings.push(`${path.relative(projectRoot, file)}: ${message}`);
}

function scanContent(file, content) {
  if (/\beval\s*\(/.test(content)) {
    addFinding(file, "Forbidden eval() usage.");
  }
  if (/\bnew\s+Function\b/.test(content) || /[^.\w]Function\s*\(/.test(content)) {
    addFinding(file, "Forbidden Function constructor usage.");
  }
  if (/\bset(?:Timeout|Interval)\s*\(\s*["'`]/.test(content)) {
    addFinding(file, "Forbidden string-based timer usage.");
  }
  if (/createElement\s*\(\s*["'`]script["'`]\s*\)/.test(content)) {
    addFinding(file, "Dynamic script creation should be avoided.");
  }
  if (file.endsWith(".js") && !file.endsWith(path.join("src", "services", "network.js")) && /\bfetch\s*\(/.test(content)) {
    addFinding(file, "Runtime network requests must go through src/services/network.js.");
  }

  if (file.endsWith(".html")) {
    const scripts = [...content.matchAll(/<script[^>]+src=["']([^"']+)["']/g)];
    scripts.forEach((match) => {
      const src = match[1];
      if (/^https?:\/\//.test(src) && !allowedExternalScripts.has(src)) {
        addFinding(file, `External script is not allowlisted: ${src}`);
      }
    });
  }
}

const files = (await Promise.all(scanRoots.map(listFiles))).flat();
for (const file of files) {
  if (!/\.(html|css|js|json)$/.test(file)) {
    continue;
  }
  const content = await readFile(file, "utf8");
  scanContent(file, content);
}

if (findings.length > 0) {
  console.error("Review safety lint failed:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log("Review safety lint passed.");
