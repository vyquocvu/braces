const fs = require("node:fs");
const path = require("node:path");

const dist = path.resolve(__dirname, "../dist");
const target = path.join(dist, "index.cjs");

const wrapper = `"use strict";
const mod = require("./index.js");
const braces = mod.default;

braces.parse = mod.parse;
braces.stringify = mod.stringify;
braces.compile = mod.compile;
braces.expand = mod.expand;
braces.create = mod.create;

module.exports = braces;
`;

fs.writeFileSync(target, wrapper);
