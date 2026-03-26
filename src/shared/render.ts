import type {
  TypeMapResult,
  CallGraphResult,
  ModuleGraphResult,
} from "./analyze";

// --- SVG Helpers ---

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createSvgElement(
  width: number,
  height: number,
  content: string,
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="font-family: 'JetBrains Mono', monospace;">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#8888a0"/>
    </marker>
    <marker id="arrowhead-extends" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#c084fc"/>
    </marker>
    <marker id="arrowhead-implements" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#22d3ee"/>
    </marker>
    <marker id="arrowhead-references" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#4ade80"/>
    </marker>
    <marker id="arrowhead-call" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#fb923c"/>
    </marker>
  </defs>
  ${content}
</svg>`;
}

// --- Layout ---

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutEdge {
  from: string;
  to: string;
}

/**
 * Layered graph layout (simplified Sugiyama).
 *
 * Assigns nodes to layers based on edge direction, orders nodes within
 * layers to reduce crossings (barycenter heuristic), then assigns
 * coordinates. Handles cycles by detecting back-edges via DFS.
 *
 * Edges flow top-to-bottom: a node with an edge to another is placed
 * above it. Pass reversed edges to invert direction (e.g. for type
 * hierarchies where parents should be on top).
 */
export function layeredLayout(
  nodeIds: string[],
  edges: LayoutEdge[],
  getSize: (id: string) => { width: number; height: number },
  options: { padX?: number; padY?: number; gapX?: number; gapY?: number } = {},
): Map<string, LayoutNode> {
  const { padX = 40, padY = 40, gapX = 40, gapY = 60 } = options;
  const result = new Map<string, LayoutNode>();

  if (nodeIds.length === 0) return result;
  if (nodeIds.length === 1) {
    const size = getSize(nodeIds[0]);
    result.set(nodeIds[0], { id: nodeIds[0], x: padX, y: padY, ...size });
    return result;
  }

  const nodeSet = new Set(nodeIds);

  // Build adjacency lists (only for known nodes, skip self-loops)
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  for (const id of nodeIds) {
    childrenOf.set(id, []);
    parentsOf.set(id, []);
  }
  for (const e of edges) {
    if (nodeSet.has(e.from) && nodeSet.has(e.to) && e.from !== e.to) {
      childrenOf.get(e.from)!.push(e.to);
      parentsOf.get(e.to)!.push(e.from);
    }
  }

  // --- Cycle breaking (DFS back-edge detection) ---
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const backEdges = new Set<string>();

  function dfs(node: string) {
    visited.add(node);
    inStack.add(node);
    for (const child of childrenOf.get(node) ?? []) {
      if (inStack.has(child)) {
        backEdges.add(`${node}->${child}`);
      } else if (!visited.has(child)) {
        dfs(child);
      }
    }
    inStack.delete(node);
  }

  const roots = nodeIds.filter((id) => parentsOf.get(id)!.length === 0);
  for (const r of roots.length > 0 ? roots : nodeIds) {
    if (!visited.has(r)) dfs(r);
  }

  // --- Layer assignment (longest path from roots, ignoring back-edges) ---
  const layer = new Map<string, number>();

  function assignLayer(node: string, trail: Set<string>): number {
    if (layer.has(node)) return layer.get(node)!;
    trail.add(node);
    let maxParent = -1;
    for (const p of parentsOf.get(node) ?? []) {
      if (!backEdges.has(`${p}->${node}`) && !trail.has(p)) {
        maxParent = Math.max(maxParent, assignLayer(p, trail));
      }
    }
    const l = maxParent + 1;
    layer.set(node, l);
    trail.delete(node);
    return l;
  }

  for (const id of nodeIds) assignLayer(id, new Set());

  // Group by layer
  const layers: string[][] = [];
  for (const [id, l] of layer) {
    while (layers.length <= l) layers.push([]);
    layers[l].push(id);
  }

  // --- Within-layer ordering (barycenter heuristic, 4 passes) ---
  for (let pass = 0; pass < 4; pass++) {
    const down = pass % 2 === 0;
    const start = down ? 1 : layers.length - 2;
    const end = down ? layers.length : -1;
    const step = down ? 1 : -1;

    for (let li = start; li !== end; li += step) {
      const cur = layers[li];
      const adj = layers[li - step];
      if (!adj) continue;

      const adjPos = new Map<string, number>();
      adj.forEach((id, i) => adjPos.set(id, i));

      const bary = new Map<string, number>();
      for (const id of cur) {
        const neighbors = down
          ? (parentsOf.get(id) ?? [])
          : (childrenOf.get(id) ?? []);
        const positions = neighbors
          .filter(
            (n) =>
              adjPos.has(n) &&
              !backEdges.has(down ? `${n}->${id}` : `${id}->${n}`),
          )
          .map((n) => adjPos.get(n)!);
        bary.set(
          id,
          positions.length > 0
            ? positions.reduce((a, b) => a + b, 0) / positions.length
            : Infinity,
        );
      }

      cur.sort((a, b) => {
        const ba = bary.get(a)!;
        const bb = bary.get(b)!;
        if (ba === Infinity && bb === Infinity) return 0;
        if (ba === Infinity) return 1;
        if (bb === Infinity) return -1;
        return ba - bb;
      });
    }
  }

  // --- Coordinate assignment (center each layer) ---
  const sizes = new Map<string, { width: number; height: number }>();
  for (const id of nodeIds) sizes.set(id, getSize(id));

  const layerHeights: number[] = [];
  const layerWidths: number[] = [];
  for (const cur of layers) {
    let h = 0;
    let w = 0;
    for (let i = 0; i < cur.length; i++) {
      const s = sizes.get(cur[i])!;
      h = Math.max(h, s.height);
      w += s.width + (i > 0 ? gapX : 0);
    }
    layerHeights.push(h);
    layerWidths.push(w);
  }

  const maxW = Math.max(...layerWidths);

  let y = padY;
  for (let li = 0; li < layers.length; li++) {
    const cur = layers[li];
    let x = padX + (maxW - layerWidths[li]) / 2;
    for (const id of cur) {
      const s = sizes.get(id)!;
      result.set(id, { id, x, y, width: s.width, height: s.height });
      x += s.width + gapX;
    }
    y += layerHeights[li] + gapY;
  }

  return result;
}

// --- Legend ---

interface LegendItem {
  color: string;
  label: string;
  dashed?: boolean;
}

function renderLegend(items: LegendItem[], x: number, y: number): { svg: string; height: number } {
  const DOT_R = 4;
  const LINE_W = 14;
  const GAP = 20;
  const CHAR_W = 6.5;
  const ROW_H = 20;

  let svg = `<g class="legend" opacity="0.6">`;
  let cx = x;

  for (const item of items) {
    if (item.dashed !== undefined) {
      // Edge indicator: short line (solid or dashed)
      const dashAttr = item.dashed ? ' stroke-dasharray="4 2"' : "";
      svg += `<line x1="${cx}" y1="${y + ROW_H / 2}" x2="${cx + LINE_W}" y2="${y + ROW_H / 2}" stroke="${item.color}" stroke-width="2"${dashAttr}/>`;
      cx += LINE_W + 6;
    } else {
      // Node indicator: filled circle
      svg += `<circle cx="${cx + DOT_R}" cy="${y + ROW_H / 2}" r="${DOT_R}" fill="${item.color}"/>`;
      cx += DOT_R * 2 + 6;
    }
    svg += `<text x="${cx}" y="${y + ROW_H / 2 + 3.5}" fill="#8888a0" font-size="10">${escapeHtml(item.label)}</text>`;
    cx += item.label.length * CHAR_W + GAP;
  }

  svg += `</g>`;
  return { svg, height: ROW_H };
}

// --- Type Map Renderer ---

const TYPE_COLORS: Record<string, { bg: string; border: string; header: string }> = {
  interface: { bg: "#1a1a2e", border: "#c084fc", header: "#c084fc" },
  type: { bg: "#1a1a2e", border: "#22d3ee", header: "#22d3ee" },
  class: { bg: "#1a1a2e", border: "#f472b6", header: "#f472b6" },
  enum: { bg: "#1a1a2e", border: "#fb923c", header: "#fb923c" },
};

const EDGE_COLORS: Record<string, string> = {
  extends: "#c084fc",
  implements: "#22d3ee",
  references: "#4ade80",
};

export function renderTypeMap(data: TypeMapResult): string {
  if (data.nodes.length === 0) {
    return createSvgElement(
      400,
      100,
      '<text x="200" y="50" text-anchor="middle" fill="#8888a0" font-size="14">No types found. Try adding interfaces, types, or classes.</text>',
    );
  }

  const HEADER_HEIGHT = 32;
  const MEMBER_HEIGHT = 22;
  const CHAR_WIDTH = 8;
  const PADDING_X = 16;

  function nodeSize(nodeId: string): { width: number; height: number } {
    const node = data.nodes.find((n) => n.name === nodeId)!;
    const titleWidth = node.name.length * 9 + node.kind.length * 7 + 40;
    const memberWidths = node.members.map(
      (m) => (m.name.length + m.type.length + 3) * CHAR_WIDTH + PADDING_X * 2,
    );
    const width = Math.max(titleWidth, ...memberWidths, 120);
    const height =
      HEADER_HEIGHT + Math.max(node.members.length, 1) * MEMBER_HEIGHT + 8;
    return { width, height };
  }

  // Reverse edges for layout so parents (extend targets) sit on top
  const layoutEdges: LayoutEdge[] = data.edges
    .filter((e) => e.kind === "extends" || e.kind === "implements")
    .map((e) => ({ from: e.to, to: e.from }));

  const layout = layeredLayout(
    data.nodes.map((n) => n.name),
    layoutEdges,
    nodeSize,
  );

  // Calculate SVG bounds
  let maxX = 0;
  let maxY = 0;
  for (const ln of layout.values()) {
    maxX = Math.max(maxX, ln.x + ln.width);
    maxY = Math.max(maxY, ln.y + ln.height);
  }

  let content = "";

  // Draw edges (direction-agnostic: pick exit/entry sides based on relative position)
  for (const edge of data.edges) {
    const from = layout.get(edge.from);
    const to = layout.get(edge.to);
    if (!from || !to) continue;

    const fromCy = from.y + from.height / 2;
    const toCy = to.y + to.height / 2;
    const goingDown = fromCy < toCy;

    const x1 = from.x + from.width / 2;
    const y1 = goingDown ? from.y + from.height : from.y;
    const x2 = to.x + to.width / 2;
    const y2 = goingDown ? to.y : to.y + to.height;

    const color = EDGE_COLORS[edge.kind] ?? "#8888a0";
    const dashArray = edge.kind === "references" ? 'stroke-dasharray="6 3"' : "";

    const midY = (y1 + y2) / 2;
    content += `<path class="graph-edge" data-edge-from="${escapeHtml(edge.from)}" data-edge-to="${escapeHtml(edge.to)}" d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="1.5" ${dashArray} marker-end="url(#arrowhead-${edge.kind})" opacity="0.7"/>`;
  }

  // Draw nodes
  for (const node of data.nodes) {
    const ln = layout.get(node.name)!;
    const colors = TYPE_COLORS[node.kind] ?? TYPE_COLORS.interface;

    content += `<g class="graph-node" data-node-id="${escapeHtml(node.name)}" style="cursor:pointer">`;

    // Box
    content += `<rect x="${ln.x}" y="${ln.y}" width="${ln.width}" height="${ln.height}" rx="6" fill="${colors.bg}" stroke="${colors.border}" stroke-width="1.5"/>`;

    // Header bar
    content += `<rect x="${ln.x}" y="${ln.y}" width="${ln.width}" height="${HEADER_HEIGHT}" rx="6" fill="${colors.border}" opacity="0.15"/>`;
    content += `<line x1="${ln.x}" y1="${ln.y + HEADER_HEIGHT}" x2="${ln.x + ln.width}" y2="${ln.y + HEADER_HEIGHT}" stroke="${colors.border}" stroke-width="0.5" opacity="0.3"/>`;

    // Title
    content += `<text x="${ln.x + PADDING_X}" y="${ln.y + 21}" fill="${colors.header}" font-size="12" font-weight="bold">${escapeHtml(node.name)}</text>`;
    content += `<text x="${ln.x + ln.width - PADDING_X}" y="${ln.y + 21}" fill="${colors.header}" font-size="9" text-anchor="end" opacity="0.6">${node.kind}</text>`;

    // Members
    if (node.members.length === 0) {
      content += `<text x="${ln.x + PADDING_X}" y="${ln.y + HEADER_HEIGHT + 18}" fill="#8888a0" font-size="10" font-style="italic">empty</text>`;
    } else {
      node.members.forEach((m, i) => {
        const my = ln.y + HEADER_HEIGHT + (i + 1) * MEMBER_HEIGHT;
        content += `<text x="${ln.x + PADDING_X}" y="${my}" fill="#e0e0e8" font-size="10">${escapeHtml(m.name)}</text>`;
        if (m.type) {
          const nameWidth = m.name.length * CHAR_WIDTH + PADDING_X + 4;
          content += `<text x="${ln.x + nameWidth}" y="${my}" fill="#8888a0" font-size="10">: ${escapeHtml(m.type)}</text>`;
        }
      });
    }

    content += `</g>`;
  }

  // Legend
  const legendItems: LegendItem[] = [
    { color: "#c084fc", label: "interface" },
    { color: "#22d3ee", label: "type" },
    { color: "#f472b6", label: "class" },
    { color: "#fb923c", label: "enum" },
    { color: "#c084fc", label: "extends", dashed: false },
    { color: "#22d3ee", label: "implements", dashed: false },
    { color: "#4ade80", label: "references", dashed: true },
  ];
  const legend = renderLegend(legendItems, 40, maxY + 30);
  content += legend.svg;

  return createSvgElement(maxX + 40, maxY + 30 + legend.height + 20, content);
}

// --- Call Graph Renderer ---

export function renderCallGraph(data: CallGraphResult): string {
  if (data.nodes.length === 0) {
    return createSvgElement(
      400,
      100,
      '<text x="200" y="50" text-anchor="middle" fill="#8888a0" font-size="14">No functions found.</text>',
    );
  }

  const CHAR_WIDTH = 8;
  const PAD = 16;
  const NODE_HEIGHT = 36;
  const COLORS: Record<string, string> = {
    function: "#c084fc",
    method: "#22d3ee",
    arrow: "#4ade80",
  };

  function callNodeSize(name: string): { width: number; height: number } {
    return { width: Math.max(name.length * CHAR_WIDTH + PAD * 2, 80), height: NODE_HEIGHT };
  }

  const layout = layeredLayout(
    data.nodes.map((n) => n.name),
    data.edges,
    (id) => callNodeSize(id),
    { gapY: 50 },
  );

  // Calculate SVG bounds
  let maxX = 0;
  let maxY = 0;
  for (const ln of layout.values()) {
    maxX = Math.max(maxX, ln.x + ln.width);
    maxY = Math.max(maxY, ln.y + ln.height);
  }

  let content = "";

  // Draw edges
  for (const edge of data.edges) {
    const from = layout.get(edge.from);
    const to = layout.get(edge.to);
    if (!from || !to) continue;

    const fromCy = from.y + from.height / 2;
    const toCy = to.y + to.height / 2;
    const goingDown = fromCy < toCy;

    const x1 = from.x + from.width / 2;
    const y1 = goingDown ? from.y + from.height : from.y;
    const x2 = to.x + to.width / 2;
    const y2 = goingDown ? to.y : to.y + to.height;

    const midY = (y1 + y2) / 2;
    content += `<path class="graph-edge" data-edge-from="${escapeHtml(edge.from)}" data-edge-to="${escapeHtml(edge.to)}" d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" fill="none" stroke="#fb923c" stroke-width="1.5" marker-end="url(#arrowhead-call)" opacity="0.6"/>`;
  }

  // Draw nodes as rounded rectangles
  for (const node of data.nodes) {
    const ln = layout.get(node.name)!;
    const color = COLORS[node.kind] ?? COLORS.function;

    content += `<g class="graph-node" data-node-id="${escapeHtml(node.name)}" style="cursor:pointer">`;
    content += `<rect x="${ln.x}" y="${ln.y}" width="${ln.width}" height="${ln.height}" rx="18" fill="#1a1a2e" stroke="${color}" stroke-width="2"/>`;

    // Label
    const displayName =
      node.name.length > 20 ? node.name.substring(0, 19) + "\u2026" : node.name;
    content += `<text x="${ln.x + ln.width / 2}" y="${ln.y + ln.height / 2 + 4}" text-anchor="middle" fill="${color}" font-size="10" font-weight="bold">${escapeHtml(displayName)}</text>`;
    content += `</g>`;
  }

  // Legend
  const legendItems: LegendItem[] = [
    { color: "#c084fc", label: "function" },
    { color: "#22d3ee", label: "method" },
    { color: "#4ade80", label: "arrow" },
    { color: "#fb923c", label: "calls", dashed: false },
  ];
  const legend = renderLegend(legendItems, 40, maxY + 30);
  content += legend.svg;

  return createSvgElement(maxX + 40, maxY + 30 + legend.height + 20, content);
}

// --- Module Graph Renderer ---

export function renderModuleGraph(data: ModuleGraphResult): string {
  if (data.nodes.length === 0) {
    return createSvgElement(
      400,
      100,
      '<text x="200" y="50" text-anchor="middle" fill="#8888a0" font-size="14">No modules found.</text>',
    );
  }

  const CHAR_WIDTH = 7.5;
  const PADDING_X = 16;
  const NODE_HEIGHT = 36;

  function nodeSize(path: string): { width: number; height: number } {
    const node = data.nodes.find((n) => n.path === path)!;
    const pathWidth = path.length * CHAR_WIDTH + PADDING_X * 2;
    const exportWidth =
      node.exports.length > 0
        ? node.exports.join(", ").length * 6 + PADDING_X * 2
        : 0;
    return {
      width: Math.max(pathWidth, exportWidth, 100),
      height: NODE_HEIGHT + (node.exports.length > 0 ? 20 : 0),
    };
  }

  const layout = layeredLayout(
    data.nodes.map((n) => n.path),
    data.edges.map((e) => ({ from: e.from, to: e.to })),
    nodeSize,
    { padX: 60, padY: 40, gapX: 60, gapY: 60 },
  );

  let maxX = 0;
  let maxY = 0;
  for (const ln of layout.values()) {
    maxX = Math.max(maxX, ln.x + ln.width);
    maxY = Math.max(maxY, ln.y + ln.height);
  }

  let content = "";

  // Draw edges (direction-agnostic)
  for (const edge of data.edges) {
    const from = layout.get(edge.from);
    const to = layout.get(edge.to);
    if (!from || !to) continue;

    const fromCy = from.y + from.height / 2;
    const toCy = to.y + to.height / 2;
    const goingDown = fromCy < toCy;

    const x1 = from.x + from.width / 2;
    const y1 = goingDown ? from.y + from.height : from.y;
    const x2 = to.x + to.width / 2;
    const y2 = goingDown ? to.y : to.y + to.height;

    const midY = (y1 + y2) / 2;
    content += `<g class="graph-edge" data-edge-from="${escapeHtml(edge.from)}" data-edge-to="${escapeHtml(edge.to)}">`;
    content += `<path d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" fill="none" stroke="#22d3ee" stroke-width="1.5" marker-end="url(#arrowhead)" opacity="0.5"/>`;

    // Label
    const labelX = (x1 + x2) / 2;
    const labelY = midY - 4;
    const label = edge.imports.join(", ");
    if (label.length < 40) {
      content += `<text x="${labelX}" y="${labelY}" text-anchor="middle" fill="#8888a0" font-size="8">${escapeHtml(label)}</text>`;
    }
    content += `</g>`;
  }

  // Draw nodes
  for (const node of data.nodes) {
    const ln = layout.get(node.path)!;

    content += `<g class="graph-node" data-node-id="${escapeHtml(node.path)}" style="cursor:pointer">`;
    content += `<rect x="${ln.x}" y="${ln.y}" width="${ln.width}" height="${ln.height}" rx="6" fill="#1a1a2e" stroke="#22d3ee" stroke-width="1.5"/>`;

    // Filename
    const filename = node.path.split("/").pop() ?? node.path;
    content += `<text x="${ln.x + PADDING_X}" y="${ln.y + 22}" fill="#22d3ee" font-size="11" font-weight="bold">${escapeHtml(filename)}</text>`;

    // Full path if different
    if (filename !== node.path) {
      content += `<text x="${ln.x + PADDING_X}" y="${ln.y + 22}" fill="#8888a0" font-size="9" dx="${filename.length * 7.5 + 8}">${escapeHtml(node.path)}</text>`;
    }

    // Exports
    if (node.exports.length > 0) {
      content += `<text x="${ln.x + PADDING_X}" y="${ln.y + 42}" fill="#4ade80" font-size="9">exports: ${escapeHtml(node.exports.join(", "))}</text>`;
    }
    content += `</g>`;
  }

  // Legend
  const legendItems: LegendItem[] = [
    { color: "#22d3ee", label: "imports", dashed: false },
    { color: "#4ade80", label: "exports" },
  ];
  const legend = renderLegend(legendItems, 60, maxY + 30);
  content += legend.svg;

  return createSvgElement(maxX + 60, maxY + 30 + legend.height + 20, content);
}
