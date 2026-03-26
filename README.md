# code-explorer

TypeScript code visualization. Paste code or point it at a directory, see type maps, call graphs, and module dependency diagrams.

**[Try it live](https://juanagentbot.github.io/code-explorer/)**

## Local projects

Visualize a local codebase:

```bash
npx @juanagentbot/code-explorer ./src
```

Reads all `.ts` and `.tsx` files, starts a local server, and opens the browser. All analysis runs client-side. Skips `node_modules`, `dist`, `.git`, and dotfiles.

```
Options:
  --port <number>   Server port (default: 3000)
  --no-open         Don't open the browser
```

Requires Node.js 18+.

## Views

Three visualization types, switchable via the tab bar.

### Type Map

Interfaces, type aliases, classes, and enums. Shows extends (purple), implements (cyan), and property reference (green dashed) relationships. Displays generic type parameters (`Repository<T extends Entity>`). UML-like boxes with member details.

### Call Graph

Functions, methods, and arrow functions. Shows which functions call which, including `this.method()` calls within classes. Rounded pills with directed arrows.

### Module Graph

File-level import/export dependencies. Define multiple files with `// --- path/to/file.ts ---` separators (or use the CLI for real projects). Handles re-exports and barrel files. Entry points at the top, leaf modules at the bottom.

## Multi-file analysis

All three views support cross-file analysis. A type in `service.ts` extending an interface from `types.ts` shows up correctly in the Type Map. Same for cross-file function calls and import chains.

Uses a two-pass approach: first pass collects all declared names across files, second pass analyzes each file with the full name set so cross-file relationships are detected.

## Features

- **CodeMirror editor** with TypeScript syntax highlighting, line numbers, bracket matching
- **Layered graph layout** (simplified Sugiyama: DFS layer assignment, barycenter crossing reduction)
- **Pan and zoom** (scroll to zoom, drag to pan, double-click to fit)
- **Fullscreen mode** with zoom controls
- **Click-to-highlight** a node to see its direct neighbors; everything else dims
- **Color legends** showing what each color and edge style means
- **Shareable URLs** encoding code in the URL hash via lz-string
- **SVG export** to download any diagram

## Development

```bash
npm install
npm run dev       # Start dev server
npm run build     # Build web app + CLI
npm run check     # Typecheck + lint + test
```

Build outputs: `dist/web/` (Vite, ~1.9 MB) and `dist/cli.mjs` (esbuild, 3.5 KB).

## Tests

118 tests covering analysis (types, call graphs, modules, multi-file projects), rendering (layout, SVG output, legends), and CLI (file collection, HTML injection, server):

```bash
npm test
```

## Tech

- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) bundled via npm (~1.2 MB gzipped)
- [CodeMirror 6](https://codemirror.net/) for the editor
- [lz-string](https://github.com/pieroxy/lz-string) for URL compression
- [Vite](https://vite.dev) for the web app build
- [esbuild](https://esbuild.github.io/) for the CLI bundle
- Hand-built SVG rendering (no chart library)
- GitHub Pages via GitHub Actions
