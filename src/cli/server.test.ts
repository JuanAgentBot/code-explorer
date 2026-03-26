import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { injectProjectData, startServer } from "./server";
import type { Server } from "node:http";

describe("injectProjectData", () => {
  it("injects script tag before </head>", () => {
    const html =
      "<html><head><title>Test</title></head><body></body></html>";
    const files = [{ path: "a.ts", content: "export const x = 1;" }];
    const result = injectProjectData(html, files);
    expect(result).toContain("window.__CODE_EXPLORER_PROJECT__=");
    expect(result).toContain("a.ts");
    // Script appears before </head>
    const scriptIdx = result.indexOf("__CODE_EXPLORER_PROJECT__");
    const headIdx = result.indexOf("</head>");
    expect(scriptIdx).toBeLessThan(headIdx);
  });

  it("preserves original HTML outside head", () => {
    const html =
      "<!doctype html><html><head></head><body><div>content</div></body></html>";
    const result = injectProjectData(html, []);
    expect(result).toContain("<body><div>content</div></body>");
  });

  it("handles empty file list", () => {
    const html = "<head></head>";
    const result = injectProjectData(html, []);
    expect(result).toContain("__CODE_EXPLORER_PROJECT__=[]");
  });

  it("escapes < to prevent script injection", () => {
    const files = [
      { path: "test.ts", content: 'const s = "</script>";' },
    ];
    const html = "<head></head>";
    const result = injectProjectData(html, files);
    // All < characters in the JSON should be escaped as \u003c
    const scriptContent = result.match(
      /window\.__CODE_EXPLORER_PROJECT__=(.+?);/,
    )![1];
    expect(scriptContent).not.toContain("<");
    expect(scriptContent).toContain("\\u003c");
  });
});

describe("startServer", () => {
  let tmpDir: string;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "ce-server-"));
    await mkdir(join(tmpDir, "assets"));
    await writeFile(
      join(tmpDir, "index.html"),
      '<!doctype html><html><head><title>CE</title></head><body>app</body></html>',
    );
    await writeFile(
      join(tmpDir, "assets", "main.js"),
      "console.log('hello');",
    );
    await writeFile(join(tmpDir, "assets", "main.css"), "body { color: red }");

    const files = [{ path: "src/index.ts", content: "export const x = 1;" }];
    server = await startServer(files, 0, tmpDir);
    const addr = server.address() as { port: number };
    baseUrl = `http://localhost:${addr.port}`;
  });

  afterAll(async () => {
    server.close();
    await rm(tmpDir, { recursive: true });
  });

  it("serves index.html with injected project data", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("__CODE_EXPLORER_PROJECT__");
    expect(body).toContain("src/index.ts");
  });

  it("serves static JS assets", async () => {
    const res = await fetch(`${baseUrl}/assets/main.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/javascript");
    const body = await res.text();
    expect(body).toBe("console.log('hello');");
  });

  it("serves static CSS assets", async () => {
    const res = await fetch(`${baseUrl}/assets/main.css`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/css");
  });

  it("returns 404 for missing files", async () => {
    const res = await fetch(`${baseUrl}/nonexistent.js`);
    expect(res.status).toBe(404);
  });
});
