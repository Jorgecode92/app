import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const releaseDir = path.resolve(projectRoot, "release");
const archivePath = path.join(releaseDir, "space-invaders-defense-grid-tiktok.zip");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

await run(process.execPath, ["tools/build.mjs"]);
await mkdir(releaseDir, { recursive: true });
await rm(archivePath, { force: true });

if (process.platform === "win32") {
  await run("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Compress-Archive -Path '${path.join(projectRoot, "dist", "*")}' -DestinationPath '${archivePath}' -Force`,
  ]);
} else {
  await run("zip", ["-qr", archivePath, "."], {
    cwd: path.join(projectRoot, "dist"),
  });
}

console.log(`Created upload archive: ${archivePath}`);
