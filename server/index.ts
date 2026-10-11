import { createApp } from "./app.ts";
const port = Number(process.env.PORT ?? 3001);
const app = createApp({ dist: new URL("../dist", import.meta.url).pathname });
app.requestTimeout = 30_000;
app.listen(port, process.env.HOST ?? "127.0.0.1", () =>
  console.log(`照着拍 API 已启动，端口 ${port}`),
);
