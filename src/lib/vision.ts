import type { Rect } from "./types";

export type VisionResult =
  | { status: "ok"; subjects: Array<{ box: Rect; confidence?: number }> }
  | { status: "unavailable" | "not_found"; message: string };
export interface VisionAdapter {
  analyze(image: Blob, crop: Rect, signal?: AbortSignal): Promise<VisionResult>;
}
// 接入真实服务时替换适配器；当前不会上传任何照片，也不会模拟识别成功。
export const manualVision: VisionAdapter = {
  async analyze() {
    return {
      status: "unavailable",
      message: "请框住照片里的人物，我们会按你确认的范围比较构图。",
    };
  },
};
