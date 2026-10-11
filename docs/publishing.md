# 在线 Demo 发布准备

当前 Demo 尚未部署，工作区内的绝对文件路径不是用户可访问的网址。

已准备 `.github/workflows/pages.yml`：使用锁文件构建单文件 Demo，将其作为 GitHub Pages 的 `index.html` 发布。所有资源已内嵌，支持仓库子路径，无需更改前端路由或图片路径。公开页面只包含演示应用和生成的咖啡馆素材；用户选择的照片仍在浏览器内处理。

发布前需读取并确认仓库状态及 Pages 配置，再将项目提交到目标仓库并将 Pages 构建来源设为 GitHub Actions。工作流成功后，读取实际部署 URL，验证网页响应与示例流程，再把链接提供给用户。不要根据用户名与仓库名拼出一个尚未验证的网址。

本次访问修复检查：

- `/workspace/hey/dist/照着拍-Demo.html` 存在，约 3.2 MB。
- 原生 Git 只读访问正常；这不等于 Pages 管理权限已验证。
- 网络配置已生效，GitHub 仓库 API 可访问；目标仓库为私有，当前没有 Pages 站点。
- Pages 管理 API 返回 `Resource not accessible by integration`（403）。这是当前连接的权限限制，需要仓库所有者在 GitHub 设置中操作，不是继续添加网络域名能解决的问题。

保持仓库私有。仓库所有者需要先查看 Settings → Pages，确认账号是否支持在该私有仓库开启 Pages。支持时将构建来源设为 GitHub Actions，再触发工作流；若界面要求升级或公开仓库，先选择其他发布方案，不自动改变仓库可见性。当前未更改远端 Pages 设置，也未完成上线。
