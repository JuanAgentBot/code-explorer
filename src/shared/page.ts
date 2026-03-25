import { readCodeFromHash, writeCodeToHash, copyShareUrl } from "./url";
import { createEditor } from "./editor";
import { setupPanZoom, type PanZoomControls } from "./pan-zoom";

/**
 * Wire up a prototype page: CodeMirror editor on the left, SVG output on the right.
 * Calls `onUpdate` whenever the input changes (debounced inside the editor).
 *
 * If the URL contains a hash, the code is loaded from it instead of the sample.
 * Every edit updates the hash so the URL is always shareable.
 */
export function setupPage(opts: {
  inputId: string;
  outputId: string;
  sampleCode: string;
  onUpdate: (code: string) => string;
}) {
  const container = document.getElementById(opts.inputId);
  const output = document.getElementById(opts.outputId) as HTMLElement;

  if (!container || !output) return;

  let panZoom: PanZoomControls | null = null;

  function update(code: string) {
    writeCodeToHash(code);

    // Clean up previous pan-zoom before replacing content
    if (panZoom) {
      panZoom.destroy();
      panZoom = null;
    }

    try {
      const svg = opts.onUpdate(code);
      output.innerHTML = svg;

      // Set up pan-zoom on the diagram area
      if (output.querySelector("svg")) {
        panZoom = setupPanZoom(output);
      }
    } catch (e) {
      output.innerHTML = `<div class="empty-state">Error: ${(e as Error).message}</div>`;
    }
  }

  // Load from URL hash or fall back to sample code
  const initialCode = readCodeFromHash() ?? opts.sampleCode;

  createEditor(container, initialCode, update);

  // Trigger initial render
  update(initialCode);

  // Add header buttons
  addShareButton();
  addFullscreenButton(output, () => {
    // After fullscreen content is set up, return current SVG
    const svg = output.querySelector("svg");
    return svg ? svg.outerHTML : null;
  });
}

function addShareButton() {
  const header = document.querySelector(".header");
  if (!header) return;

  const btn = document.createElement("button");
  btn.className = "share-btn";
  btn.textContent = "Share";
  btn.title = "Copy shareable URL to clipboard";

  btn.addEventListener("click", async () => {
    const ok = await copyShareUrl();
    if (ok) {
      btn.textContent = "Copied!";
      btn.classList.add("share-btn--copied");
      setTimeout(() => {
        btn.textContent = "Share";
        btn.classList.remove("share-btn--copied");
      }, 1500);
    }
  });

  // Insert before the nav (last child of header)
  const nav = header.querySelector("nav");
  if (nav) {
    header.insertBefore(btn, nav);
  } else {
    header.appendChild(btn);
  }
}

function addFullscreenButton(
  diagramArea: HTMLElement,
  getSvg: () => string | null,
) {
  // Add button to the diagram panel header
  const diagramPanel = diagramArea.closest(".panel");
  const panelHeader = diagramPanel?.querySelector(".panel-header");
  if (!panelHeader) return;

  const btn = document.createElement("button");
  btn.className = "fullscreen-btn";
  btn.innerHTML = "&#x26F6;"; // ⛶ fullscreen icon
  btn.title = "Full screen (Escape to exit)";

  btn.addEventListener("click", () => {
    openFullscreen(getSvg);
  });

  panelHeader.appendChild(btn);
}

function openFullscreen(getSvg: () => string | null) {
  const svgHtml = getSvg();
  if (!svgHtml) return;

  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "fullscreen-overlay";

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "fullscreen-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.title = "Close (Escape)";

  // Zoom controls
  const controls = document.createElement("div");
  controls.className = "fullscreen-controls";
  controls.innerHTML = `
    <button class="fullscreen-control-btn" data-action="zoom-in" title="Zoom in">+</button>
    <button class="fullscreen-control-btn" data-action="zoom-out" title="Zoom out">&minus;</button>
    <button class="fullscreen-control-btn" data-action="reset" title="Fit to screen">⊡</button>
  `;

  // Diagram container
  const diagramContainer = document.createElement("div");
  diagramContainer.className = "fullscreen-diagram";
  diagramContainer.innerHTML = svgHtml;

  overlay.appendChild(closeBtn);
  overlay.appendChild(controls);
  overlay.appendChild(diagramContainer);
  document.body.appendChild(overlay);

  // Set up pan-zoom on the fullscreen diagram
  const panZoom = setupPanZoom(diagramContainer);

  // Wire up control buttons
  controls.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest("[data-action]");
    if (!target) return;

    const action = target.getAttribute("data-action");
    if (action === "reset") {
      panZoom.reset();
    }
    // zoom-in / zoom-out: simulate wheel events on center
    if (action === "zoom-in" || action === "zoom-out") {
      const rect = diagramContainer.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      diagramContainer.dispatchEvent(
        new WheelEvent("wheel", {
          clientX: centerX,
          clientY: centerY,
          deltaY: action === "zoom-in" ? -100 : 100,
          bubbles: true,
        }),
      );
    }
  });

  // Close handlers
  function close() {
    panZoom.destroy();
    document.removeEventListener("keydown", onKey);
    overlay.remove();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", onKey);

  // Fade in
  requestAnimationFrame(() => overlay.classList.add("fullscreen-overlay--open"));
}
