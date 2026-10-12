import { chromium } from "@playwright/test";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
const base = process.env.PREVIEW_BASE_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const audit = [];
try {
  for (const slug of ["magazine", "notebook"]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/${slug}-guide.html`);
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.querySelectorAll(".shot img,.scene-image")).map(
          (img) => img.decode(),
        ),
      ),
    );
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error(slug + " mobile guide overflow");
    await page.screenshot({
      path: `docs/ui-preview/mobile-v0.7/${slug}-guide.png`,
      animations: "disabled",
    });
    await page.pdf({
      path: `public/guide/${slug}-handbook-v0.7.pdf`,
      preferCSSPageSize: true,
      printBackground: true,
    });
    await copyFile(
      `public/guide/${slug}-handbook-v0.7.pdf`,
      `downloads/${slug}-handbook-v0.7.pdf`,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    const width = await page
      .locator("main")
      .evaluate((el) => el.getBoundingClientRect().width);
    if (width > 430) throw new Error("Wide screen invented a desktop manual");
    if (errors.length) throw new Error(errors.join(";"));
    audit.push({
      slug,
      images: "loaded",
      mobile: "390px no overflow",
      desktopPreviewWidth: width,
      errors,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  "artifacts/mobile-guides-audit.json",
  JSON.stringify(audit, null, 2),
);
console.log(
  "Both independent mobile guides rendered; images and mobile layout checked.",
);
