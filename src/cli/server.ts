import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import type { ProjectFile } from "./files";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/**
 * Inject project data as a <script> tag before </head>.
 * Escapes < as \u003c to prevent breaking out of the script tag.
 */
export function injectProjectData(
  html: string,
  files: ProjectFile[],
): string {
  const json = JSON.stringify(files).replace(/</g, "\\u003c");
  const script = `<script>window.__CODE_EXPLORER_PROJECT__=${json};</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

/**
 * Start an HTTP server that serves pre-built web assets with
 * project file data injected into the HTML.
 */
export async function startServer(
  files: ProjectFile[],
  port: number,
  webDir: string,
): Promise<Server> {
  const resolvedWebDir = resolve(webDir);
  const rawHtml = await readFile(join(resolvedWebDir, "index.html"), "utf-8");
  const html = injectProjectData(rawHtml, files);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    // Serve patched index.html for root
    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    // Serve static assets (prevent directory traversal)
    const filePath = resolve(join(resolvedWebDir, pathname));
    if (!filePath.startsWith(resolvedWebDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    try {
      const content = await readFile(filePath);
      const ext = extname(pathname);
      const mime = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}
