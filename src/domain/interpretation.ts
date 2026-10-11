import { FEATURES, GROUPS } from "./session.ts";
import type {
  TargetDraft,
  Insight,
  Group,
  Feature,
  Person,
} from "./session.ts";
import type { Rect } from "../lib/types.ts";

export type ImageStats = {
  red: number;
  green: number;
  blue: number;
  light: number;
  left: number;
  right: number;
};
export function localInsights(
  box: Rect,
  stats?: ImageStats,
  notes: Partial<Record<Feature, string>> = {},
): Insight[] {
  const warm = stats ? stats.red - stats.blue : 0;
  return (Object.keys(FEATURES) as Feature[]).map((id) => {
    const common = {
      id,
      title: FEATURES[id].label,
      support: FEATURES[id].support,
    };
    if (id === "composition")
      return {
        ...common,
        summary: "跟随参考中人物的位置与可见占比。",
        evidence: `以确认的人物范围为依据：中心在画面横向 ${Math.round((box.x + box.width / 2) * 100)}%，可见占高 ${Math.round(box.height * 100)}%。`,
        confidence: "observed" as const,
      };
    if (notes[id])
      return {
        ...common,
        summary: notes[id]!,
        evidence: "来自这张示例的人工编辑备注；请按现场条件选择。",
        confidence: "observed" as const,
      };
    if (id === "color" && stats)
      return {
        ...common,
        summary:
          warm > 12
            ? "画面整体偏暖，可以在成片后轻调冷暖。"
            : warm < -12
              ? "画面整体偏冷，可以在成片后轻调冷暖。"
              : "画面整体冷暖较中性，可在成片后细调。",
        evidence: "依据当前裁切图像的颜色统计，不识别真实光源色温。",
        confidence: "observed" as const,
      };
    if (id === "exposure" && stats)
      return {
        ...common,
        summary:
          stats.light < 85
            ? "参考整体偏暗，保留氛围，同时留意脸部是否看得清。"
            : stats.light > 175
              ? "参考整体偏明亮，拍摄时留意高光细节。"
              : "参考整体明暗适中，现场先确认人物面部可辨。",
        evidence: "这是参考图的整体明暗描述，不作为实时曝光好坏判断。",
        confidence: "observed" as const,
      };
    if (id === "light" && stats && Math.abs(stats.left - stats.right) > 20)
      return {
        ...common,
        summary: `画面${stats.left > stats.right ? "左" : "右"}侧更亮，先观察现场可用的光。`,
        evidence:
          "依据画面两侧亮度差；亮区可能是背景，无法据此确定光源方向或软硬。",
        confidence: "inferred" as const,
      };
    const unknown: Record<string, string> = {
      viewpoint: "无法从单张照片确定距离和焦距。先用参考小窗观察视角。",
      light: "光源方向与软硬暂不确定。先找让脸部清楚的自然光。",
      focus: "无法可靠判断焦距或景深参数。拍摄前在相机中确认主体清楚。",
      styling:
        "自动识别背景、服装和道具需要深度解读。先自行核对参考里的可见物。",
      moment: "无法仅凭本地关键点确定抓拍时机，先选舒适、能保持的动作。",
      expression: "表情只作视觉参考，不进行微笑或五官评分。",
    };
    return {
      ...common,
      summary: unknown[id] ?? "当前还不能可靠判断，请对照参考自行确认。",
      evidence: "本地模式没有视觉语言解读，不补造图像事实。",
      confidence: "unknown" as const,
    };
  });
}
export function describeTarget(d: TargetDraft): string {
  const actions = d.groups.length
    ? `跟随${d.groups.map((g) => GROUPS[g].label).join("、")}。`
    : "不跟随姿势。";
  const advice = d.features
    .filter((f) => !["composition", "color", "styling"].includes(f))
    .map((f) => FEATURES[f].label);
  return `${actions}${d.features.includes("composition") ? "保持参考的人物位置和占比。" : "人物位置和大小自由。"}${d.ignoreContact ? "不要手贴脸，只学抬手高度。" : ""}${d.features.includes("color") ? "保留参考色调。" : ""}${d.features.includes("styling") ? "参考背景与造型。" : "背景自由。"}${advice.length ? `拍前参考：${advice.join("、")}。` : ""}${d.mirror ? "镜像学习。" : ""}`;
}
export function parseLocalEdit(
  text: string,
  base: TargetDraft,
  available: Group[],
): { ok: true; draft: TargetDraft } | { ok: false; message: string } {
  const value = text.trim();
  if (!value)
    return { ok: false, message: "先写下想调整的目标，或恢复自动解读。" };
  if (value === describeTarget(base)) return { ok: true, draft: { ...base } };
  const next: TargetDraft = {
    ...base,
    groups: [...base.groups],
    features: [...base.features],
  };
  const add = (f: Feature) => {
    if (!next.features.includes(f)) next.features.push(f);
  };
  const remove = (f: Feature) => {
    next.features = next.features.filter((x) => x !== f);
  };
  const clauses = value
    .split(/[。；;，,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown: string[] = [];
  for (const c of clauses) {
    if (c === "镜像学习") {
      next.mirror = true;
      continue;
    }
    if (c === "取消镜像") {
      next.mirror = false;
      continue;
    }
    if (c.startsWith("拍前参考：")) {
      const names = c.slice(5).split("、"),
        keys = names.map((name) =>
          (Object.keys(FEATURES) as Feature[]).find(
            (f) => FEATURES[f].label === name,
          ),
        );
      if (keys.every(Boolean)) {
        keys.forEach((k) => add(k!));
        continue;
      }
    }
    if (c.startsWith("跟随")) {
      const names = c.slice(2).split("、"),
        keys = names.map((name) =>
          (Object.keys(GROUPS) as Group[]).find(
            (g) => GROUPS[g].label === name,
          ),
        );
      if (keys.every(Boolean)) {
        next.groups = keys as Group[];
        continue;
      }
    }
    if (/^(?:不要|不学|不跟随|取消)(?:左臂|左手)(?:动作)?$/.test(c)) {
      next.groups = next.groups.filter((x) => x !== "left_arm");
      continue;
    }
    if (/^(?:不要|不学|不跟随|取消)(?:右臂|右手)(?:动作)?$/.test(c)) {
      next.groups = next.groups.filter((x) => x !== "right_arm");
      continue;
    }
    if (/^(?:不要|不跟随|取消)(?:姿势|动作)$/.test(c)) {
      next.groups = [];
      continue;
    }
    if (/^(?:只学|跟随|学)(?:左臂|左手)(?:动作)?$/.test(c)) {
      next.groups = ["left_arm"];
      continue;
    }
    if (/^(?:只学|跟随|学)(?:右臂|右手)(?:动作)?$/.test(c)) {
      next.groups = ["right_arm"];
      continue;
    }
    if (c === "只学抬手高度") {
      next.groups = next.groups.filter((g) => g.endsWith("_arm"));
      next.ignoreContact = true;
      continue;
    }
    if (/^(?:只学|跟随|学)(?:抬手|手臂|双臂|双手)(?:动作|高度)?$/.test(c)) {
      next.groups = base.groups.filter((g) => g.endsWith("_arm"));
      if (!next.groups.length)
        next.groups = available.filter((g) => g.endsWith("_arm"));
      next.features = [];
      continue;
    }
    if (/^(?:跟随|学)(?:左臂动作、右臂动作|右臂动作、左臂动作)$/.test(c)) {
      next.groups = ["left_arm", "right_arm"];
      continue;
    }
    if (/^(?:不要|不要求|取消)手贴脸$/.test(c)) {
      next.ignoreContact = true;
      continue;
    }
    if (
      /^(?:人物)?(?:位置和大小|构图|站位)(?:自由|不跟随)$/.test(c) ||
      /^(?:不要|取消|不跟随)构图$/.test(c)
    ) {
      remove("composition");
      continue;
    }
    if (/^(?:保持|跟随)(?:参考的?)?(?:人物位置和占比|构图)$/.test(c)) {
      add("composition");
      continue;
    }
    if (/^(?:保留|跟随)(?:参考的?)?(?:暖色|冷暖|色调|色彩)$/.test(c)) {
      add("color");
      continue;
    }
    if (/^(?:不要|取消|不跟随)(?:色调|色彩)$/.test(c)) {
      remove("color");
      continue;
    }
    if (/^(?:背景自由|不要背景|不跟随背景)$/.test(c)) {
      remove("styling");
      continue;
    }
    if (/^参考背景与造型$/.test(c)) {
      add("styling");
      continue;
    }
    if (/^跟随(?:头部与表情|肩部与躯干)$/.test(c)) {
      next.groups = [c.includes("头部") ? "head" : "torso"];
      continue;
    }
    unknown.push(c);
  }
  if (unknown.length)
    return {
      ok: false,
      message: `本地模式还不能确定「${unknown[0]}」的意思。输入已保留；可改用下方目标开关，或在配置模型后请求深度解读。`,
    };
  const missing = next.groups.find((g) => !available.includes(g));
  if (missing)
    return {
      ok: false,
      message: `参考里${GROUPS[missing].label}的关键部位不清楚，无法创建这个动作目标。请换范围或只跟随构图。`,
    };
  return { ok: true, draft: next };
}
export function preparation(d: TargetDraft, insights: Insight[]): string[] {
  const notes = insights
    .filter((i) => d.features.includes(i.id) && i.support !== "live")
    .map((i) => i.summary);
  if (d.groups.some((g) => g.endsWith("_arm")))
    notes.unshift("给手臂留出活动空间，让肩膀、手肘和手腕都能入镜。");
  if (d.features.includes("composition"))
    notes.unshift("先让人物完整进入选定画幅，再按提示调整位置和大小。");
  return notes.length ? notes : ["把参考留在小窗里，先拍一张你喜欢的。"];
}
export function canConfirm(
  d: TargetDraft,
  person: Person | null,
  manualBox: boolean,
): boolean {
  if (d.features.includes("composition") && (person || manualBox)) return true;
  return !!person && d.groups.length > 0;
}
