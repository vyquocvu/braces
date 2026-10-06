const test = require("node:test");
const assert = require("node:assert/strict");
const bracesModule = require("../dist/index.js");
const braces = bracesModule.default;

test("CommonJS require returns callable API", () => {\n  assert.equal(typeof braces, "function");\n  assert.equal(typeof braces.expand, "function");\n  assert.equal(typeof braces.compile, "function");\n  assert.deepEqual(braces("{a,b}", { expand: true }), ["a", "b"]);\n});\n\ntest("expands comma lists", () => {
  assert.deepEqual(braces("a/{x,y,z}/b", { expand: true }), [
    "a/x/b",
    "a/y/b",
    "a/z/b",
  ]);
});

test("expands numeric ranges", () => {
  assert.deepEqual(braces.expand("{1..5}"), ["1", "2", "3", "4", "5"]);
  assert.deepEqual(braces.expand("{5..1..2}"), ["5", "3", "1"]);
});

test("expands alpha ranges", () => {
  assert.deepEqual(braces.expand("{a..e..2}"), ["a", "c", "e"]);
});

test("preserves zero padding", () => {
  assert.deepEqual(braces.expand("{01..03}"), ["01", "02", "03"]);
});

test("handles cartesian products", () => {
  assert.deepEqual(braces.expand("{a,b}{1,2}"), ["a1", "a2", "b1", "b2"]);
});

test("handles nested alternatives without duplicating siblings", () => {
  assert.deepEqual(braces.expand("a{b,c,{d,e}}"), ["ab", "ac", "ad", "ae"]);
});

test("does not expand a single item", () => {
  assert.deepEqual(braces.expand("a{b}c"), ["a{b}c"]);
});

test("supports escaped commas and strips escaping by default", () => {
  assert.deepEqual(braces.expand("a{d\\,c,b}e"), ["ad,ce", "abe"]);
});

test("can keep escaping", () => {
  assert.deepEqual(braces.expand("a{d\\,c,b}e", { keepEscaping: true }), [
    "ad\\,ce",
    "abe",
  ]);
});

test("supports nodupes", () => {
  assert.deepEqual(braces.expand("{a,a,b}", { nodupes: true }), ["a", "b"]);
});

test("supports noempty", () => {
  assert.deepEqual(braces.expand("{,a}", { noempty: true }), ["a"]);
});

test("preserves regex quantifiers when requested", () => {
  assert.deepEqual(braces("a/b{1,3}/{x,y}", { quantifiers: true }), [
    "a/b{1,3}/(x|y)",
  ]);
});

test("compiles alternatives", () => {
  assert.deepEqual(braces("a/{x,y}/b"), ["a/(x|y)/b"]);
});

test("parse/stringify round trip", () => {
  const ast = braces.parse("foo/{a,{1..3},b}/bar");
  assert.equal(braces.stringify(ast), "foo/{a,{1..3},b}/bar");
});

test("rejects excessive nesting before stack exhaustion", () => {
  const input = "{".repeat(65) + "x" + "}".repeat(65);
  assert.throws(
    () => braces.expand(input),
    /maxDepth/,
  );
});

test("allows a caller-controlled nesting budget", () => {
  const input = "{".repeat(8) + "x" + "}".repeat(8);
  assert.throws(
    () => braces.expand(input, { maxDepth: 4 }),
    /maxDepth/,
  );
});

test("rejects output explosions", () => {
  assert.throws(
    () => braces.expand("{a,b,c,d,e}{1,2,3,4,5}", { maxOutput: 20 }),
    /maxOutput/,
  );
});

test("rejects huge ranges", () => {
  assert.throws(
    () => braces.expand("{1..1001}"),
    /rangeLimit/,
  );
});

test("rejects oversized input", () => {
  assert.throws(
    () => braces.expand("x".repeat(20), { maxLength: 10 }),
    /maxLength/,
  );
});
