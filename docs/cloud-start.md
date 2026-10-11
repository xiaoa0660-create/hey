# 照着拍：云环境启动

项目目录是 `/workspace/hey`。在现有 checkout 内工作，保留已有修改；不要自动创建 worktree。

1. 阅读 `README.md`；产品说明在 `docs/product-brief.md`。
2. 首次准备运行 `bash scripts/setup-cloud.sh`。需要 Node.js 22.18+，已在 Node.js 24.19.0 / npm 11.9.0 验证。该脚本使用锁文件安装依赖，并生成生产构建和独立 HTML Demo。无需环境变量、数据库或 API 密钥。
3. 在持久终端运行 `npm run dev -- --port 5173 --strictPort`。监听 `0.0.0.0:5173`。服务器进程需要在环境重新启动后重启。
4. 用本环境内的 HTTP 请求确认服务可达，再用浏览器走咖啡馆示例：留白 → 左侧 → 示例试拍 → 重拍比较 → 选择并保存照片。端口监听不等于功能验证。
5. 检查命令：`npm test`、`npm run build:demo`。有系统 Chromium 时运行 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e`；其他环境按 README 安装 Playwright 浏览器。

浏览器处理用户照片，不发往服务器；会话不持久化。咖啡馆照片为本地生成素材，必须保留 `public/images/cafe-editorial.png`。真实图片使用手动人物框和构图计算，AI 人物识别尚未接入。

已运行开发服务时，重新执行 `npm ci` 会替换依赖和优化缓存；安装完成后重启 Vite，再做浏览器检查。

`dist/照着拍-Demo.html` 是可直接下载并在现代桌面浏览器打开的离线演示；正常开发仍用 Vite 服务。云环境草稿保存不等于发布；以环境设置中的保存、发布结果为准。未独立验证新任务快照恢复，也未部署到公网。
