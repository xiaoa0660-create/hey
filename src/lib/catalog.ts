import type { Photo, Rect } from "./types";
import type { Feature } from "../domain/session";
import { loadImage } from "./images";
import { LIGHT_RECIPES } from "../domain/lighting";
import type { LightStyle } from "../domain/lighting";
export type Template = {
  id: string;
  title: string;
  subtitle: string;
  category: "daily" | "painting";
  image: string;
  tag: string;
  light: LightStyle;
  difficulty: string;
  story: string;
  crop?: Rect;
  notes?: Partial<Record<Feature, string>>;
};
export const TEMPLATES: Template[] = [
  {
    id: "window",
    title: "把午后，留在窗边",
    subtitle: "咖啡馆 · 窗边坐姿",
    category: "daily",
    image: "cafe-editorial.png",
    tag: "柔和窗光",
    light: "window",
    difficulty: "容易上手",
    story: "把脸转向窗边，让木桌和窗外的留白一起进入画面。",
    notes: { styling: "浅色衣服、木桌与饮品，可以作为场景参考。" },
  },
  {
    id: "city",
    title: "借一点，街角的光",
    subtitle: "城市漫步 · 抬手遮阳",
    category: "daily",
    image: "city-sun.png",
    tag: "街角日光",
    light: "hard",
    difficulty: "留意站位",
    story: "用浅墙承接影子；抬手遮阳时，眼睛仍留在完整的亮区。",
  },
  {
    id: "dusk",
    title: "等海风，也等落日",
    subtitle: "海边 · 落日与轮廓",
    category: "daily",
    image: "seaside-dusk.png",
    tag: "落日逆光",
    light: "backlight",
    difficulty: "需要等光",
    story: "太阳放在肩膀斜后方，脸朝向明亮天空，保留海面的蓝。",
  },
  {
    id: "rain",
    title: "蓝调时分，借一盏灯",
    subtitle: "雨后街头 · 冷暖夜色",
    category: "daily",
    image: "rainy-blue-hour.png",
    tag: "橱窗夜光",
    light: "night",
    difficulty: "需要持稳",
    story: "橱窗照亮人物，远处灯光和雨后地面补上夜晚的层次。",
  },
  {
    id: "garden",
    title: "把树影，穿在身上",
    subtitle: "花园墙边 · 光斑与留白",
    category: "daily",
    image: "garden-shadow.png",
    tag: "树影斜光",
    light: "hard",
    difficulty: "留意站位",
    story: "让碎影留在墙面和衣服上，给眼睛和脸留一片干净的光。",
  },
  {
    id: "architecture",
    title: "走进一张安静的线条",
    subtitle: "建筑漫游 · 阴天人像",
    category: "daily",
    image: "concrete-overcast.png",
    tag: "阴天漫射",
    light: "overcast",
    difficulty: "容易上手",
    story: "让楼梯引导视线，人物小一些也没关系，建筑替你讲故事。",
  },
  {
    id: "meadow",
    title: "风来的时候，伸个懒腰",
    subtitle: "山坡散步 · 自然展臂",
    category: "daily",
    image: "meadow.png",
    tag: "傍晚侧光",
    light: "side",
    difficulty: "留意站位",
    story: "把远处山海留在身边，借低角度日光表现衬衫的褶皱。",
    notes: { styling: "白衬衫与远处草木形成对照；先选平稳、安全的落脚点。" },
  },
  {
    id: "painting",
    title: "让时间，慢下来一点",
    subtitle: "原创油画习作 · 托腮",
    category: "painting",
    image: "painting-study.png",
    tag: "油画柔光",
    light: "window",
    difficulty: "姿态参考",
    story: "借柔和侧窗光和深色背景，试一次安静的画中姿态。",
    notes: {
      expression: "微微侧脸的神情只供对照，不做表情评分。",
      styling: "用桌面承托手肘，保持手腕自然。",
    },
  },
].map((t) => ({
  ...t,
  category: t.category as Template["category"],
  light: t.light as LightStyle,
  notes: {
    ...t.notes,
    light: LIGHT_RECIPES[t.light as LightStyle].find,
    viewpoint: LIGHT_RECIPES[t.light as LightStyle].camera,
    exposure: LIGHT_RECIPES[t.light as LightStyle].exposure,
    focus: LIGHT_RECIPES[t.light as LightStyle].background,
    moment: LIGHT_RECIPES[t.light as LightStyle].moment,
  },
}));
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
