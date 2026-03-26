import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
]);

export interface ProjectFile {
  path: string;
  content: string;
}

/**
 * Recursively collect .ts and .tsx files from a directory.
 * Skips node_modules, dist, build, coverage, .git, and dotfiles.
 * Results are sorted alphabetically by path.
 */
export async function collectFiles(dir: string): Promise<ProjectFile[]> {
  const files: ProjectFile[] = [];

  async function walk(currentDir: string, relativePath: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const relPath = relativePath
          ? join(relativePath, entry.name)
          : entry.name;
        await walk(fullPath, relPath);
      } else if (/\.tsx?$/.test(entry.name)) {
        const content = await readFile(fullPath, "utf-8");
        const filePath = relativePath
          ? join(relativePath, entry.name)
          : entry.name;
        files.push({ path: filePath, content });
      }
    }
  }

  await walk(dir, "");
  return files;
}
