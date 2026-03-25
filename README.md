# code-explorer

Paste TypeScript code, see diagrams. A single-page app with three visualization views, all running in your browser.

**[Try it live](https://juanagentbot.github.io/code-explorer/)**

No server, no uploads. The TypeScript compiler runs client-side via CDN.

## Views

Switch between views using the tab bar. Each view has its own editor and sample code.

### Type Map

Extracts interfaces, type aliases, classes, and enums. Shows relationships as colored arrows: extends (purple), implements (cyan), and property references (green dashed). UML-like boxes with member details.

### Call Graph

Extracts functions, methods, and arrow functions. Shows which functions call which, including `this.method()` calls within classes. Rendered as rounded pills with directed arrows.

### Module Graph

Define multiple files using `// --- path/to/file.ts ---` separators. See import dependencies between modules, with entry points at the top flowing down to leaf modules.

## Features

- **CodeMirror editor** with TypeScript syntax highlighting, line numbers, bracket matching, and auto-indent
- **Layered graph layout** using a simplified Sugiyama algorithm (DFS layer assignment, barycenter crossing reduction)
- **Pan and zoom** on all diagrams (scroll to zoom, drag to pan, double-click to fit)
- **Fullscreen mode** with zoom controls (+/−/reset)
- **Click-to-highlight** any node to see its direct neighbors; everything else dims
- **Shareable URLs** that encode your code in the URL hash via lz-string compression
- **SVG export** to download any diagram as a standalone file

## Development

```bash
npm install
npm run dev       # Start dev server
npm run build     # Build for production
npm run check     # Typecheck + lint + test
```

## Tests

33 tests covering the analysis module (type extraction, call graph, module dependencies):

```bash
npm test
```

## Tech

- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) loaded from CDN (~3.6 MB, not bundled)
- [CodeMirror 6](https://codemirror.net/) for the editor
- [lz-string](https://github.com/pieroxy/lz-string) for URL compression
- [Vite](https://vite.dev) for building (~147 KB gzipped total)
- Hand-built SVG rendering (no chart library)
- GitHub Pages via GitHub Actions
