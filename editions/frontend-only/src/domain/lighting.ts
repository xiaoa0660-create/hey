import type { Target } from "./session.ts";
import type { Rect } from "../lib/types.ts";

export type LightStyle =
  | "window"
  | "hard"
  | "backlight"
  | "overcast"
  | "night"
  | "side"
  | "shade";
export type LightChoice = {
  reference: LightStyle | null;
  setup: LightStyle | null;
};
export type LightRecipe = {
  title: string;
  effect: string;
  source: string;
  position: [number, number];
  find: string;
  subject: string;
  camera: string;
  exposure: string;
  background: string;
  moment: string;
  limitation: string;
  palette: string[];
  tone: {
    warmth: number;
    brightness: number;
    contrast: number;
    strength: number;
  };
};
export const LIGHT_RECIPES: Record<LightStyle, LightRecipe> = {
  window: {
    title: "窗边柔光",
    effect: "脸部柔和，明暗有层次",
    source: "窗户",
    position: [52, 75],
    find: "找一扇没有阳光直射的大窗；先避开头顶暖灯，让光线颜色更统一。",
    subject: "侧身靠近窗边，再把脸稍微转向窗。观察两侧脸的亮度，不必贴着玻璃。",
    camera: "站在人物正前方，略靠窗的一侧；手机先与眼睛接近同高。",
    exposure:
      "先看亮侧脸颊是否还保留细节。太亮就让人物离窗远一点，暗侧太黑就多转向窗。",
    background:
      "让人物离背景远一点，避开从头顶穿出的窗框；背景简洁比强行虚化更有用。",
    moment: "先拿起杯子或看看窗外，再轻轻回头；眼睛清楚时拍下一张。",
    limitation: "阴天也能拍；小窗或直射阳光会让阴影更硬。",
    palette: ["#d5c6ac", "#7d846b", "#eadfca"],
    tone: { warmth: 12, brightness: 6, contrast: -8, strength: 0.65 },
  },
  hard: {
    title: "日光与树影",
    effect: "轮廓鲜明，留下光影图案",
    source: "侧上方日光",
    position: [50, 45],
    find: "找有树影的浅色墙或街角，先观察阴影边缘。上午或傍晚的斜光通常更容易控制。",
    subject: "站在明暗交界的亮处，轻微转脸，让眼睛留在完整的亮区，不直视太阳。",
    camera:
      "先把墙上的影子纳入留白，再让同伴慢慢转身；保持眼睛附近不被碎影切开。",
    exposure:
      "重点看额头和浅色衣服是否变成一片白；先换一小步站位，再决定要不要保留强对比。",
    background: "用一面干净的浅墙承接影子，避免人物轮廓与大片杂乱树叶重叠。",
    moment: "风会移动树影。等眼睛和脸部的亮区完整，再按快门。",
    limitation: "没有直射阳光时无法复现清晰投影；可改用开放阴影，保留构图。",
    palette: ["#ded0ae", "#66724e", "#a86044"],
    tone: { warmth: 9, brightness: -3, contrast: 16, strength: 0.6 },
  },
  backlight: {
    title: "落日轮廓光",
    effect: "发丝发亮，背景保留暮色",
    source: "身后落日",
    position: [246, 40],
    find: "日落前后找视野开阔的位置，让低处的太阳位于人物身后偏一侧。",
    subject: "背向斜后方的光，脸朝向明亮天空。眼睛自然看同伴，不直视太阳。",
    camera: "轻微横移，让太阳被肩膀或头部遮住一部分；这样更容易减少眩光。",
    exposure:
      "天空与脸往往不能同时一样亮。脸太暗时先转向明亮天空或换角度，别只靠后期提亮。",
    background: "把地平线放在肩膀下方或头部上方，避免正好穿过脖子。",
    moment: "保持眼睛和嘴角放松，等头发被风轻轻带起；拍完马上查看脸部细节。",
    limitation:
      "阴天不会出现相同的金色轮廓，可切换阴天漫射光；暖色滤镜不能补出轮廓光。",
    palette: ["#d5a875", "#667e8e", "#e6d6b5"],
    tone: { warmth: 17, brightness: 3, contrast: -5, strength: 0.6 },
  },
  overcast: {
    title: "阴天漫射光",
    effect: "色彩安静，脸部明暗均匀",
    source: "开阔天空",
    position: [56, 145],
    find: "找能看见大片天空的开阔位置；离开很深的屋檐和树冠下方。",
    subject: "朝向开阔天空，轻轻抬眼看同伴。身体可以侧一些，脸不必正对镜头。",
    camera:
      "利用楼梯、墙面或道路的线条安排留白，先保持手机竖直，避免建筑明显歪斜。",
    exposure:
      "检查眼窝是否仍有细节。太暗就往开阔处走，保留阴天的柔和，不必追求整张更亮。",
    background: "选干净的建筑或单一色块，让衣服颜色与背景拉开一点差别。",
    moment: "可以慢慢走一步再停住；停住时拍，更容易保留人物清晰度。",
    limitation: "天空是大面积光源，位置图只表达面向开阔处；不追求明显投影。",
    palette: ["#c7c9c4", "#536574", "#e5dfd2"],
    tone: { warmth: -8, brightness: 5, contrast: -6, strength: 0.55 },
  },
  night: {
    title: "夜景橱窗光",
    effect: "暖色人物，蓝色夜景",
    source: "橱窗或招牌",
    position: [48, 77],
    find: "找亮度稳定的橱窗或店门口，让光照到脸；先避开彩色灯直接照脸。",
    subject: "靠近橱窗亮处，脸稍向光源，先停住动作。雨伞边缘不要遮住眼睛。",
    camera: "双手持稳手机，把远处灯光留在人物侧后方；等同伴站稳再拍。",
    exposure:
      "允许背景比人暗一些。脸太暗就靠近现有灯光；招牌和脸都很亮时优先保留脸部细节。",
    background: "找有距离的灯光与湿地反光，避免把亮招牌直接放在人物头后。",
    moment:
      "拍完放大看看眼睛有没有拖影；模糊时重新持稳拍摄，不把调锐当作重新对焦。",
    limitation: "网页相机不保证系统夜景模式或可调快门；暗光下尽量让人物静止。",
    palette: ["#344858", "#c49663", "#78777e"],
    tone: { warmth: -5, brightness: -3, contrast: 12, strength: 0.5 },
  },
  side: {
    title: "傍晚侧光",
    effect: "暖色照亮侧脸，衣服有立体感",
    source: "侧方低处日光",
    position: [56, 70],
    find: "找能照到低角度日光的平稳开阔处，让光从人物斜前方照来。先检查脚下，不在陡坡边缘摆动作。",
    subject:
      "身体稍微侧向日光，脸朝同伴转一点。眼睛不要直视太阳，手臂自然伸展。",
    camera: "站在人物前方，横移一点观察脸部层次；把山海或草木留在人物身侧。",
    exposure:
      "看亮侧脸颊和浅色衣服的褶皱是否仍清楚。对比太强时多朝亮天空转脸，或改到开放阴影。",
    background: "把远处山线避开脖子，留下少量前景草木，让风景有前后层次。",
    moment: "等风把衣服轻轻吹起再拍，保持身体稳定；不必做幅度很大的动作。",
    limitation: "需要较低角度的自然日光。阴天时可以保留构图，改用漫射光方案。",
    palette: ["#bcc6b0", "#d4b475", "#697f88"],
    tone: { warmth: 13, brightness: 2, contrast: 6, strength: 0.6 },
  },
  shade: {
    title: "开放阴影",
    effect: "避开刺眼日光，保留自然肤色",
    source: "阴影外亮处",
    position: [70, 155],
    find: "找建筑阴影边缘，让人站在阴影里、面朝外面的亮处；不要退进完全昏暗的角落。",
    subject: "面向开阔的亮处，观察眼睛里有没有一点自然亮光，再选舒服的姿势。",
    camera: "站在亮处与人物之间，先选较暗且简单的背景，让脸部从背景里分开。",
    exposure:
      "如果背景亮到一片白，先改变机位、减少天空面积；脸部的自然层次比全图一样亮重要。",
    background: "避免绿色墙面或彩色广告紧贴人物，以免反射出明显色偏。",
    moment: "适合聊天时的小表情。请同伴稍微停住，再捕捉一瞬间。",
    limitation:
      "这是一种更容易执行的替代方案，会失去原来清晰的树影或金色轮廓。",
    palette: ["#a9b4a3", "#d6cabc", "#6d786a"],
    tone: { warmth: 3, brightness: 4, contrast: -3, strength: 0.55 },
  },
};
export function activeLighting(target: Target): LightRecipe | null {
  return target.features.includes("light") && target.lighting?.setup
    ? LIGHT_RECIPES[target.lighting.setup]
    : null;
}
export function lightingAdapted(choice: LightChoice) {
  return (
    !!choice.reference && !!choice.setup && choice.reference !== choice.setup
  );
}

export type RegionLight = {
  median: number;
  dark: number;
  bright: number;
  samples: number;
};
/** Pixel description of a confirmed person rectangle, not a skin mask or exposure score. */
export function regionLight(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  box: Rect,
): RegionLight | null {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    data.length !== width * height * 4 ||
    ![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
    box.width <= 0 ||
    box.height <= 0
  )
    return null;
  const x0 = Math.max(0, Math.floor(box.x * width)),
    y0 = Math.max(0, Math.floor(box.y * height));
  const x1 = Math.min(width, Math.ceil((box.x + box.width) * width)),
    y1 = Math.min(height, Math.ceil((box.y + box.height) * height));
  const values: number[] = [];
  let dark = 0,
    bright = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const v = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      values.push(v);
      if (v < 30) dark++;
      if (v > 245) bright++;
    }
  if (values.length < 16) return null;
  values.sort((a, b) => a - b);
  return {
    median: Math.round(values[Math.floor(values.length / 2)]),
    dark: dark / values.length,
    bright: bright / values.length,
    samples: values.length,
  };
}
