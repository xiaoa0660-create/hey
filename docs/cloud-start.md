# 照着拍：云环境恢复

项目目录 `/workspace/hey`。保留已有修改，在当前 checkout 工作。

1. 阅读 `README.md`、`docs/prd-v1.1.md`、`docs/acceptance-v1.1.md`。
2. 首次运行 `bash scripts/setup-cloud.sh`，需要 Node.js 22.18+。锁文件安装、模型哈希校验、WASM 复制、classic Worker 构建及生产打包均在此步骤完成。模型随源码本地保存，不能拿 Git LFS 指针代替。
3. 持久终端运行 `npm run dev`：Vite 0.0.0.0:5173，Node API 127.0.0.1:3001。检查 `/api/health` 和首页。环境重启后需要重新启动进程，快照不恢复运行中的服务器。
4. 走首页 → 街角示例 → 实际人体检测 → 涂手腕 → 确认 → 拍前准备 → 相机 → 拍摄保存。浏览器没有真实摄像头时，权限提示是预期状态。
5. 运行 `npm test`、`npm run build`、`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e -- --workers=2`。浏览器测试使用明确标注的合成媒体流，不能宣称手机真机验收。

本地核心流程无需密钥。云端解读需在 `.env` 或环境秘密变量中配置 provider、可访问的 model 与对应 key，见 `.env.example`。不要打印秘密值。出站模型域名也必须由环境网络策略允许；当前任务尚未配置模型凭证或验证真实云调用。

安装时已验证 npm 包完整性；本地模型和许可证来源见 `docs/model-assets.md`。应用保留四张原创生成图片，个人上传不写入仓库。

`npm start` 可用 Node 服务一起提供生产前后端。旧 `build:demo` 单 HTML 方式不支持新版架构；`downloads/zhaozhepai-demo.zip` 只是历史 v0 文件。

用户最新要求提前体验交互，已经准备静态体验包和 `docs/interactive-preview.md` 中的上传步骤。静态包不含云端解读服务。源码仓库保持私有；GitHub Pages 管理 API 返回 403，当前连接无法开启托管。当前没有验证过的公网体验链接，不要把 localhost / 云环境内部地址当成用户可打开链接。环境配置草稿不等于保存或发布；未验证新任务快照恢复。
