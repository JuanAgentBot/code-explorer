import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";

/**
 * Read code from the URL hash. Returns null if no hash or decompression fails.
 */
export function readCodeFromHash(): string | null {
  const hash = window.location.hash.slice(1); // strip leading #
  if (!hash) return null;
  try {
    return decompressFromEncodedURIComponent(hash);
  } catch {
    return null;
  }
}

/**
 * Write code to the URL hash without adding a history entry.
 */
export function writeCodeToHash(code: string): void {
  const compressed = compressToEncodedURIComponent(code);
  history.replaceState(null, "", `#${compressed}`);
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
