import type { Detection } from "../domain/session";

export class PoseClient {
  private worker: Worker;
  private sequence = 0;
  private pending = new Map<
    number,
    {
      resolve: (data: any) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private ready: Promise<unknown>;
  private closed = false;
  constructor() {
    this.worker = new Worker(
      `${import.meta.env.BASE_URL}vision/pose-worker.js`,
    );
    this.worker.onmessage = ({ data }) => {
      const request = this.pending.get(data.id);
      if (!request) return;
      clearTimeout(request.timer);
      this.pending.delete(data.id);
      if (data.ok) request.resolve(data.result);
      else request.reject(new Error(data.message));
    };
    this.worker.onerror = () =>
      this.dispose(
        "当前浏览器没有成功启动人体检测，请重试或使用构图参考模式。",
      );
    this.ready = this.request("init", {}, [], 45_000);
    void this.ready.catch(() => {});
  }
  private request(
    type: string,
    data: Record<string, unknown>,
    transfer: Transferable[] = [],
    timeout = 12_000,
  ): Promise<Detection> {
    if (this.closed) return Promise.reject(new Error("人体检测已结束"));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("人体模型加载或处理超时，请重试。"));
        this.dispose("人体检测超时");
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, type, ...data }, transfer);
    });
  }
  async detect(
    source: CanvasImageSource,
    video = false,
    timestamp = performance.now(),
  ): Promise<Detection> {
    await this.ready;
    if (this.closed) throw new Error("人体检测已结束");
    const bitmap = await createImageBitmap(source as ImageBitmapSource);
    if (this.closed) {
      bitmap.close();
      throw new Error("人体检测已结束");
    }
    return this.request(video ? "video" : "image", { bitmap, timestamp }, [
      bitmap,
    ]);
  }
  dispose(message = "人体检测已结束") {
    if (this.closed) return;
    this.closed = true;
    this.worker.terminate();
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error(message));
    }
    this.pending.clear();
  }
}
