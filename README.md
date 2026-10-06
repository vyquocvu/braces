# @vyquocvu/braces

A clean-room TypeScript implementation of Bash-like brace expansion, designed to be fast, dependency-free, and resistant to resource-exhaustion inputs.

## Goals

- Familiar `braces` API: callable default export plus `parse`, `stringify`, `compile`, `expand`, and `create`.
- No runtime dependencies.
- Iterative parsing/evaluation: deeply nested input does not recurse through the JavaScript call stack.
- Explicit resource budgets for untrusted input.
- Strict TypeScript and small, auditable source.

## Install

```bash
npm install @vyquocvu/braces
```

## Usage

```ts
import braces from "@vyquocvu/braces";

braces("a/{x,y}/b");
// ["a/(x|y)/b"]

braces("a/{x,y}/b", { expand: true });
// ["a/x/b", "a/y/b"]

braces.expand("{01..03}");
// ["01", "02", "03"]
```

## Security model

Expansion syntax can turn a tiny input into a very large amount of work. This implementation treats that as a first-class API concern.

Default limits:

| Option | Default | Purpose |
| --- | ---: | --- |
| `maxLength` | 10,000 | Maximum input length |
| `maxDepth` | 64 | Maximum brace nesting |
| `maxNodes` | 100,000 | Maximum AST nodes |
| `maxOutput` | 10,000 | Maximum expanded strings |
| `rangeLimit` | 1,000 | Maximum values materialized by one range |

Example for user-controlled input:

```ts
braces.expand(pattern, {
  maxLength: 2048,
  maxDepth: 32,
  maxNodes: 20_000,
  maxOutput: 2_000,
  rangeLimit: 500,
});
```

The parser and evaluator use explicit stacks rather than recursive function calls, so nesting is bounded by policy instead of the JavaScript call-stack size.

## Supported syntax

- Lists: `{a,b,c}`
- Numeric ranges: `{1..5}`, `{5..1}`
- Character ranges: `{a..z}`
- Steps: `{1..9..2}`
- Zero padding: `{001..010}`
- Nested braces
- Escaped separators
- Regex quantifier preservation with `{ quantifiers: true }`
- `nodupes`, `noempty`, and `keepEscaping`

## Development

```bash
npm install
npm test
npm run bench
```

## Compatibility note

This project aims for practical API compatibility with the widely used `braces` package, while intentionally preferring bounded work over silently processing unbounded expansion patterns. Extremely large ranges therefore throw a `RangeError` unless the caller explicitly raises the relevant limit.

## License

MIT.
