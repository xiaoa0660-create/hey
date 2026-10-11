import { z } from "zod";
import { FEATURES } from "../src/domain/session.ts";

const group = z.enum(["left_arm", "right_arm", "head", "torso"]);
const feature = z.enum([
  "composition",
  "viewpoint",
  "light",
  "exposure",
  "focus",
  "color",
  "styling",
  "moment",
  "expression",
]);
export const draftSchema = z
  .object({
    mode: z.enum(["partial", "whole"]),
    groups: z.array(group).max(4),
    features: z.array(feature).max(9),
    ignoreContact: z.boolean(),
    mirror: z.boolean(),
  })
  .strict();
export const requestSchema = z
  .object({
    consent: z.literal(true),
    image: z
      .string()
      .max(3_000_000)
      .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/),
    text: z.string().max(2000),
    availableGroups: z.array(group).max(4),
    personBox: z
      .object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        width: z.number().positive().max(1),
        height: z.number().positive().max(1),
      })
      .refine((b) => b.x + b.width <= 1.001 && b.y + b.height <= 1.001)
      .nullable(),
    draft: draftSchema,
    selection: z
      .array(
        z.object({
          tool: z.enum(["paint", "erase"]),
          radius: z.number().min(0.001).max(0.2),
          points: z
            .array(
              z.object({
                x: z.number().min(0).max(1),
                y: z.number().min(0).max(1),
              }),
            )
            .max(600),
        }),
      )
      .max(60),
  })
  .strict();
export type InterpretRequest = z.infer<typeof requestSchema>;
export const resultSchema = z
  .object({
    draft: draftSchema,
    insights: z
      .array(
        z
          .object({
            id: feature,
            summary: z.string().min(1).max(350),
            evidence: z.string().min(1).max(350),
            confidence: z.enum(["observed", "inferred", "unknown"]),
          })
          .strict(),
      )
      .max(9),
    explanation: z.string().max(500),
  })
  .strict();
export function validateResult(value: unknown, input: InterpretRequest) {
  const result = resultSchema.parse(value);
  if (result.draft.groups.some((g) => !input.availableGroups.includes(g)))
    throw new Error("模型选择了无法检测的动作，请调整目标后重试。");
  if (new Set(result.insights.map((i) => i.id)).size !== result.insights.length)
    throw new Error("解读结果包含重复要素。");
  // The model cannot promote a preparation-only element into a live constraint.
  return {
    ...result,
    insights: result.insights.map((i) => ({
      ...i,
      title: FEATURES[i.id].label,
      support: FEATURES[i.id].support,
    })),
  };
}
