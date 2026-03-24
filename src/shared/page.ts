/**
 * Wire up a prototype page: textarea input on the left, SVG output on the right.
 * Calls `onUpdate` whenever the input changes (debounced).
 */
export function setupPage(opts: {
  inputId: string;
  outputId: string;
  sampleCode: string;
  onUpdate: (code: string) => string;
}) {
  const input = document.getElementById(opts.inputId) as HTMLTextAreaElement;
  const output = document.getElementById(opts.outputId) as HTMLElement;

  if (!input || !output) return;

  let timer: ReturnType<typeof setTimeout>;

  function update() {
    const code = input.value;
    try {
      const svg = opts.onUpdate(code);
      output.innerHTML = svg;
    } catch (e) {
      output.innerHTML = `<div class="empty-state">Error: ${(e as Error).message}</div>`;
    }
  }

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(update, 300);
  });

  // Load sample code
  input.value = opts.sampleCode;
  update();
}
