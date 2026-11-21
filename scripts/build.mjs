import { build } from "vite";
import esbuild from "esbuild";
import { rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });

await build({ configFile: "vite.config.js" });

await esbuild.build({
  entryPoints: ["worker/index.js"],
  bundle: true,
  format: "esm",
  target: "es2022",
  platform: "neutral",
  outfile: "dist/worker.js",
  minify: true,
  legalComments: "none",
  logLevel: "info",
});

console.log("✓ build complete");
