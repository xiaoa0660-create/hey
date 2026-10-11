import { chromium } from "@playwright/test";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const errors = [];
const requests = [];
for (const [edition, entry] of [
  ["a", "/"],
  ["b", "/notebook.html"],
]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) requests.push([r.status(), r.url()]);
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const img = new Image();
        img.src = "/images/cafe-editorial.png";
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const draw = () => canvas.getContext("2d").drawImage(img, 0, 0);
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
  const base = process.env.PREVIEW_BASE_URL || "http://127.0.0.1:5173";
  async function snap(name, locator) {
    const path = `public/guide/${edition}-${name}.png`;
    if (locator) await locator.screenshot({ path });
    else
      await page.screenshot({
        path,
        fullPage: !["home", "camera", "guide"].includes(name),
      });
    await copyFile(path, `docs/ui-preview/easy-v0.6/${edition}-${name}.png`);
    console.log("screenshot", edition, name);
  }
  await page.goto(base + entry);
  await page.locator(".zp-hero-strip svg").first().waitFor();
  await page.waitForTimeout(500);
  await snap("home");
  await page.getByRole("button", { name: /第一次来/ }).click();
  await snap("guide");
  await page.getByRole("button", { name: "关闭窗口" }).click();
  await page.getByRole("button", { name: /拍一下眼前的风景/ }).click();
  await snap("scene");
  await page.getByRole("button", { name: /先看湖边示例/ }).click();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("button", { name: "打开这个示例的拍法" }).click();
  await snap("scene-plan");
  await page.getByText("光线怎么用", { exact: true }).click();
  await snap("light", page.locator(".zp-details").first());
  await page.locator(".zp-brand").click();
  await page.getByRole("button", { name: "直接离开", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "找参考" })
    .click();
  await snap("discover");
  await page.getByRole("button", { name: "同款打卡", exact: true }).click();
  await page
    .getByRole("button", { name: "查看赫本同款：草地上的侧坐", exact: true })
    .click();
  await snap("checkin");
  await page.getByRole("button", { name: "返回参考", exact: true }).click();
  await page.getByRole("button", { name: "画作复刻", exact: true }).click();
  await page
    .getByRole("button", {
      name: "查看把自己拍进《戴珍珠耳环的少女》",
      exact: true,
    })
    .click();
  await snap("art");
  await page.getByRole("button", { name: "返回参考", exact: true }).click();
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page
    .getByRole("button", { name: "查看把咖啡的时间拍慢一点", exact: true })
    .click();
  await snap("detail");
  await page.getByRole("button", { name: "收藏这张参考", exact: true }).click();
  await page.getByRole("button", { name: "照着这张拍", exact: true }).click();
  const begin = page.getByRole("button", { name: "开始拍摄", exact: true });
  await begin.waitFor();
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent.includes("开始拍摄"),
      ).disabled,
  );
  await snap("plan");
  await page.getByText("还想改哪里（可选）", { exact: true }).click();
  await page.getByRole("button", { name: /打开照片裁切/ }).click();
  await page
    .locator(".zp-advanced .v2-detection-status")
    .filter({ hasText: /已识别|人物|可用/ })
    .waitFor();
  await page.waitForTimeout(1200);
  await snap("advanced", page.locator(".zp-advanced"));
  await page.getByRole("button", { name: /收起照片裁切/ }).click();
  await page.getByText("还想改哪里（可选）", { exact: true }).click();
  await begin.click();
  await snap("handoff", page.getByRole("dialog"));
  await page.getByRole("button", { name: "我拿手机，打开相机" }).click();
  const shutter = page.getByRole("button", { name: "拍下这一张", exact: true });
  await shutter.waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".v2-shutter").disabled,
  );
  await page.waitForTimeout(1600);
  await snap("camera");
  await shutter.click();
  await page.getByAltText("刚刚拍下的原片").waitFor();
  await snap("result");
  await page
    .getByRole("button", { name: "动作自然一点", exact: false })
    .click();
  await snap("review", page.locator(".nb-review"));
  await page.getByRole("button", { name: "微调一下颜色" }).click();
  await page.getByRole("slider", { name: "冷暖", exact: true }).fill("12");
  await page.waitForTimeout(400);
  await snap("tone", page.locator(".v2-toning"));
  await page.getByRole("button", { name: "保存这次拍摄", exact: true }).click();
  await page.locator(".zp-toast").filter({ hasText: "已保存到" }).waitFor();
  await page.locator(".zp-brand").click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "收藏", exact: true })
    .click();
  await snap("favorites");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "我的拍摄", exact: true })
    .click();
  await snap("mine");
  await page.getByRole("button", { name: /删除把咖啡/ }).click();
  await snap("delete", page.getByRole("dialog"));
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.close();
}
const desktop = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
});
await desktop.goto("http://127.0.0.1:5173/compare.html");
await desktop.screenshot({
  path: "docs/ui-preview/easy-v0.6/comparison.png",
  fullPage: true,
});
await desktop.close();
await browser.close();
await writeFile(
  "artifacts/capture-audit.json",
  JSON.stringify(
    {
      errors,
      requests,
      camera:
        "Canvas MediaStream fixture, actual local model and shutter pipeline; not a physical-device photograph",
    },
    null,
    2,
  ),
);
if (errors.length || requests.length)
  throw new Error(
    "Capture had page errors or failed requests: " +
      JSON.stringify({ errors, requests }),
  );
