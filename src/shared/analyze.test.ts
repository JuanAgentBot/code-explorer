import { describe, it, expect } from "vitest";
import { analyzeTypes, analyzeCallGraph, analyzeModules } from "./analyze";

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
});
