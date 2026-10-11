# 照着拍

从一张场景图或参考照片开始，让拿手机的人知道怎么取景，让镜头前的人知道怎么站、怎么动。先拍一张，再只改一点。

**当前交付 v0.6：两个版本同步更新。** A 保留暖白、墨绿和衬线标题；B 使用白底、红色强调和双列拍法笔记。两者共用相同功能与 20 张参考，有四个 TAB、首页上手示例、风景拍法、双人指导、光影、连续重拍、导出和本地保存。

[完整 PRD 与全部交互](docs/prd-v1.5.md) · [图文产品手册 PDF](downloads/照着拍-产品手册-v0.6.pdf) · [38 张双版本截图](docs/ui-preview/easy-v0.6/README.md) · [下载与打开步骤](docs/delivery-v0.6.md) · [素材出处](docs/image-sources-v0.6.md) · [验收记录](docs/acceptance-v1.5.md)

## 体验与页面

双版本体验包的首页是风格选择页。选择 A 或 B 后，默认到“开始拍”。产品共 9 个核心页面；手册和双版本选择页在主流程外。

- 从风景开始：拍／传场景 → AI 建议或自己选站位 → 看双方拍法 → 主动开相机 → 结果与重拍。
- 从参考开始：导入个人图，或从 20 张参考中选 → 看双方拍法 → 主动开相机 → 导出与保存。
- 底部 TAB：开始拍 / 找参考 / 收藏 / 我的拍摄。
- 首页 30 秒示例不调用 AI、不打开相机；完整手册支持 A/B 截图切换、章节跳转、点图放大和 PDF 下载。

**这是 React 前端 + Node 可选视觉分析后端。** 人体模型、相机、收藏、手动站位、光影方案、拍摄与导出在浏览器本地运行。场景与参考的大模型分析通过后端。当前没有配置模型账号或密钥，静态体验包明确显示 AI 分析未开启，不会把固定示例套到上传图上。

请上传整个解压目录，不要只上传 HTML，也不要双击 HTML 当作运行应用。GitHub 私有分支的文件更新不会自动更新你手动上传的 Netlify 网站。云端 localhost 地址不能作为用户体验链接。

## 开发与生产启动

Node.js 22.18+；本次环境 Node.js 24.19.0 / npm 11.9.0。

```bash
npm ci --cache /tmp/zhaozhepai-npm-cache
npm run dev
```

开发：前端 5173，API 127.0.0.1:3001；Vite 代理 `/api`。启动脚本验证本地模型，准备 WASM 和 Worker。只在同一台电脑访问本机地址；手机拍摄需要 HTTPS。

```bash
npm run build
npm start
```

生产 Node 同时提供 `dist` 和 API。按托管平台配置 `HOST=0.0.0.0`、`PORT` 和 HTTPS。开发入口 A 为 `index.html`、B 为 `notebook.html`，对比为 `compare.html`；静态对比 ZIP 将 A 放在 `classic.html`，根 `index.html` 为对比页。

模型服务配置见 [.env.example](.env.example)。在服务端安全环境变量填写 `VISION_PROVIDER`（gemini / openai）、`VISION_MODEL` 和对应 `GEMINI_API_KEY` / `VISION_API_KEY`，可选 HTTPS 的 `VISION_API_BASE`。不设假定模型名，不把密钥放入前端或提交仓库。两种提供商都适配图片输入和结构化返回。API：`GET /api/health`、`POST /api/scene`、`POST /api/interpret`；发送需要明确同意。当前静态包不提供后端，模型服务不会因上传前端而自动开启。

## 验证与生成交付文件

```bash
npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e -- --workers=2 --timeout=60000
node scripts/capture-product.mjs
node scripts/render-handbook.mjs
npm run build
python3 scripts/package-comparison.py
```

解压包后的静态验收使用 `PRODUCT_STATIC_BUNDLE=1`、`PLAYWRIGHT_BASE_URL` 指向本地静态服务、`PRODUCT_A_ENTRY=/classic.html`。有一个直接导入 Vite 源码的模型诊断在开发服务单独执行；其余流程可以直接针对交付 ZIP 测试。

截图脚本需要运行中的开发服务，使用 Canvas 视频流演示实际相机 UI 与本地模型，生产产品不包含测试视频。PDF 通过 Chromium 打印独立版式，用户阅读不需要 Node 或账号。图库随包提供，不依赖远程图床。底层模型来源与许可见 [模型资产说明](docs/model-assets.md)。

## 保存边界与历史作品

收藏与拍摄记录都只在当前浏览器。记录最多 12 条，每条保留参考、最新拍法以及最后明确保存的一张结果及其历史目标；照片长边最多 1600px。最近 6 张只保留在会话，重要原片需独立导出。没有账号、云相册或跨设备同步。

同款打卡本次提供真实赫本参考与来源，原拍摄地点尚未确认；画作复刻使用四幅原作。日常图与湖边教程是明确标记的原创 AI 示例。详见素材出处，不把生成图当作现实打卡照片。

历史 [v0.4 体验包](downloads/zhaozhepai-preview-v0.4.zip) 与 [v0.5 双版本包](downloads/zhaozhepai-comparison-v0.5.zip) 保留。历史需求／设计文档与归档分支保留，`main` 未被预览分支覆盖。`legacy.html` 和 `legacy-notebook.html` 用于旧核心能力回归，不作为当前首页推荐入口。
