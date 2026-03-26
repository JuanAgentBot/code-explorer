import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectFiles } from "./files";

describe("collectFiles", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "code-explorer-test-"));

    // src/index.ts
    // src/utils/helper.ts
    // src/utils/style.css        (not collected - wrong extension)
    // node_modules/dep/a.ts      (skipped directory)
    // .hidden/b.ts               (skipped dotfile directory)
    // dist/c.ts                  (skipped directory)
    // readme.md                  (not collected)
    await mkdir(join(tmpDir, "src", "utils"), { recursive: true });
    await mkdir(join(tmpDir, "node_modules", "dep"), { recursive: true });
    await mkdir(join(tmpDir, ".hidden"), { recursive: true });
    await mkdir(join(tmpDir, "dist"), { recursive: true });

    await writeFile(join(tmpDir, "src", "index.ts"), "export const x = 1;");
    await writeFile(
      join(tmpDir, "src", "utils", "helper.ts"),
      "export function help() {}",
    );
    await writeFile(join(tmpDir, "src", "utils", "style.css"), "body {}");
    await writeFile(
      join(tmpDir, "node_modules", "dep", "a.ts"),
      "export const a = 1;",
    );
    await writeFile(join(tmpDir, ".hidden", "b.ts"), "export const b = 1;");
    await writeFile(join(tmpDir, "dist", "c.ts"), "export const c = 1;");
    await writeFile(join(tmpDir, "readme.md"), "# Hello");
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it("collects .ts files from directory tree", async () => {
    const files = await collectFiles(tmpDir);
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["src/index.ts", "src/utils/helper.ts"]);
  });

  it("reads file content", async () => {
    const files = await collectFiles(tmpDir);
    const index = files.find((f) => f.path === "src/index.ts");
    expect(index?.content).toBe("export const x = 1;");
  });

  it("skips node_modules", async () => {
    const files = await collectFiles(tmpDir);
    expect(files.find((f) => f.path.includes("node_modules"))).toBeUndefined();
  });

  it("skips dotfile directories", async () => {
    const files = await collectFiles(tmpDir);
    expect(files.find((f) => f.path.includes(".hidden"))).toBeUndefined();
  });

  it("skips dist directory", async () => {
    const files = await collectFiles(tmpDir);
    expect(files.find((f) => f.path.includes("dist"))).toBeUndefined();
  });

  it("returns empty array for directory with no TS files", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "ce-empty-"));
    await writeFile(join(emptyDir, "readme.md"), "# Hello");
    const files = await collectFiles(emptyDir);
    expect(files).toEqual([]);
    await rm(emptyDir, { recursive: true });
  });

  it("collects .tsx files", async () => {
    const tsxDir = await mkdtemp(join(tmpdir(), "ce-tsx-"));
    await writeFile(
      join(tsxDir, "app.tsx"),
      "export default () => <div/>;",
    );
    const files = await collectFiles(tsxDir);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("app.tsx");
    await rm(tsxDir, { recursive: true });
  });

  it("sorts files alphabetically", async () => {
    const sortDir = await mkdtemp(join(tmpdir(), "ce-sort-"));
    await writeFile(join(sortDir, "z.ts"), "export const z = 1;");
    await writeFile(join(sortDir, "a.ts"), "export const a = 1;");
    await writeFile(join(sortDir, "m.ts"), "export const m = 1;");
    const files = await collectFiles(sortDir);
    expect(files.map((f) => f.path)).toEqual(["a.ts", "m.ts", "z.ts"]);
    await rm(sortDir, { recursive: true });
  });
});
