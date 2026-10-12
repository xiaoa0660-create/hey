# 照着拍

从一张风景图或参考照片开始，让拿手机的人知道怎么取景，让镜头前的人知道怎么配合。拍完只改一个地方，再拍下一张。

**当前 v0.7，两版同步更新，手机是唯一产品设计目标。** A · 杂志版采用奶油白、墨绿、衬线与留白；B · 笔记版采用白底、红色强调与双列参考。每版分别交付立项／研发评审 PRD、手机用户手册和独立体验包。

| 版本 | 评审与作品 | 手册 | 体验包 |
| --- | --- | --- | --- |
| A · 杂志版 | [交付入口](docs/editions/magazine/README.md) · [PRD](docs/editions/magazine/prd.md) | [PDF](downloads/magazine-handbook-v0.7.pdf?raw=true) | [ZIP](downloads/zhaozhepai-magazine-v0.7.zip?raw=true) |
| B · 笔记版 | [交付入口](docs/editions/notebook/README.md) · [PRD](docs/editions/notebook/prd.md) | [PDF](downloads/notebook-handbook-v0.7.pdf?raw=true) | [ZIP](downloads/zhaozhepai-notebook-v0.7.zip?raw=true) |

[新手打开步骤](docs/delivery-v0.7.md) · [46张手机截图](docs/ui-preview/mobile-v0.7/README.md) · [验收记录](docs/acceptance-v1.6.md) · [素材出处](docs/image-sources-v0.7.md)

## 这一轮改动

- 四个 TAB：开始拍、找参考、收藏、我的拍摄；首张流程不依赖读完整手册。
- 每个参考分类都有上传；选图直接到拍法，个人参考可找回、改名、改分类和删除。保存失败保留当前图，可继续拍。
- 同一组20张参考，个人参考最多24张；拍摄记录最多12条。两人提示、光影、高级编辑、连续重拍、调色、干净原片导出继续保留。
- 两版各自打开固定风格的手机手册，10页手机比例PDF；宽屏也只显示手机宽度。手册不包含部署和研发说明。
- PRD从痛点、真实反馈、设计取舍到状态与模型合同。每版6张设计图和少量关键截图；真实反馈证据为本次对话中1位需求提出者，未编造访谈或市场指标。

## 开发与模型

React + TypeScript前端，Node可选视觉后端。Node22.18+；锁定依赖与本地MediaPipe模型，参见[模型资产](docs/model-assets.md)。

```bash
npm ci --cache /tmp/zhaozhepai-npm-cache
npm run dev
npm test
npm run build
```

开发前端5173，API3001。端侧模型、相机、构图、光影、本地保存和导出在浏览器运行。视觉LLM分别通过 `/api/scene`、`/api/interpret` 解读单张图，不接收持续视频。用户明确确认后发送，返回经结构与语义验证。

当前模型环境变量缺失；接口、适配器与恢复流程已实现，真实外部模型语义、延迟与成本未验证。安全配置见[.env.example](.env.example)，密钥只在服务端配置。完整Node生产服务：`npm run build` 后 `npm start`；手机拍照需要HTTPS。

## 生成文档与交付

```bash
python3 scripts/build-review-docs.py
python3 scripts/build-mobile-guides.py
node scripts/capture-product.mjs
node scripts/render-mobile-guides.mjs
python3 scripts/package-mobile-handbooks.py
npm run build
python3 scripts/package-mobile-editions.py
```

截图和PDF生成需要开发服务与Chromium。截图脚本使用受控Canvas视频流，生产产品使用设备相机。静态ZIP有独立A/B包和比较包，明确标记AI未配置。GitHub目录用于浏览器阅读／下载，不使用聊天里的本地文件预览打开PDF。

## 历史与验证范围

v0.4、v0.5、v0.6 ZIP与历史分支保留；main未覆盖。本轮没有部署原Netlify站点，上传整个解压文件夹后才会更新。真实手机和模型评测仍需执行，脚本通过不等于真实用户易用性或市场验证。当前无账号或跨设备同步，同款地点库尚未完整核实。

## 火山方舟 + Render 部署

豆包图片理解支持使用 Responses API（`VISION_PROVIDER=ark`）。配置步骤见 [部署说明](docs/render-ark.md)。密钥只填入部署平台环境变量，仓库只提供空白配置示例。真实模型调用效果仍需部署后验收。

## Netlify 与 cowork 交接

Render 若要求银行卡，可参照 [Netlify 函数部署](docs/netlify-ark.md) 复用已有账号，账号限制及额度以控制台为准。给另一 AI Coding 应用的需求、视觉与模型协议见 [cowork 交接说明](docs/cowork-handoff.md)，可下载 [交接材料包](downloads/zhaozhepai-cowork-handoff-v0.7.zip)。

## REDcowork 纯前端源码

[独立前端项目](editions/frontend-only/README.md) 保留两种视觉，使用本地功能和手动方案；无模型密钥、函数后端或服务器。可下载 [REDcowork 源码包](downloads/zhaozhepai-redcowork-frontend-v0.7.zip)，按 [节省额度的导入/提交步骤](docs/redcowork-submit.md) 先发布。仓库根目录继续保留完整前后端版本。
