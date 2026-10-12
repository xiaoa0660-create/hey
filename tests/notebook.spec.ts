import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const cafe = "咖啡馆别只拍咖啡，窗边这样坐就很好看";
async function reference(page: Page) {
  await page.goto("/legacy-notebook.html");
  await page.getByRole("button", { name: `查看拍法：${cafe}` }).click();
  await page.getByRole("button", { name: "照着这张拍" }).click();
  await expect(page.locator(".v2-detection-status")).toContainText(
    "已识别人像",
    { timeout: 45_000 },
  );
}
async function cameraFixture(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 900;
        canvas.height = 1125;
        const img = new Image();
        img.src = "/images/cafe-editorial.png";
        await img.decode();
        const ctx = canvas.getContext("2d")!;
        const draw = () => ctx.drawImage(img, 0, 0, 900, 1125);
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
async function cardRecords(page: Page) {
  return page.evaluate(
    async () =>
      new Promise<{
        count: number;
        blob: boolean;
        capture: boolean;
        light?: string;
        motion?: string;
      }>((resolve, reject) => {
        const r = indexedDB.open("zhaozhepai-notebook-v1", 1);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("cards", "readonly"),
            q = tx.objectStore("cards").getAll();
          q.onsuccess = () => {
            const c = q.result[0];
            resolve({
              count: q.result.length,
              blob: c?.reference.blob instanceof Blob,
              capture: c?.capture?.photo.blob instanceof Blob,
              light: c?.target.lighting?.setup,
              motion: c?.target.notebook?.motion,
            });
          };
          tx.oncomplete = () => db.close();
        };
      }),
  );
}
test("notebook is mobile, image rich, searchable and favorites survive reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/legacy-notebook.html");
  await expect(page.locator(".nb-note-card")).toHaveCount(8);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: `收藏：${cafe}`, exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name: "收藏", exact: true })
    .click();
  await expect(page.locator(".nb-note-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: `取消收藏：${cafe}`, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "给下次拍照，留一点灵感" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name: "发现", exact: true })
    .click();
  await page.getByRole("button", { name: "搜索拍法笔记" }).click();
  await page.getByRole("textbox", { name: "搜索关键词" }).fill("橱窗");
  await expect(page.locator(".nb-note-card")).toHaveCount(1);
  await expect(page.locator(".nb-note-card")).toContainText("下雨也有好照片");
});
test("scene decision and motion are saved as blobs, restored after refresh, and deleted explicitly", async ({
  page,
}) => {
  await reference(page);
  await page.getByRole("button", { name: "看看怎么拍" }).click();
  await page.getByLabel("现场光线", { exact: true }).selectOption("overcast");
  await page.getByRole("button", { name: "只能原地拍" }).click();
  await expect(page.getByRole("dialog")).toContainText("不会与参考完全一样");
  await page.getByRole("button", { name: "用这个方案" }).click();
  await expect(
    page.getByRole("button", { name: "走两步，停一下" }),
  ).toBeDisabled();
  await page.locator(".nb-light-details > summary").click();
  await page.getByRole("button", { name: "夜景橱窗光", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "走两步，停一下" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "阴天漫射光", exact: true }).click();
  await page.locator(".nb-light-details > summary").click();
  await page.getByRole("button", { name: "给双手找件小事" }).click();
  await page.getByRole("button", { name: "确认目标，交给拍摄者" }).click();
  await page.getByRole("button", { name: "先保存拍摄小卡，下次再拍" }).click();
  await expect(page.getByRole("dialog")).toContainText("已保存到");
  expect(await cardRecords(page)).toMatchObject({
    count: 1,
    blob: true,
    capture: false,
    light: "overcast",
    motion: "hands",
  });
  await page.reload();
  await page.getByRole("button", { name: "我的小卡", exact: true }).click();
  await page.getByRole("button", { name: /继续这次拍摄/ }).click();
  await expect(
    page.getByRole("button", { name: "给双手找件小事" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "走两步，停一下" }),
  ).toBeDisabled();
  await expect(page.locator(".v2-detection-status")).toContainText(
    "已识别人像",
    { timeout: 45_000 },
  );
  await page.getByRole("button", { name: "返回发现" }).click();
  await page.getByRole("button", { name: "我的小卡", exact: true }).click();
  await page.getByRole("button", { name: /删除小卡/ }).click();
  await page.getByRole("button", { name: "删除这张小卡", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "下一次，不用从头想" }),
  ).toBeVisible();
  expect((await cardRecords(page)).count).toBe(0);
});
test("no reference entry matches local light and has a manual usable plan", async ({
  page,
}) => {
  await page.goto("/legacy-notebook.html");
  await page.getByRole("button", { name: "开始拍摄" }).click();
  await page.getByRole("button", { name: /没有参考，就在这里拍/ }).click();
  await page.getByLabel("现场光线", { exact: true }).selectOption("night");
  await page.getByRole("button", { name: "用这个方案" }).click();
  await expect(page.locator(".nb-plan-block").first()).toContainText(
    "现场方案已选好",
  );
  await expect(page.locator(".v4-reference-story")).toContainText("橱窗");
});
test("continuous capture keeps previous shots, applies one change, and saved capture survives refresh", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await cameraFixture(page);
  await reference(page);
  await page.getByRole("button", { name: "给双手找件小事" }).click();
  await page.getByRole("button", { name: "确认目标，交给拍摄者" }).click();
  await page.getByRole("button", { name: "我来拍，打开相机" }).click();
  const shutter = page.getByRole("button", { name: "拍下这一张" });
  await expect(shutter).toBeEnabled();
  await expect(page.getByLabel("双人动作提示")).toBeVisible();
  const box = (await shutter.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  await shutter.click();
  await expect(page.getByAltText("刚刚拍下的原片")).toBeVisible();
  await page.getByRole("button", { name: "再拍一张", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(shutter).toBeEnabled();
  await shutter.click();
  await expect(page.getByLabel("本次最近拍摄").getByRole("button")).toHaveCount(
    2,
  );
  await page.getByRole("button", { name: "查看第 1 张", exact: true }).click();
  await page
    .getByRole("button", { name: "动作自然一点", exact: false })
    .click();
  await page.getByRole("button", { name: "只改这一点，继续拍" }).click();
  await expect(page.getByTestId("notebook-camera-change")).toContainText(
    "只改动作",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(shutter).toBeEnabled();
  const changedBox = (await shutter.boundingBox())!;
  expect(changedBox.y + changedBox.height).toBeLessThanOrEqual(844);
  await shutter.click();
  await page.getByRole("button", { name: "把这一张存进拍摄小卡" }).click();
  await expect(page.locator(".nb-message")).toContainText("已保存到");
  expect(await cardRecords(page)).toMatchObject({
    count: 1,
    blob: true,
    capture: true,
    motion: "turn",
  });
  await page.reload();
  await page.getByRole("button", { name: "我的小卡", exact: true }).click();
  await page.getByRole("button", { name: /继续这次拍摄/ }).click();
  await page.getByRole("button", { name: "查看已保存或刚拍下的照片" }).click();
  await expect(page.getByAltText("刚刚拍下的原片")).toBeVisible();
  expect(
    await page
      .getByAltText("刚刚拍下的原片")
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(80);
});
test("feedback honors kept preferences and offers actionable manual lighting advice", async ({
  page,
}) => {
  await cameraFixture(page);
  await reference(page);
  await page.getByRole("button", { name: "确认目标，交给拍摄者" }).click();
  await page.getByRole("button", { name: "我来拍，打开相机" }).click();
  await page.getByRole("button", { name: "拍下这一张" }).click();
  await page.getByRole("button", { name: "+ 光线", exact: true }).click();
  await page.getByRole("button", { name: /脸再亮一点/ }).click();
  await expect(page.locator(".nb-next-change")).toContainText("已经选为保留");
  await expect(
    page.getByRole("button", { name: "只改这一点，继续拍" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "✓ 光线", exact: true }).click();
  await page.getByRole("button", { name: "只改这一点，继续拍" }).click();
  await expect(page.getByTestId("notebook-camera-change")).toContainText(
    "让脸稍转向窗户或亮处",
  );
});
test("unavailable browser storage gives an honest error instead of pretending to save", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "QuotaExceededError");
    };
  });
  await page.goto("/legacy-notebook.html");
  await page
    .getByRole("button", { name: `收藏：${cafe}`, exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("没有保存成功");
  await expect(
    page.getByRole("button", { name: `收藏：${cafe}`, exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
test("comparison opens both new editions with the same clear entry points", async ({
  page,
}) => {
  await page.goto("/compare.html");
  await page.getByRole("link", { name: "进入杂志版" }).click();
  await expect(page.locator(".zp-editorial")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "拍一下眼前的风景", exact: false }),
  ).toBeVisible();
  await page.goto("/compare.html");
  await page.getByRole("link", { name: "进入笔记版" }).click();
  await expect(page.locator(".zp-notebook")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "拍一下眼前的风景", exact: false }),
  ).toBeVisible();
});
