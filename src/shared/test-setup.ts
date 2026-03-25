import ts from "typescript";

// analyze.ts reads the TypeScript compiler from globalThis.ts
// (loaded via CDN script tag in the browser).
// For tests, provide it from the npm package.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ts = ts;
