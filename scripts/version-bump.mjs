import { readFileSync, writeFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

const packageJson = readJson("package.json");
const manifest = readJson("manifest.json");
const versions = readJson("versions.json");

manifest.version = packageJson.version;
versions[manifest.version] = manifest.minAppVersion;

writeJson("manifest.json", manifest);
writeJson("versions.json", versions);

console.log(`Synced manifest.json and versions.json to ${manifest.version}.`);
