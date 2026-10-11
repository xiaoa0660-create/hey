import type { Goal, Side, Rect, Photo, Guide, Subject } from "./types.ts";

export const TOLERANCE = {
  position: 0.035,
  scale: 0.04,
  negative_space: 0.035,
};
export const clamp = (n: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, n));
export const center = (r: Rect) => ({
  x: r.x + r.width / 2,
  y: r.y + r.height / 2,
});
export const aspectOf = (p: Photo) =>
  (p.width * p.crop.width) / (p.height * p.crop.height);
export const space = (r: Rect, s: Side) =>
  s === "left" ? r.x : s === "right" ? 1 - r.x - r.width : r.y;

export function validRect(r: Rect): boolean {
  return (
    [r.x, r.y, r.width, r.height].every(Number.isFinite) &&
    r.width > 0 &&
    r.height > 0 &&
    r.x >= 0 &&
    r.y >= 0 &&
    r.x + r.width <= 1.0000001 &&
    r.y + r.height <= 1.0000001
  );
}
export function boundRect(r: Rect): Rect {
  const width = clamp(r.width, 0.04, 1),
    height = clamp(r.height, 0.04, 1);
  return {
    width,
    height,
    x: clamp(r.x, 0, 1 - width),
    y: clamp(r.y, 0, 1 - height),
  };
}
export function initialCrop(
  width: number,
  height: number,
  aspect: number,
): Rect {
  const original = width / height;
  if (original > aspect) {
    const w = aspect / original;
    return { x: (1 - w) / 2, y: 0, width: w, height: 1 };
  }
  const h = original / aspect;
  return { x: 0, y: (1 - h) / 2, width: 1, height: h };
}
export function recrop(p: Photo, crop: Rect): Photo {
  const s = p.subject,
    c = p.crop;
  const left = c.x + s.x * c.width,
    top = c.y + s.y * c.height;
  const right = left + s.width * c.width,
    bottom = top + s.height * c.height;
  const x = Math.max(0, (left - crop.x) / crop.width),
    y = Math.max(0, (top - crop.y) / crop.height);
  const width = Math.min(1, (right - crop.x) / crop.width) - x;
  const height = Math.min(1, (bottom - crop.y) / crop.height) - y;
  const next =
    width > 0.05 && height > 0.05
      ? boundRect({ x, y, width, height })
      : { x: 0.3, y: 0.12, width: 0.4, height: 0.75 };
  return {
    ...p,
    crop,
    subject: { ...next, source: "manual", confirmed: false },
  };
}
export function resizeRect(
  r: Rect,
  corner: string,
  dx: number,
  dy: number,
): Rect {
  const left = corner.includes("w")
    ? clamp(r.x + dx, 0, r.x + r.width - 0.04)
    : r.x;
  const top = corner.includes("n")
    ? clamp(r.y + dy, 0, r.y + r.height - 0.04)
    : r.y;
  const right = corner.includes("e")
    ? clamp(r.x + r.width + dx, r.x + 0.04, 1)
    : r.x + r.width;
  const bottom = corner.includes("s")
    ? clamp(r.y + r.height + dy, r.y + 0.04, 1)
    : r.y + r.height;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
export function resizeCrop(
  r: Rect,
  corner: string,
  dx: number,
  dy: number,
): Rect {
  const ratio = r.width / r.height;
  const horizontal = corner.includes("w") ? -dx : dx;
  const vertical = (corner.includes("n") ? -dy : dy) * ratio;
  const delta =
    Math.abs(horizontal) > Math.abs(vertical) ? horizontal : vertical;
  const anchorX = corner.includes("w") ? r.x + r.width : r.x;
  const anchorY = corner.includes("n") ? r.y + r.height : r.y;
  const maxW = Math.min(
    corner.includes("w") ? anchorX : 1 - anchorX,
    (corner.includes("n") ? anchorY : 1 - anchorY) * ratio,
  );
  const width = clamp(r.width + delta, Math.min(0.1, maxW), maxW),
    height = width / ratio;
  return {
    x: corner.includes("w") ? anchorX - width : anchorX,
    y: corner.includes("n") ? anchorY - height : anchorY,
    width,
    height,
  };
}
export function distance(
  ref: Rect,
  shot: Rect,
  goal: Goal,
  side: Side,
): number {
  if (goal === "scale") return Math.abs(ref.height - shot.height);
  if (goal === "negative_space")
    return Math.abs(space(ref, side) - space(shot, side));
  const a = center(ref),
    b = center(shot);
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export function changed(
  ref: Rect,
  before: Rect,
  after: Rect,
  goal: Goal,
  side: Side,
) {
  const oldDistance = distance(ref, before, goal, side),
    newDistance = distance(ref, after, goal, side);
  const change = oldDistance - newDistance;
  return {
    oldDistance,
    newDistance,
    matched: newDistance <= TOLERANCE[goal],
    direction:
      change > 0.01
        ? ("closer" as const)
        : change < -0.01
          ? ("further" as const)
          : ("similar" as const),
  };
}
function scaled(r: Rect, factor: number): Rect {
  const c = center(r);
  const width = clamp(r.width * factor, 0.04, 1),
    height = clamp(r.height * factor, 0.04, 1);
  return boundRect({ x: c.x - width / 2, y: c.y - height / 2, width, height });
}
export function makeGuide(
  ref: Subject,
  shot: Subject,
  goal: Goal,
  side: Side,
): Guide {
  if (!ref.confirmed || !shot.confirmed || !validRect(ref) || !validRect(shot))
    throw new Error("请先确认有效的人物框");
  const d = distance(ref, shot, goal, side);
  if (d <= TOLERANCE[goal])
    return {
      action: "这个目标已经比较接近，可以按这个构图拍。",
      short: "刚刚好，先留住这一张",
      reason:
        "按你确认的人物框，这一项构图已经落在本次比较的容差范围内。照片是否喜欢，交给你决定。",
      matched: true,
      kind: "matched",
      target: shot,
    };
  if (goal === "scale") {
    const smaller = shot.height > ref.height;
    return {
      action: smaller
        ? "保持当前焦距，往后退一点，让人物在画面里小一些。"
        : "保持当前焦距，靠近一点，让人物在画面里大一些。",
      short: smaller ? "往后一点，风景多一点" : "靠近一点，把人留在眼前",
      reason: smaller
        ? "现在人物占画面的比例比参考更大。退一点，能让背景也进入画面。"
        : "现在人物在画面中比参考更小。靠近一点，让人物的比例更接近参考。",
      kind: "scale",
      direction: smaller ? "out" : "in",
      target: scaled(shot, ref.height / shot.height),
      matched: false,
    };
  }
  const a = center(ref),
    b = center(shot);
  let x = shot.x,
    y = shot.y;
  if (goal === "position") {
    // 一次只调整差异较大的轴。
    if (Math.abs(a.x - b.x) >= Math.abs(a.y - b.y)) x = a.x - shot.width / 2;
    else y = a.y - shot.height / 2;
  } else if (side === "left") x = ref.x;
  else if (side === "right") x = 1 - space(ref, side) - shot.width;
  else y = ref.y;
  if (x < 0 || y < 0 || x + shot.width > 1 || y + shot.height > 1) {
    const maxWidth =
      goal === "negative_space" && side !== "top"
        ? 1 - space(ref, side)
        : 2 * Math.min(a.x, 1 - a.x);
    const maxHeight =
      goal === "negative_space" && side === "top"
        ? 1 - ref.y
        : 2 * Math.min(a.y, 1 - a.y);
    const factor = Math.min(
      0.85,
      maxWidth / shot.width,
      maxHeight / shot.height,
    );
    return {
      action: "保持当前焦距，先往后退一点，让人物在画面里小一些。",
      short: "先留出调整的余地",
      reason:
        "当前人物占比偏大，直接移动会超出画面。先缩小一点，再调整位置和空间。",
      kind: "scale",
      direction: "out",
      target: scaled(shot, Math.max(0.1, factor)),
      matched: false,
    };
  }
  const dx = x - shot.x,
    dy = y - shot.y;
  const direction =
    Math.abs(dx) >= Math.abs(dy)
      ? dx > 0
        ? "right"
        : "left"
      : dy > 0
        ? "down"
        : "up";
  const word = { right: "右", left: "左", up: "上", down: "下" }[direction];
  const name = { left: "左侧", right: "右侧", top: "上方" }[side];
  return {
    action: `调整取景，让人物在画面里靠${word}一点。`,
    short: `让人物，靠${word}一点`,
    reason:
      goal === "position"
        ? `人物的中心位置与参考还有差异。箭头表示人物在最终画面中应靠近的方向。`
        : `现在${name}空间${space(shot, side) < space(ref, side) ? "比参考少" : "比参考多"}一些。调整取景，让这一侧的空间更接近你选的参考。`,
    kind: goal === "position" ? "move" : "space",
    direction,
    target: { ...shot, x, y },
    matched: false,
  };
}
