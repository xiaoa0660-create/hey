# Render + 火山方舟 Responses 接入

代码分支：`preview/mobile-v07-20261012`。模型来自用户已开通的账号：`doubao-seed-2-1-pro-260915`。

Render 选择 Web Service / Node，Root Directory 留空，Build Command 为 `npm ci && npm run build`，Start Command 为 `npm start`。先用 Free 验收；空闲后服务会休眠，重新打开需要等待启动。

环境变量（密钥仅填入 Render）：

| KEY | VALUE |
|---|---|
| NODE_VERSION | 22.18.0 |
| HOST | 0.0.0.0 |
| VISION_PROVIDER | ark |
| VISION_MODEL | doubao-seed-2-1-pro-260915 |
| VISION_API_BASE | https://ark.cn-beijing.volces.com/api/v3 |
| VISION_API_KEY | 在 Render 安全配置中粘贴真实 API Key |

不要把 `/responses` 拼进 VISION_API_BASE，程序会追加。PORT 使用平台自动提供的值。接口为非流式 Responses：图片采用 input_image，关闭思考以减少等待，JSON 输出，store=false（不保留可供后续引用的响应；不等于供应商零日志承诺）。只读取完成状态下的 assistant/output_text，拒绝部分响应、错误、拒答和未经校验的建议。调用期限仍为 20 秒，失败回到保留照片的手动流程。

验证边界：适配器和输入输出约束可用模拟响应自动测试；真实调用、账号配额、模型对参数的支持、图片分析质量和实际费用必须在部署后使用账号验证。`/api/health` 仅说明配置存在，不证明真实模型调用成功。

验收：打开 HTTPS 首页 → 上传风景图 → 明确同意发送 → 成功得到三个不同构图方案；再上传参考图验证建议。两种视觉分别访问 `/` 和 `/notebook.html`。API Key 不进入前端、仓库或截图。
