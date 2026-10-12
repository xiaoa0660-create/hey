# Netlify GitHub 部署 + 豆包图片理解

Render 已在用户选择 Free 后仍要求银行卡验证。本方案复用用户原有 Netlify 账号；是否需要验证和免费额度以该账号当前政策为准，不保证永久免费或免卡。

不要再次拖拽旧静态 ZIP 来开启 AI；通过 GitHub 导入 `xiaoa0660-create/hey`、选择 `preview/mobile-v07-20261012`，由 `netlify.toml` 配置构建、静态资源与函数。现有站点可在设置中关联 GitHub，避免无意义新建多个站点。

## 设置

Build command: `npm ci && npm run build`；Publish directory: `dist`；Functions directory: `netlify/functions`；Base directory 留空。

在站点环境变量中添加以下 4 项，VISION_API_KEY 必须可用于 Functions 运行环境，然后重新部署：

| KEY | VALUE |
|---|---|
| VISION_PROVIDER | ark |
| VISION_MODEL | doubao-seed-2-1-pro-260915 |
| VISION_API_BASE | https://ark.cn-beijing.volces.com/api/v3 |
| VISION_API_KEY | 自己的真实 API Key，不提交仓库 |

NODE_VERSION 已由 netlify.toml 配置。Netlify 函数不使用 HOST 或 PORT；没有 npm start 字段。

## 验收边界

`/api/health` 由函数返回状态，`configured=true` 仅说明环境变量齐备。真正验收需要用户同意上传图片后得到经校验的结果。上游调用仍有 20 秒期限；Netlify Functions 执行期限、额度、构建权限和地域网络必须在部署后确认。函数与原 Node 服务共用授权、大小、结果验证和失败保图流程；并发集合仅为实例内保护，不是全站预算限额。

本地测试验证重写后的 Lambda 事件、真实业务路由、授权和错误回退，并用 esbuild 检查函数可打包；不将这些测试等同于 Netlify 云端部署或真实模型效果验收。
