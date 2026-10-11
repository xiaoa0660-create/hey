import { boundRect, center, clamp } from "../lib/geometry.ts";
import { DETECTION_CONFIDENCE, GROUPS } from "./session.ts";
import type {
  Point,
  Landmark,
  Person,
  Group,
  Stroke,
  Target,
  LiveHint,
  Arm,
} from "./session.ts";

export function visible(p?: Landmark): p is Landmark {
  return (
    !!p &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.visibility >= DETECTION_CONFIDENCE &&
    p.x >= 0 &&
    p.x <= 1 &&
    p.y >= 0 &&
    p.y <= 1
  );
}
export function toPerson(landmarks: Landmark[]): Person | null {
  if (landmarks.length !== 33 || ![11, 12].every((i) => visible(landmarks[i])))
    return null;
  const points = landmarks.filter(visible);
  if (points.length < 7) return null;
  const left = Math.min(...points.map((p) => p.x)),
    top = Math.min(...points.map((p) => p.y));
  const right = Math.max(...points.map((p) => p.x)),
    bottom = Math.max(...points.map((p) => p.y));
  return {
    landmarks,
    box: boundRect({
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    }),
    confidence: points.reduce((s, p) => s + p.visibility, 0) / points.length,
  };
}
export function usableGroups(p: Person | null): Group[] {
  if (!p) return [];
  return (Object.keys(GROUPS) as Group[]).filter((g) =>
    GROUPS[g].joints.every((i) => visible(p.landmarks[i])),
  );
}
export function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    dot = dx * dx + dy * dy;
  const t = dot === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / dot);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function strokeTouches(
  point: Point,
  stroke: Stroke,
  aspect: number,
): boolean {
  const map = (p: Point) => ({ x: p.x * aspect, y: p.y });
  const p = map(point),
    r = stroke.radius * aspect;
  if (stroke.points.length === 1)
    return (
      Math.hypot(p.x - stroke.points[0].x * aspect, p.y - stroke.points[0].y) <=
      r
    );
  return stroke.points.some(
    (q, i) =>
      i > 0 && segmentDistance(p, map(stroke.points[i - 1]), map(q)) <= r,
  );
}
export function painted(
  point: Point,
  strokes: Stroke[],
  aspect: number,
): boolean {
  for (let i = strokes.length - 1; i >= 0; i--)
    if (strokeTouches(point, strokes[i], aspect))
      return strokes[i].tool === "paint";
  return false;
}
export function groupsFromStrokes(
  person: Person | null,
  strokes: Stroke[],
  aspect: number,
): Group[] {
  if (!person) return [];
  return usableGroups(person).filter((group) => {
    const joints = GROUPS[group].joints.map((i) => person.landmarks[i]);
    return (
      joints.some((p) => painted(p, strokes, aspect)) ||
      joints.some(
        (a, i) =>
          i > 0 &&
          Array.from({ length: 11 }, (_, n) => n / 10).some((t) =>
            painted(
              {
                x: a.x + (joints[i - 1].x - a.x) * t,
                y: a.y + (joints[i - 1].y - a.y) * t,
              },
              strokes,
              aspect,
            ),
          ),
      )
    );
  });
}
const pairs = [
  [1, 4],
  [2, 5],
  [3, 6],
  [7, 8],
  [9, 10],
  [11, 12],
  [13, 14],
  [15, 16],
  [17, 18],
  [19, 20],
  [21, 22],
  [23, 24],
  [25, 26],
  [27, 28],
  [29, 30],
  [31, 32],
];
export function mirroredPerson(p: Person): Person {
  const landmarks = p.landmarks.map((q) => ({ ...q, x: 1 - q.x }));
  for (const [a, b] of pairs)
    [landmarks[a], landmarks[b]] = [landmarks[b], landmarks[a]];
  return { ...p, landmarks, box: { ...p.box, x: 1 - p.box.x - p.box.width } };
}
export function targetPerson(target: Target) {
  return (
    target.person &&
    (target.mirror ? mirroredPerson(target.person) : target.person)
  );
}
export function targetGroups(target: Target): Group[] {
  return target.groups.map((g) =>
    target.mirror
      ? g === "left_arm"
        ? "right_arm"
        : g === "right_arm"
          ? "left_arm"
          : g
      : g,
  );
}
function bodyScale(p: Person) {
  const a = p.landmarks[11],
    b = p.landmarks[12];
  return Math.max(0.06, Math.hypot(a.x - b.x, a.y - b.y));
}
function screenArm(p: Person, arm: Arm) {
  const own = arm === "left_arm" ? 11 : 12,
    other = own === 11 ? 12 : 11;
  return `画面${p.landmarks[own].x < p.landmarks[other].x ? "左" : "右"}侧手臂`;
}
export function poseHint(target: Target, people: Person[]): LiveHint {
  if (!people.length)
    return {
      key: "lost",
      state: "lost",
      actor: "当前状态",
      text: "让一个人进入画面，露出肩膀和手臂。",
      detail: "暂时没有可靠的人体检测，上一条动作提示已暂停。",
    };
  if (people.length > 1)
    return {
      key: "multiple",
      state: "uncertain",
      actor: "当前状态",
      text: "画面里有多个人，先让其他人离开取景。",
      detail: "避免把不同人的动作混在一起。",
    };
  const current = people[0],
    ref = targetPerson(target);
  const arms = targetGroups(target).filter(
    (g): g is Arm => g === "left_arm" || g === "right_arm",
  );
  // Visibility has priority over all matching; never retain a stale green state.
  for (const arm of arms)
    if (
      !ref ||
      !GROUPS[arm].joints.every(
        (i) => visible(ref.landmarks[i]) && visible(current.landmarks[i]),
      )
    ) {
      return {
        key: `occluded-${arm}`,
        state: "uncertain",
        actor: "被拍的人",
        text: `让${screenArm(current, arm)}的肩、肘和手腕都露出来。`,
        detail: "关键部位被遮挡或检测把握不足，先暂停动作比较。",
        group: arm,
      };
    }
  if (target.features.includes("composition")) {
    const box = target.mirror
      ? { ...target.box, x: 1 - target.box.x - target.box.width }
      : target.box;
    const scale = current.box.height - box.height;
    if (Math.abs(scale) > 0.09)
      return {
        key: scale > 0 ? "scale-out" : "scale-in",
        state: "adjust",
        actor: "拍摄的人",
        text: scale > 0 ? "让人物在画面里小一些。" : "让人物在画面里大一些。",
        detail: "保持当前焦距，调整取景距离；不推断具体米数。",
      };
    const a = center(box),
      b = center(current.box),
      dx = a.x - b.x,
      dy = a.y - b.y;
    if (Math.hypot(dx, dy) > 0.06) {
      const horizontal = Math.abs(dx) >= Math.abs(dy),
        word = horizontal ? (dx > 0 ? "右" : "左") : dy > 0 ? "下" : "上";
      return {
        key: `position-${word}`,
        state: "adjust",
        actor: "拍摄的人",
        text: `让人物在画面里靠${word}一点。`,
        detail: "箭头表示人物在最终画面中的位置，不是镜头移动方向。",
        arrow: {
          from: b,
          to: { x: horizontal ? a.x : b.x, y: horizontal ? b.y : a.y },
        },
      };
    }
  }
  if (ref)
    for (const arm of arms) {
      const [shoulder, elbow, wrist] = GROUPS[arm].joints;
      const rs = bodyScale(ref),
        cs = bodyScale(current);
      for (const joint of [wrist, elbow]) {
        const r = ref.landmarks[joint],
          c = current.landmarks[joint],
          ra = ref.landmarks[shoulder],
          ca = current.landmarks[shoulder];
        const dy = (r.y - ra.y) / rs - (c.y - ca.y) / cs,
          dx = (r.x - ra.x) / rs - (c.x - ca.x) / cs;
        const y = Math.abs(dy) > 0.23,
          x = !target.ignoreContact && Math.abs(dx) > 0.28;
        if (y || x) {
          const useY = y && (!x || Math.abs(dy) >= Math.abs(dx)),
            word = useY
              ? dy < 0
                ? "抬高"
                : "放低"
              : dx < 0
                ? "向画面左侧移动"
                : "向画面右侧移动";
          const name = joint === wrist ? "手腕" : "手肘";
          return {
            key: `${arm}-${joint}-${word}`,
            state: "adjust",
            actor: "被拍的人",
            text: `${screenArm(current, arm)}的${name}，${word}一点。`,
            detail: "只比较相对肩膀的位置；身体站位和远近由你决定。",
            group: arm,
            arrow: {
              from: c,
              to: {
                x: clamp(c.x + (useY ? 0 : dx * cs)),
                y: clamp(c.y + (useY ? dy * cs : 0)),
              },
            },
          };
        }
      }
    }
  if (!arms.length && !target.features.includes("composition"))
    return {
      key: "reference-only",
      state: "reference",
      actor: "当前状态",
      text: "对照小窗找感觉，喜欢时就按快门。",
      detail: "本次选择的要素仅供参考，没有可实时比较的动作约束。",
    };
  return {
    key: "hold",
    state: "hold",
    actor: "当前状态",
    text: "当前目标比较接近，喜欢就拍下来。",
    detail: "只比较已选的构图与有限手臂动作，不代表审美评分。",
  };
}
export class HintStabilizer {
  private pending: LiveHint | null = null;
  private since = 0;
  private last: LiveHint | null = null;
  reset() {
    this.pending = null;
    this.last = null;
    this.since = 0;
  }
  update(next: LiveHint, now: number): LiveHint {
    if (next.state === "lost" || next.state === "uncertain") {
      this.reset();
      this.last = next;
      return next;
    }
    if (this.pending?.key !== next.key) {
      this.pending = next;
      this.since = now;
    }
    if (!this.last)
      this.last = {
        key: "checking",
        state: "reference",
        actor: "当前状态",
        text: "正在确认位置与动作…",
        detail: "保持自然，等提示稳定后再调整。",
      };
    if (now - this.since >= (next.state === "hold" ? 900 : 400))
      this.last = next;
    if (this.last.state === "hold" && next.state !== "hold") {
      this.last = {
        key: "checking",
        state: "reference",
        actor: "当前状态",
        text: "正在重新确认位置与动作…",
        detail: "保持自然，等提示稳定后再调整。",
      };
    }
    return this.last;
  }
}
