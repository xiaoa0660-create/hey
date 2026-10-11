import type { Photo, Rect } from "./types";
import type { Feature } from "../domain/session";
import { loadImage } from "./images";
export type Template = {
  id: string;
  title: string;
  subtitle: string;
  category: "daily" | "painting";
  image: string;
  tag: string;
  crop?: Rect;
  notes?: Partial<Record<Feature, string>>;
};
export const TEMPLATES: Template[] = [
  {
    id: "window",
    title: "把午后，留在窗边",
    subtitle: "咖啡馆 · 坐姿与留白",
    category: "daily",
    image: "cafe-editorial.png",
    tag: "窗边坐姿",
    notes: {
      light: "在窗边寻找柔和的自然光；先观察脸部，再决定朝向。",
      styling: "浅色衣服、木桌和一杯饮品，已经足够。",
    },
  },
  {
    id: "city",
    title: "借一点，街角的光",
    subtitle: "城市漫步 · 抬手遮阳",
    category: "daily",
    image: "city-sun.png",
    tag: "抬手动作",
    notes: {
      styling: "浅蓝衬衫与浅色墙面构成清爽的搭配。",
      light: "找一块明亮但不刺眼的地方，不直视太阳。",
    },
  },
  {
    id: "meadow",
    title: "风来的时候，伸个懒腰",
    subtitle: "草地散步 · 自然展臂",
    category: "daily",
    image: "meadow.png",
    tag: "舒展手臂",
    notes: { styling: "草地、白衬衫和舒展的手臂，保留轻松的感觉。" },
  },
  {
    id: "painting",
    title: "让时间，慢下来一点",
    subtitle: "原创油画习作 · 托腮",
    category: "painting",
    image: "painting-study.png",
    tag: "画中姿态",
    notes: {
      expression: "微微侧脸的神情只供对照，不做表情评分。",
      styling: "用桌面承托手肘，注意保持手腕自然。",
    },
  },
  ...[
    [
      "city-air",
      "city-sun.png",
      "抬手，也可以很松弛",
      "只学动作 · 自由站位",
      "daily",
    ],
    [
      "window-space",
      "cafe-editorial.png",
      "给窗外留一个位置",
      "构图练习 · 左侧留白",
      "daily",
    ],
    [
      "meadow-space",
      "meadow.png",
      "人与风景，各占一点",
      "构图练习 · 环境人像",
      "daily",
    ],
    [
      "window-hands",
      "cafe-editorial.png",
      "不知道手放哪，就借张桌子",
      "动作练习 · 坐姿",
      "daily",
    ],
    [
      "city-color",
      "city-sun.png",
      "蓝色与日光的小默契",
      "色彩练习 · 拍后冷暖",
      "daily",
    ],
    [
      "meadow-air",
      "meadow.png",
      "在户外，站得自在一点",
      "机位练习 · 拍前观察",
      "daily",
    ],
    [
      "painting-hand",
      "painting-study.png",
      "从一只手开始，走进画里",
      "姿态练习 · 托腮细节",
      "painting",
    ],
    [
      "painting-color",
      "painting-study.png",
      "一张有油画气息的日常",
      "色彩练习 · 克制暖调",
      "painting",
    ],
  ].map(([id, image, title, subtitle, category]) => ({
    id,
    image,
    title,
    subtitle,
    category: category as "daily" | "painting",
    tag: "同图练习",
  })),
];
export async function templatePhoto(t: Template): Promise<Photo> {
  const url = `${import.meta.env.BASE_URL}images/${t.image}`,
    image = await loadImage(url);
  return {
    id: crypto.randomUUID(),
    url,
    name: t.title,
    width: image.naturalWidth,
    height: image.naturalHeight,
    crop: t.crop ?? { x: 0, y: 0, width: 1, height: 1 },
    sample: true,
    subject: {
      x: 0.3,
      y: 0.1,
      width: 0.4,
      height: 0.8,
      source: "manual",
      confirmed: false,
    },
  };
}
