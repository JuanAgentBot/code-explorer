import { describe, it, expect } from "vitest";
import { renderSvg, VIEW_NAMES } from "./svg";
import type { ProjectFile } from "./files";

const sampleFiles: ProjectFile[] = [
  {
    path: "types.ts",
    content: `
export interface User { name: string; }
export interface Admin extends User { role: string; }
    `,
  },
  {
    path: "service.ts",
    content: `
import { User } from "./types";
export function getUser(): User { return { name: "test" }; }
export function greet() { return getUser().name; }
    `,
  },
];

describe("renderSvg", () => {
  it("renders type-map SVG", () => {
    const svg = renderSvg(sampleFiles, "type-map");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("User");
    expect(svg).toContain("Admin");
  });

  it("renders call-graph SVG", () => {
    const svg = renderSvg(sampleFiles, "call-graph");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("getUser");
    expect(svg).toContain("greet");
  });

  it("renders module-graph SVG", () => {
    const svg = renderSvg(sampleFiles, "module-graph");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("types.ts");
    expect(svg).toContain("service.ts");
  });

  it("returns empty-state SVG when no nodes found", () => {
    const emptyFiles: ProjectFile[] = [
      { path: "empty.ts", content: "const x = 1;" },
    ];
    const svg = renderSvg(emptyFiles, "type-map");
    expect(svg).toContain("<svg");
    expect(svg).toContain("No types found");
  });

  it("handles all view names", () => {
    for (const view of VIEW_NAMES) {
      const svg = renderSvg(sampleFiles, view);
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
    }
  });
});
