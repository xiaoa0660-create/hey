import { cp, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { build } from "esbuild";
const root = resolve(import.meta.dirname, "..");
const model = await readFile(
  resolve(root, "public/models/pose_landmarker_full.task"),
);
if (
  createHash("sha256").update(model).digest("hex") !==
  "5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1"
)
  throw new Error(
    "Pose model checksum mismatch. See docs/model-assets.md. A Git LFS pointer is not a model.",
  );
await mkdir(resolve(root, "public/vision/wasm"), { recursive: true });
await cp(
  resolve(root, "node_modules/@mediapipe/tasks-vision/wasm"),
  resolve(root, "public/vision/wasm"),
  { recursive: true },
);
await build({
  entryPoints: [resolve(root, "src/workers/pose.worker.ts")],
  outfile: resolve(root, "public/vision/pose-worker.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
});
console.log("Pinned MediaPipe WASM copied to local assets.");
