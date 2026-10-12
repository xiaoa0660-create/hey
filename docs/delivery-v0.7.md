# 照着拍 v0.7：两版分别查看与体验

## 先阅读本版文档

| 版本 | 评审与代码交付入口 | 用户手册 PDF | 手机体验包 |
| --- | --- | --- | --- |
| A · 杂志版 | [进入本版目录](editions/magazine/README.md) · [PRD](editions/magazine/prd.md) | [下载](../downloads/magazine-handbook-v0.7.pdf?raw=true) | [ZIP](../downloads/zhaozhepai-magazine-v0.7.zip?raw=true) |
| B · 笔记版 | [进入本版目录](editions/notebook/README.md) · [PRD](editions/notebook/prd.md) | [下载](../downloads/notebook-handbook-v0.7.pdf?raw=true) | [ZIP](../downloads/zhaozhepai-notebook-v0.7.zip?raw=true) |

请在 Chrome 或 Safari 打开 GitHub 链接。仓库私有，须登录有权限的账号。聊天里的 `/workspace` 文件链接会触发代码预览，不能可靠显示 PDF；本次提供 GitHub 浏览器入口与下载。

文件页右上角的向下箭头是 Download raw file。PDF 下载后在电脑「下载」文件夹双击打开，两份都是 10 页手机阅读比例。若 GitHub 无法预览，直接下载即可，不需要先部署产品。

[杂志版离线手册](../downloads/magazine-handbook-offline-v0.7.html?raw=true) · [笔记版离线手册](../downloads/notebook-handbook-offline-v0.7.html?raw=true)：下载后可单独阅读，图片、样式与 PDF 已嵌入文件。它们是阅读手册，拍照仍从体验网址打开产品。

## 手机体验：任选独立包，或一次部署两个版本

1. 下载本版 ZIP，解压。
2. 找到直接包含 `index.html`、`assets`、`images`、`models`、`vision`、`guide` 的文件夹。
3. 在你的 Netlify 项目 Deploys 页面，把这个 **整个文件夹** 拖进手动上传区域。不要只上传 HTML。
4. 等显示 Published，在手机的系统浏览器打开生成的 HTTPS 网址，允许相机。
5. 首页从风景或参考开始；「找参考」每类都有上传按钮；右上角「怎么用」进入当前版本手册。

希望一次比较两个版本，可以下载 [双版本体验包](../downloads/zhaozhepai-comparison-v0.7.zip?raw=true)，按同样步骤上传。首页选择版本，A 入口为 `/classic.html`，B 入口为 `/notebook.html`；两版各自打开自己的手册。

## 检查是否上传正确

在网址后加 `/preview-manifest.json`，应显示 `version: "0.7.0"`。404 通常表示文件夹层级或文件不完整，重新上传第2步的整个文件夹。

已有的 https://kaleidoscopic-starburst-62c6b2.netlify.app/ 不会因为 GitHub 文件变化自动升级，需要重新上传。没有声称替你更新该站点。本次没有新增模型账号或 Netlify 访问凭据。

当前静态包可体验本地参考、人物检测、手动风景构图、用光、相机、重拍、调色、导出和保存。真实视觉模型接口已实现，但服务尚未配置，页面如实提示；不会套用示例分析。个人参考24张、拍摄记录12条，只在当前浏览器。旧版 ZIP 和历史分支继续保留。
