import { describe, it, expect } from "vitest";
import {
  analyzeTypes,
  analyzeCallGraph,
  analyzeModules,
  analyzeTypesProject,
  analyzeCallGraphProject,
  parseFiles,
  formatFiles,
} from "./analyze";

// --- analyzeTypes ---

describe("analyzeTypes", () => {
  it("extracts an interface with members", () => {
    const result = analyzeTypes(`
      interface User {
        name: string;
        age: number;
      }
    `);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      name: "User",
      kind: "interface",
      members: [
        { name: "name", type: "string" },
        { name: "age", type: "number" },
      ],
    });
    expect(result.edges).toHaveLength(0);
  });

  it("extracts a type alias with object literal members", () => {
    const result = analyzeTypes(`
      type Point = { x: number; y: number };
    `);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      name: "Point",
      kind: "type",
      members: [
        { name: "x", type: "number" },
        { name: "y", type: "number" },
      ],
    });
  });

  it("extracts a type alias without object literal (no members)", () => {
    const result = analyzeTypes(`
      type ID = string | number;
    `);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      name: "ID",
      kind: "type",
      members: [],
    });
  });

  it("extracts a class with properties and methods", () => {
    const result = analyzeTypes(`
      class Dog {
        name: string;
        bark() {}
      }
    `);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      name: "Dog",
      kind: "class",
      members: [
        { name: "name", type: "string" },
        { name: "bark()", type: "method" },
      ],
    });
  });

  it("extracts an enum with members", () => {
    const result = analyzeTypes(`
      enum Color {
        Red = "red",
        Green = "green",
        Blue = "blue",
      }
    `);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      name: "Color",
      kind: "enum",
      members: [
        { name: "Red", type: '"red"' },
        { name: "Green", type: '"green"' },
        { name: "Blue", type: '"blue"' },
      ],
    });
  });

  it("detects extends edges between interfaces", () => {
    const result = analyzeTypes(`
      interface Animal { name: string; }
      interface Dog extends Animal { breed: string; }
    `);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toContainEqual({
      from: "Dog",
      to: "Animal",
      kind: "extends",
    });
  });

  it("detects implements edges from class to interface", () => {
    const result = analyzeTypes(`
      interface Serializable { serialize(): string; }
      class Config implements Serializable {
        serialize() { return ""; }
      }
    `);

    expect(result.edges).toContainEqual({
      from: "Config",
      to: "Serializable",
      kind: "implements",
    });
  });

  it("detects extends edges between classes", () => {
    const result = analyzeTypes(`
      class Base { id: number; }
      class Child extends Base { name: string; }
    `);

    expect(result.edges).toContainEqual({
      from: "Child",
      to: "Base",
      kind: "extends",
    });
  });

  it("detects reference edges from member types", () => {
    const result = analyzeTypes(`
      interface Address { street: string; }
      interface User { home: Address; }
    `);

    expect(result.edges).toContainEqual({
      from: "User",
      to: "Address",
      kind: "references",
    });
  });

  it("detects reference edges from type aliases", () => {
    const result = analyzeTypes(`
      interface Item { id: string; }
      type Cart = { items: Item[]; total: number };
    `);

    expect(result.edges).toContainEqual({
      from: "Cart",
      to: "Item",
      kind: "references",
    });
  });

  it("deduplicates edges", () => {
    const result = analyzeTypes(`
      interface Coord { x: number; }
      interface Line { start: Coord; end: Coord; }
    `);

    const refs = result.edges.filter(
      (e) => e.from === "Line" && e.to === "Coord" && e.kind === "references",
    );
    expect(refs).toHaveLength(1);
  });

  it("ignores extends to unknown types", () => {
    const result = analyzeTypes(`
      interface Dog extends ExternalType { name: string; }
    `);

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it("handles empty input", () => {
    const result = analyzeTypes("");
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it("handles multiple declaration kinds together", () => {
    const result = analyzeTypes(`
      interface Shape { area(): number; }
      type Color = "red" | "blue";
      class Circle implements Shape { area() { return 0; } }
      enum Size { Small, Medium, Large }
    `);

    expect(result.nodes).toHaveLength(4);
    const kinds = result.nodes.map((n) => n.kind).sort();
    expect(kinds).toEqual(["class", "enum", "interface", "type"]);
  });

  it("extracts generic type parameters from an interface", () => {
    const result = analyzeTypes(`
      interface Container<T> {
        value: T;
      }
    `);

    expect(result.nodes[0]).toMatchObject({
      name: "Container",
      typeParams: "<T>",
    });
  });

  it("extracts constrained type parameters", () => {
    const result = analyzeTypes(`
      interface Repository<T extends Entity> {
        findById(id: string): T;
      }
      interface Entity { id: string; }
    `);

    expect(result.nodes.find((n) => n.name === "Repository")).toMatchObject({
      typeParams: "<T extends Entity>",
    });
  });

  it("extracts multiple type parameters", () => {
    const result = analyzeTypes(`
      type Pair<A, B> = { first: A; second: B };
    `);

    expect(result.nodes[0]).toMatchObject({
      name: "Pair",
      typeParams: "<A, B>",
    });
  });

  it("extracts type parameters with defaults", () => {
    const result = analyzeTypes(`
      interface Config<T = string> {
        value: T;
      }
    `);

    expect(result.nodes[0]).toMatchObject({
      typeParams: "<T = string>",
    });
  });

  it("extracts type parameters from classes", () => {
    const result = analyzeTypes(`
      class Stack<T> {
        items: T[];
        push(item: T) {}
      }
    `);

    expect(result.nodes[0]).toMatchObject({
      name: "Stack",
      kind: "class",
      typeParams: "<T>",
    });
  });

  it("omits typeParams when there are none", () => {
    const result = analyzeTypes(`
      interface Simple { name: string; }
    `);

    expect(result.nodes[0].typeParams).toBeUndefined();
  });
});

// --- analyzeCallGraph ---

describe("analyzeCallGraph", () => {
  it("extracts a function declaration", () => {
    const result = analyzeCallGraph(`
      function greet() { return "hi"; }
    `);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      name: "greet",
      kind: "function",
    });
    expect(result.edges).toHaveLength(0);
  });

  it("extracts an arrow function", () => {
    const result = analyzeCallGraph(`
      const add = (a: number, b: number) => a + b;
    `);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      name: "add",
      kind: "arrow",
    });
  });

  it("extracts class methods", () => {
    const result = analyzeCallGraph(`
      class Calc {
        add(a: number, b: number) { return a + b; }
        subtract(a: number, b: number) { return a - b; }
      }
    `);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]).toMatchObject({
      name: "Calc.add",
      kind: "method",
      className: "Calc",
    });
    expect(result.nodes[1]).toMatchObject({
      name: "Calc.subtract",
      kind: "method",
      className: "Calc",
    });
  });

  it("detects direct function calls", () => {
    const result = analyzeCallGraph(`
      function helper() { return 1; }
      function main() { helper(); }
    `);

    expect(result.edges).toContainEqual({
      from: "main",
      to: "helper",
    });
  });

  it("detects this.method() calls within a class", () => {
    const result = analyzeCallGraph(`
      class Service {
        validate() { return true; }
        process() { this.validate(); }
      }
    `);

    expect(result.edges).toContainEqual({
      from: "Service.process",
      to: "Service.validate",
    });
  });

  it("does not create self-edges", () => {
    const result = analyzeCallGraph(`
      function recurse() { recurse(); }
    `);

    expect(result.edges).toHaveLength(0);
  });

  it("ignores calls to unknown functions", () => {
    const result = analyzeCallGraph(`
      function main() { console.log("hi"); unknown(); }
    `);

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it("deduplicates call edges", () => {
    const result = analyzeCallGraph(`
      function log() {}
      function main() { log(); log(); log(); }
    `);

    expect(result.edges).toHaveLength(1);
  });

  it("handles arrow functions calling other functions", () => {
    const result = analyzeCallGraph(`
      function compute() { return 42; }
      const run = () => compute();
    `);

    expect(result.edges).toContainEqual({
      from: "run",
      to: "compute",
    });
  });

  it("handles empty input", () => {
    const result = analyzeCallGraph("");
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });
});

// --- analyzeModules ---

describe("analyzeModules", () => {
  it("extracts exports from a file", () => {
    const result = analyzeModules([
      {
        path: "utils.ts",
        content: `
          export function add(a: number, b: number) { return a + b; }
          export const PI = 3.14;
          function internal() {}
        `,
      },
    ]);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].path).toBe("utils.ts");
    expect(result.nodes[0].exports).toContain("add");
    expect(result.nodes[0].exports).toContain("PI");
    expect(result.nodes[0].exports).not.toContain("internal");
  });

  it("detects import edges between files", () => {
    const result = analyzeModules([
      {
        path: "utils.ts",
        content: `export function add() {}`,
      },
      {
        path: "main.ts",
        content: `import { add } from "./utils";`,
      },
    ]);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      from: "main.ts",
      to: "utils.ts",
      imports: ["add"],
    });
  });

  it("resolves relative imports in subdirectories", () => {
    const result = analyzeModules([
      {
        path: "lib/math.ts",
        content: `export function sum() {}`,
      },
      {
        path: "app/main.ts",
        content: `import { sum } from "../lib/math";`,
      },
    ]);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      from: "app/main.ts",
      to: "lib/math.ts",
    });
  });

  it("handles default imports", () => {
    const result = analyzeModules([
      {
        path: "config.ts",
        content: `export default { port: 3000 };`,
      },
      {
        path: "main.ts",
        content: `import config from "./config";`,
      },
    ]);

    expect(result.nodes.find((n) => n.path === "config.ts")?.exports).toContain(
      "default",
    );
    expect(result.edges[0].imports).toContain("config");
  });

  it("handles namespace imports", () => {
    const result = analyzeModules([
      {
        path: "utils.ts",
        content: `export function a() {} export function b() {}`,
      },
      {
        path: "main.ts",
        content: `import * as utils from "./utils";`,
      },
    ]);

    expect(result.edges[0].imports).toContain("* as utils");
  });

  it("ignores non-relative imports", () => {
    const result = analyzeModules([
      {
        path: "main.ts",
        content: `import { readFile } from "fs";`,
      },
    ]);

    expect(result.edges).toHaveLength(0);
  });

  it("ignores imports to unknown files", () => {
    const result = analyzeModules([
      {
        path: "main.ts",
        content: `import { foo } from "./missing";`,
      },
    ]);

    expect(result.edges).toHaveLength(0);
  });

  it("handles empty file list", () => {
    const result = analyzeModules([]);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it("resolves index.ts imports", () => {
    const result = analyzeModules([
      {
        path: "lib/index.ts",
        content: `export function create() {}`,
      },
      {
        path: "main.ts",
        content: `import { create } from "./lib";`,
      },
    ]);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      from: "main.ts",
      to: "lib/index.ts",
    });
  });

  it("handles named re-exports", () => {
    const result = analyzeModules([
      {
        path: "math.ts",
        content: `export function add() {} export function subtract() {}`,
      },
      {
        path: "index.ts",
        content: `export { add, subtract } from "./math";`,
      },
    ]);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      from: "index.ts",
      to: "math.ts",
      imports: ["add", "subtract"],
    });
    expect(result.nodes.find((n) => n.path === "index.ts")?.exports).toEqual(
      expect.arrayContaining(["add", "subtract"]),
    );
  });

  it("handles star re-exports", () => {
    const result = analyzeModules([
      {
        path: "utils.ts",
        content: `export function format() {} export function parse() {}`,
      },
      {
        path: "index.ts",
        content: `export * from "./utils";`,
      },
    ]);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      from: "index.ts",
      to: "utils.ts",
      imports: ["*"],
    });
    expect(result.nodes.find((n) => n.path === "index.ts")?.exports).toContain("*");
  });

  it("handles barrel file re-exporting from multiple modules", () => {
    const result = analyzeModules([
      {
        path: "lib/math.ts",
        content: `export function add() {}`,
      },
      {
        path: "lib/string.ts",
        content: `export function trim() {}`,
      },
      {
        path: "lib/index.ts",
        content: `export { add } from "./math";\nexport { trim } from "./string";`,
      },
      {
        path: "main.ts",
        content: `import { add, trim } from "./lib";`,
      },
    ]);

    const indexEdges = result.edges.filter((e) => e.from === "lib/index.ts");
    expect(indexEdges).toHaveLength(2);
    expect(indexEdges).toContainEqual(
      expect.objectContaining({ from: "lib/index.ts", to: "lib/math.ts" }),
    );
    expect(indexEdges).toContainEqual(
      expect.objectContaining({ from: "lib/index.ts", to: "lib/string.ts" }),
    );

    const mainEdge = result.edges.find((e) => e.from === "main.ts");
    expect(mainEdge).toMatchObject({ to: "lib/index.ts" });
  });

  it("handles re-export with renaming", () => {
    const result = analyzeModules([
      {
        path: "internal.ts",
        content: `export function _doWork() {}`,
      },
      {
        path: "public.ts",
        content: `export { _doWork as doWork } from "./internal";`,
      },
    ]);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      from: "public.ts",
      to: "internal.ts",
      imports: ["_doWork"],
    });
    expect(result.nodes.find((n) => n.path === "public.ts")?.exports).toContain(
      "doWork",
    );
  });

  it("ignores re-exports from non-relative modules", () => {
    const result = analyzeModules([
      {
        path: "index.ts",
        content: `export { readFile } from "fs";`,
      },
    ]);

    expect(result.edges).toHaveLength(0);
  });

  // --- Cycle detection ---

  it("detects no cycles in a DAG", () => {
    const result = analyzeModules([
      { path: "a.ts", content: `import { b } from "./b";` },
      { path: "b.ts", content: `import { c } from "./c";` },
      { path: "c.ts", content: `export const c = 1;` },
    ]);

    expect(result.cycleEdges).toHaveLength(0);
  });

  it("detects a direct circular dependency (A <-> B)", () => {
    const result = analyzeModules([
      { path: "a.ts", content: `import { y } from "./b"; export const x = 1;` },
      { path: "b.ts", content: `import { x } from "./a"; export const y = 2;` },
    ]);

    expect(result.cycleEdges).toHaveLength(2);
    expect(result.cycleEdges).toContainEqual({ from: "a.ts", to: "b.ts" });
    expect(result.cycleEdges).toContainEqual({ from: "b.ts", to: "a.ts" });
  });

  it("detects an indirect circular dependency (A -> B -> C -> A)", () => {
    const result = analyzeModules([
      { path: "a.ts", content: `import { b } from "./b"; export const a = 1;` },
      { path: "b.ts", content: `import { c } from "./c"; export const b = 2;` },
      { path: "c.ts", content: `import { a } from "./a"; export const c = 3;` },
    ]);

    expect(result.cycleEdges).toHaveLength(3);
    expect(result.cycleEdges).toContainEqual({ from: "a.ts", to: "b.ts" });
    expect(result.cycleEdges).toContainEqual({ from: "b.ts", to: "c.ts" });
    expect(result.cycleEdges).toContainEqual({ from: "c.ts", to: "a.ts" });
  });

  it("distinguishes cycle edges from non-cycle edges", () => {
    const result = analyzeModules([
      { path: "a.ts", content: `import { b } from "./b"; export const a = 1;` },
      { path: "b.ts", content: `import { a } from "./a"; import { c } from "./c"; export const b = 2;` },
      { path: "c.ts", content: `export const c = 3;` },
    ]);

    // a <-> b is a cycle, b -> c is not
    expect(result.cycleEdges).toHaveLength(2);
    expect(result.cycleEdges).toContainEqual({ from: "a.ts", to: "b.ts" });
    expect(result.cycleEdges).toContainEqual({ from: "b.ts", to: "a.ts" });
    // b -> c should NOT be in cycleEdges
    expect(result.cycleEdges).not.toContainEqual({ from: "b.ts", to: "c.ts" });
  });

  it("returns empty cycleEdges for a single file", () => {
    const result = analyzeModules([
      { path: "a.ts", content: `export const x = 1;` },
    ]);

    expect(result.cycleEdges).toHaveLength(0);
  });

  it("returns empty cycleEdges for empty file list", () => {
    const result = analyzeModules([]);
    expect(result.cycleEdges).toHaveLength(0);
  });
});

// --- parseFiles ---

describe("parseFiles", () => {
  it("parses multiple files from separator format", () => {
    const input = [
      "// --- utils.ts ---",
      "export function add() {}",
      "// --- main.ts ---",
      'import { add } from "./utils";',
    ].join("\n");

    const files = parseFiles(input);
    expect(files).toHaveLength(2);
    expect(files[0].path).toBe("utils.ts");
    expect(files[0].content).toContain("export function add");
    expect(files[1].path).toBe("main.ts");
    expect(files[1].content).toContain("import { add }");
  });

  it("handles nested paths", () => {
    const input = [
      "// --- src/lib/math.ts ---",
      "export const PI = 3.14;",
    ].join("\n");

    const files = parseFiles(input);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("src/lib/math.ts");
  });

  it("returns empty array for input with no separators", () => {
    const files = parseFiles("const x = 1;");
    expect(files).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    const files = parseFiles("");
    expect(files).toHaveLength(0);
  });
});

// --- formatFiles ---

describe("formatFiles", () => {
  it("formats files into separator format", () => {
    const files = [
      { path: "utils.ts", content: "export function add() {}" },
      { path: "main.ts", content: 'import { add } from "./utils";' },
    ];
    const result = formatFiles(files);
    expect(result).toBe(
      [
        "// --- utils.ts ---",
        "export function add() {}",
        "// --- main.ts ---",
        'import { add } from "./utils";',
      ].join("\n"),
    );
  });

  it("round-trips with parseFiles", () => {
    const original = [
      { path: "src/types.ts", content: "export interface User {\n  id: string;\n}" },
      { path: "src/service.ts", content: "import { User } from './types';\nexport class UserService {}" },
    ];
    const formatted = formatFiles(original);
    const parsed = parseFiles(formatted);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].path).toBe("src/types.ts");
    expect(parsed[0].content.trim()).toBe(original[0].content);
    expect(parsed[1].path).toBe("src/service.ts");
    expect(parsed[1].content.trim()).toBe(original[1].content);
  });

  it("handles empty array", () => {
    expect(formatFiles([])).toBe("");
  });

  it("handles single file", () => {
    const result = formatFiles([{ path: "index.ts", content: "const x = 1;" }]);
    expect(result).toBe("// --- index.ts ---\nconst x = 1;");
  });
});

// --- analyzeTypesProject ---

describe("analyzeTypesProject", () => {
  it("detects cross-file extends", () => {
    const result = analyzeTypesProject([
      {
        path: "types.ts",
        content: "interface Entity { id: string; }",
      },
      {
        path: "user.ts",
        content: "interface User extends Entity { name: string; }",
      },
    ]);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toContainEqual({
      from: "User",
      to: "Entity",
      kind: "extends",
    });
  });

  it("detects cross-file references in member types", () => {
    const result = analyzeTypesProject([
      {
        path: "address.ts",
        content: "interface Address { street: string; city: string; }",
      },
      {
        path: "person.ts",
        content: "interface Person { name: string; home: Address; }",
      },
    ]);

    expect(result.edges).toContainEqual({
      from: "Person",
      to: "Address",
      kind: "references",
    });
  });

  it("detects cross-file implements", () => {
    const result = analyzeTypesProject([
      {
        path: "serializable.ts",
        content: "interface Serializable { serialize(): string; }",
      },
      {
        path: "config.ts",
        content:
          'class Config implements Serializable { serialize() { return ""; } }',
      },
    ]);

    expect(result.edges).toContainEqual({
      from: "Config",
      to: "Serializable",
      kind: "implements",
    });
  });

  it("detects cross-file type alias references", () => {
    const result = analyzeTypesProject([
      {
        path: "item.ts",
        content: "interface Item { id: string; price: number; }",
      },
      {
        path: "cart.ts",
        content: "type Cart = { items: Item[]; total: number };",
      },
    ]);

    expect(result.edges).toContainEqual({
      from: "Cart",
      to: "Item",
      kind: "references",
    });
  });

  it("deduplicates nodes with the same name across files", () => {
    const result = analyzeTypesProject([
      {
        path: "a.ts",
        content: "interface Config { host: string; }",
      },
      {
        path: "b.ts",
        content: "interface Config { port: number; }",
      },
    ]);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].name).toBe("Config");
  });

  it("handles empty files", () => {
    const result = analyzeTypesProject([
      { path: "empty.ts", content: "" },
      {
        path: "types.ts",
        content: "interface User { name: string; }",
      },
    ]);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].name).toBe("User");
  });

  it("handles single file (same as analyzeTypes)", () => {
    const result = analyzeTypesProject([
      {
        path: "types.ts",
        content: `
          interface Animal { name: string; }
          interface Dog extends Animal { breed: string; }
        `,
      },
    ]);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toContainEqual({
      from: "Dog",
      to: "Animal",
      kind: "extends",
    });
  });

  it("handles empty file list", () => {
    const result = analyzeTypesProject([]);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });
});

// --- analyzeCallGraphProject ---

describe("analyzeCallGraphProject", () => {
  it("detects cross-file function calls", () => {
    const result = analyzeCallGraphProject([
      {
        path: "utils.ts",
        content: "function validate() { return true; }",
      },
      {
        path: "main.ts",
        content: "function process() { validate(); }",
      },
    ]);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toContainEqual({
      from: "process",
      to: "validate",
    });
  });

  it("detects cross-file arrow function calls", () => {
    const result = analyzeCallGraphProject([
      {
        path: "math.ts",
        content: "const add = (a: number, b: number) => a + b;",
      },
      {
        path: "calc.ts",
        content: "function compute() { return add(1, 2); }",
      },
    ]);

    expect(result.edges).toContainEqual({
      from: "compute",
      to: "add",
    });
  });

  it("detects cross-file method calls by unqualified name", () => {
    const result = analyzeCallGraphProject([
      {
        path: "service.ts",
        content: `
          class Service {
            fetch() { return []; }
          }
        `,
      },
      {
        path: "handler.ts",
        content: "function handle() { fetch(); }",
      },
    ]);

    expect(result.edges).toContainEqual({
      from: "handle",
      to: "Service.fetch",
    });
  });

  it("deduplicates nodes with the same name across files", () => {
    const result = analyzeCallGraphProject([
      {
        path: "a.ts",
        content: "function init() {}",
      },
      {
        path: "b.ts",
        content: "function init() {}",
      },
    ]);

    expect(result.nodes).toHaveLength(1);
  });

  it("handles empty files", () => {
    const result = analyzeCallGraphProject([
      { path: "empty.ts", content: "" },
      {
        path: "main.ts",
        content: "function main() {}",
      },
    ]);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].name).toBe("main");
  });

  it("handles empty file list", () => {
    const result = analyzeCallGraphProject([]);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });
});
