const fs = require("fs-extra");
const path = require("path");
const sanitize = require("sanitize-filename");

function folderName(name) {
  return sanitize(name).replace(/\s+/g, "_") || "Ritual";
}

function cleanFileBase(name, fallback = "song") {
  return (sanitize(name || fallback).replace(/\s+/g, " ").trim() || fallback).slice(0, 120);
}

async function uniquePath(dir, base, ext) {
  let attempt = path.join(dir, `${base}${ext}`);
  let index = 2;
  while (await fs.pathExists(attempt)) {
    attempt = path.join(dir, `${base}_${index}${ext}`);
    index += 1;
  }
  return attempt;
}

module.exports = { folderName, cleanFileBase, uniquePath };
