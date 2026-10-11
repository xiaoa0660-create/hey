# 打开两个版本，一次上传即可

## 先看截图

[打开双版本截图页](ui-preview/dual-v0.5/README.md)。这是当前页面截图，不是新的在线体验网址。

## 下载并体验

1. 打开 [双版本体验包](../downloads/zhaozhepai-comparison-v0.5.zip)。在 GitHub 文件页点击右上角下载按钮（Download raw file）。
2. 在电脑“下载”文件夹中找到 ZIP，双击解压。
3. 打开你原来的 Netlify 项目，进入 **Deploys**。将**整个解压后的文件夹**拖进手动上传区域。
4. 等待显示 **Published**，再打开原来的 `https://…netlify.app` 网址。首页会有 **A 暖色原版** 和 **B 笔记新版** 两个按钮。

正确上传的文件夹应该直接包含这些内容：

```text
index.html          ← 双版本选择首页
classic.html        ← A 暖色原版
notebook.html       ← B 笔记新版
compare.html
assets/
images/
models/
vision/
preview-manifest.json
```

**不要只上传 HTML，也不要直接双击 HTML 来体验。** 两个版本需要图片、网页资源和人体模型一起加载。

不需要重新注册 Netlify，也不需要填写模型 API 密钥。第一次人体识别会加载本机模型；打开相机时需要允许权限。电脑没有摄像头时，可以把同一个网址发到手机，用手机系统浏览器打开。

如仍看到旧页面，刷新页面。也可以在网址后加 `/preview-manifest.json`，应显示 `version: "0.5.0"` 和 A/B 两个入口。如果是 404，检查是否上传了直接包含 `index.html` 的完整文件夹。

## 建议这样比较

先进入 A，感受原来的暖色页面；返回浏览器上一页，再进入 B。

在 B 中：选一张参考 → 看拍法笔记 → 点“照着这张拍” → 选择现场条件和一个小动作 → 确认后保存小卡 → 交给同伴打开相机。拍后选“动作自然一点”或“脸再亮一点”，直接再拍。

回到首页点“我的小卡”，刷新后再打开，确认刚才的参考和方案仍然在。小卡仅属于当前浏览器，换电脑或清理网站数据不会同步，请单独保存重要原片。

## 发布状态

这次更新包括源码、截图和可部署 ZIP；原来的 Netlify 网站不会随着 GitHub 分支自动更新。当前没有连接该站点的部署权限，需要你按上述步骤上传一次。旧 v0.4 ZIP 和原体验分支均保留。

开发者重新打包：先运行 `npm run build`，成功后运行 `python scripts/package-comparison.py`。原 `package-preview.py` 是单版本打包脚本，双版本体验请用新的命令。
