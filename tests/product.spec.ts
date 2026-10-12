import { test, expect, type Page } from "@playwright/test";
import { LAKE_EXAMPLE } from "../src/product/scene";
const A_ENTRY = process.env.PRODUCT_A_ENTRY ?? "/";

async function cameraFixture(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const image = new Image();
        image.src = "/images/cafe-editorial.png";
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const draw = () => canvas.getContext("2d")!.drawImage(image, 0, 0);
        draw();
        const stream = canvas.captureStream(12),
          timer = setInterval(draw, 80),
          track = stream.getVideoTracks()[0],
          stop = track.stop.bind(track);
        track.stop = () => {
          clearInterval(timer);
          stop();
        };
        return stream;
      },
    });
  });
}
async function sceneFile(page: Page) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /拍一张或选择风景照片/ }).click();
  await (await chooser).setFiles("public/images/curated/parasol.jpg");
  await expect(page.locator(".zp-scene .zp-placement")).toBeVisible();
}
for (const [edition, url] of [
  ["A", A_ENTRY],
  ["B", "/notebook.html"],
] as const) {
  test(`${edition}: visible onboarding, 20 references, original artwork and persisted favorites`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url);
    await expect(
      page.getByRole("button", { name: /第一次来/ }),
    ).toBeInViewport();
    await page.getByRole("button", { name: /第一次来/ }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "不会启动相机或调用 AI",
    );
    await page.getByRole("button", { name: "下一步", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "两个人，各看一句提示",
    );
    await page.getByRole("button", { name: "关闭窗口" }).click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "找参考" })
      .click();
    await expect(page.locator(".zp-note")).toHaveCount(20);
    await page.getByRole("button", { name: "画作复刻", exact: true }).click();
    await expect(page.locator(".zp-note")).toHaveCount(4);
    await page
      .getByRole("button", {
        name: "查看把自己拍进《戴珍珠耳环的少女》",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("link", { name: /查看图片出处/ }),
    ).toHaveAttribute("href", /mauritshuis/);
    await page.getByRole("button", { name: "收藏这张参考" }).click();
    await page.reload();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "收藏", exact: true })
      .click();
    await expect(page.locator(".zp-note")).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
  });
  test(`${edition}: scene import keeps the image when AI is unavailable, and manual placement survives save/reload`, async ({
    page,
  }) => {
    await page.goto(url);
    await page.getByRole("button", { name: /拍一下眼前的风景/ }).click();
    await sceneFile(page);
    let sent = 0;
    await page.route("**/api/scene", (route) => {
      sent++;
      return route.abort();
    });
    await page
      .getByRole("button", { name: "让 AI 看看怎么拍", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("暂未开启");
    await expect(
      page.getByRole("button", { name: "同意发送，开始分析" }),
    ).toBeDisabled();
    expect(sent).toBe(0);
    await page.getByRole("button", { name: "不发送，我自己选站位" }).click();
    await expect(page.locator(".zp-page-title")).toContainText(
      "没有分析这张照片",
    );
    await expect(
      page.getByRole("button", { name: "开始拍摄", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "多留风景", exact: true }).click();
    const height = await page
      .locator(".zp-target")
      .evaluate((el) => el.style.height);
    expect(height).toBe("30%");
    await page.getByText("还想改哪里（可选）", { exact: true }).click();
    await page
      .getByRole("button", { name: "保存这次拍摄", exact: true })
      .click();
    await expect(page.locator(".zp-toast")).toContainText("已保存到");
    await page.reload();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "我的拍摄" })
      .click();
    await page.locator(".zp-saved-open").click();
    await expect(
      page.getByRole("button", { name: "多留风景", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await page.locator(".zp-target").evaluate((el) => el.style.height),
    ).toBe(height);
  });
}
test("scene API is called only after consent; rejection and cancellation preserve the uploaded image", async ({
  page,
}) => {
  let sent = 0;
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { configured: true, sceneConfigured: true } }),
  );
  await page.route("**/api/scene", (r) => {
    sent++;
    return r.fulfill({
      status: 502,
      json: { error: "这次风景分析没有成功，照片已保留。" },
    });
  });
  await page.goto(A_ENTRY);
  await page.getByRole("button", { name: /拍一下眼前的风景/ }).click();
  await sceneFile(page);
  await page
    .getByRole("button", { name: "让 AI 看看怎么拍", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "同意发送，开始分析" }),
  ).toBeEnabled();
  expect(sent).toBe(0);
  await page.getByRole("button", { name: "同意发送，开始分析" }).click();
  await expect(page.getByRole("alert")).toContainText("照片已保留");
  expect(sent).toBe(1);
  await expect(page.locator(".zp-scene .zp-placement")).toBeVisible();
  await page.getByRole("button", { name: "我先自己选站位" }).click();
  await expect(
    page.getByRole("button", { name: "开始拍摄", exact: true }),
  ).toBeEnabled();
});
test("validated scene plan guides real local camera, exports clean photos and keeps per-shot plans through retry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await cameraFixture(page);
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { configured: true, sceneConfigured: true } }),
  );
  await page.route("**/api/scene", (r) => r.fulfill({ json: LAKE_EXAMPLE }));
  await page.goto("/notebook.html");
  await page.getByRole("button", { name: /拍一下眼前的风景/ }).click();
  await sceneFile(page);
  await page
    .getByRole("button", { name: "让 AI 看看怎么拍", exact: true })
    .click();
  await page.getByRole("button", { name: "同意发送，开始分析" }).click();
  await expect(page.getByRole("button", { name: "人景平衡" })).toBeVisible();
  await page.getByRole("button", { name: "开始拍摄", exact: true }).click();
  await page.getByRole("button", { name: "我拿手机，打开相机" }).click();
  const shutter = page.getByRole("button", { name: "拍下这一张" });
  await expect(shutter).toBeEnabled();
  const rect = (await shutter.boundingBox())!;
  expect(rect.y + rect.height).toBeLessThanOrEqual(844);
  await shutter.click();
  await expect(page.getByAltText("刚刚拍下的原片")).toBeVisible();
  await expect(page.locator(".zp-scene-review")).toContainText("没有人物");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出原片", exact: true }).click();
  expect((await download).suggestedFilename()).toContain("原片.jpg");
  await page
    .getByRole("button", { name: "动作自然一点", exact: false })
    .click();
  await page.getByRole("button", { name: "只改这一点，继续拍" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(shutter).toBeEnabled();
  await shutter.click();
  await expect(page.getByLabel("本次最近拍摄").getByRole("button")).toHaveCount(
    2,
  );
  await page.getByRole("button", { name: "保存这次拍摄", exact: true }).click();
  await expect(page.locator(".zp-toast")).toContainText("已保存到");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "我的拍摄" })
    .click();
  await page.locator(".zp-saved-open").click();
  await page.getByRole("button", { name: "查看已拍下的照片" }).click();
  await expect(page.getByAltText("刚刚拍下的原片")).toBeVisible();
  await page.getByRole("button", { name: /换一张灵感/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("advanced adjustments apply to the simple plan and unsaved changes get a concrete leave choice", async ({
  page,
}) => {
  await page.goto(A_ENTRY);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "找参考" })
    .click();
  await page
    .getByRole("button", { name: "查看把咖啡的时间拍慢一点", exact: true })
    .click();
  await page.getByRole("button", { name: "照着这张拍", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "开始拍摄", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await page.getByText("还想改哪里（可选）", { exact: true }).click();
  await page.getByRole("button", { name: /打开照片裁切/ }).click();
  const advanced = page.locator(".zp-advanced");
  await expect(advanced.locator(".v2-detection-status")).toContainText(
    "已识别人像",
    { timeout: 45000 },
  );
  await advanced
    .getByRole("button", { name: "应用这些调整", exact: true })
    .click();
  await expect(advanced).toHaveCount(0);
  await page.locator(".zp-brand").click();
  await expect(page.getByRole("dialog")).toContainText("还没有明确保存");
  await page.getByRole("button", { name: "继续这次拍摄", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "这张怎么拍", exact: true }),
  ).toBeVisible();
  await page.locator(".zp-brand").click();
  await page.getByRole("button", { name: "保存后离开", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "我的拍摄" })
    .click();
  await expect(page.locator(".zp-saved-open")).toHaveCount(1);
  await page.locator(".zp-saved-open").click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "把咖啡的时间拍慢一点", exact: true }),
  ).toBeVisible();
});

test("canceling analysis ignores the late result and preserves the user photo", async ({
  page,
}) => {
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { configured: true, sceneConfigured: true } }),
  );
  await page.route("**/api/scene", async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 1400));
    try {
      await r.fulfill({ json: LAKE_EXAMPLE });
    } catch {}
  });
  await page.goto(A_ENTRY);
  await page.getByRole("button", { name: /拍一下眼前的风景/ }).click();
  await sceneFile(page);
  await page
    .getByRole("button", { name: "让 AI 看看怎么拍", exact: true })
    .click();
  await page.getByRole("button", { name: "同意发送，开始分析" }).click();
  await page.getByRole("button", { name: "取消分析，保留照片" }).click();
  await page.getByRole("button", { name: "我先自己选站位" }).click();
  await page.waitForTimeout(1600);
  await expect(page.locator(".zp-page-title")).toContainText(
    "没有分析这张照片",
  );
  expect(
    await page
      .locator(".zp-placement img")
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(80);
});
test("both independent mobile guides have readable images, zoom and PDF downloads", async ({
  page,
}) => {
  for (const [slug, name] of [
    ["magazine", "杂志版"],
    ["notebook", "笔记版"],
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${slug}-guide.html`);
    await expect(page.locator("header")).toContainText(name);
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll<HTMLImageElement>(".shot img")).every(
        (img) => img.complete && img.naturalWidth > 80,
      ),
    );
    await expect(page.locator("#theme-switch")).toHaveCount(0);
    await page.locator(".shot").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "关闭大图" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "下载 PDF ↓", exact: true }).click();
    expect((await download).suggestedFilename()).toBe(
      `${slug}-handbook-v0.7.pdf`,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
  }
});
