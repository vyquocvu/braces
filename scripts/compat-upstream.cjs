const assert = require("node:assert/strict");
const ours = require("../dist/index.cjs");

let upstream;
try {
  upstream = require("braces-upstream");
} catch {
  console.error("Missing braces-upstream oracle. Install temporarily with:");
  console.error("npm install --no-save --ignore-scripts braces-upstream@npm:braces@3.0.3");
  process.exit(2);
}

const cases = [
  "abc",
  "a/{x,y,z}/b",
  "{1..5}",
  "{5..1}",
  "{01..03}",
  "{001..010}",
  "{a..e}",
  "{E..A..2}",
  "{a,b}{1,2}",
  "a/{b,c,{d,e}}/g",
  "a{b,c{d,e}f}g",
  "{,}",
  "a{,}b",
  "{a,b{,}{,},c}d",
  "a/b/{d,e,[1-5]}/*.js",
  "a/{b,c}/{x\\,y}/d/e",
  "\\{a,b,c}",
  "{x\\,y,\\{abc\\},trie}",
  "abc/${ddd}/xyz",
  "a${b}c",
  "a/{${b},c}/d",
  "a{b}c",
  "{}",
  "}",
  "{",
  "abc{",
  "{{a,b}",
  "{a,b}}",
  "../{1..3}/../foo",
  "{-2..-10..3}",
  "{2147483645..2147483649}",
  "{1.1..2.1}",
  "{1..10f}",
  "foo {1,2} bar",
  "a/**/c/{d,e}/f*.{md,txt}"
];

const options = [
  {},
  { expand: true },
  { expand: true, nodupes: true },
  { expand: true, keepEscaping: true },
  { quantifiers: true },
];

let passed = 0;
let failed = 0;
const failures = [];

for (const pattern of cases) {
  for (const opts of options) {
    let a;
    let b;
    let ae;
    let be;

    try { a = ours(pattern, opts); } catch (error) { ae = error; }
    try { b = upstream(pattern, opts); } catch (error) { be = error; }

    const sameError =
      ae && be &&
      ae.constructor?.name === be.constructor?.name;

    try {
      if (ae || be) {
        assert.ok(sameError, "error mismatch");
      } else {
        assert.deepEqual(a, b);
      }
      passed++;
    } catch {
      failed++;
      failures.push({
        pattern,
        options: opts,
        ours: ae ? ae.constructor?.name + ": " + ae.message : a,
        upstream: be ? be.constructor?.name + ": " + be.message : b,
      });
    }
  }
}

const total = passed + failed;
const rate = total === 0 ? 100 : (passed / total) * 100;

console.log(JSON.stringify({
  total,
  passed,
  failed,
  compatibility: Number(rate.toFixed(2)),
  failures: failures.slice(0, 50),
}, null, 2));

process.exitCode = failed === 0 ? 0 : 1;
