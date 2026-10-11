import type { Photo, Goal, Side, Guide, Rect } from "./types";
import { initialCrop } from "./geometry";
import { GOALS, SIDES } from "./types";

const urls = new Set<string>();
export function trackUrl(blob: Blob) {
  const url = URL.createObjectURL(blob);
  urls.add(url);
  return url;
}
export function releasePhotos() {
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls.clear();
}
export function releasePhoto(photo: Photo) {
  if (urls.delete(photo.url)) URL.revokeObjectURL(photo.url);
}
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("这张照片暂时读不了，请换一张 JPG、PNG 或 WebP 图片。"));
    img.src = url;
  });
}
export async function readPhoto(file: File, aspect?: number): Promise<Photo> {
  if (
    !file.type.startsWith("image/") &&
    !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
  )
    throw new Error("请选择照片文件，支持 JPG、PNG 和 WebP。");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("照片超过 20 MB，请选择稍小的图片。");
  const originalUrl = trackUrl(file);
  try {
    const img = await loadImage(originalUrl);
    const width = img.naturalWidth,
      height = img.naturalHeight;
    if (width < 80 || height < 80)
      throw new Error("照片太小了，请选择至少 80 × 80 像素的图片。");
    if (width * height > 32_000_000)
      throw new Error("这张照片的分辨率较大，请使用 3200 万像素以内的图片。");
    // 浏览器先按 EXIF 正确显示；画入 canvas 后得到方向固定的图像。
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("此浏览器暂不支持图片编辑。");
    ctx.drawImage(img, 0, 0);
    const blob = await canvasBlob(canvas, "image/jpeg", 0.96);
    const url = trackUrl(blob);
    return {
      id: crypto.randomUUID(),
      url,
      name: file.name,
      width,
      height,
      crop: initialCrop(width, height, aspect ?? width / height),
      sample: false,
      subject: {
        x: 0.3,
        y: 0.12,
        width: 0.4,
        height: 0.75,
        confirmed: false,
        source: "manual",
      },
    };
  } finally {
    URL.revokeObjectURL(originalUrl);
    urls.delete(originalUrl);
  }
}
export function canvasBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("图片导出失败，请重试。")),
      type,
      quality,
    ),
  );
}
export async function photoCanvas(photo: Photo, maxWidth?: number) {
  const img = await loadImage(photo.url),
    c = photo.crop;
  const originalW = img.naturalWidth * c.width,
    originalH = img.naturalHeight * c.height;
  const factor = maxWidth ? Math.min(1, maxWidth / originalW) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(originalW * factor);
  canvas.height = Math.round(originalH * factor);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("图片导出不可用。");
  ctx.drawImage(
    img,
    c.x * img.naturalWidth,
    c.y * img.naturalHeight,
    originalW,
    originalH,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}
export async function downloadCanvas(
  canvas: HTMLCanvasElement,
  name: string,
  jpeg = false,
) {
  const blob = await canvasBlob(
      canvas,
      jpeg ? "image/jpeg" : "image/png",
      0.96,
    ),
    url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
) {
  let line = "";
  for (const char of text) {
    if (ctx.measureText(line + char).width > width) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = char;
    } else line += char;
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
}
function outline(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  x: number,
  y: number,
  w: number,
  h: number,
  dashed: boolean,
) {
  ctx.strokeStyle = dashed ? "#D7EB9A" : "#FFFFFF";
  ctx.lineWidth = 3;
  ctx.setLineDash(dashed ? [10, 7] : []);
  ctx.strokeRect(x + r.x * w, y + r.y * h, r.width * w, r.height * h);
  ctx.setLineDash([]);
}
export async function exportGuide(
  ref: Photo,
  shot: Photo,
  guide: Guide,
  goal: Goal,
  side: Side,
) {
  const [reference, current] = await Promise.all([
    photoCanvas(ref, 550),
    photoCanvas(shot, 550),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  const photoW = 538,
    photoH = Math.round((photoW * current.height) / current.width);
  canvas.height = photoH + 450;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#F5F3ED";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#273F35";
  ctx.font = "600 36px sans-serif";
  ctx.fillText("照着拍", 44, 60);
  ctx.font = "19px sans-serif";
  ctx.fillStyle = "#60665E";
  ctx.fillText("把你想拍的，讲清楚。", 865, 56);
  ctx.font = "20px sans-serif";
  ctx.fillText("参考构图", 44, 108);
  ctx.fillText("这次试拍", 618, 108);
  ctx.drawImage(reference, 44, 129, photoW, photoH);
  ctx.drawImage(current, 618, 129, photoW, photoH);
  outline(ctx, shot.subject, 618, 129, photoW, photoH, false);
  outline(ctx, guide.target, 618, 129, photoW, photoH, true);
  if (guide.kind === "move" || guide.kind === "space") {
    const sx = 618 + (shot.subject.x + shot.subject.width / 2) * photoW,
      sy = 129 + (shot.subject.y + shot.subject.height / 2) * photoH;
    const ex = 618 + (guide.target.x + guide.target.width / 2) * photoW,
      ey = 129 + (guide.target.y + guide.target.height / 2) * photoH;
    const angle = Math.atan2(ey - sy, ex - sx);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.moveTo(
      ex - 15 * Math.cos(angle - 0.5),
      ey - 15 * Math.sin(angle - 0.5),
    );
    ctx.lineTo(ex, ey);
    ctx.lineTo(
      ex - 15 * Math.cos(angle + 0.5),
      ey - 15 * Math.sin(angle + 0.5),
    );
    ctx.stroke();
  }
  const top = photoH + 170;
  ctx.fillStyle = "#273F35";
  ctx.font = "18px sans-serif";
  ctx.fillText(
    `拍摄的人 · ${goal === "negative_space" ? `${SIDES[side]}空间` : GOALS[goal].label}`,
    44,
    top,
  );
  ctx.font = "600 34px sans-serif";
  const end = wrap(ctx, guide.action, 44, top + 57, 1110, 49);
  ctx.font = "21px sans-serif";
  ctx.fillStyle = "#60665E";
  wrap(ctx, guide.reason, 44, end + 18, 1110, 34);
  ctx.font = "16px sans-serif";
  ctx.fillText(
    ref.sample && shot.sample
      ? "示例体验 · 同一生成素材的不同裁切，用于构图演示"
      : "按你确认的人物框生成 · 箭头描述最终画面中的目标方向",
    44,
    canvas.height - 31,
  );
  await downloadCanvas(canvas, "照着拍-拍摄指引.png");
}
