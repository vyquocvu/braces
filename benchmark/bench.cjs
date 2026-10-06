const { performance } = require("node:perf_hooks");
const braces = require("../dist/index.js").default;

const cases = [
  ["list", "a/{foo,bar,baz}/file.js", { expand: true }],
  ["range", "file-{001..500}.txt", { expand: true, rangeLimit: 1000 }],
  ["nested", "a/{x,{1..20},y}/{foo,bar}/z", { expand: true }],
  ["compile", "src/{foo,bar,baz}/{1..100}.js", {}],
];

for (const [name, pattern, options] of cases) {
  const iterations = 10_000;
  for (let i = 0; i < 100; i++) braces(pattern, options);

  const start = performance.now();
  for (let i = 0; i < iterations; i++) braces(pattern, options);
  const elapsed = performance.now() - start;

  console.log(
    `${name.padEnd(8)} ${(iterations / (elapsed / 1000)).toFixed(0).padStart(10)} ops/s  ${elapsed.toFixed(1)} ms`,
  );
}
