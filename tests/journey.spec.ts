import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { resolve } from "node:path";
async function reference(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "先用一张示例试试" }).click();
  await expect(page.locator(".v2-detection-status")).toContainText(
    "已识别人像",
    { timeout: 45_000 },
  );
}
async function paint(page: Page, x = 0.405, y = 0.155) {
  const canvas = page.getByTestId("selection-canvas");
  const b = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: b.width * x, y: b.height * y } });
}
async function camera(page: Page) {
  await reference(page);
  await paint(page);
  await page.getByRole("button", { name: "确认目标，去拍摄" }).click();
  await page.getByRole("button", { name: "准备好了，打开相机" }).click();
}
async function syntheticCamera(page: Page) {
  // Browser test fixture only: real MediaPipe inference on a canvas MediaStream.
  // This is not a physical-camera or real-device acceptance test.
  await page.addInitScript(() => {
    const state = window as unknown as {
      __scene: string;
      __streams: MediaStream[];
    };
    state.__scene = "person";
    state.__streams = [];
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 900;
        canvas.height = 1125;
        const ctx = canvas.getContext("2d")!,
          img = new Image();
        img.src = "/images/city-sun.png";
        await img.decode();
        const draw = () => {
          ctx.fillStyle = "#687d69";
          ctx.fillRect(0, 0, 900, 1125);
          if (state.__scene !== "blank")
            ctx.drawImage(
              img,
              state.__scene === "shifted" ? 180 : 0,
              0,
              900,
              1125,
            );
        };
        draw();
        const stream = canvas.captureStream(12),
          timer = setInterval(draw, 80);
        state.__streams.push(stream);
        const track = stream.getVideoTracks()[0],
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
test("real model recognizes all four references and empty pixels do not invent a body", async ({
  page,
}) => {
  await page.goto("/");
  const detections = await page.evaluate(async () => {
    const { PoseClient } = await import("/src/lib/pose-client.ts" as string),
      client = new PoseClient();
    const results = [];
    try {
      for (const name of [
        "city-sun.png",
        "cafe-editorial.png",
        "meadow.png",
        "painting-study.png",
      ]) {
        const image = new Image();
        image.src = "/images/" + name;
        await image.decode();
        const result = await client.detect(image);
        results.push({
          name,
          count: result.people.length,
          visibleArms: result.people[0]?.landmarks
            .filter((_: unknown, i: number) =>
              [11, 12, 13, 14, 15, 16].includes(i),
            )
            .every((p: { visibility: number }) => p.visibility > 0.55),
        });
      }
      const blank = document.createElement("canvas");
      blank.width = 640;
      blank.height = 800;
      blank.getContext("2d")!.fillRect(0, 0, 640, 800);
      results.push({
        name: "blank",
        count: (await client.detect(blank)).people.length,
        visibleArms: false,
      });
      return results;
    } finally {
      client.dispose();
    }
  });
  expect(
    detections.slice(0, 4).every((d) => d.count === 1 && d.visibleArms),
  ).toBe(true);
  expect(detections[4].count).toBe(0);
});
test("paint, erase, undo, redo and mode switch preserve intended scope", async ({
  page,
}) => {
  await reference(page);
  await paint(page, 0.025, 0.93);
  await expect(
    page.getByRole("button", { name: "确认目标，去拍摄" }),
  ).toBeDisabled();
  await paint(page);
  await expect(page.getByTestId("selected-groups")).toContainText("右臂动作");
  await page.getByRole("button", { name: "橡皮", exact: true }).click();
  await paint(page);
  await expect(page.getByTestId("selected-groups")).not.toContainText(
    "右臂动作",
  );
  await page.getByRole("button", { name: "撤销涂抹" }).click();
  await expect(page.getByTestId("selected-groups")).toContainText("右臂动作");
  await page.getByRole("button", { name: "重做涂抹" }).click();
  await expect(page.getByTestId("selected-groups")).not.toContainText(
    "右臂动作",
  );
  await page.getByRole("button", { name: "撤销涂抹" }).click();
  await page.getByRole("button", { name: "整张照片复刻" }).click();
  await expect(
    page.getByRole("checkbox", { name: "画面构图", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "只学涂抹的部分" }).click();
  await expect(page.getByTestId("selected-groups")).toContainText("右臂动作");
  await expect(
    page.getByRole("checkbox", { name: "画面构图", exact: true }),
  ).not.toBeChecked();
});
test("editing the brief changes confirmed targets; unsupported text blocks confirmation", async ({
  page,
}) => {
  await reference(page);
  await page.getByRole("button", { name: "整张照片复刻" }).click();
  const text = page.getByRole("textbox", { name: "我理解你想拍的是" });
  await text.fill("只学抬手，不要手贴脸；保留参考的暖色，背景自由。");
  await expect(
    page.getByRole("button", { name: "确认目标，去拍摄" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "应用修改" }).click();
  await expect(page.getByTestId("target-summary")).toContainText("不要手贴脸");
  await expect(
    page.getByRole("checkbox", { name: "画面构图", exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "色彩与冷暖", exact: true }),
  ).toBeChecked();
  await text.fill("我要你自动改变现场光源");
  await page.getByRole("button", { name: "应用修改" }).click();
  await expect(page.getByRole("alert")).toContainText("不能确定");
  await expect(
    page.getByRole("button", { name: "确认目标，去拍摄" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "恢复自动解读" }).click();
  await expect(
    page.getByRole("button", { name: "确认目标，去拍摄" }),
  ).toBeEnabled();
});
test("upload cancel preserves session, valid image can be cropped, rotation invalidates selection", async ({
  page,
}) => {
  await reference(page);
  await paint(page);
  await page
    .getByLabel("导入参考照片")
    .setInputFiles(resolve("public/images/meadow.png"));
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "关闭窗口" }).click();
  await expect(page.getByTestId("selected-groups")).toContainText("右臂动作");
  await page
    .getByLabel("导入参考照片")
    .setInputFiles(resolve("public/images/meadow.png"));
  await page.getByRole("button", { name: "4:5", exact: true }).click();
  await page.getByRole("button", { name: "继续确认人物" }).click();
  await page.getByRole("button", { name: "确认这个人物框" }).click();
  await expect(page.locator(".v2-detection-status")).toContainText(
    "已识别人像",
  );
  await page.getByRole("button", { name: "整张照片复刻" }).click();
  await expect(
    page.getByRole("button", { name: "确认目标，去拍摄" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "顺时针旋转参考" }).click();
  await expect(
    page.getByRole("button", { name: "只学涂抹的部分" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "确认目标，去拍摄" }),
  ).toBeDisabled();
});
test("cloud analysis is opt-in and unconfigured service leaves local workflow usable", async ({
  page,
}) => {
  let sent = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/interpret")) sent++;
  });
  await reference(page);
  await paint(page);
  await page.getByRole("button", { name: "深度解读", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("不会发送相机视频");
  await expect(page.getByRole("dialog")).toContainText("深度解读还未配置");
  expect(sent).toBe(0);
  await page.getByRole("button", { name: "关闭窗口" }).click();
  await expect(
    page.getByRole("button", { name: "确认目标，去拍摄" }),
  ).toBeEnabled();
});
test("denied camera offers recovery and retains edited reference", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    }),
  );
  await camera(page);
  await expect(page.getByRole("alert")).toContainText("相机权限没有开启");
  await page.getByRole("button", { name: "调整目标", exact: true }).click();
  await expect(page.getByTestId("selected-groups")).toContainText("右臂动作");
  await expect(
    page.getByRole("button", { name: "确认目标，去拍摄" }),
  ).toBeEnabled();
});
test("real video inference pauses when person disappears, shutter saves clean pixels and releases camera", async ({
  page,
}) => {
  await syntheticCamera(page);
  await camera(page);
  await expect(page.getByRole("button", { name: "拍下这一张" })).toBeEnabled();
  await expect(page.locator(".v2-live-hint")).toHaveClass(/hold/, {
    timeout: 30_000,
  });
  await page.screenshot({
    path: "artifacts/v2-camera-desktop.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    (window as unknown as { __scene: string }).__scene = "blank";
  });
  await expect(page.locator(".v2-live-hint")).toHaveClass(/lost/, {
    timeout: 10_000,
  });
  await expect(page.getByRole("slider", { name: "镜头变焦" })).toHaveCount(0);
  await page.getByRole("button", { name: "拍下这一张" }).click();
  await expect(
    page.getByRole("heading", { name: "有参考，也有你的样子。" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as unknown as { __streams: MediaStream[] }).__streams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    ),
  ).toBe(true);
  const pixels = await page
    .getByAltText("刚刚拍下的原片")
    .evaluate(async (el) => {
      const img = el as HTMLImageElement;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      return [
        [20, 20],
        [Math.round(c.width / 2), Math.round(c.height / 2)],
        [c.width - 20, c.height - 20],
      ].map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]);
    });
  for (const pixel of pixels) {
    expect(Math.abs(pixel[0] - 104)).toBeLessThan(5);
    expect(Math.abs(pixel[1] - 125)).toBeLessThan(5);
    expect(Math.abs(pixel[2] - 105)).toBeLessThan(5);
  }
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存原片", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("照着拍-原片.jpg");
  await page.getByRole("button", { name: "微调一下颜色" }).click();
  await page.getByRole("slider", { name: "冷暖", exact: true }).fill("25");
  await expect(page.getByText("调色预览", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "恢复原片", exact: true }).click();
  await expect(page.getByText("拍摄原片", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "artifacts/v2-result-desktop.png",
    fullPage: true,
  });
});
test("mobile layout, reference selection and screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({
    path: "artifacts/v2-home-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await reference(page);
  await paint(page);
  await expect(page.getByTestId("selected-groups")).toContainText("右臂动作");
  await page.screenshot({
    path: "artifacts/v2-reference-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("pending edits survive new strokes, and mirror does not undo an applied target edit", async ({
  page,
}) => {
  await reference(page);
  await paint(page);
  const text = page.getByRole("textbox", { name: "我理解你想拍的是" });
  await text.fill("只学右臂，背景自由");
  await page.getByRole("button", { name: "放大参考" }).click();
  const rect = await page.locator(".v2-selection-content").boundingBox();
  await page.mouse.click(
    rect!.x + rect!.width * 0.4,
    rect!.y + rect!.height * 0.155,
  );
  await expect(text).toHaveValue("只学右臂，背景自由");
  await page.getByRole("button", { name: "应用修改" }).click();
  await page
    .getByRole("checkbox", { name: "镜像学习（左右动作互换）" })
    .check();
  await expect(page.getByTestId("target-summary")).toContainText(
    "跟随右臂动作",
  );
  await expect(page.getByTestId("target-summary")).toContainText("镜像学习");
  await page.getByRole("button", { name: "顺时针旋转参考" }).click();
  await expect(page.getByRole("dialog")).toContainText("会清空当前涂抹和解读");
  await page.getByRole("button", { name: "保留当前选区" }).click();
  await expect(page.getByTestId("selected-groups")).toContainText("右臂动作");
});

test("mobile camera keeps shutter reachable, switching stops old tracks and mirrored capture matches preview", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await syntheticCamera(page);
  await camera(page);
  await expect(page.getByRole("button", { name: "拍下这一张" })).toBeEnabled();
  await expect(page.locator(".v2-live-hint")).toHaveClass(/hold/, {
    timeout: 30_000,
  });
  await page.screenshot({
    path: "artifacts/v2-camera-mobile.png",
    fullPage: true,
  });
  const shutter = (await page
    .getByRole("button", { name: "拍下这一张" })
    .boundingBox())!;
  expect(shutter.y + shutter.height).toBeLessThanOrEqual(844);
  await page.getByRole("button", { name: "切换前后相机" }).click();
  await expect(page.getByRole("button", { name: "拍下这一张" })).toBeEnabled();
  await expect(page.getByText("前置镜像", { exact: false })).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as unknown as { __streams: MediaStream[] }).__streams
        .slice(0, -1)
        .every((s) => s.getTracks()[0].readyState === "ended"),
    ),
  ).toBe(true);
  const sourcePixels = await page.getByLabel("实时相机画面").evaluate((v) => {
    const video = v as HTMLVideoElement,
      c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    return {
      width: c.width,
      height: c.height,
      pixel: [...ctx.getImageData(c.width - 100, 400, 1, 1).data],
    };
  });
  await page.getByRole("button", { name: "拍下这一张" }).click();
  const captured = await page
    .getByAltText("刚刚拍下的原片")
    .evaluate(async (el) => {
      const img = el as HTMLImageElement;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      return [...ctx.getImageData(100, 400, 1, 1).data];
    });
  for (let ch = 0; ch < 3; ch++)
    expect(Math.abs(captured[ch] - sourcePixels.pixel[ch])).toBeLessThan(16);
});

test("page backgrounding stops capture; explicit resume recovers the camera", async ({
  page,
}) => {
  await syntheticCamera(page);
  await camera(page);
  await expect(page.getByRole("button", { name: "拍下这一张" })).toBeEnabled();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("heading", { name: "相机已暂停" })).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as unknown as { __streams: MediaStream[] }).__streams.every(
        (s) => s.getTracks()[0].readyState === "ended",
      ),
    ),
  ).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByRole("button", { name: "继续拍摄", exact: true }).click();
  await expect(page.getByRole("button", { name: "拍下这一张" })).toBeEnabled();
});

test("malformed and oversized uploads explain the problem without discarding the active reference", async ({
  page,
}) => {
  await reference(page);
  await paint(page);
  await page.getByLabel("导入参考照片").setInputFiles({
    name: "bad.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toContainText("照片暂时读不了");
  await expect(page.getByTestId("selected-groups")).toContainText("右臂动作");
  await page.getByLabel("导入参考照片").setInputFiles({
    name: "large.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(21 * 1024 * 1024),
  });
  await expect(page.getByRole("alert")).toContainText("超过 20 MB");
  await expect(page.getByTestId("selected-groups")).toContainText("右臂动作");
});

test("configured cloud response changes targets only after explicit image consent", async ({
  page,
}) => {
  let count = 0;
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { configured: true } }),
  );
  await page.route("**/api/interpret", async (r) => {
    count++;
    const input = r.request().postDataJSON();
    expect(input.consent).toBe(true);
    expect(input.image).toMatch(/^data:image\/jpeg;base64,/);
    expect(input.personBox.width).toBeGreaterThan(0);
    expect(input.selection.length).toBeGreaterThan(0);
    await r.fulfill({
      json: {
        draft: { ...input.draft, features: ["color"], ignoreContact: true },
        insights: [
          {
            id: "color",
            title: "色彩与冷暖",
            summary: "测试服务：参考偏暖",
            evidence: "测试返回",
            confidence: "observed",
            support: "post",
          },
        ],
        explanation: "测试服务：只保留手臂高度与冷暖。",
      },
    });
  });
  await reference(page);
  await paint(page);
  expect(count).toBe(0);
  await page.getByRole("button", { name: "深度解读", exact: true }).click();
  expect(count).toBe(0);
  await page.getByRole("button", { name: "同意发送，开始解读" }).click();
  await expect(page.getByTestId("target-summary")).toContainText(
    "只学抬手高度",
  );
  await expect(
    page.getByRole("checkbox", { name: "色彩与冷暖", exact: true }),
  ).toBeChecked();
  expect(count).toBe(1);
  await page.getByRole("button", { name: "确认目标，去拍摄" }).click();
  await expect(page.getByRole("dialog")).toContainText("测试服务：参考偏暖");
});

test("multiple people in an imported reference require selecting one before painting", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const image = new Image();
    image.src = "/images/city-sun.png";
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth * 2;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    ctx.drawImage(image, image.naturalWidth, 0);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg"),
    );
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([blob], "two-people.jpg", { type: "image/jpeg" }),
    );
    const input = document.querySelector(
      "input[type=file]",
    ) as HTMLInputElement;
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByRole("button", { name: "继续确认人物" }).click();
  await page.getByRole("button", { name: "确认这个人物框" }).click();
  await expect(page.locator(".v2-detection-status")).toContainText("2 个人", {
    timeout: 30_000,
  });
  await paint(page, 0.2, 0.155);
  await expect(page.getByTestId("selected-groups")).not.toContainText(
    "右臂动作",
  );
  await expect(page.locator(".v2-person-box.selected")).toHaveCount(1);
  await paint(page, 0.2, 0.155);
  await expect(page.getByTestId("selected-groups")).toContainText("右臂动作");
});
