import {
  analyzeTypesProject,
  analyzeCallGraphProject,
  analyzeModules,
} from "../shared/analyze.js";
import {
  renderTypeMap,
  renderCallGraph,
  renderModuleGraph,
} from "../shared/render.js";
import type { ProjectFile } from "./files.js";

export const VIEW_NAMES = ["type-map", "call-graph", "module-graph"] as const;
export type ViewName = (typeof VIEW_NAMES)[number];

/**
 * Analyze project files and render the specified view as an SVG string.
 */
export function renderSvg(files: ProjectFile[], view: ViewName): string {
  switch (view) {
    case "type-map":
      return renderTypeMap(analyzeTypesProject(files));
    case "call-graph":
      return renderCallGraph(analyzeCallGraphProject(files));
    case "module-graph":
      return renderModuleGraph(analyzeModules(files));
  }
}
