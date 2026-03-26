import ts from "typescript";

// --- Type Map ---

export interface TypeNode {
  name: string;
  kind: "interface" | "type" | "class" | "enum";
  typeParams?: string;
  members: { name: string; type: string }[];
  position: { line: number };
}

export interface TypeEdge {
  from: string;
  to: string;
  kind: "extends" | "implements" | "references";
}

export interface TypeMapResult {
  nodes: TypeNode[];
  edges: TypeEdge[];
}

export function analyzeTypes(
  code: string,
  externalNames?: Set<string>,
): TypeMapResult {
  const sourceFile = ts.createSourceFile(
    "input.ts",
    code,
    ts.ScriptTarget.Latest,
    true,
  );

  const nodes: TypeNode[] = [];
  const edges: TypeEdge[] = [];
  const knownNames = new Set<string>(externalNames);

  // First pass: collect all declared type names
  ts.forEachChild(sourceFile, (node) => {
    const name = getDeclarationName(node);
    if (name) knownNames.add(name);
  });

  // Second pass: extract details and edges
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isInterfaceDeclaration(node)) {
      const name = node.name.text;
      const members = node.members
        .filter(ts.isPropertySignature)
        .map((m) => ({
          name: m.name?.getText(sourceFile) ?? "?",
          type: m.type?.getText(sourceFile) ?? "unknown",
        }));

      const typeParams = getTypeParams(node.typeParameters, sourceFile);
      nodes.push({
        name,
        kind: "interface",
        ...(typeParams && { typeParams }),
        members,
        position: { line: sourceFile.getLineAndCharacterOfPosition(node.pos).line },
      });

      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          for (const type of clause.types) {
            const target = type.expression.getText(sourceFile);
            if (knownNames.has(target)) {
              edges.push({ from: name, to: target, kind: "extends" });
            }
          }
        }
      }

      // Find references to other known types in member types
      for (const member of members) {
        for (const known of knownNames) {
          if (known !== name && member.type.includes(known)) {
            edges.push({ from: name, to: known, kind: "references" });
          }
        }
      }
    }

    if (ts.isTypeAliasDeclaration(node)) {
      const name = node.name.text;
      const typeText = node.type.getText(sourceFile);
      // For object literal types, extract properties
      const members: { name: string; type: string }[] = [];
      if (ts.isTypeLiteralNode(node.type)) {
        for (const m of node.type.members) {
          if (ts.isPropertySignature(m)) {
            members.push({
              name: m.name?.getText(sourceFile) ?? "?",
              type: m.type?.getText(sourceFile) ?? "unknown",
            });
          }
        }
      }

      const typeParams = getTypeParams(node.typeParameters, sourceFile);
      nodes.push({
        name,
        kind: "type",
        ...(typeParams && { typeParams }),
        members,
        position: { line: sourceFile.getLineAndCharacterOfPosition(node.pos).line },
      });

      // Find references
      for (const known of knownNames) {
        if (known !== name && typeText.includes(known)) {
          edges.push({ from: name, to: known, kind: "references" });
        }
      }
    }

    if (ts.isClassDeclaration(node) && node.name) {
      const name = node.name.text;
      const members = node.members
        .filter(
          (m): m is ts.PropertyDeclaration | ts.MethodDeclaration =>
            ts.isPropertyDeclaration(m) || ts.isMethodDeclaration(m),
        )
        .map((m) => ({
          name:
            (m.name?.getText(sourceFile) ?? "?") +
            (ts.isMethodDeclaration(m) ? "()" : ""),
          type: ts.isPropertyDeclaration(m)
            ? (m.type?.getText(sourceFile) ?? "unknown")
            : "method",
        }));

      const typeParams = getTypeParams(node.typeParameters, sourceFile);
      nodes.push({
        name,
        kind: "class",
        ...(typeParams && { typeParams }),
        members,
        position: { line: sourceFile.getLineAndCharacterOfPosition(node.pos).line },
      });

      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          for (const type of clause.types) {
            const target = type.expression.getText(sourceFile);
            if (knownNames.has(target)) {
              edges.push({
                from: name,
                to: target,
                kind:
                  clause.token === ts.SyntaxKind.ImplementsKeyword
                    ? "implements"
                    : "extends",
              });
            }
          }
        }
      }
    }

    if (ts.isEnumDeclaration(node)) {
      const name = node.name.text;
      const members = node.members.map((m) => ({
        name: m.name.getText(sourceFile),
        type: m.initializer?.getText(sourceFile) ?? "",
      }));

      nodes.push({
        name,
        kind: "enum",
        members,
        position: { line: sourceFile.getLineAndCharacterOfPosition(node.pos).line },
      });
    }
  });

  // Deduplicate edges
  const edgeKeys = new Set<string>();
  const uniqueEdges = edges.filter((e) => {
    const key = `${e.from}->${e.to}:${e.kind}`;
    if (edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    return true;
  });

  return { nodes, edges: uniqueEdges };
}

// --- Call Graph ---

export interface FunctionNode {
  name: string;
  kind: "function" | "method" | "arrow";
  className?: string;
  position: { line: number };
}

export interface CallEdge {
  from: string;
  to: string;
}

export interface CallGraphResult {
  nodes: FunctionNode[];
  edges: CallEdge[];
}

export function analyzeCallGraph(
  code: string,
  externalFunctions?: Set<string>,
): CallGraphResult {
  const sourceFile = ts.createSourceFile(
    "input.ts",
    code,
    ts.ScriptTarget.Latest,
    true,
  );

  const nodes: FunctionNode[] = [];
  const edges: CallEdge[] = [];
  const knownFunctions = new Set<string>(externalFunctions);

  // Collect all function/method names
  function collectFunctions(node: ts.Node, className?: string) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      knownFunctions.add(name);
      nodes.push({
        name,
        kind: "function",
        position: { line: sourceFile.getLineAndCharacterOfPosition(node.pos).line },
      });
    }

    if (ts.isMethodDeclaration(node) && node.name) {
      const methodName = node.name.getText(sourceFile);
      const fullName = className ? `${className}.${methodName}` : methodName;
      knownFunctions.add(fullName);
      knownFunctions.add(methodName); // also match unqualified
      nodes.push({
        name: fullName,
        kind: "method",
        className,
        position: { line: sourceFile.getLineAndCharacterOfPosition(node.pos).line },
      });
    }

    if (
      ts.isVariableDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isArrowFunction(node.initializer)
    ) {
      const name = node.name.text;
      knownFunctions.add(name);
      nodes.push({
        name,
        kind: "arrow",
        position: { line: sourceFile.getLineAndCharacterOfPosition(node.pos).line },
      });
    }

    if (ts.isClassDeclaration(node) && node.name) {
      ts.forEachChild(node, (child) => collectFunctions(child, node.name!.text));
      return; // don't recurse again
    }

    ts.forEachChild(node, (child) => collectFunctions(child, className));
  }

  collectFunctions(sourceFile);

  // Find calls within each function body
  function findCalls(body: ts.Node, callerName: string) {
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        let calleeName: string | undefined;

        if (ts.isIdentifier(expr)) {
          calleeName = expr.text;
        } else if (ts.isPropertyAccessExpression(expr)) {
          // Handle this.method() and obj.method()
          const method = expr.name.text;
          if (
            expr.expression.kind === ts.SyntaxKind.ThisKeyword &&
            callerName.includes(".")
          ) {
            const cls = callerName.split(".")[0];
            calleeName = `${cls}.${method}`;
          } else {
            calleeName = method;
          }
        }

        if (calleeName && calleeName !== callerName) {
          // Match against known functions (exact or method name)
          const match = [...knownFunctions].find(
            (f) => f === calleeName || f.endsWith(`.${calleeName}`),
          );
          if (match) {
            edges.push({ from: callerName, to: match });
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(body);
  }

  function extractCalls(node: ts.Node, className?: string) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      findCalls(node.body, node.name.text);
    }

    if (
      ts.isMethodDeclaration(node) &&
      node.name &&
      node.body &&
      className
    ) {
      const fullName = `${className}.${node.name.getText(sourceFile)}`;
      findCalls(node.body, fullName);
    }

    if (
      ts.isVariableDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isArrowFunction(node.initializer) &&
      node.initializer.body
    ) {
      findCalls(node.initializer.body, node.name.text);
    }

    if (ts.isClassDeclaration(node) && node.name) {
      ts.forEachChild(node, (child) => extractCalls(child, node.name!.text));
      return;
    }

    ts.forEachChild(node, (child) => extractCalls(child, className));
  }

  extractCalls(sourceFile);

  // Deduplicate edges
  const edgeKeys = new Set<string>();
  const uniqueEdges = edges.filter((e) => {
    const key = `${e.from}->${e.to}`;
    if (edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    return true;
  });

  return { nodes, edges: uniqueEdges };
}

// --- Module Graph ---

export interface ModuleNode {
  path: string;
  exports: string[];
}

export interface ImportEdge {
  from: string;
  to: string;
  imports: string[];
}

export interface ModuleGraphResult {
  nodes: ModuleNode[];
  edges: ImportEdge[];
  cycleEdges: { from: string; to: string }[];
}

export function analyzeModules(
  files: { path: string; content: string }[],
): ModuleGraphResult {
  const nodes: ModuleNode[] = [];
  const edges: ImportEdge[] = [];
  const pathSet = new Set(files.map((f) => f.path));

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.Latest,
      true,
    );

    const exports: string[] = [];
    const imports: Map<string, string[]> = new Map();

    ts.forEachChild(sourceFile, (node) => {
      // Collect exports
      if (hasExportModifier(node)) {
        const name = getDeclarationName(node);
        if (name) exports.push(name);
      }

      if (ts.isExportAssignment(node)) {
        exports.push("default");
      }

      // Collect re-exports: export { foo } from './bar' and export * from './bar'
      if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const spec = node.moduleSpecifier.text;
        const resolved = resolveImport(file.path, spec, pathSet);
        if (resolved) {
          const names: string[] = [];
          if (node.exportClause && ts.isNamedExports(node.exportClause)) {
            // export { foo, bar } from './module'
            for (const el of node.exportClause.elements) {
              names.push(el.propertyName?.text ?? el.name.text);
              exports.push(el.name.text);
            }
          } else if (!node.exportClause) {
            // export * from './module'
            names.push("*");
            exports.push("*");
          }
          const existing = imports.get(resolved);
          if (existing) {
            existing.push(...names);
          } else {
            imports.set(resolved, names);
          }
        }
      }

      // Collect imports
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const spec = node.moduleSpecifier.text;
        const resolved = resolveImport(file.path, spec, pathSet);
        if (resolved) {
          const names: string[] = [];
          if (node.importClause) {
            if (node.importClause.name) {
              names.push(node.importClause.name.text);
            }
            const bindings = node.importClause.namedBindings;
            if (bindings && ts.isNamedImports(bindings)) {
              for (const el of bindings.elements) {
                names.push(el.name.text);
              }
            }
            if (bindings && ts.isNamespaceImport(bindings)) {
              names.push(`* as ${bindings.name.text}`);
            }
          }
          const existing = imports.get(resolved);
          if (existing) {
            existing.push(...names);
          } else {
            imports.set(resolved, names);
          }
        }
      }
    });

    nodes.push({ path: file.path, exports });

    for (const [target, importedNames] of imports) {
      edges.push({ from: file.path, to: target, imports: importedNames });
    }
  }

  return { nodes, edges, cycleEdges: findCycleEdges(nodes.map(n => n.path), edges) };
}

// --- Cycle detection ---

/**
 * Find edges that are part of circular dependencies using Tarjan's SCC algorithm.
 * An edge is a cycle edge if both endpoints are in the same strongly connected
 * component (size > 1), or if it's a self-edge (from === to).
 */
function findCycleEdges(
  nodePaths: string[],
  edges: { from: string; to: string }[],
): { from: string; to: string }[] {
  const adj = new Map<string, string[]>();
  for (const path of nodePaths) adj.set(path, []);
  for (const e of edges) {
    adj.get(e.from)?.push(e.to);
  }

  // Tarjan's SCC algorithm
  let index = 0;
  const nodeIndex = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];

  function strongConnect(v: string) {
    nodeIndex.set(v, index);
    lowlink.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    for (const w of adj.get(v) ?? []) {
      if (!nodeIndex.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, nodeIndex.get(w)!));
      }
    }

    if (lowlink.get(v) === nodeIndex.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (const path of nodePaths) {
    if (!nodeIndex.has(path)) {
      strongConnect(path);
    }
  }

  // Map nodes in non-trivial SCCs (size > 1) to their SCC index
  const nodeToScc = new Map<string, number>();
  for (let i = 0; i < sccs.length; i++) {
    if (sccs[i].length > 1) {
      for (const node of sccs[i]) {
        nodeToScc.set(node, i);
      }
    }
  }

  // An edge is a cycle edge if both endpoints are in the same non-trivial SCC
  return edges
    .filter((e) => {
      if (e.from === e.to) return true; // self-edge
      const sccFrom = nodeToScc.get(e.from);
      const sccTo = nodeToScc.get(e.to);
      return sccFrom !== undefined && sccFrom === sccTo;
    })
    .map((e) => ({ from: e.from, to: e.to }));
}

// --- Multi-file parser ---

/** Format an array of files into the `// --- path ---` separator format used by the editor. */
export function formatFiles(
  files: { path: string; content: string }[],
): string {
  return files.map((f) => `// --- ${f.path} ---\n${f.content}`).join("\n");
}

export function parseFiles(
  input: string,
): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  const lines = input.split("\n");
  let currentPath: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\/\/\s*---\s*(.+?)\s*---\s*$/);
    if (match) {
      if (currentPath) {
        files.push({ path: currentPath, content: currentLines.join("\n") });
      }
      currentPath = match[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentPath) {
    files.push({ path: currentPath, content: currentLines.join("\n") });
  }

  return files;
}

// --- Multi-file analysis ---

/**
 * Analyze types across multiple files. Cross-file references (extends,
 * implements, references) are detected by collecting all type names from
 * all files first, then analyzing each file with the full name set.
 */
export function analyzeTypesProject(
  files: { path: string; content: string }[],
): TypeMapResult {
  // Pass 1: collect all type names across all files
  const allNames = new Set<string>();
  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.Latest,
      true,
    );
    ts.forEachChild(sourceFile, (node) => {
      const name = getDeclarationName(node);
      if (name) allNames.add(name);
    });
  }

  // Pass 2: analyze each file with the full name set for cross-file edge detection
  const allNodes: TypeNode[] = [];
  const allEdges: TypeEdge[] = [];

  for (const file of files) {
    const result = analyzeTypes(file.content, allNames);
    allNodes.push(...result.nodes);
    allEdges.push(...result.edges);
  }

  // Deduplicate nodes (same name from different files)
  const seenNodes = new Set<string>();
  const uniqueNodes = allNodes.filter((n) => {
    if (seenNodes.has(n.name)) return false;
    seenNodes.add(n.name);
    return true;
  });

  // Deduplicate edges
  const edgeKeys = new Set<string>();
  const uniqueEdges = allEdges.filter((e) => {
    const key = `${e.from}->${e.to}:${e.kind}`;
    if (edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    return true;
  });

  return { nodes: uniqueNodes, edges: uniqueEdges };
}

/**
 * Analyze call graphs across multiple files. Cross-file calls are detected
 * by collecting all function names from all files first, then analyzing
 * each file with the full name set.
 */
export function analyzeCallGraphProject(
  files: { path: string; content: string }[],
): CallGraphResult {
  // Pass 1: collect all function/method names across all files
  const allFunctions = new Set<string>();
  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.Latest,
      true,
    );
    collectFunctionNames(sourceFile, allFunctions);
  }

  // Pass 2: analyze each file with the full name set for cross-file call detection
  const allNodes: FunctionNode[] = [];
  const allEdges: CallEdge[] = [];

  for (const file of files) {
    const result = analyzeCallGraph(file.content, allFunctions);
    allNodes.push(...result.nodes);
    allEdges.push(...result.edges);
  }

  // Deduplicate nodes (same name from different files)
  const seenNodes = new Set<string>();
  const uniqueNodes = allNodes.filter((n) => {
    if (seenNodes.has(n.name)) return false;
    seenNodes.add(n.name);
    return true;
  });

  // Deduplicate edges
  const edgeKeys = new Set<string>();
  const uniqueEdges = allEdges.filter((e) => {
    const key = `${e.from}->${e.to}`;
    if (edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    return true;
  });

  return { nodes: uniqueNodes, edges: uniqueEdges };
}

/** Collect function/method names from a source file into the given set. */
function collectFunctionNames(
  sourceFile: ts.SourceFile,
  names: Set<string>,
  className?: string,
) {
  ts.forEachChild(sourceFile, function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      names.add(node.name.text);
    }

    if (ts.isMethodDeclaration(node) && node.name) {
      const methodName = node.name.getText(sourceFile);
      const fullName = className ? `${className}.${methodName}` : methodName;
      names.add(fullName);
      names.add(methodName);
    }

    if (
      ts.isVariableDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isArrowFunction(node.initializer)
    ) {
      names.add(node.name.text);
    }

    if (ts.isClassDeclaration(node) && node.name) {
      ts.forEachChild(node, (child) => {
        if (ts.isMethodDeclaration(child) && child.name) {
          const methodName = child.name.getText(sourceFile);
          names.add(`${node.name!.text}.${methodName}`);
          names.add(methodName);
        }
      });
      return;
    }

    ts.forEachChild(node, visit);
  });
}

// --- Helpers ---

function getTypeParams(
  typeParameters: ts.NodeArray<ts.TypeParameterDeclaration> | undefined,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (!typeParameters || typeParameters.length === 0) return undefined;
  const params = typeParameters.map((tp) => {
    let text = tp.name.text;
    if (tp.constraint) {
      text += ` extends ${tp.constraint.getText(sourceFile)}`;
    }
    if (tp.default) {
      text += ` = ${tp.default.getText(sourceFile)}`;
    }
    return text;
  });
  return `<${params.join(", ")}>`;
}

function getDeclarationName(node: ts.Node): string | undefined {
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node)
  ) {
    return node.name?.text;
  }
  if (ts.isVariableStatement(node)) {
    const decl = node.declarationList.declarations[0];
    if (decl && ts.isIdentifier(decl.name)) {
      return decl.name.text;
    }
  }
  return undefined;
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function resolveImport(
  fromPath: string,
  specifier: string,
  knownPaths: Set<string>,
): string | undefined {
  if (!specifier.startsWith(".")) return undefined;

  const fromDir = fromPath.includes("/")
    ? fromPath.substring(0, fromPath.lastIndexOf("/"))
    : ".";

  const parts = specifier.split("/");
  const resolved: string[] = fromDir.split("/");

  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  let base = resolved.join("/");
  // Normalize away leading "./" so root-level files resolve correctly
  if (base.startsWith("./")) base = base.substring(2);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`];
  return candidates.find((c) => knownPaths.has(c));
}
