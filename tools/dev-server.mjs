import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(process.cwd(), process.argv[2] || ".");
const port = Number.parseInt(process.argv[3] || "3000", 10);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
]);

function isInsideRoot(filePath) {
  const relative = path.relative(rootDir, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function resolveFile(url) {
  const requestPath = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const normalized = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.resolve(rootDir, `.${normalized}`);

  if (!isInsideRoot(filePath)) {
    return null;
  }

  const fileStat = await stat(filePath).catch(() => null);
  if (fileStat?.isFile()) {
    return filePath;
  }

  return null;
}

const server = createServer(async (request, response) => {
  const filePath = await resolveFile(request.url || "/");

  if (!filePath) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": mimeTypes.get(path.extname(filePath)) || "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  const scriptName = path.basename(fileURLToPath(import.meta.url));
  console.log(`${scriptName} serving ${rootDir}`);
  console.log(`Local URL: http://localhost:${port}`);
});
