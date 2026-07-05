import esbuild from "esbuild";

const isWatch = process.argv.includes("--watch");
const isProduction = process.argv.includes("--production");

const options = {
  entryPoints: ["src/main.js"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  platform: "browser",
  target: "es2018",
  outfile: "main.js",
  sourcemap: isProduction ? false : "inline",
  logLevel: "info"
};

if (isWatch) {
  const context = await esbuild.context(options);
  await context.watch();
  console.log("Watching src/main.js -> main.js");
} else {
  await esbuild.build(options);
}