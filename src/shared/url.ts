import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";

export type ViewType = "types" | "calls" | "modules";

const VALID_VIEWS = new Set<ViewType>(["types", "calls", "modules"]);

/**
 * Read view and code from the URL hash.
 * Format: #view:compressed_code (e.g. #types:NobwRA...)
 * Legacy format (no colon): treated as types view.
 * Returns null if no hash.
 */
export function readFromHash(): { view: ViewType; code: string } | null {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;

  const colonIdx = hash.indexOf(":");
  if (colonIdx === -1) {
    // Legacy format: just compressed code, default to types
    try {
      const code = decompressFromEncodedURIComponent(hash);
      if (code) return { view: "types", code };
    } catch {
      // ignore
    }
    return null;
  }

  const viewStr = hash.substring(0, colonIdx);
  const compressed = hash.substring(colonIdx + 1);

  const view = VALID_VIEWS.has(viewStr as ViewType)
    ? (viewStr as ViewType)
    : "types";

  try {
    const code = decompressFromEncodedURIComponent(compressed);
    if (code) return { view, code };
  } catch {
    // ignore
  }
  return null;
}

/**
 * Write view and code to the URL hash without adding a history entry.
 */
export function writeToHash(view: ViewType, code: string): void {
  const compressed = compressToEncodedURIComponent(code);
  history.replaceState(null, "", `#${view}:${compressed}`);
}

/**
 * Copy the current page URL (with hash) to the clipboard.
 * Returns true on success, false on failure.
 */
export async function copyShareUrl(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    return true;
  } catch {
    return false;
  }
}
