export interface BracesOptions {
  expand?: boolean;
  nodupes?: boolean;
  noempty?: boolean;
  keepEscaping?: boolean;
  quantifiers?: boolean;
  maxLength?: number;
  maxDepth?: number;
  maxOutput?: number;
  maxNodes?: number;
  rangeLimit?: number;
}

export interface RootNode {
  type: "root";
  nodes: AstNode[];
}

export interface TextNode {
  type: "text";
  value: string;
}

export interface BraceNode {
  type: "brace";
  parts: AstNode[][];
}

export type AstNode = TextNode | BraceNode;
export type Ast = RootNode;

const DEFAULTS = {
  maxLength: 10_000,
  maxDepth: 64,
  maxOutput: 10_000,
  maxNodes: 100_000,
  rangeLimit: 1_000,
} as const;

type ResolvedOptions = Required<
  Pick<BracesOptions, "maxLength" | "maxDepth" | "maxOutput" | "maxNodes" | "rangeLimit">
> &
  BracesOptions;

function optionsOf(options: BracesOptions = {}): ResolvedOptions {
  return {
    ...options,
    maxLength: options.maxLength ?? DEFAULTS.maxLength,
    maxDepth: options.maxDepth ?? DEFAULTS.maxDepth,
    maxOutput: options.maxOutput ?? DEFAULTS.maxOutput,
    maxNodes: options.maxNodes ?? DEFAULTS.maxNodes,
    rangeLimit: options.rangeLimit ?? DEFAULTS.rangeLimit,
  };
}

function assertInput(input: string, options: ResolvedOptions): void {
  if (typeof input !== "string") {
    throw new TypeError("Expected a string");
  }
  if (input.length > options.maxLength) {
    throw new RangeError(
      `Input length ${input.length} exceeds maxLength ${options.maxLength}`,
    );
  }
}

function isEscaped(input: string, index: number): boolean {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && input.charCodeAt(i) === 92; i--) {
    slashes++;
  }
  return (slashes & 1) === 1;
}

function matchedBraces(input: string, options: ResolvedOptions): {
  opens: Set<number>;
  closes: Set<number>;
} {
  const opens = new Set<number>();
  const closes = new Set<number>();
  const stack: number[] = [];

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code === 123 && !isEscaped(input, i)) {
      if (stack.length >= options.maxDepth) {
        throw new RangeError(
          `Brace nesting exceeds maxDepth ${options.maxDepth}`,
        );
      }
      stack.push(i);
      continue;
    }

    if (code === 125 && !isEscaped(input, i) && stack.length > 0) {
      const open = stack.pop()!;
      opens.add(open);
      closes.add(i);
    }
  }

  return { opens, closes };
}

function appendText(nodes: AstNode[], value: string, counter: { value: number }, options: ResolvedOptions): void {
  if (!value) return;

  const last = nodes[nodes.length - 1];
  if (last?.type === "text") {
    last.value += value;
    return;
  }

  counter.value++;
  if (counter.value > options.maxNodes) {
    throw new RangeError(`AST exceeds maxNodes ${options.maxNodes}`);
  }
  nodes.push({ type: "text", value });
}

export function parse(input: string, options: BracesOptions = {}): Ast {
  const opts = optionsOf(options);
  assertInput(input, opts);

  const { opens, closes } = matchedBraces(input, opts);
  const root: RootNode = { type: "root", nodes: [] };
  const counter = { value: 1 };

  type Context = {
    brace: BraceNode;
    parent: AstNode[];
    current: AstNode[];
  };

  const stack: Context[] = [];
  let current = root.nodes;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;

    if (ch === "{" && opens.has(i)) {
      counter.value++;
      if (counter.value > opts.maxNodes) {
        throw new RangeError(`AST exceeds maxNodes ${opts.maxNodes}`);
      }

      const brace: BraceNode = { type: "brace", parts: [[]] };
      current.push(brace);
      const next = brace.parts[0]!;
      stack.push({ brace, parent: current, current: next });
      current = next;
      continue;
    }

    if (ch === "}" && closes.has(i) && stack.length > 0) {
      const ctx = stack.pop()!;
      current = ctx.parent;
      continue;
    }

    if (ch === "," && !isEscaped(input, i) && stack.length > 0) {
      const ctx = stack[stack.length - 1]!;
      const next: AstNode[] = [];
      ctx.brace.parts.push(next);
      ctx.current = next;
      current = next;
      continue;
    }

    appendText(current, ch, counter, opts);
  }

  return root;
}

function unescapeText(value: string, keepEscaping: boolean): string {
  if (keepEscaping || value.indexOf("\\") === -1) return value;

  let out = "";
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "\\" && i + 1 < value.length) {
      out += value[++i];
    } else {
      out += value[i];
    }
  }
  return out;
}

function rawSequence(nodes: AstNode[]): string | null {
  let out = "";
  for (const node of nodes) {
    if (node.type !== "text") return null;
    out += node.value;
  }
  return out;
}

type RangeSpec =
  | { kind: "number"; start: number; end: number; step: number; width: number }
  | { kind: "char"; start: number; end: number; step: number };

function parseRange(value: string): RangeSpec | null {
  const match = /^(-?\d+|[A-Za-z])\.\.(-?\d+|[A-Za-z])(?:\.\.(-?\d+))?$/.exec(value);
  if (!match) return null;

  const [, a, b, rawStep] = match;
  const numeric = /^-?\d+$/.test(a!) && /^-?\d+$/.test(b!);

  if (numeric) {
    const start = Number(a);
    const end = Number(b);
    let step = rawStep === undefined ? (start <= end ? 1 : -1) : Number(rawStep);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || !Number.isSafeInteger(step) || step === 0) {
      return null;
    }
    if (start < end && step < 0) step = -step;
    if (start > end && step > 0) step = -step;

    const aDigits = a!.replace(/^-/, "").length;
    const bDigits = b!.replace(/^-/, "").length;
    const padded = /^-?0\d/.test(a!) || /^-?0\d/.test(b!);
    return {
      kind: "number",
      start,
      end,
      step,
      width: padded ? Math.max(aDigits, bDigits) : 0,
    };
  }

  if (a!.length !== 1 || b!.length !== 1) return null;
  const start = a!.charCodeAt(0);
  const end = b!.charCodeAt(0);
  let step = rawStep === undefined ? (start <= end ? 1 : -1) : Number(rawStep);
  if (!Number.isSafeInteger(step) || step === 0) return null;
  if (start < end && step < 0) step = -step;
  if (start > end && step > 0) step = -step;
  return { kind: "char", start, end, step };
}

function rangeCount(range: RangeSpec): number {
  const distance = Math.abs(range.end - range.start);
  return Math.floor(distance / Math.abs(range.step)) + 1;
}

function formatNumber(value: number, width: number): string {
  if (width === 0) return String(value);
  const sign = value < 0 ? "-" : "";
  return sign + Math.abs(value).toString().padStart(width, "0");
}

function materializeRange(range: RangeSpec, options: ResolvedOptions): string[] {
  const count = rangeCount(range);
  if (count > options.rangeLimit) {
    throw new RangeError(
      `Range expands to ${count} values, exceeding rangeLimit ${options.rangeLimit}`,
    );
  }
  if (count > options.maxOutput) {
    throw new RangeError(
      `Range expands to ${count} values, exceeding maxOutput ${options.maxOutput}`,
    );
  }

  const out = new Array<string>(count);
  let value = range.start;

  for (let i = 0; i < count; i++, value += range.step) {
    out[i] =
      range.kind === "number"
        ? formatNumber(value, range.width)
        : String.fromCharCode(value);
  }

  return out;
}

function cartesian(
  left: string[],
  right: string[],
  options: ResolvedOptions,
): string[] {
  const size = left.length * right.length;
  if (!Number.isSafeInteger(size) || size > options.maxOutput) {
    throw new RangeError(
      `Expansion would produce ${size} values, exceeding maxOutput ${options.maxOutput}`,
    );
  }

  const out = new Array<string>(size);
  let k = 0;
  for (const a of left) {
    for (const b of right) out[k++] = a + b;
  }
  return out;
}

type EvalMode = "expand" | "compile";

function isQuantifier(node: BraceNode): boolean {
  if (node.parts.length !== 2) return false;
  const a = rawSequence(node.parts[0]!);
  const b = rawSequence(node.parts[1]!);
  return a !== null && b !== null && /^\d+$/.test(a) && /^\d+$/.test(b);
}

function evaluate(
  ast: Ast,
  mode: EvalMode,
  options: ResolvedOptions,
): string[] {
  const values = new Map<AstNode | RootNode, string[]>();

  type Frame =
    | { kind: "node"; node: AstNode | RootNode; visited: boolean };

  const stack: Frame[] = [{ kind: "node", node: ast, visited: false }];

  while (stack.length > 0) {
    const frame = stack.pop()!;
    const node = frame.node;

    if (!frame.visited) {
      stack.push({ kind: "node", node, visited: true });

      const children =
        node.type === "root"
          ? node.nodes
          : node.type === "brace"
            ? node.parts.flat()
            : [];

      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({ kind: "node", node: children[i]!, visited: false });
      }
      continue;
    }

    if (node.type === "text") {
      values.set(node, [unescapeText(node.value, options.keepEscaping === true)]);
      continue;
    }

    const parts = node.type === "root" ? [node.nodes] : node.parts;
    const renderedParts: string[][] = [];

    for (const sequence of parts) {
      let acc = [""];
      for (const child of sequence) {
        acc = cartesian(acc, values.get(child) ?? [""], options);
      }
      renderedParts.push(acc);
    }

    if (node.type === "root") {
      values.set(node, renderedParts[0] ?? [""]);
      continue;
    }

    const raw = node.parts.length === 1 ? rawSequence(node.parts[0]!) : null;
    const range = raw === null ? null : parseRange(raw);

    if (range) {
      const items = materializeRange(range, options);
      values.set(node, mode === "expand" ? items : [`(${items.join("|")})`]);
      continue;
    }

    if (options.quantifiers === true && isQuantifier(node)) {
      const literal = `{${renderedParts.map((p) => p.join("")).join(",")}}`;
      values.set(node, [literal]);
      continue;
    }

    if (node.parts.length < 2) {
      const inner = renderedParts[0]?.join("") ?? "";
      values.set(node, [`{${inner}}`]);
      continue;
    }

    if (mode === "compile") {
      const alternatives = renderedParts.flat();
      values.set(node, [`(${alternatives.join("|")})`]);
      continue;
    }

    const expanded = renderedParts.flat();
    if (expanded.length > options.maxOutput) {
      throw new RangeError(
        `Expansion produced ${expanded.length} values, exceeding maxOutput ${options.maxOutput}`,
      );
    }
    values.set(node, expanded);
  }

  return values.get(ast) ?? [""];
}

export function stringify(input: string | AstNode | Ast, options: BracesOptions = {}): string {
  const opts = optionsOf(options);
  const ast = typeof input === "string" ? parse(input, opts) : input;

  if (ast.type === "text") {
    return unescapeText(ast.value, opts.keepEscaping === true);
  }

  let out = "";
  type Frame =
    | { kind: "node"; node: AstNode | RootNode }
    | { kind: "text"; value: string };

  const stack: Frame[] = [{ kind: "node", node: ast }];

  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.kind === "text") {
      out += frame.value;
      continue;
    }

    const node = frame.node;
    if (node.type === "text") {
      out += unescapeText(node.value, opts.keepEscaping === true);
      continue;
    }

    if (node.type === "root") {
      for (let i = node.nodes.length - 1; i >= 0; i--) {
        stack.push({ kind: "node", node: node.nodes[i]! });
      }
      continue;
    }

    stack.push({ kind: "text", value: "}" });
    for (let p = node.parts.length - 1; p >= 0; p--) {
      const part = node.parts[p]!;
      for (let i = part.length - 1; i >= 0; i--) {
        stack.push({ kind: "node", node: part[i]! });
      }
      if (p > 0) stack.push({ kind: "text", value: "," });
    }
    stack.push({ kind: "text", value: "{" });
  }

  return out;
}

export function expand(input: string | Ast, options: BracesOptions = {}): string[] {
  const opts = optionsOf(options);
  const ast = typeof input === "string" ? parse(input, opts) : input;
  let result = evaluate(ast, "expand", opts);

  if (options.noempty === true) result = result.filter(Boolean);
  if (options.nodupes === true) result = [...new Set(result)];
  return result;
}

export function compile(input: string | Ast, options: BracesOptions = {}): string[] {
  const opts = optionsOf(options);
  const ast = typeof input === "string" ? parse(input, opts) : input;
  return evaluate(ast, "compile", opts);
}

export function create(input: string, options: BracesOptions = {}): string[] {
  if (input === "" || input.length < 3) return [input];
  return options.expand === true
    ? expand(input, options)
    : compile(input, options);
}

export interface Braces {
  (input: string | string[], options?: BracesOptions): string[];
  parse: typeof parse;
  stringify: typeof stringify;
  compile: typeof compile;
  expand: typeof expand;
  create: typeof create;
}

const braces = ((input: string | string[], options: BracesOptions = {}): string[] => {
  const patterns = Array.isArray(input) ? input : [input];
  const out: string[] = [];

  for (const pattern of patterns) {
    out.push(...create(pattern, options));
  }

  return options.expand === true && options.nodupes === true
    ? [...new Set(out)]
    : out;
}) as Braces;

braces.parse = parse;
braces.stringify = stringify;
braces.compile = compile;
braces.expand = expand;
braces.create = create;

export default braces;
