import type { Photo, Rect } from "./types";

export const SAMPLE_URL = "/images/cafe-editorial.png";
// 生成素材中的实际可见人物边界，坐标已按图片校准。
const originalSubject: Rect = {
  x: 0.507,
  y: 0.143,
  width: 0.36,
  height: 0.857,
};
export function samplePhoto(kind: "reference" | "first" | "retake"): Photo {
  const crop = {
    x: kind === "reference" ? 0.337 : kind === "first" ? 7 / 15 : 0.36,
    y: 0,
    width: 8 / 15,
    height: 1,
  };
  const x = (originalSubject.x - crop.x) / crop.width;
  return {
    id: `sample-${kind}`,
    url: SAMPLE_URL,
    name: "咖啡馆示例",
    width: 1536,
    height: 1024,
    crop,
    sample: true,
    subject: {
      x,
      y: originalSubject.y,
      width: originalSubject.width / crop.width,
      height: originalSubject.height,
      source: "sample",
      confirmed: true,
    },
  };
}
