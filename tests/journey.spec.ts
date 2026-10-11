import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const fixture = path.resolve("public/images/cafe-editorial.png");
async function sample(page: Page, goal = "这里的留白") {
  await page.goto("/");
  await page.getByRole("button", { name: "用咖啡馆示例试试" }).click();
  await page.getByRole("button", { name: new RegExp(goal) }).click();
  await page.getByRole("button", { name: "照这个目标试拍" }).click();
  await page.getByRole("button", { name: "看看示例的第一次试拍" }).click();
}
async function commitEditor(page: Page) {
  await page.getByRole("button", { name: "继续确认人物" }).click();
  await page.getByRole("button", { name: "确认这个人物框" }).click();
}
async function ownReference(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "选一张参考图" })
    .click({ noWaitAfter: true });
  await page.getByLabel("选择照片文件").setInputFiles(fixture);
  await commitEditor(page);
  await page.getByRole("button", { name: /人物的位置/ }).click();
  await page.getByRole("button", { name: "照这个目标试拍" }).click();
}
async function uploadShot(page: Page, button: string) {
  await page
    .getByRole("button", { name: button, exact: true })
    .click({ noWaitAfter: true });
  await page.getByLabel("选择照片文件").setInputFiles(fixture);
  await commitEditor(page);
}

test("sample flow, actual guide export, compare both preferences and download the selected crop", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await sample(page);
  await expect(
    page.getByRole("heading", { name: "调整取景，让人物在画面里靠右一点。" }),
  ).toBeVisible();
  const guideDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /保存拍摄指引卡/ }).click();
  const guide = await guideDownload;
  const guideBytes = await readFile((await guide.path())!);
  expect(guideBytes.subarray(1, 4).toString()).toBe("PNG");
  expect(guideBytes.readUInt32BE(16)).toBe(1200);
  await page.getByRole("button", { name: "看看调整后的一张" }).click();
  await expect(
    page.getByRole("heading", { name: "左侧留白，更接近你想要的了。" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "保存这张照片" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "我更喜欢之前那张", exact: true })
    .click();
  const beforeDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存这张照片" }).click();
  const before = await beforeDownload;
  expect(before.suggestedFilename()).toBe("照着拍-第1张.jpg");
  const beforeBytes = await readFile((await before.path())!);
  expect(beforeBytes.subarray(0, 2).toString("hex")).toBe("ffd8");
  await page.getByRole("button", { name: "我更喜欢这张", exact: true }).click();
  const afterDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存这张照片" }).click();
  const after = await afterDownload;
  expect(after.suggestedFilename()).toBe("照着拍-第2张.jpg");
  expect((await readFile((await after.path())!)).equals(beforeBytes)).toBe(
    false,
  );
  await page.getByRole("button", { name: "滑动", exact: true }).click();
  await page.getByRole("slider", { name: "拖动查看两张照片" }).fill("75");
  await expect(page.locator(".slider-after")).toHaveCSS(
    "clip-path",
    "inset(0px 0px 0px 75%)",
  );
  await page.getByRole("button", { name: "还想调整", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /下一步，\s*先做这一件事。/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("real uploads of the same photo require manual confirmation and do not force an adjustment", async ({
  page,
}) => {
  await ownReference(page);
  await uploadShot(page, "选一张试拍照片");
  await expect(
    page.getByRole("heading", {
      name: "这个目标已经比较接近，可以按这个构图拍。",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("按你确认的人物框生成 · 照片仅在当前浏览器处理"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "就留这张，保存照片" }),
  ).toBeEnabled();
});

test("a worse retake is reported truthfully and the previous photo remains selectable", async ({
  page,
}) => {
  await ownReference(page);
  await uploadShot(page, "选一张试拍照片");
  await page
    .getByRole("button", { name: "再拍一张", exact: true })
    .click({ noWaitAfter: true });
  await page.getByLabel("选择照片文件").setInputFiles(fixture);
  await page.getByRole("button", { name: "继续确认人物" }).click();
  await page.getByText("精细调整", { exact: true }).click();
  await page.getByRole("slider", { name: "人物框左右位置" }).fill("0.05");
  await page.getByRole("button", { name: "确认这个人物框" }).click();
  await expect(
    page.getByRole("heading", { name: "这次的人物的位置，离参考更远了一点。" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "我更喜欢之前那张", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "保存这张照片" }),
  ).toBeEnabled();
});

test("changing goals recalculates guidance; resizing a confirmed box changes scale advice", async ({
  page,
}) => {
  await sample(page);
  await page.getByRole("button", { name: "上一步", exact: true }).click();
  await page.getByRole("button", { name: /人和背景的比例/ }).click();
  await page.getByRole("button", { name: "按这个目标继续" }).click();
  await expect(
    page.getByRole("heading", {
      name: "这个目标已经比较接近，可以按这个构图拍。",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "人物框不准？调整一下" }).click();
  await page.getByText("精细调整", { exact: true }).click();
  await page.getByRole("slider", { name: "人物框高度" }).fill("0.5");
  await page.getByRole("button", { name: "确认这个人物框" }).click();
  await expect(
    page.getByRole("heading", {
      name: "保持当前焦距，靠近一点，让人物在画面里大一些。",
    }),
  ).toBeVisible();
});

test("bad file keeps the current session; replacing reference clears previous shots", async ({
  page,
}) => {
  await sample(page);
  await page
    .getByRole("button", { name: "选择重拍照片" })
    .click({ noWaitAfter: true });
  await page.getByLabel("选择照片文件").setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a photo"),
  });
  await expect(page.getByRole("alert")).toContainText("这张照片暂时读不了");
  await expect(
    page.getByRole("heading", { name: "调整取景，让人物在画面里靠右一点。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "上一步", exact: true }).click();
  await page
    .getByRole("button", { name: "换一张参考图" })
    .click({ noWaitAfter: true });
  await page.getByLabel("选择照片文件").setInputFiles(fixture);
  await commitEditor(page);
  await expect(
    page.getByRole("button", { name: "照这个目标试拍" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "照这个目标试拍" }).click();
  await expect(
    page.getByRole("heading", { name: "从一张试拍开始" }),
  ).toBeVisible();
});

test("crop dragging preserves aspect and editable box keyboard resize does not also move its parent", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "选一张参考图" })
    .click({ noWaitAfter: true });
  await page.getByLabel("选择照片文件").setInputFiles(fixture);
  await page.getByRole("button", { name: "4:5", exact: true }).click();
  const crop = page.getByRole("group", { name: "裁切框，可用方向键移动" });
  const first = await crop.boundingBox();
  await crop.focus();
  await page.keyboard.press("ArrowRight");
  const second = await crop.boundingBox();
  expect(second!.x).toBeGreaterThan(first!.x);
  expect(second!.width / second!.height).toBeCloseTo(0.8, 2);
  await page.getByRole("button", { name: "继续确认人物" }).click();
  const box = page.getByRole("group", { name: "人物框，可用方向键移动" });
  const before = await box.boundingBox();
  await page.getByRole("button", { name: "调整人物框右下角" }).focus();
  await page.keyboard.press("ArrowLeft");
  const after = await box.boundingBox();
  expect(after!.x).toBeCloseTo(before!.x, 1);
  expect(after!.width).toBeLessThan(before!.width);
  // Returning to crop must retain the user's latest subject edits.
  await page.getByRole("button", { name: "01 裁切画幅" }).click();
  await crop.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "继续确认人物" }).click();
  const afterRecrop = await box.boundingBox();
  expect(afterRecrop!.width).toBeCloseTo(after!.width, 1);
  await page.getByRole("button", { name: "确认这个人物框" }).click();
  const rendered = await page
    .locator(".reference-photo-column .photo-view")
    .boundingBox();
  expect(rendered!.width / rendered!.height).toBeCloseTo(0.8, 2);
});

for (const width of [360, 390]) {
  test(`mobile ${width}px: complete flow, correct image aspect, no horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await sample(page);
    const frame = await page
      .locator(".current-photo .photo-view")
      .boundingBox();
    expect(frame!.width / frame!.height).toBeCloseTo(0.8, 2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: /心里的那张参考/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.getByRole("button", { name: "看看调整后的一张" }).click();
    await page
      .getByRole("button", { name: "我更喜欢这张", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "保存这张照片" }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
