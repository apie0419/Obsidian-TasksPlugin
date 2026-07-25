import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import "./validate-release.mjs";

if (process.exitCode) {
  process.exit(process.exitCode);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const outputDir = join("release", manifest.id);

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const file of ["main.js", "manifest.json", "styles.css"]) {
  cpSync(file, join(outputDir, file));
}

writeFileSync(
  join(outputDir, "README.txt"),
  [
    `${manifest.name} ${manifest.version}`,
    "",
    "Manual install:",
    `Copy this folder to <vault>/.obsidian/plugins/${manifest.id}/, then enable the plugin in Obsidian.`,
    "",
    "GitHub Release assets:",
    "Upload main.js, manifest.json, and styles.css as separate release assets."
  ].join("\n")
);

console.log(`Packaged release files in ${outputDir}.`);
