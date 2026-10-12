import type { ModelConfig } from "./provider.ts";

/** Ark Responses: use only final assistant text, never reasoning or partial output. */
export async function requestArkText(
  image: string,
  instructions: string,
  config: ModelConfig,
  maxOutputTokens: number,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher(`${config.base}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.key}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: instructions },
          { type: "input_image", image_url: image },
        ],
      }],
      thinking: { type: "disabled" },
      text: { format: { type: "json_object" } },
      temperature: 0.2,
      max_output_tokens: maxOutputTokens,
      store: false,
      stream: false,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("图片分析服务暂不可用");
  const value = await response.json() as {
    status?: string;
    error?: unknown;
    output?: Array<{
      type?: string;
      role?: string;
      content?: Array<{ type?: string; text?: unknown }>;
    }>;
  };
  if (value.status !== "completed" || value.error || !Array.isArray(value.output))
    throw new Error("图片分析尚未完整完成");
  const content = value.output
    .filter((item) => item.type === "message" && item.role === "assistant")
    .flatMap((item) => Array.isArray(item.content) ? item.content : []);
  if (content.some((item) => item.type === "refusal"))
    throw new Error("无法分析这张图片");
  const output = content
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text as string)
    .join("");
  if (!output.trim() || output.length > 30_000)
    throw new Error("无法读取图片分析结果");
  return output;
}
