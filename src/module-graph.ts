import { analyzeModules } from "./shared/analyze";
import { renderModuleGraph } from "./shared/render";
import { setupPage } from "./shared/page";
import { MODULE_GRAPH_SAMPLE } from "./shared/sample-code";

/**
 * Parse multi-file input. Files are separated by lines matching:
 *   // --- path/to/file.ts ---
 */
function parseFiles(input: string): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  const lines = input.split("\n");
  let currentPath: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\/\/\s*---\s*(.+?)\s*---\s*$/);
    if (match) {
      if (currentPath) {
        files.push({ path: currentPath, content: currentLines.join("\n") });
      }
      currentPath = match[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentPath) {
    files.push({ path: currentPath, content: currentLines.join("\n") });
  }

  return files;
}

setupPage({
  inputId: "code-input",
  outputId: "diagram-output",
  sampleCode: MODULE_GRAPH_SAMPLE,
  onUpdate: (code) => {
    const files = parseFiles(code);
    if (files.length === 0) {
      return '<div class="empty-state">Use // --- path/to/file.ts --- comments to define files</div>';
    }
    return renderModuleGraph(analyzeModules(files));
  },
});
