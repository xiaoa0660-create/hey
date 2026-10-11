import { center, clamp } from "../lib/geometry.ts";
import type { Rect } from "../lib/types.ts";
import type { Capture, Feedback, Target, TargetDraft } from "./session.ts";
import { GROUPS } from "./session.ts";
import { describeTarget } from "./interpretation.ts";

export type Priority = "composition" | "pose" | "mood";
export const PRIORITIES = [
  {
    id: "composition",
    title: "人物与构图",
    detail: "位置、大小和留白",
    role: "拍摄者来调整",
  },
  {
    id: "pose",
    title: "动作参考",
    detail: "跟随选中的手臂动作",
    role: "被拍者按需参考",
  },
  {
    id: "mood",
    title: "光线与色彩",
    detail: "拍前看光，拍后调色",
    role: "两个人一起决定",
  },
] as const;
export function priorities(draft: TargetDraft): Priority[] {
  return [
    ...(draft.features.includes("composition") ? ["composition" as const] : []),
    ...(draft.groups.length ? ["pose" as const] : []),
    ...(draft.features.some((f) => f !== "composition")
      ? ["mood" as const]
      : []),
  ];
}
export function displayBox(target: Target): Rect {
  return target.mirror
    ? { ...target.box, x: 1 - target.box.x - target.box.width }
    : target.box;
}
export function shootingBrief(target: Target) {
  const box = displayBox(target),
    x = center(box).x;
  const position = x < 0.42 ? "靠左" : x > 0.58 ? "靠右" : "居中";
  const composition = target.features.includes("composition");
  return {
    camera: composition
      ? `人物${position}，可见范围约占画面高度的 ${Math.round(box.height * 100)}%。先调整取景，让人物落进目标框。`
      : "构图由你现场决定，保留参考小窗，先拍一张看看。",
    subject: target.groups.length
      ? `按自己的舒适程度参考${target.groups.map((g) => GROUPS[g].label).join("、")}。先站好，等同伴调好取景，再调整动作。`
      : "动作自由，选一个自己舒服的姿势。先保持位置，让同伴调整取景。",
    mood: target.insights.filter(
      (i) => target.features.includes(i.id) && i.support !== "live",
    ),
    freePose: target.groups.length === 0,
  };
}
export const FEEDBACK = [
  { id: "smaller", label: "人物小一点", detail: "缩小人物占比，保留目标位置" },
  { id: "larger", label: "人物大一点", detail: "增加人物占比，保留目标位置" },
  {
    id: "background",
    label: "多留一点背景",
    detail: "扩大取景范围，具体景物由你选",
  },
  {
    id: "free-pose",
    label: "动作我想自己来",
    detail: "停止纠正动作，保留其他目标",
  },
] as const;

export function canAdjustFraming(target: Target, capture: Capture) {
  return !!capture.framing || target.features.includes("composition");
}
/** Feedback changes one constraint, using measured bounds when available. */
export function applyFeedback(
  target: Target,
  capture: Capture,
  feedback: Feedback,
): Target {
  if (feedback !== "free-pose" && !canAdjustFraming(target, capture))
    throw new Error("这张还没有可靠的人物范围，请先确认构图目标。");
  let box = { ...target.box };
  let note: string;
  let groups = [...target.groups];
  const features = [...target.features];
  if (feedback === "free-pose") {
    groups = [];
    note = "下一张动作自由，停止动作纠正；其他目标保留。";
  } else {
    const measured = capture.framing ?? displayBox(target);
    const factor =
      feedback === "larger" ? 1.14 : feedback === "background" ? 0.8 : 0.86;
    const anchor = center(target.box);
    // Preserve the target centre, including mirrored targets, and stay in-frame.
    const maxWidth = 2 * Math.min(anchor.x, 1 - anchor.x);
    const maxHeight = 2 * Math.min(anchor.y, 1 - anchor.y);
    const scale = Math.min(
      factor,
      maxWidth / measured.width,
      maxHeight / measured.height,
    );
    const width = clamp(
      measured.width * scale,
      Math.min(0.08, maxWidth),
      maxWidth,
    );
    const height = clamp(
      measured.height * scale,
      Math.min(0.12, maxHeight),
      maxHeight,
    );
    if (feedback === "larger" && height <= measured.height)
      throw new Error(
        "这个目标位置没有足够空间继续放大人物，先点「调整目标」重新选择构图。",
      );
    if (feedback !== "larger" && height >= measured.height)
      throw new Error("人物目标已经很小，先点「调整目标」检查人物范围。");
    box = { x: anchor.x - width / 2, y: anchor.y - height / 2, width, height };
    if (!features.includes("composition")) features.push("composition");
    const label = FEEDBACK.find((f) => f.id === feedback)!.label;
    note = `下一张：${label}。目标人物可见占高约 ${Math.round(height * 100)}%，原目标位置${groups.length ? "和动作" : ""}保留。`;
    if (!capture.framing) note += "这张未获得稳定的人物范围，先按原目标微调。";
    if (feedback === "background") note += "背景内容请在现场自行确认。";
  }
  const next: Target = {
    ...target,
    id: crypto.randomUUID(),
    revision: target.revision + 1,
    box,
    groups,
    features,
    adjustment: { feedback, note },
  };
  next.text = `${describeTarget(next)} ${note}`;
  return next;
}
