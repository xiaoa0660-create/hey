import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { requestSchema } from "./schema.ts";
import { interpret, modelConfig } from "./provider.ts";
import type { InterpretRequest } from "./schema.ts";
import { sceneRequestSchema, sceneResultSchema } from "../src/product/scene.ts";
import { planScene } from "./scene-provider.ts";

export function createApp(
  options: {
    dist?: string;
    run?: (data: InterpretRequest) => Promise<unknown>;
    configured?: boolean;
    runScene?: (image: string) => Promise<unknown>;
  } = {},
) {
  const config = options.run ? null : modelConfig();
  const runScene =
    options.runScene ??
    (config ? (image: string) => planScene(image, config) : null);
  const run =
    options.run ??
    (config ? (data: InterpretRequest) => interpret(data, config) : null);
  const active = new Set<string>();
  return createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    const json = (status: number, value: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json;charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path === "/api/health") {
      json(200, {
        configured: options.configured ?? !!run,
        provider: config?.provider ?? null,
        model: config?.model ?? null,
        sceneConfigured: !!runScene,
      });
      return;
    }
    if (path === "/api/scene") {
      if (req.method !== "POST") {
        json(405, { error: "请使用 POST 请求。" });
        return;
      }
      if (!req.headers["content-type"]?.startsWith("application/json")) {
        json(415, { error: "仅支持 JSON 请求。" });
        return;
      }
      if (req.headers.origin) {
        try {
          if (new URL(req.headers.origin).host !== req.headers.host) {
            json(403, { error: "此来源不能请求分析。" });
            return;
          }
        } catch {
          json(403, { error: "此来源不能请求分析。" });
          return;
        }
      }
      if (!runScene) {
        json(503, {
          error: "AI 风景分析还未开启。照片已保留，可以自己选择站位继续拍。",
        });
        return;
      }
      const key = req.socket.remoteAddress ?? "local";
      if (active.has(key)) {
        json(429, { error: "上一张照片还在分析，请稍等。" });
        return;
      }
      active.add(key);
      try {
        let size = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 3_500_000) {
            json(413, { error: "照片过大，请缩小后重试。" });
            return;
          }
          chunks.push(chunk);
        }
        let input;
        try {
          input = sceneRequestSchema.parse(
            JSON.parse(Buffer.concat(chunks).toString("utf8")),
          );
        } catch {
          json(400, { error: "请确认图片和发送授权后重试。" });
          return;
        }
        json(200, sceneResultSchema.parse(await runScene(input.image)));
      } catch {
        json(502, {
          error:
            "这次风景分析没有成功，可能是超时或结果不完整。照片已保留，可重试或自己调整。",
        });
      } finally {
        active.delete(key);
      }
      return;
    }
    if (path === "/api/interpret") {
      if (req.method !== "POST") {
        json(405, { error: "请使用 POST 请求。" });
        return;
      }
      if (!req.headers["content-type"]?.startsWith("application/json")) {
        json(415, { error: "仅支持 JSON 请求。" });
        return;
      }
      if (req.headers.origin) {
        let same = false;
        try {
          same = new URL(req.headers.origin).host === req.headers.host;
        } catch {}
        if (!same) {
          json(403, { error: "此来源不能请求解读。" });
          return;
        }
      }
      if (!run) {
        json(503, {
          error: "深度解读还未配置。你可以继续使用本地涂抹、目标开关与相机。",
        });
        return;
      }
      const key = req.socket.remoteAddress ?? "local";
      if (active.has(key)) {
        json(429, { error: "上一张参考还在解读，请稍等。" });
        return;
      }
      active.add(key);
      try {
        let size = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 3_500_000) {
            json(413, { error: "参考图片过大，请缩小后重试。" });
            return;
          }
          chunks.push(chunk);
        }
        let data;
        try {
          data = requestSchema.parse(
            JSON.parse(Buffer.concat(chunks).toString("utf8")),
          );
        } catch {
          json(400, {
            error: "参考信息不完整，或图片、选区超出限制。请调整后重试。",
          });
          return;
        }
        const result = await run(data);
        json(200, result);
      } catch {
        json(502, {
          error:
            "这次深度解读没有成功，可能是模型超时、配置问题或结果无法验证。输入已保留，可重试或恢复本地解读。",
        });
      } finally {
        active.delete(key);
      }
      return;
    }
    if (path.startsWith("/api/")) {
      json(404, { error: "接口不存在。" });
      return;
    }
    if (!options.dist) {
      json(404, { error: "请从前端页面访问。" });
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      json(405, { error: "请求方法不可用。" });
      return;
    }
    try {
      const root = resolve(options.dist);
      let file = resolve(root, "." + decodeURIComponent(path));
      if (file !== root && !file.startsWith(root + sep)) {
        json(403, { error: "路径不可用。" });
        return;
      }
      if (path === "/") file = resolve(root, "index.html");
      try {
        if (!(await stat(file)).isFile()) throw new Error();
      } catch {
        json(404, { error: "文件不存在。" });
        return;
      }
      const types: Record<string, string> = {
        ".html": "text/html;charset=utf-8",
        ".js": "text/javascript",
        ".css": "text/css",
        ".wasm": "application/wasm",
        ".task": "application/octet-stream",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".pdf": "application/pdf",
      };
      res.writeHead(200, {
        "Content-Type": types[extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : await readFile(file));
    } catch {
      json(400, { error: "请求不可用。" });
    }
  });
}
