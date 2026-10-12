import { test, expect } from "@playwright/test";
const A = process.env.PRODUCT_A_ENTRY ?? "/";
for (const [edition, url, guide] of [
  ["A", A, "magazine"],
  ["B", "/notebook.html", "notebook"],
] as const) {
  test(`${edition}: category upload, personal reference persistence, edit and deletion retain saved shooting plans`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url);
    await expect(page.locator(".zp-desktop-note")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "怎么用", exact: true }),
    ).toHaveAttribute("href", `/${guide}-guide.html`);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "找参考", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /上传我的参考图/ }),
    ).toBeInViewport();
    await page.getByRole("button", { name: "同款打卡", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /上传想拍的同款/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "画作复刻", exact: true }).click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /上传想复刻的画作/ }).click();
    await (await chooser).setFiles("public/images/cafe-editorial.png");
    await expect(page.locator(".zp-toast")).toContainText("已加入");
    await expect(
      page.getByRole("button", { name: "开始拍摄", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    const startRect = await page
      .getByRole("button", { name: "开始拍摄", exact: true })
      .boundingBox();
    expect(startRect!.y + startRect!.height).toBeLessThanOrEqual(844);
    await page.getByText("还想改哪里（可选）", { exact: true }).click();
    await page
      .getByRole("button", { name: "保存这次拍摄", exact: true })
      .click();
    await expect(page.locator(".zp-toast")).toContainText("已保存到");
    await page.reload();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "找参考", exact: true })
      .click();
    await page.getByRole("button", { name: /我的参考 · 1/ }).click();
    await expect(page.locator(".zp-note")).toHaveCount(1);
    await page
      .getByRole("button", { name: "管理cafe-editorial", exact: true })
      .click();
    await page.getByLabel("参考名称", { exact: true }).fill("我的周末同款");
    await page.getByLabel("参考分类", { exact: true }).selectOption("checkin");
    await page.getByRole("button", { name: "保存修改", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "同款打卡", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "查看我的周末同款", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "管理我的周末同款", exact: true })
      .click();
    await page
      .getByRole("button", { name: "删除这张参考", exact: true })
      .click();
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await expect(page.locator(".zp-note")).toHaveCount(1);
    await page
      .getByRole("button", { name: "管理我的周末同款", exact: true })
      .click();
    await page
      .getByRole("button", { name: "删除这张参考", exact: true })
      .click();
    await page
      .getByRole("button", { name: "确认删除参考", exact: true })
      .click();
    await expect(page.locator(".zp-note")).toHaveCount(0);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "我的拍摄", exact: true })
      .click();
    await expect(page.locator(".zp-saved-open")).toHaveCount(1);
    await page.locator(".zp-saved-open").click();
    await expect(
      page.getByRole("button", { name: "开始拍摄", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
  });
}
test("personal storage failure preserves imported photo and allows local shooting", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      get: () => {
        throw new Error("Storage unavailable");
      },
    }),
  );
  await page.goto(A);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /导入想照着拍的照片/ }).click();
  await (await chooser).setFiles("public/images/cafe-editorial.png");
  await expect(page.getByRole("alert")).toContainText("未保存到我的参考");
  await expect(
    page.getByRole("button", { name: "开始拍摄", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  expect(
    await page
      .locator(".zp-placement img")
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(80);
});

test("manual person confirmation wins over a late automatic detection", async ({
  page,
}) => {
  await page.route("**/models/pose_landmarker_full.task", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      await route.continue();
    } catch {}
  });
  await page.goto(A);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /导入想照着拍的照片/ }).click();
  await (await chooser).setFiles("public/images/cafe-editorial.png");
  await page.getByRole("button", { name: "调整人物范围", exact: true }).click();
  await page
    .getByRole("button", { name: "确认这个人物框", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "已使用你确认" }),
  ).toBeVisible();
  const box = await page.locator(".zp-target").getAttribute("style");
  await page.waitForTimeout(2400);
  expect(await page.locator(".zp-target").getAttribute("style")).toBe(box);
  await expect(
    page.getByRole("button", { name: "开始拍摄", exact: true }),
  ).toBeEnabled();
});
