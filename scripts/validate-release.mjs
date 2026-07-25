import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const tagIndex = args.indexOf("--tag");
const expectedTag = tagIndex >= 0 ? args[tagIndex + 1] : "";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fail(message) {
  console.error(`Release check failed: ${message}`);
  process.exitCode = 1;
}

function warn(message) {
  console.warn(`Release check warning: ${message}`);
}

const manifest = readJson("manifest.json");
const packageJson = readJson("package.json");
const versions = readJson("versions.json");

const requiredManifestFields = [
  "id",
  "name",
  "version",
  "minAppVersion",
  "description",
  "author",
  "isDesktopOnly"
];

for (const field of requiredManifestFields) {
  if (manifest[field] === undefined || manifest[field] === "") {
    fail(`manifest.json is missing "${field}".`);
  }
}

if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(manifest.version)) {
  fail(`manifest.json version "${manifest.version}" must use x.y.z format.`);
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.id)) {
  fail(`manifest.json id "${manifest.id}" must use lowercase letters, numbers, and hyphens.`);
}

if (manifest.id.includes("obsidian")) {
  fail('manifest.json id must not contain "obsidian".');
}

if (/\bobsidian\b/i.test(manifest.description)) {
  fail('manifest.json description must not include the word "Obsidian".');
}

if (manifest.description.toLowerCase().startsWith(manifest.name.toLowerCase())) {
  fail("manifest.json description should not start with the plugin name.");
}

if (packageJson.version !== manifest.version) {
  fail(`package.json version ${packageJson.version} does not match manifest.json version ${manifest.version}.`);
}

if (versions[manifest.version] !== manifest.minAppVersion) {
  fail(`versions.json must map "${manifest.version}" to "${manifest.minAppVersion}".`);
}

if (expectedTag) {
  if (expectedTag.startsWith("v")) {
    fail(`GitHub release tag "${expectedTag}" must not start with "v".`);
  }
  if (expectedTag !== manifest.version) {
    fail(`GitHub release tag "${expectedTag}" must match manifest.json version "${manifest.version}".`);
  }
}

for (const path of ["main.js", "manifest.json", "styles.css", "README.md", "LICENSE"]) {
  if (!existsSync(path)) {
    fail(`${path} is required before release.`);
  }
}

if (manifest.author === "Codex") {
  warn('manifest.json author is still "Codex"; set this to the maintainer name before submitting to the community directory.');
}

if (!process.exitCode) {
  console.log(`Release check passed for ${manifest.id} ${manifest.version}.`);
}
