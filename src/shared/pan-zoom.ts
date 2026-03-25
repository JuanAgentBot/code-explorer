/**
 * Pan-zoom interaction for a container element.
 *
 * Wraps the container's children in a transform div and handles:
 * - Mouse wheel → zoom (centered on cursor)
 * - Click + drag → pan
 * - Double-click → reset to fit
 *
 * The container must have overflow: hidden for clipping.
 */

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

export interface PanZoomControls {
  /** Reset transform to fit content in container */
  reset(): void;
  /** Clean up event listeners */
  destroy(): void;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export function setupPanZoom(container: HTMLElement): PanZoomControls {
  // Wrap existing children in a transform layer
  const layer = document.createElement("div");
  layer.style.transformOrigin = "0 0";
  layer.style.willChange = "transform";

  while (container.firstChild) {
    layer.appendChild(container.firstChild);
  }
  container.appendChild(layer);
  container.style.overflow = "hidden";
  container.style.cursor = "grab";

  const transform: Transform = { x: 0, y: 0, scale: 1 };

  function apply() {
    layer.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
  }

  function reset() {
    // Fit the SVG content within the container
    const svg = layer.querySelector("svg");
    if (!svg) {
      transform.x = 0;
      transform.y = 0;
      transform.scale = 1;
      apply();
      return;
    }

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const sw = svg.viewBox.baseVal.width || svg.clientWidth;
    const sh = svg.viewBox.baseVal.height || svg.clientHeight;

    if (sw === 0 || sh === 0) {
      transform.x = 0;
      transform.y = 0;
      transform.scale = 1;
      apply();
      return;
    }

    const scale = Math.min(cw / sw, ch / sh, 1) * 0.9; // 90% to leave breathing room
    transform.scale = scale;
    transform.x = (cw - sw * scale) / 2;
    transform.y = (ch - sh * scale) / 2;
    apply();
  }

  // --- Wheel zoom (centered on cursor) ---
  function onWheel(e: WheelEvent) {
    e.preventDefault();

    const rect = container.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, transform.scale * factor));
    const ratio = newScale / transform.scale;

    // Adjust translation so the point under cursor stays fixed
    transform.x = cx - (cx - transform.x) * ratio;
    transform.y = cy - (cy - transform.y) * ratio;
    transform.scale = newScale;
    apply();
  }

  // --- Drag pan ---
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartTx = 0;
  let dragStartTy = 0;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartTx = transform.x;
    dragStartTy = transform.y;
    container.style.cursor = "grabbing";
    container.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    transform.x = dragStartTx + (e.clientX - dragStartX);
    transform.y = dragStartTy + (e.clientY - dragStartY);
    apply();
  }

  function onPointerUp() {
    dragging = false;
    container.style.cursor = "grab";
  }

  // --- Double-click to reset ---
  function onDblClick(e: MouseEvent) {
    e.preventDefault();
    reset();
  }

  container.addEventListener("wheel", onWheel, { passive: false });
  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("dblclick", onDblClick);

  // Initial fit
  reset();

  return {
    reset,
    destroy() {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("dblclick", onDblClick);
    },
  };
}
