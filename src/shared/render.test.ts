import { describe, it, expect } from "vitest";
import {
  layeredLayout,
  renderTypeMap,
  renderCallGraph,
  renderModuleGraph,
} from "./render";

// --- layeredLayout ---

const UNIT = { width: 100, height: 40 };
const unitSize = () => UNIT;

describe("layeredLayout", () => {
  it("returns empty map for no nodes", () => {
    const result = layeredLayout([], [], unitSize);
    expect(result.size).toBe(0);
  });

  it("positions a single node at padding offset", () => {
    const result = layeredLayout(["A"], [], unitSize);
    expect(result.size).toBe(1);
    const a = result.get("A")!;
    expect(a.x).toBe(40); // default padX
    expect(a.y).toBe(40); // default padY
    expect(a.width).toBe(100);
    expect(a.height).toBe(40);
  });

  it("assigns two connected nodes to different layers", () => {
    const result = layeredLayout(
      ["A", "B"],
      [{ from: "A", to: "B" }],
      unitSize,
    );
    const a = result.get("A")!;
    const b = result.get("B")!;
    // A has edge to B, so A is on top (lower y)
    expect(a.y).toBeLessThan(b.y);
  });

  it("lays out a chain A → B → C in three layers", () => {
    const result = layeredLayout(
      ["A", "B", "C"],
      [
        { from: "A", to: "B" },
        { from: "B", to: "C" },
      ],
      unitSize,
    );
    const a = result.get("A")!;
    const b = result.get("B")!;
    const c = result.get("C")!;
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBeLessThan(c.y);
  });

  it("places nodes with no edges in the same layer", () => {
    const result = layeredLayout(["A", "B", "C"], [], unitSize);
    const a = result.get("A")!;
    const b = result.get("B")!;
    const c = result.get("C")!;
    // All on the same layer (same y)
    expect(a.y).toBe(b.y);
    expect(b.y).toBe(c.y);
    // Spread horizontally
    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);
  });

  it("handles a diamond: A → B, A → C, B → D, C → D", () => {
    const result = layeredLayout(
      ["A", "B", "C", "D"],
      [
        { from: "A", to: "B" },
        { from: "A", to: "C" },
        { from: "B", to: "D" },
        { from: "C", to: "D" },
      ],
      unitSize,
    );
    const a = result.get("A")!;
    const b = result.get("B")!;
    const c = result.get("C")!;
    const d = result.get("D")!;
    // A on top, B and C in the middle, D at the bottom
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBe(c.y);
    expect(b.y).toBeLessThan(d.y);
  });

  it("handles cycles without infinite looping", () => {
    const result = layeredLayout(
      ["A", "B"],
      [
        { from: "A", to: "B" },
        { from: "B", to: "A" },
      ],
      unitSize,
    );
    // Both nodes should be positioned (cycle is broken via back-edge detection)
    expect(result.size).toBe(2);
    expect(result.has("A")).toBe(true);
    expect(result.has("B")).toBe(true);
  });

  it("handles a 3-node cycle", () => {
    const result = layeredLayout(
      ["A", "B", "C"],
      [
        { from: "A", to: "B" },
        { from: "B", to: "C" },
        { from: "C", to: "A" },
      ],
      unitSize,
    );
    expect(result.size).toBe(3);
  });

  it("skips self-loops", () => {
    const result = layeredLayout(
      ["A", "B"],
      [
        { from: "A", to: "A" },
        { from: "A", to: "B" },
      ],
      unitSize,
    );
    const a = result.get("A")!;
    const b = result.get("B")!;
    expect(a.y).toBeLessThan(b.y);
  });

  it("filters edges referencing unknown nodes", () => {
    const result = layeredLayout(
      ["A"],
      [{ from: "A", to: "UNKNOWN" }],
      unitSize,
    );
    expect(result.size).toBe(1);
    // Single node positioned at padding
    expect(result.get("A")!.x).toBe(40);
  });

  it("uses custom padding and gap options", () => {
    const result = layeredLayout(
      ["A", "B"],
      [{ from: "A", to: "B" }],
      unitSize,
      { padX: 10, padY: 20, gapY: 30 },
    );
    const a = result.get("A")!;
    const b = result.get("B")!;
    expect(a.y).toBe(20); // padY
    expect(b.y).toBe(20 + 40 + 30); // padY + height + gapY
  });

  it("respects variable node sizes", () => {
    const sizes: Record<string, { width: number; height: number }> = {
      wide: { width: 200, height: 40 },
      tall: { width: 100, height: 80 },
    };
    const result = layeredLayout(
      ["wide", "tall"],
      [{ from: "wide", to: "tall" }],
      (id) => sizes[id],
    );
    const wide = result.get("wide")!;
    const tall = result.get("tall")!;
    expect(wide.width).toBe(200);
    expect(tall.height).toBe(80);
    // wide is on top, tall below with gap accounting for wide's height
    expect(tall.y).toBe(wide.y + wide.height + 60); // default gapY
  });

  it("nodes in the same layer do not overlap horizontally", () => {
    const result = layeredLayout(
      ["A", "B", "C"],
      [],
      unitSize,
    );
    const positions = ["A", "B", "C"].map((id) => result.get(id)!);
    for (let i = 0; i < positions.length - 1; i++) {
      const right = positions[i].x + positions[i].width;
      expect(right).toBeLessThanOrEqual(positions[i + 1].x);
    }
  });
});

// --- renderTypeMap ---

describe("renderTypeMap", () => {
  it("shows message when there are no types", () => {
    const svg = renderTypeMap({ nodes: [], edges: [] });
    expect(svg).toContain("<svg");
    expect(svg).toContain("No types found");
  });

  it("renders a single interface", () => {
    const svg = renderTypeMap({
      nodes: [
        {
          name: "User",
          kind: "interface",
          members: [{ name: "name", type: "string" }],
          position: { line: 1 },
        },
      ],
      edges: [],
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain('data-node-id="User"');
    expect(svg).toContain("User");
    expect(svg).toContain("interface");
  });

  it("renders edges between types", () => {
    const svg = renderTypeMap({
      nodes: [
        { name: "Animal", kind: "interface", members: [], position: { line: 1 } },
        { name: "Dog", kind: "class", members: [], position: { line: 3 } },
      ],
      edges: [{ from: "Dog", to: "Animal", kind: "extends" }],
    });
    expect(svg).toContain('data-node-id="Animal"');
    expect(svg).toContain('data-node-id="Dog"');
    expect(svg).toContain('data-edge-from="Dog"');
    expect(svg).toContain('data-edge-to="Animal"');
  });

  it("uses correct colors for different type kinds", () => {
    const svg = renderTypeMap({
      nodes: [
        { name: "MyClass", kind: "class", members: [], position: { line: 1 } },
        { name: "MyEnum", kind: "enum", members: [], position: { line: 2 } },
      ],
      edges: [],
    });
    // class uses pink (#f472b6), enum uses orange (#fb923c)
    expect(svg).toContain("#f472b6");
    expect(svg).toContain("#fb923c");
  });

  it("renders reference edges as dashed lines", () => {
    const svg = renderTypeMap({
      nodes: [
        { name: "Config", kind: "type", members: [{ name: "db", type: "DB" }], position: { line: 1 } },
        { name: "DB", kind: "interface", members: [], position: { line: 3 } },
      ],
      edges: [{ from: "Config", to: "DB", kind: "references" }],
    });
    expect(svg).toContain('stroke-dasharray="6 3"');
  });

  it("renders members in type nodes", () => {
    const svg = renderTypeMap({
      nodes: [
        {
          name: "Point",
          kind: "type",
          members: [
            { name: "x", type: "number" },
            { name: "y", type: "number" },
          ],
          position: { line: 1 },
        },
      ],
      edges: [],
    });
    expect(svg).toContain(">x<");
    expect(svg).toContain(": number<");
  });

  it("shows 'empty' for types with no members", () => {
    const svg = renderTypeMap({
      nodes: [
        { name: "Empty", kind: "interface", members: [], position: { line: 1 } },
      ],
      edges: [],
    });
    expect(svg).toContain("empty");
  });

  it("includes a legend with node kinds and edge types", () => {
    const svg = renderTypeMap({
      nodes: [
        { name: "A", kind: "interface", members: [], position: { line: 1 } },
      ],
      edges: [],
    });
    expect(svg).toContain('class="legend"');
    expect(svg).toContain("interface");
    expect(svg).toContain("type");
    expect(svg).toContain("class");
    expect(svg).toContain("enum");
    expect(svg).toContain("extends");
    expect(svg).toContain("implements");
    expect(svg).toContain("references");
  });
});

// --- renderCallGraph ---

describe("renderCallGraph", () => {
  it("shows message when there are no functions", () => {
    const svg = renderCallGraph({ nodes: [], edges: [] });
    expect(svg).toContain("<svg");
    expect(svg).toContain("No functions found");
  });

  it("renders a single function node", () => {
    const svg = renderCallGraph({
      nodes: [{ name: "main", kind: "function", position: { line: 1 } }],
      edges: [],
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain('data-node-id="main"');
    expect(svg).toContain("main");
  });

  it("renders call edges", () => {
    const svg = renderCallGraph({
      nodes: [
        { name: "caller", kind: "function", position: { line: 1 } },
        { name: "callee", kind: "function", position: { line: 5 } },
      ],
      edges: [{ from: "caller", to: "callee" }],
    });
    expect(svg).toContain('data-edge-from="caller"');
    expect(svg).toContain('data-edge-to="callee"');
    expect(svg).toContain("arrowhead-call");
  });

  it("uses different colors for function kinds", () => {
    const svg = renderCallGraph({
      nodes: [
        { name: "fn", kind: "function", position: { line: 1 } },
        { name: "m", kind: "method", position: { line: 3 } },
        { name: "a", kind: "arrow", position: { line: 5 } },
      ],
      edges: [],
    });
    // function=#c084fc, method=#22d3ee, arrow=#4ade80
    expect(svg).toContain("#c084fc");
    expect(svg).toContain("#22d3ee");
    expect(svg).toContain("#4ade80");
  });

  it("truncates long function names", () => {
    const svg = renderCallGraph({
      nodes: [{ name: "aVeryLongFunctionNameThatExceedsTwentyCharacters", kind: "function", position: { line: 1 } }],
      edges: [],
    });
    // Should contain the truncated name with ellipsis
    expect(svg).toContain("aVeryLongFunctionNam");
    expect(svg).toContain("\u2026");
  });

  it("includes a legend with node kinds and edge type", () => {
    const svg = renderCallGraph({
      nodes: [
        { name: "fn", kind: "function", position: { line: 1 } },
      ],
      edges: [],
    });
    expect(svg).toContain('class="legend"');
    expect(svg).toContain("function");
    expect(svg).toContain("method");
    expect(svg).toContain("arrow");
    expect(svg).toContain("calls");
  });
});

// --- renderModuleGraph ---

describe("renderModuleGraph", () => {
  it("shows message when there are no modules", () => {
    const svg = renderModuleGraph({ nodes: [], edges: [] });
    expect(svg).toContain("<svg");
    expect(svg).toContain("No modules found");
  });

  it("renders a single module node", () => {
    const svg = renderModuleGraph({
      nodes: [{ path: "index.ts", exports: ["main"] }],
      edges: [],
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain('data-node-id="index.ts"');
    expect(svg).toContain("index.ts");
  });

  it("shows exports on module nodes", () => {
    const svg = renderModuleGraph({
      nodes: [{ path: "utils.ts", exports: ["add", "subtract"] }],
      edges: [],
    });
    expect(svg).toContain("exports:");
    expect(svg).toContain("add, subtract");
  });

  it("renders import edges with labels", () => {
    const svg = renderModuleGraph({
      nodes: [
        { path: "app.ts", exports: [] },
        { path: "utils.ts", exports: ["helper"] },
      ],
      edges: [{ from: "app.ts", to: "utils.ts", imports: ["helper"] }],
    });
    expect(svg).toContain('data-edge-from="app.ts"');
    expect(svg).toContain('data-edge-to="utils.ts"');
    expect(svg).toContain("helper");
  });

  it("shows filename separately from full path for nested modules", () => {
    const svg = renderModuleGraph({
      nodes: [{ path: "lib/utils.ts", exports: [] }],
      edges: [],
    });
    // Should show both the filename and full path
    expect(svg).toContain("utils.ts");
    expect(svg).toContain("lib/utils.ts");
  });

  it("skips long import labels", () => {
    const longImports = Array.from({ length: 20 }, (_, i) => `import${i}`);
    const svg = renderModuleGraph({
      nodes: [
        { path: "a.ts", exports: [] },
        { path: "b.ts", exports: longImports },
      ],
      edges: [{ from: "a.ts", to: "b.ts", imports: longImports }],
    });
    // Label text should be omitted when join exceeds 40 chars
    expect(svg).toContain('data-edge-from="a.ts"');
    // The edge path exists, but no label text (imports joined > 40 chars)
    const edgeGroup = svg.match(/<g class="graph-edge"[^>]*>[\s\S]*?<\/g>/)?.[0];
    expect(edgeGroup).toBeDefined();
    // Should only have the path element, no text element for the label
    expect(edgeGroup).not.toContain("<text");
  });

  it("includes a legend with imports", () => {
    const svg = renderModuleGraph({
      nodes: [{ path: "index.ts", exports: [] }],
      edges: [],
    });
    expect(svg).toContain('class="legend"');
    expect(svg).toContain("imports");
    expect(svg).toContain("exports");
  });
});
