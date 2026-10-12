import { z } from "zod";

export const sceneRequestSchema = z
  .object({
    consent: z.literal(true),
    image: z
      .string()
      .max(3_000_000)
      .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/),
  })
  .strict();
const boxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0.06).max(0.85),
    height: z.number().min(0.12).max(0.92),
  })
  .strict()
  .refine(
    (b) => b.x + b.width <= 1.001 && b.y + b.height <= 1.001,
    "人物建议范围超出画面",
  );
export const sceneVariantSchema = z
  .object({
    id: z.enum(["balanced", "scenery", "person"]),
    box: boxSchema,
    camera: z.string().min(5).max(250),
    subject: z.string().min(5).max(250),
    why: z.string().min(5).max(350),
  })
  .strict();
export const sceneResultSchema = z
  .object({
    summary: z.string().min(5).max(350),
    light: z
      .object({
        style: z
          .enum([
            "window",
            "hard",
            "backlight",
            "overcast",
            "night",
            "side",
            "shade",
          ])
          .nullable(),
        advice: z.string().min(5).max(350),
        evidence: z.string().min(3).max(350),
      })
      .strict(),
    variants: z.array(sceneVariantSchema).length(3),
    limitations: z.array(z.string().min(3).max(250)).min(1).max(5),
  })
  .strict()
  .superRefine((result, ctx) => {
    const modes = result.variants.map((v) => v.id);
    if (new Set(modes).size !== 3)
      ctx.addIssue({ code: "custom", message: "缺少不同的构图方案" });
    const height = (id: string) =>
      result.variants.find((v) => v.id === id)?.box.height ?? 0;
    if (
      !(
        height("scenery") < height("balanced") &&
        height("balanced") < height("person")
      )
    )
      ctx.addIssue({ code: "custom", message: "人物大小与构图选项不一致" });
  });
export type SceneResult = z.infer<typeof sceneResultSchema>;
export type SceneVariant = z.infer<typeof sceneVariantSchema>;
export const COMPOSITIONS = [
  { id: "balanced", label: "人景平衡" },
  { id: "scenery", label: "多留风景" },
  { id: "person", label: "突出人物" },
] as const;

// This is a named, fixed tutorial for the bundled lake image. Never applied to uploads.
export const LAKE_EXAMPLE: SceneResult = {
  summary:
    "让人物站在画面右侧，左边留给湖面和远山。人不用很大，风景也能成为这一张的主角。",
  light: {
    style: "overcast",
    advice:
      "脸朝向明亮天空，先看脸颊。站在岸边平坦、开放的地方，避开树下太暗的阴影。",
    evidence:
      "示例中天空柔和，地面没有清晰的硬阴影；这是编辑为示例整理的建议。",
  },
  variants: [
    {
      id: "balanced",
      box: { x: 0.62, y: 0.46, width: 0.19, height: 0.44 },
      camera: "先保留湖面和山顶，把人物放在右侧虚线框里，地平线避开脖子。",
      subject: "站在岸边的平坦步道上，身体侧向湖面，再轻轻回头。",
      why: "右侧人物与左侧湖面形成平衡，脚边也有空间。",
    },
    {
      id: "scenery",
      box: { x: 0.66, y: 0.61, width: 0.12, height: 0.28 },
      camera:
        "把人物拍小一点，多留远山和湖面；左右挪动取景，让头部避开山脊线。",
      subject: "保持右侧站位，面向湖面，双手自然放松。",
      why: "人物成为尺度参照，风景占据更多画面。",
    },
    {
      id: "person",
      box: { x: 0.48, y: 0.2, width: 0.31, height: 0.7 },
      camera: "靠近一些拍人物，仍让一侧留出湖面，留完整头顶和脚边。",
      subject: "身体稍微侧过来，看向同伴，先停稳再拍。",
      why: "人物更醒目，保留一些背景说明你在哪里。",
    },
  ],
  limitations: [
    "图中的虚线框和人形是建议位置，不是已经检测到的人。",
    "一张照片无法确定真实距离、地面深度和光源位置，请现场确认。",
  ],
};
