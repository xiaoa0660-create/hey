# 本地模型与素材来源

## 端侧人体检测

- 运行库：Google `@mediapipe/tasks-vision@0.10.21`，锁定于 package-lock.json，Apache-2.0。
- 本地模型：MediaPipe Pose Landmarker **Full**，9,398,198 bytes，33 个关键点。
- 实际取得方式：从公开 npm 包 `expo-mediapipe-pose@0.3.0` 的 `package/assets/pose_landmarker_full.task` 提取。该社区包说明模型来自 Google；本项目未安装或运行其原生相机代码。
- 固定下载地址：https://registry.npmjs.org/expo-mediapipe-pose/-/expo-mediapipe-pose-0.3.0.tgz
- 模型 SHA-256：`5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1`。
- 包含 `pose_detector.tflite`、`pose_landmarks_detector.tflite`。准备脚本验证模型文件哈希，避免误把 Git LFS 文本指针当成模型。
- 上游文档：https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
- 许可证原文及分发包声明位于 `public/licenses/mediapipe-notices.md`、`public/licenses/model-distribution-MIT.txt`。

本次环境直接访问 Google 模型存储返回 HTTP 403，因此使用上述固定 npm 分发包。它不是从 Google URL 直接下载的字节文件，也不声明与其他镜像压缩包的哈希一致。已在浏览器实际加载和推理验证。使用 Full 而非 PRD 候选 Lite，低性能设备按实际耗时减少检测频率；手机持续帧率与发热尚待真机测量。

`npm run dev` 和 `npm run build` 的准备步骤从锁定依赖复制 WASM，并用 esbuild 构建 classic Worker。MediaPipe 0.10.21 内部使用 importScripts，不能直接放入 module Worker。模型和 WASM 由本应用同源提供，摄像头帧不离开设备。

## 示例素材

- `cafe-editorial.png`：此前版本生成的咖啡馆原创示例，保留原风格。
- `city-sun.png`：本次生成的成年人物街角抬手示例。
- `meadow.png`：本次生成的成年人物户外舒展手臂示例。
- `painting-study.png`：本次生成的原创油画习作，不冒充名画原作。

- `seaside-dusk.png`：v0.4 新增，成年男子在落日海边的侧逆光参考。
- `rainy-blue-hour.png`：v0.4 新增，成年女子持透明伞的雨后蓝调橱窗光参考。
- `garden-shadow.png`：v0.4 新增，成年女子与花园墙面树影参考。
- `concrete-overcast.png`：v0.4 新增，成年男子与阴天建筑线条参考。

素材均通过本会话图像生成工具创建，未从社交平台抓取人物照片。v0.4 使用 8 张独立图片，移除旧版同图练习入口。它们是生成素材，不代表真实用户试拍或效果验证。个人上传图不写入项目、服务器或公共素材库。用光说明与色调预设由编辑整理，不冒充图片模型自动分析结果。
