import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { toPerson } from "../domain/pose";
import type { Landmark } from "../domain/session";

let detector: PoseLandmarker | null = null;
let mode: "IMAGE" | "VIDEO" = "IMAGE";
const scope = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (message: unknown) => void;
  location: Location;
};
scope.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === "init") {
      const base = new URL("../", scope.location.href);
      const files = await FilesetResolver.forVisionTasks(
        new URL("vision/wasm", base).href,
      );
      detector = await PoseLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: new URL("models/pose_landmarker_full.task", base)
            .href,
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        numPoses: 3,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
        outputSegmentationMasks: false,
      });
      scope.postMessage({ id, ok: true });
      return;
    }
    if (type === "close") {
      detector?.close();
      detector = null;
      return;
    }
    if (!detector) throw new Error("人体模型尚未就绪");
    const nextMode = type === "video" ? "VIDEO" : "IMAGE";
    if (mode !== nextMode) {
      await detector.setOptions({ runningMode: nextMode });
      mode = nextMode;
    }
    const started = performance.now();
    const result =
      nextMode === "VIDEO"
        ? detector.detectForVideo(data.bitmap, data.timestamp)
        : detector.detect(data.bitmap);
    const people = result.landmarks
      .map((raw) =>
        toPerson(
          raw.map(
            (p) =>
              ({
                x: p.x,
                y: p.y,
                z: p.z,
                visibility: p.visibility ?? 0,
              }) as Landmark,
          ),
        ),
      )
      .filter(Boolean);
    scope.postMessage({
      id,
      ok: true,
      result: {
        people,
        durationMs: performance.now() - started,
        timestamp: data.timestamp ?? 0,
      },
    });
  } catch (error) {
    scope.postMessage({
      id,
      ok: false,
      message: error instanceof Error ? error.message : "人体检测失败",
    });
  } finally {
    data.bitmap?.close();
  }
};
