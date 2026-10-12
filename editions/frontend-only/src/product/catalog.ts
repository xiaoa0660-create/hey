import { TEMPLATES, type Template } from "../lib/catalog";
import { loadImage } from "../lib/images";
import type { Photo, Rect } from "../lib/types";
import type { LightStyle } from "../domain/lighting";
import { unpack } from "../notebook/storage";
import { PERSONAL_CATEGORY_LABELS, type PersonalReference } from "./personal";

export type Reference = Template & {
  kind: "daily" | "checkin" | "painting";
  scene: string;
  source: {
    label: string;
    url?: string;
    type: "generated" | "photo" | "artwork" | "user";
  };
  subjectTip: string;
  cameraTip: string;
  needs: string;
  location?: { name: string; url: string };
  personal?: PersonalReference;
  lightKnown?: boolean;
};
const generated = { label: "原创 AI 场景示例", type: "generated" as const };
const sheetCrop = (n: number): Rect => ({
  x: (n % 4) / 4,
  y: Math.floor(n / 4) / 2,
  width: 0.25,
  height: 0.5,
});
const newPhotos: [
  string,
  string,
  string,
  LightStyle,
  string,
  string,
  string,
][] = [
  [
    "terrace",
    "把咖啡的时间拍慢一点",
    "咖啡馆",
    "overcast",
    "坐稳后端起杯子，先看街边，再看同伴。",
    "保留桌面和半身，窗框不要从头顶穿过。",
    "有露天桌椅；饮品可换成一本书。",
  ],
  [
    "museum",
    "人小一点，建筑也会说话",
    "建筑",
    "overcast",
    "沿平坦通道走两步，停住后侧身看远处。",
    "把竖直墙线拍直，留完整脚边，别急着拍满人物。",
    "浅色建筑或走廊；遵守场馆拍摄规定。",
  ],
  [
    "bookshop",
    "翻到喜欢的那一页",
    "书店",
    "window",
    "轻轻翻书，不必看镜头；肩膀放松。",
    "从书架斜侧取景，让人物脸朝向较亮的窗边。",
    "一本书和整齐的书架；先征得店家同意。",
  ],
  [
    "lake",
    "今天，风景也在照片里",
    "出游",
    "overcast",
    "站在平坦观景处，背向湖面侧身，帽子可以不戴。",
    "给远山和湖面多留空间，让人物在画面右侧小一点。",
    "开阔湖岸或安全观景平台；无需靠近水边。",
  ],
  [
    "umbrella",
    "雨停之前，再留一张",
    "夜景",
    "night",
    "撑伞站稳，稍微抬头看向亮处，别让伞遮住脸。",
    "靠橱窗的亮侧取景，等对方停住再拍。",
    "雨伞与有照明的安全步道；避开车道。",
  ],
  [
    "picnic",
    "把周末装进绿色里",
    "公园",
    "shade",
    "坐在野餐垫上，轻轻收拢手，看看身边的花。",
    "别让树影切开眼睛，先找脸部光线完整的位置。",
    "野餐垫可换成公园长椅；不必准备整套道具。",
  ],
  [
    "stairs",
    "回头的那一秒",
    "街拍",
    "side",
    "在宽阔平稳处停住，身体朝前，再慢慢回头。",
    "留出身旁的线条和景色，先取景再叫对方回头。",
    "安全的石墙旁或台阶平台；不边走边回头。",
  ],
];
const additions: Reference[] = newPhotos.map((p, n) => ({
  id: p[0],
  title: p[1],
  subtitle: p[2] + " · 原创拍法",
  category: "daily",
  kind: "daily",
  scene: p[2],
  image: "curated/city-life-sheet.png",
  crop: sheetCrop(n),
  tag: p[3] === "night" ? "雨夜氛围" : "轻松可复刻",
  light: p[3],
  difficulty: "容易上手",
  story: p[4],
  subjectTip: p[4],
  cameraTip: p[5],
  needs: p[6],
  source: generated,
}));
const originals: Reference[] = TEMPLATES.filter(
  (t) => t.category === "daily",
).map((t) => ({
  ...t,
  kind: "daily",
  scene: (
    {
      window: "咖啡馆",
      city: "街拍",
      dusk: "出游",
      rain: "夜景",
      garden: "公园",
      architecture: "建筑",
      meadow: "出游",
    } as Record<string, string>
  )[t.id],
  source: generated,
  subjectTip: t.story,
  cameraTip: t.notes?.viewpoint ?? "保留参考里的留白，先让人物落进框里。",
  needs:
    t.difficulty === "需要等光"
      ? "需要相近的现场光线；没有落日可以只借构图。"
      : "有相似背景就能试，不要求相同衣服或道具。",
}));
const fanSource =
  "https://github.com/marie-noelle97/audrey-hepburn-tribute-page/tree/master/images";
const checkins: Reference[] = [
  {
    id: "audrey-garden",
    title: "赫本同款：草地上的侧坐",
    subtitle: "经典照片 · 借坐姿与配色",
    category: "daily",
    kind: "checkin",
    scene: "公园",
    image: "curated/audrey-garden.jpg",
    tag: "真实历史照片",
    light: "side",
    difficulty: "坐姿参考",
    story: "喜欢的是侧坐的线条、自然撑手和草地背景。可以在自己的公园里试。",
    subjectTip: "侧坐在平稳的草地或长椅上，手掌轻撑身后，另一手自然搭在膝上。",
    cameraTip: "从略偏侧前方取景，保留腿部方向和一侧草地，不要把手肘裁掉。",
    needs: "一片草地或长椅；原拍摄地点未确认，先借动作与构图。",
    source: {
      type: "photo",
      label: "Audrey Hepburn 纪念图集 · 原拍摄地点未确认",
      url: fanSource + "/Audrey_hepburn_garden.jpg",
    },
  },
  {
    id: "audrey-hands",
    title: "赫本同款：双手轻托脸",
    subtitle: "经典照片 · 近景动作",
    category: "daily",
    kind: "checkin",
    scene: "室内",
    image: "curated/audrey-hands.jpg",
    tag: "真实历史照片",
    light: "window",
    difficulty: "近景参考",
    story: "把那张经典的托脸照片当作动作参考，重点是手、脸与干净背景。",
    subjectTip: "双手轻放脸颊两侧，手指放松，不用用力挤压脸。",
    cameraTip: "让眼睛清楚，保留手指和下巴，使用干净背景。",
    needs: "明亮窗边或柔和照明；原拍摄地点未确认，可以在任何室内借动作。",
    source: {
      type: "photo",
      label: "Audrey Hepburn 纪念图集 · 原拍摄地点未确认",
      url: fanSource + "/Audrey_hepburn_hands_face.jpg",
    },
  },
];
const artSource =
  "https://github.com/eudoxia0/flashcards/tree/master/cards/art/images";
const paintings: Reference[] = [
  {
    id: "pearl",
    title: "把自己拍进《戴珍珠耳环的少女》",
    subtitle: "维米尔 · 约 1665 年",
    category: "painting",
    kind: "painting",
    scene: "室内",
    image: "curated/pearl.jpg",
    tag: "回头与侧光",
    light: "window",
    difficulty: "先借光线",
    story: "不用先买服装。暗背景、侧窗光和回头的轮廓，就能借到画里的感觉。",
    subjectTip: "身体侧向一边，再慢慢回头看同伴，肩膀放松。",
    cameraTip: "从亮侧脸颊的方向取景，保留肩膀和头顶，背景避开亮杂物。",
    needs: "深色背景与侧窗光；围巾和耳环都是可选。",
    source: {
      type: "artwork",
      label: "维米尔 · 《戴珍珠耳环的少女》 · 莫瑞泰斯皇家美术馆",
      url: "https://www.mauritshuis.nl/en/our-collection/artworks/670-girl-with-a-pearl-earring/",
    },
  },
  {
    id: "parasol",
    title: "把风拍进《撑阳伞的女人》",
    subtitle: "莫奈 · 1875 年",
    category: "painting",
    kind: "painting",
    scene: "公园",
    image: "curated/parasol.jpg",
    tag: "草地与天空",
    light: "backlight",
    difficulty: "需要现场光",
    story: "借草地、天空和伞的轮廓，保留风里的轻松感；不用站到危险的坡边。",
    subjectTip: "站在平坦开阔的草地上，轻轻侧身持伞，先稳住脚下。",
    cameraTip: "稍低取景，多留天空，观察脸是否太暗，不直视太阳。",
    needs: "平坦草地与伞；没有逆光时可以先借构图。",
    source: {
      type: "artwork",
      label: "莫奈 · 《撑阳伞的女人——莫奈夫人与儿子》 · 美国国家美术馆",
      url: "https://www.nga.gov/artworks/61379-woman-parasol-madame-monet-and-her-son",
    },
  },
  {
    id: "letter",
    title: "窗边读一封信",
    subtitle: "维米尔 · 约 1657–1659 年",
    category: "painting",
    kind: "painting",
    scene: "室内",
    image: "curated/letter.jpg",
    tag: "安静的侧身",
    light: "window",
    difficulty: "容易上手",
    story: "保留侧身、窗光和安静的手部动作。可以把信换成一本书。",
    subjectTip: "侧身站在窗边，双手轻拿纸张，目光自然落在纸上。",
    cameraTip: "从侧面保留窗户与人物，先看脸部暗侧有没有细节。",
    needs: "大窗与纸张或书；窗帘和复古道具可省略。",
    source: {
      type: "artwork",
      label: "维米尔 · 《窗前读信的少女》 · 德累斯顿历代大师画廊",
      url: artSource,
    },
  },
  {
    id: "renoir",
    title: "一张温柔的托腮肖像",
    subtitle: "雷诺阿 · 1877 年",
    category: "painting",
    kind: "painting",
    scene: "室内",
    image: "curated/renoir.jpg",
    tag: "托腮与柔和色彩",
    light: "window",
    difficulty: "容易上手",
    story: "取用《让娜·萨马里的肖像》里的轻托脸和暖色背景，不要求复刻衣服。",
    subjectTip: "手肘放在桌上，手掌轻托脸，身体稍微前倾。",
    cameraTip: "从接近眼睛的高度取景，保留肩膀，避免头顶灯造成眼窝阴影。",
    needs: "一张桌子与柔和窗光；暖色墙面会更接近画作。",
    source: {
      type: "artwork",
      label: "雷诺阿 · 《让娜·萨马里的肖像》 · 1877 年",
      url: artSource,
    },
  },
];
export const REFERENCES: Reference[] = [
  ...additions,
  ...originals,
  ...checkins,
  ...paintings,
];
export const REFERENCE_CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "daily", label: "日常人像" },
  { id: "checkin", label: "同款打卡" },
  { id: "painting", label: "画作复刻" },
] as const;
export async function referencePhoto(t: Reference): Promise<Photo> {
  if (t.personal) return { ...unpack(t.personal.photo), name: t.title };
  const url = `${import.meta.env.BASE_URL}images/${t.image}`;
  const image = await loadImage(url);
  return {
    id: crypto.randomUUID(),
    url,
    name: t.title,
    width: image.naturalWidth,
    height: image.naturalHeight,
    crop: t.crop ?? { x: 0, y: 0, width: 1, height: 1 },
    sample: true,
    subject: {
      x: 0.25,
      y: 0.1,
      width: 0.5,
      height: 0.8,
      source: "manual",
      confirmed: false,
    },
  };
}
export function personalAsReference(record: PersonalReference): Reference {
  return {
    id: record.id,
    title: record.name,
    subtitle: "我的参考 · " + PERSONAL_CATEGORY_LABELS[record.category],
    category: record.category === "painting" ? "painting" : "daily",
    kind: record.category,
    image: "",
    tag: PERSONAL_CATEGORY_LABELS[record.category],
    scene: "我的参考",
    light: "window",
    lightKnown: false,
    difficulty: "先试构图",
    story:
      "这是你上传的参考。先借人物位置、留白或动作；下面是通用提醒，可在拍法里调整。",
    cameraTip: "把人物放到参考位置，留出头顶和脚边，再看背景。",
    subjectTip: "先站稳或坐舒服，等同伴框好画面，再试喜欢的动作。",
    needs: "光线与场地按现场条件选择；不必准备完全相同的衣服和道具。",
    source: { label: "个人上传的参考 · 保存在当前浏览器", type: "user" },
    personal: record,
  };
}
export async function exampleScenePhoto(): Promise<Photo> {
  const url = `${import.meta.env.BASE_URL}images/curated/city-life-sheet.png`;
  const image = await loadImage(url);
  return {
    id: crypto.randomUUID(),
    url,
    name: "湖边示例 · 场景图",
    width: image.naturalWidth,
    height: image.naturalHeight,
    crop: sheetCrop(7),
    sample: true,
    subject: {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      source: "manual",
      confirmed: false,
    },
  };
}
