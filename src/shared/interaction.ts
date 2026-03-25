/**
 * Click-to-highlight for graph nodes.
 *
 * Click a node to highlight it and its direct neighbors.
 * Everything else dims. Click the same node or the background to clear.
 *
 * Expects SVG elements with:
 * - `.graph-node[data-node-id]` groups for nodes
 * - `.graph-edge[data-edge-from][data-edge-to]` elements for edges
 */

const DIM_OPACITY = "0.12";
const HIGHLIGHT_NODE_OPACITY = "1";
const HIGHLIGHT_EDGE_OPACITY = "0.9";

export interface InteractionControls {
  destroy(): void;
}

export function setupNodeHighlight(
  container: HTMLElement,
): InteractionControls {
  const svg = container.querySelector("svg");
  if (!svg) return { destroy: () => {} };

  let selectedNodeId: string | null = null;

  function clearHighlight() {
    selectedNodeId = null;
    for (const node of svg!.querySelectorAll<SVGElement>(".graph-node")) {
      node.style.opacity = "";
      node.style.transition = "";
    }
    for (const edge of svg!.querySelectorAll<SVGElement>(".graph-edge")) {
      edge.style.opacity = "";
      edge.style.transition = "";
    }
  }

  function highlight(nodeId: string) {
    const edges = svg!.querySelectorAll<SVGElement>(".graph-edge");
    const connectedNodeIds = new Set([nodeId]);

    // Find all nodes connected by an edge
    for (const edge of edges) {
      const from = edge.getAttribute("data-edge-from");
      const to = edge.getAttribute("data-edge-to");
      if (from === nodeId) connectedNodeIds.add(to!);
      if (to === nodeId) connectedNodeIds.add(from!);
    }

    // Dim/highlight edges
    for (const edge of edges) {
      const from = edge.getAttribute("data-edge-from");
      const to = edge.getAttribute("data-edge-to");
      const connected = from === nodeId || to === nodeId;
      edge.style.transition = "opacity 0.15s";
      edge.style.opacity = connected ? HIGHLIGHT_EDGE_OPACITY : DIM_OPACITY;
    }

    // Dim/highlight nodes
    for (const node of svg!.querySelectorAll<SVGElement>(".graph-node")) {
      const id = node.getAttribute("data-node-id");
      const connected = connectedNodeIds.has(id!);
      node.style.transition = "opacity 0.15s";
      node.style.opacity = connected ? HIGHLIGHT_NODE_OPACITY : DIM_OPACITY;
    }
  }

  function onClick(e: Event) {
    const target = e.target as Element;
    const nodeGroup = target.closest(".graph-node");

    if (nodeGroup) {
      const nodeId = nodeGroup.getAttribute("data-node-id");
      if (!nodeId) return;

      if (nodeId === selectedNodeId) {
        clearHighlight();
      } else {
        selectedNodeId = nodeId;
        highlight(nodeId);
      }
    } else if (target.closest("svg")) {
      // Clicked background
      if (selectedNodeId) clearHighlight();
    }
  }

  svg.addEventListener("click", onClick);

  return {
    destroy() {
      svg.removeEventListener("click", onClick);
      clearHighlight();
    },
  };
}
