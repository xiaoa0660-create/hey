import { readFileSync } from "node:fs";
if (
  JSON.parse(readFileSync("package.json", "utf8")).version.startsWith("0.7.")
) {
  await import("./render-mobile-guides.mjs");
  process.exit(0);
}
import { chromium } from "@playwright/test";
import { copyFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(
    (process.env.PREVIEW_BASE_URL || "http://127.0.0.1:5173") +
      "/handbook.html",
  );
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.querySelectorAll("img[data-screen]")).map((img) =>
        img.decode(),
      ),
    ),
  );
  await page.screenshot({
    path: "docs/ui-preview/easy-v0.6/handbook-desktop.png",
    fullPage: false,
  });
  await page.pdf({
    path: "public/guide/照着拍-产品手册-v0.6.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  await mkdir("downloads", { recursive: true });
  await copyFile(
    "public/guide/照着拍-产品手册-v0.6.pdf",
    "downloads/照着拍-产品手册-v0.6.pdf",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw new Error("Manual overflows mobile viewport");
  await page.screenshot({
    path: "docs/ui-preview/easy-v0.6/handbook-mobile.png",
    fullPage: false,
  });
  const missing = await page.evaluate(() =>
    Array.from(document.querySelectorAll("img[data-screen]"))
      .filter((img) => !img.naturalWidth)
      .map((img) => img.src),
  );
  if (missing.length)
    throw new Error("Missing screenshots " + missing.join(","));
  console.log(
    "Created handbook PDF, mobile and desktop previews; all screenshots load.",
  );
} finally {
  await browser.close();
}
