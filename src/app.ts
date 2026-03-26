import {
  analyzeTypes,
  analyzeCallGraph,
  analyzeModules,
  parseFiles,
} from "./shared/analyze";
import {
  renderTypeMap,
  renderCallGraph,
  renderModuleGraph,
} from "./shared/render";
import { createEditor } from "./shared/editor";
import { setupPanZoom, type PanZoomControls } from "./shared/pan-zoom";
import {
  setupNodeHighlight,
  type InteractionControls,
} from "./shared/interaction";
import {
  readFromHash,
  writeToHash,
  copyShareUrl,
  type ViewType,
} from "./shared/url";
import {
  TYPE_MAP_SAMPLE,
  CALL_GRAPH_SAMPLE,
  MODULE_GRAPH_SAMPLE,
} from "./shared/sample-code";

// --- View definitions ---

interface RenderResult {
  svg: string;
  stats: string;
}

interface ViewConfig {
  label: string;
  sample: string;
  render: (code: string) => RenderResult;
  dotColor: string;
  inputLabel: string;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

const VIEWS: Record<ViewType, ViewConfig> = {
  types: {
    label: "Type Map",
    sample: TYPE_MAP_SAMPLE,
    render: (code) => {
      const result = analyzeTypes(code);
      return {
        svg: renderTypeMap(result),
        stats: result.nodes.length
          ? `${plural(result.nodes.length, "type")} · ${plural(result.edges.length, "edge")}`
          : "",
      };
    },
    dotColor: "var(--accent)",
    inputLabel: "input.ts",
  },
  calls: {
    label: "Call Graph",
    sample: CALL_GRAPH_SAMPLE,
    render: (code) => {
      const result = analyzeCallGraph(code);
      return {
        svg: renderCallGraph(result),
        stats: result.nodes.length
          ? `${plural(result.nodes.length, "function")} · ${plural(result.edges.length, "call")}`
          : "",
      };
    },
    dotColor: "var(--orange)",
    inputLabel: "input.ts",
  },
  modules: {
    label: "Module Graph",
    sample: MODULE_GRAPH_SAMPLE,
    render: (code) => {
      const result = analyzeModules(parseFiles(code));
      return {
        svg: renderModuleGraph(result),
        stats: result.nodes.length
          ? `${plural(result.nodes.length, "file")} · ${plural(result.edges.length, "import")}`
          : "",
      };
    },
    dotColor: "var(--cyan)",
    inputLabel: "files",
  },
};

const VIEW_ORDER: ViewType[] = ["types", "calls", "modules"];

// --- App state ---

/** Per-tab code storage. Initialized to sample code. */
const codeStore: Record<ViewType, string> = {
  types: TYPE_MAP_SAMPLE,
  calls: CALL_GRAPH_SAMPLE,
  modules: MODULE_GRAPH_SAMPLE,
};

let activeView: ViewType = "types";
let panZoom: PanZoomControls | null = null;
let interaction: InteractionControls | null = null;

// --- DOM setup ---

const tabBar = document.getElementById("tab-bar")!;
const diagramOutput = document.getElementById("diagram-output")!;
const editorContainer = document.getElementById("code-input")!;
const inputLabel = document.getElementById("input-label")!;
const diagramDot = document.getElementById("diagram-dot")!;
const diagramStats = document.getElementById("diagram-stats")!;

// Load initial state from URL hash
const hashState = readFromHash();
if (hashState) {
  activeView = hashState.view;
  codeStore[activeView] = hashState.code;
}

// Create editor
const editor = createEditor(editorContainer, codeStore[activeView], (code) => {
  codeStore[activeView] = code;
  writeToHash(activeView, code);
  renderDiagram(code);
});

// Build tab buttons
for (const viewId of VIEW_ORDER) {
  const btn = document.createElement("button");
  btn.className = "tab-btn" + (viewId === activeView ? " tab-btn--active" : "");
  btn.textContent = VIEWS[viewId].label;
  btn.dataset.view = viewId;
  btn.addEventListener("click", () => switchView(viewId));
  tabBar.appendChild(btn);
}

// Header buttons
addShareButton();
addExportButton();
addFullscreenButton();

// Initial render
updatePanelLabels();
renderDiagram(codeStore[activeView]);

// --- Functions ---

function switchView(view: ViewType) {
  if (view === activeView) return;

  // Save current code
  codeStore[activeView] = editor.getCode();

  // Switch
  activeView = view;

  // Update editor content
  editor.setCode(codeStore[view]);

  // Update URL
  writeToHash(view, codeStore[view]);

  // Update UI
  updatePanelLabels();
  updateTabs();
  renderDiagram(codeStore[view]);
}

function renderDiagram(code: string) {
  // Clean up previous interactions
  if (interaction) {
    interaction.destroy();
    interaction = null;
  }
  if (panZoom) {
    panZoom.destroy();
    panZoom = null;
  }

  try {
    const { svg, stats } = VIEWS[activeView].render(code);
    diagramOutput.innerHTML = svg;
    diagramStats.textContent = stats;

    if (diagramOutput.querySelector("svg")) {
      panZoom = setupPanZoom(diagramOutput);
      interaction = setupNodeHighlight(diagramOutput);
    }
  } catch (e) {
    diagramOutput.innerHTML = `<div class="empty-state">Error: ${(e as Error).message}</div>`;
    diagramStats.textContent = "";
  }
}

function updateTabs() {
  for (const btn of tabBar.querySelectorAll<HTMLButtonElement>(".tab-btn")) {
    btn.classList.toggle("tab-btn--active", btn.dataset.view === activeView);
  }
}

function updatePanelLabels() {
  const config = VIEWS[activeView];
  inputLabel.textContent = config.inputLabel;
  diagramDot.style.background = config.dotColor;
}

function addShareButton() {
  const header = document.querySelector(".header")!;
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

  header.appendChild(btn);
}

function addExportButton() {
  const panelHeader = diagramOutput
    .closest(".panel")
    ?.querySelector(".panel-header");
  if (!panelHeader) return;

  const btn = document.createElement("button");
  btn.className = "export-btn";
  btn.textContent = "SVG";
  btn.title = "Export diagram as SVG";

  btn.addEventListener("click", () => {
    const svg = diagramOutput.querySelector("svg");
    if (!svg) return;

    const svgString = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const slug = VIEWS[activeView].label.toLowerCase().replace(/\s+/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  });

  panelHeader.appendChild(btn);
}

function addFullscreenButton() {
  const panelHeader = diagramOutput
    .closest(".panel")
    ?.querySelector(".panel-header");
  if (!panelHeader) return;

  const btn = document.createElement("button");
  btn.className = "fullscreen-btn";
  btn.innerHTML = "&#x26F6;";
  btn.title = "Full screen (Escape to exit)";

  btn.addEventListener("click", () => {
    const svg = diagramOutput.querySelector("svg");
    if (!svg) return;
    openFullscreen(svg.outerHTML);
  });

  panelHeader.appendChild(btn);
}

function openFullscreen(svgHtml: string) {
  const overlay = document.createElement("div");
  overlay.className = "fullscreen-overlay";

  const closeBtn = document.createElement("button");
  closeBtn.className = "fullscreen-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.title = "Close (Escape)";

  const controls = document.createElement("div");
  controls.className = "fullscreen-controls";
  controls.innerHTML = `
    <button class="fullscreen-control-btn" data-action="zoom-in" title="Zoom in">+</button>
    <button class="fullscreen-control-btn" data-action="zoom-out" title="Zoom out">&minus;</button>
    <button class="fullscreen-control-btn" data-action="reset" title="Fit to screen">⊡</button>
  `;

  const diagramContainer = document.createElement("div");
  diagramContainer.className = "fullscreen-diagram";
  diagramContainer.innerHTML = svgHtml;

  overlay.appendChild(closeBtn);
  overlay.appendChild(controls);
  overlay.appendChild(diagramContainer);
  document.body.appendChild(overlay);

  const fsPanZoom = setupPanZoom(diagramContainer);
  const fsInteraction = setupNodeHighlight(diagramContainer);

  controls.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest("[data-action]");
    if (!target) return;
    const action = target.getAttribute("data-action");
    if (action === "reset") {
      fsPanZoom.reset();
    }
    if (action === "zoom-in" || action === "zoom-out") {
      const rect = diagramContainer.getBoundingClientRect();
      diagramContainer.dispatchEvent(
        new WheelEvent("wheel", {
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          deltaY: action === "zoom-in" ? -100 : 100,
          bubbles: true,
        }),
      );
    }
  });

  function close() {
    fsInteraction.destroy();
    fsPanZoom.destroy();
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

  requestAnimationFrame(() =>
    overlay.classList.add("fullscreen-overlay--open"),
  );
}
