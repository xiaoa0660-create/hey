export type Goal = "position" | "scale" | "negative_space";
export type Side = "left" | "right" | "top";
export type Rect = { x: number; y: number; width: number; height: number };
export type Subject = Rect & {
  source: "manual" | "sample" | "vision";
  confirmed: boolean;
};
export type Photo = {
  id: string;
  url: string;
  name: string;
  width: number;
  height: number;
  crop: Rect;
  subject: Subject;
  sample: boolean;
};
export type Guide = {
  action: string;
  reason: string;
  short: string;
  matched: boolean;
  kind: "move" | "scale" | "space" | "matched";
  target: Rect;
  direction?: "left" | "right" | "up" | "down" | "in" | "out";
};
export const GOALS: Record<Goal, { label: string; description: string }> = {
  position: {
    label: "人物的位置",
    description: "让人站在画面里，刚刚好的地方",
  },
  scale: { label: "人和背景的比例", description: "人近一点，还是风景多一点" },
  negative_space: {
    label: "这里的留白",
    description: "给窗边、天空或街景留一点空间",
  },
};
export const SIDES: Record<Side, string> = {
  left: "左侧",
  right: "右侧",
  top: "上方",
};
