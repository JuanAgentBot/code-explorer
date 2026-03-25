import { readCodeFromHash, writeCodeToHash, copyShareUrl } from "./url";
import { createEditor } from "./editor";

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

  function update(code: string) {
    writeCodeToHash(code);
    try {
      const svg = opts.onUpdate(code);
      output.innerHTML = svg;
    } catch (e) {
      output.innerHTML = `<div class="empty-state">Error: ${(e as Error).message}</div>`;
    }
  }

  // Load from URL hash or fall back to sample code
  const initialCode = readCodeFromHash() ?? opts.sampleCode;

  createEditor(container, initialCode, update);

  // Trigger initial render
  update(initialCode);

  // Add share button to the header
  addShareButton();
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
