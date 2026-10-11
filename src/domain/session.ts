import type { Photo, Rect } from "../lib/types.ts";

export type Point = { x: number; y: number };
export type Landmark = Point & { z?: number; visibility: number };
export type Person = { landmarks: Landmark[]; box: Rect; confidence: number };
export type Group = "left_arm" | "right_arm" | "head" | "torso";
export type Arm = "left_arm" | "right_arm";
export type Feature =
  | "composition"
  | "viewpoint"
  | "light"
  | "exposure"
  | "focus"
  | "color"
  | "styling"
  | "moment"
  | "expression";
export type Mode = "partial" | "whole";
export type Stroke = {
  id: string;
  tool: "paint" | "erase";
  radius: number;
  points: Point[];
};
export type Insight = {
  id: Feature;
  title: string;
  summary: string;
  evidence: string;
  confidence: "observed" | "inferred" | "unknown";
  support: "live" | "preparation" | "post" | "reference";
};
export type TargetDraft = {
  mode: Mode;
  groups: Group[];
  features: Feature[];
  ignoreContact: boolean;
  mirror: boolean;
};
export type Target = TargetDraft & {
  id: string;
  photoId: string;
  revision: number;
  aspect: number;
  person: Person | null;
  box: Rect;
  text: string;
  preparation: string[];
  insights: Insight[];
};
export type Detection = {
  people: Person[];
  durationMs: number;
  timestamp: number;
};
export type LiveHint = {
  key: string;
  state: "adjust" | "hold" | "lost" | "uncertain" | "reference";
  actor: "拍摄的人" | "被拍的人" | "当前状态";
  text: string;
  detail: string;
  group?: Group;
  arrow?: { from: Point; to: Point };
};
export type Capture = {
  id: string;
  photo: Photo;
  targetId: string;
  mirrored: boolean;
  width: number;
  height: number;
  takenAt: number;
};

export const GROUPS: Record<
  Group,
  { label: string; short: string; joints: number[]; live: boolean }
> = {
  left_arm: {
    label: "左臂动作",
    short: "左臂",
    joints: [11, 13, 15],
    live: true,
  },
  right_arm: {
    label: "右臂动作",
    short: "右臂",
    joints: [12, 14, 16],
    live: true,
  },
  head: { label: "头部与表情", short: "头部", joints: [0, 7, 8], live: false },
  torso: {
    label: "肩部与躯干",
    short: "肩身",
    joints: [11, 12, 23, 24],
    live: false,
  },
};
export const FEATURES: Record<
  Feature,
  { label: string; support: Insight["support"] }
> = {
  composition: { label: "画面构图", support: "live" },
  viewpoint: { label: "机位与透视", support: "preparation" },
  light: { label: "光影", support: "preparation" },
  exposure: { label: "明暗效果", support: "preparation" },
  focus: { label: "焦点与景深", support: "preparation" },
  color: { label: "色彩与冷暖", support: "post" },
  styling: { label: "背景与造型", support: "preparation" },
  moment: { label: "动作瞬间", support: "preparation" },
  expression: { label: "表情", support: "reference" },
};
export const SUPPORT = {
  live: "实时指导",
  preparation: "拍前建议",
  post: "拍后处理",
  reference: "仅供参考",
};
export const CONFIDENCE = {
  observed: "可见依据",
  inferred: "有限推测",
  unknown: "不确定",
};
export const ARM_CONNECTIONS = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
] as const;
export const BODY_CONNECTIONS = [
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  ...ARM_CONNECTIONS,
] as const;
export const DETECTION_CONFIDENCE = 0.55;
