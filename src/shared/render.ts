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

// --- Simple Layout ---

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function simpleGridLayout(
  ids: string[],
  getSize: (id: string) => { width: number; height: number },
  padding: number = 40,
  maxCols: number = 4,
): Map<string, LayoutNode> {
  const result = new Map<string, LayoutNode>();
  const cols = Math.min(ids.length, maxCols);

  // Calculate max width per column and max height per row
  const colWidths: number[] = new Array(cols).fill(0);
  const rowHeights: number[] = [];

  for (let i = 0; i < ids.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const size = getSize(ids[i]);
    colWidths[col] = Math.max(colWidths[col], size.width);
    if (!rowHeights[row]) rowHeights[row] = 0;
    rowHeights[row] = Math.max(rowHeights[row], size.height);
  }

  let y = padding;
  for (let i = 0; i < ids.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    if (col === 0 && i > 0) {
      y += rowHeights[row - 1] + padding;
    }

    let x = padding;
    for (let c = 0; c < col; c++) {
      x += colWidths[c] + padding;
    }

    const size = getSize(ids[i]);
    result.set(ids[i], { id: ids[i], x, y, width: size.width, height: size.height });
  }

  return result;
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

  const layout = simpleGridLayout(
    data.nodes.map((n) => n.name),
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

  // Draw edges
  for (const edge of data.edges) {
    const from = layout.get(edge.from);
    const to = layout.get(edge.to);
    if (!from || !to) continue;

    const x1 = from.x + from.width / 2;
    const y1 = from.y + from.height;
    const x2 = to.x + to.width / 2;
    const y2 = to.y;

    const color = EDGE_COLORS[edge.kind] ?? "#8888a0";
    const dashArray = edge.kind === "references" ? 'stroke-dasharray="6 3"' : "";

    // Curved path
    const midY = (y1 + y2) / 2;
    content += `<path d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="1.5" ${dashArray} marker-end="url(#arrowhead-${edge.kind})" opacity="0.7"/>`;
  }

  // Draw nodes
  for (const node of data.nodes) {
    const ln = layout.get(node.name)!;
    const colors = TYPE_COLORS[node.kind] ?? TYPE_COLORS.interface;

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
  }

  return createSvgElement(maxX + 40, maxY + 40, content);
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

  const NODE_RADIUS = 30;
  const NODE_PAD = 120;
  const COLORS: Record<string, string> = {
    function: "#c084fc",
    method: "#22d3ee",
    arrow: "#4ade80",
  };

  // Simple force-like layout: arrange in a circle, then pull connected nodes closer
  const n = data.nodes.length;
  const centerX = Math.max(300, n * 30);
  const centerY = Math.max(250, n * 25);
  const radius = Math.min(centerX, centerY) - 80;

  const positions = new Map<string, { x: number; y: number }>();
  data.nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    positions.set(node.name, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  });

  let content = "";

  // Draw edges
  for (const edge of data.edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) continue;

    const ox = (dx / dist) * (NODE_RADIUS + 4);
    const oy = (dy / dist) * (NODE_RADIUS + 4);

    const x1 = from.x + ox;
    const y1 = from.y + oy;
    const x2 = to.x - ox;
    const y2 = to.y - oy;

    // Slight curve
    const mx = (x1 + x2) / 2 - (y2 - y1) * 0.1;
    const my = (y1 + y2) / 2 + (x2 - x1) * 0.1;

    content += `<path d="M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}" fill="none" stroke="#fb923c" stroke-width="1.5" marker-end="url(#arrowhead-call)" opacity="0.6"/>`;
  }

  // Draw nodes
  for (const node of data.nodes) {
    const pos = positions.get(node.name)!;
    const color = COLORS[node.kind] ?? COLORS.function;

    content += `<circle cx="${pos.x}" cy="${pos.y}" r="${NODE_RADIUS}" fill="#1a1a2e" stroke="${color}" stroke-width="2"/>`;

    // Label
    const displayName =
      node.name.length > 12 ? node.name.substring(0, 11) + "..." : node.name;
    content += `<text x="${pos.x}" y="${pos.y + 4}" text-anchor="middle" fill="${color}" font-size="10" font-weight="bold">${escapeHtml(displayName)}</text>`;

    // Kind tag below
    content += `<text x="${pos.x}" y="${pos.y + NODE_RADIUS + 16}" text-anchor="middle" fill="#8888a0" font-size="9">${node.kind}</text>`;
  }

  const svgWidth = centerX * 2;
  const svgHeight = centerY * 2;

  return createSvgElement(svgWidth, svgHeight, content);
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

  const layout = simpleGridLayout(
    data.nodes.map((n) => n.path),
    nodeSize,
    60,
    3,
  );

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

    const x1 = from.x + from.width / 2;
    const y1 = from.y + from.height;
    const x2 = to.x + to.width / 2;
    const y2 = to.y;

    const midY = (y1 + y2) / 2;
    content += `<path d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" fill="none" stroke="#22d3ee" stroke-width="1.5" marker-end="url(#arrowhead)" opacity="0.5"/>`;

    // Label
    const labelX = (x1 + x2) / 2;
    const labelY = midY - 4;
    const label = edge.imports.join(", ");
    if (label.length < 40) {
      content += `<text x="${labelX}" y="${labelY}" text-anchor="middle" fill="#8888a0" font-size="8">${escapeHtml(label)}</text>`;
    }
  }

  // Draw nodes
  for (const node of data.nodes) {
    const ln = layout.get(node.path)!;

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
  }

  return createSvgElement(maxX + 60, maxY + 60, content);
}
