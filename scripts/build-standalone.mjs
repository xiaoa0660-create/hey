import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// The demo has no server dependencies. Bundle its generated photo, styles and
// application code into one portable document for offline review.
const root = resolve(import.meta.dirname, "..");
let html = await readFile(resolve(root, "dist/index.html"), "utf8");
const script = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(
  /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/,
);
if (!script || !stylesheet)
  throw new Error(
    "Expected Vite JavaScript and CSS assets. Run npm run build first.",
  );
const [js, css, photo, icon] = await Promise.all([
  readFile(resolve(root, "dist", script[1].replace(/^\//, "")), "utf8"),
  readFile(resolve(root, "dist", stylesheet[1].replace(/^\//, "")), "utf8"),
  readFile(resolve(root, "public/images/cafe-editorial.png")),
  readFile(resolve(root, "public/favicon.svg")),
]);
if (!js.includes("/images/cafe-editorial.png"))
  throw new Error(
    "Sample asset reference changed; update the standalone bundler.",
  );
const embedded = js
  .replaceAll(
    "/images/cafe-editorial.png",
    `data:image/png;base64,${photo.toString("base64")}`,
  )
  .replaceAll("</script", "<\\/script");
html = html.replace(
  script[0],
  () => `<script type="module">${embedded}</script>`,
);
html = html.replace(
  stylesheet[0],
  () => `<style>${css.replaceAll("</style", "<\\/style")}</style>`,
);
html = html.replace(
  "/favicon.svg",
  `data:image/svg+xml;base64,${icon.toString("base64")}`,
);
const output = resolve(root, "dist/照着拍-Demo.html");
await writeFile(output, html);
console.log(
  `Standalone demo: ${output} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB)`,
);
