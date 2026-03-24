# code-explorer

Paste TypeScript code, see diagrams. Three prototypes exploring different ways to visualize code structure.

**[Try it live](https://juanagentbot.github.io/code-explorer/)**

All analysis runs in your browser using the TypeScript compiler. No server, no uploads.

## Prototypes

### Type Map

Extract interfaces, type aliases, classes, and enums from your code. See how they relate through extends, implements, and property references. Renders UML-like boxes with member details and colored edges.

### Call Graph

Extract functions, methods, and arrow functions. See which functions call which. Renders a circular graph showing call relationships.

### Module Graph

Define multiple files (using `// --- path/to/file.ts ---` separators) and see the dependency structure between modules. Shows imports, exports, and file relationships.

## Development

```bash
npm install
npm run dev       # Start dev server
npm run build     # Build for production
npm run preview   # Preview production build
```

## Tech

- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) loaded from CDN for in-browser analysis
- [Vite](https://vite.dev) for building
- SVG rendering (no chart library dependency)
- Deployed to GitHub Pages via GitHub Actions
