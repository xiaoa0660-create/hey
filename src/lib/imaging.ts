import type { Photo } from "./types";
import { aspectOf } from "./geometry";
import { canvasBlob, loadImage, photoCanvas, trackUrl } from "./images";
import type { ImageStats } from "../domain/interpretation";

export async function rotatePhoto(photo: Photo): Promise<Photo> {
  const img = await loadImage(photo.url),
    canvas = document.createElement("canvas");
  canvas.width = photo.height;
  canvas.height = photo.width;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0);
  const c = photo.crop,
    s = photo.subject;
  return {
    ...photo,
    id: crypto.randomUUID(),
    url: trackUrl(await canvasBlob(canvas, "image/jpeg", 0.97)),
    width: photo.height,
    height: photo.width,
    crop: { x: 1 - c.y - c.height, y: c.x, width: c.height, height: c.width },
    subject: {
      ...s,
      x: 1 - s.y - s.height,
      y: s.x,
      width: s.height,
      height: s.width,
      confirmed: false,
      source: "manual",
    },
  };
}
export async function imageStats(photo: Photo): Promise<ImageStats> {
  const c = await photoCanvas(photo, 128),
    ctx = c.getContext("2d")!,
    { data } = ctx.getImageData(0, 0, c.width, c.height);
  let red = 0,
    green = 0,
    blue = 0,
    light = 0,
    left = 0,
    right = 0,
    lc = 0,
    rc = 0,
    n = 0;
  for (let i = 0; i < data.length; i += 4) {
    red += data[i];
    green += data[i + 1];
    blue += data[i + 2];
    const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    light += y;
    n++;
    if ((i / 4) % c.width < c.width / 2) {
      left += y;
      lc++;
    } else {
      right += y;
      rc++;
    }
  }
  return {
    red: red / n,
    green: green / n,
    blue: blue / n,
    light: light / n,
    left: left / lc,
    right: right / rc,
  };
}
export async function referenceData(photo: Photo): Promise<string> {
  return (
    await photoCanvas(photo, Math.round(1024 * Math.min(1, aspectOf(photo))))
  ).toDataURL("image/jpeg", 0.82);
}
export function drawCameraFrame(
  video: HTMLVideoElement,
  aspect: number,
  mirror: boolean,
  maxSide?: number,
): HTMLCanvasElement {
  const w = video.videoWidth,
    h = video.videoHeight;
  if (!w || !h) throw new Error("相机画面还没准备好，请稍等。");
  const cropW = w / h > aspect ? h * aspect : w,
    cropH = w / h > aspect ? h : w / aspect;
  const scale = maxSide ? Math.min(1, maxSide / Math.max(cropW, cropH)) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cropW * scale);
  canvas.height = Math.round(cropH * scale);
  const ctx = canvas.getContext("2d")!;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    video,
    (w - cropW) / 2,
    (h - cropH) / 2,
    cropW,
    cropH,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}
export async function capturedPhoto(canvas: HTMLCanvasElement): Promise<Photo> {
  return {
    id: crypto.randomUUID(),
    url: trackUrl(await canvasBlob(canvas, "image/jpeg", 0.98)),
    name: "我的拍摄",
    width: canvas.width,
    height: canvas.height,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    subject: {
      x: 0.3,
      y: 0.1,
      width: 0.4,
      height: 0.8,
      confirmed: false,
      source: "manual",
    },
    sample: false,
  };
}
export async function tonedCanvas(
  photo: Photo,
  adjust: {
    warmth: number;
    brightness: number;
    contrast: number;
    strength: number;
  },
): Promise<HTMLCanvasElement> {
  const canvas = await photoCanvas(photo),
    ctx = canvas.getContext("2d")!,
    pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
    s = adjust.strength;
  for (let i = 0; i < pixels.data.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const original = pixels.data[i + ch];
      const warm =
        ch === 0 ? adjust.warmth * 0.6 : ch === 2 ? -adjust.warmth * 0.6 : 0;
      const result =
        (original - 128) * (1 + adjust.contrast / 100) +
        128 +
        adjust.brightness * 0.6 +
        warm;
      pixels.data[i + ch] = original + (result - original) * s;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
