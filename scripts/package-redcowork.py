"""Build an independently installable frontend source edition for REDcowork."""
from pathlib import Path
import json
import re
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "editions/frontend-only"
DEST.mkdir(parents=True, exist_ok=True)

# These paths belong to this generated edition only; never clean the original app.
for relative in ["src", "public", "scripts"]:
    path = DEST / relative
    if path.exists():
        shutil.rmtree(path)
shutil.copytree(ROOT / "src", DEST / "src", ignore=shutil.ignore_patterns("*.test.ts"))
(DEST / "scripts").mkdir()
shutil.copy2(ROOT / "scripts/prepare-vision.mjs", DEST / "scripts/prepare-vision.mjs")

public = DEST / "public"
public.mkdir()
for name in ["images", "models", "licenses", "review"]:
    shutil.copytree(ROOT / "public" / name, public / name)
for name in ["favicon.svg", "handbook.html", "magazine-guide.html", "notebook-guide.html"]:
    shutil.copy2(ROOT / "public" / name, public / name)
(public / "guide/v0.7").mkdir(parents=True)
for name in ["mobile-v0.7.css", "magazine-handbook-v0.7.pdf", "notebook-handbook-v0.7.pdf"]:
    shutil.copy2(ROOT / "public/guide" / name, public / "guide" / name)
for guide in ["magazine-guide.html", "notebook-guide.html"]:
    text = (public / guide).read_text()
    for filename in re.findall(r'\./guide/v0\.7/([^"<>]+)', text):
        shutil.copy2(ROOT / "public/guide/v0.7" / filename, public / "guide/v0.7" / filename)
    if guide == "notebook-guide.html":
        text = text.replace('./notebook.html', './index.html?theme=notebook')
        (public / guide).write_text(text)

for name in ["index.html", "notebook.html", "compare.html", "legacy.html", "legacy-notebook.html"]:
    shutil.copy2(ROOT / name, DEST / name)

package = json.loads((ROOT / "package.json").read_text())
package["name"] = "zhaozhepai-frontend"
package["description"] = "Frontend-only mobile photography demo: magazine and notebook styles"
package["scripts"] = {
    "predev": "node scripts/prepare-vision.mjs",
    "dev": "vite --host 0.0.0.0",
    "prebuild": "node scripts/prepare-vision.mjs",
    "build": "tsc -b && vite build",
    "start": "npm run dev",
    "preview": "vite preview --host 0.0.0.0",
}
package["dependencies"].pop("serverless-http", None)
for name in ["@playwright/test", "concurrently"]:
    package["devDependencies"].pop(name, None)
(DEST / "package.json").write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n")
tsconfig = json.loads((ROOT / "tsconfig.json").read_text())
tsconfig["include"] = ["src", "vite.config.ts"]
(DEST / "tsconfig.json").write_text(json.dumps(tsconfig, indent=2) + "\n")
vite = (ROOT / "vite.config.ts").read_text()
vite = vite.replace('  plugins: [react()],', '  plugins: [react()],\n  define: { "import.meta.env.VITE_FRONTEND_ONLY": JSON.stringify("true") },')
vite = vite.replace('    proxy: { "/api": "http://127.0.0.1:3001" },\n', '')
(DEST / "vite.config.ts").write_text(vite)

# Preserve all cloud UI and manual alternatives but make zero backend requests.
for name, marker in [
    ("src/product/App.tsx", "    setConfigured(null);"),
    ("src/components/ReferenceStudio.tsx", "    setConfigured(null);"),
    ("src/notebook/ReferenceStudio.tsx", "    setConfigured(null);"),
]:
    path = DEST / name
    text = path.read_text()
    assert text.count(marker) == 1, f"Review health-check location in {name}"
    text = text.replace(marker, marker + '\n    if (import.meta.env.VITE_FRONTEND_ONLY === "true") {\n      setConfigured(false);\n      return;\n    }')
    if "ReferenceStudio" in name:
        text = text.replace('  async function analyze() {\n', '  async function analyze() {\n    if (!configured) return;\n')
    if name == "src/product/App.tsx":
        text = text.replace('AI 风景分析暂未开启', '纯前端版暂未接入 AI 风景分析')
        before = '            <a href={fullHelp} className="zp-help">'
        assert before in text
        text = text.replace(before, '''            <a className="zp-help" href={`./index.html?theme=${theme === "editorial" ? "notebook" : "editorial"}`}>
              {theme === "editorial" ? "看笔记版" : "看杂志版"}
            </a>
''' + before)
    path.write_text(text)

main = DEST / "src/main.tsx"
main.write_text(main.read_text().replace('<App theme="editorial" />', '<App theme={new URLSearchParams(location.search).get("theme") === "notebook" ? "notebook" : "editorial"} />'))
(DEST / ".gitignore").write_text("node_modules/\ndist/\n*.tsbuildinfo\n.DS_Store\npublic/vision/\n")
(DEST / "README.md").write_text("""# 照着拍 · REDcowork 纯前端代码

本目录是可独立安装的前端项目，不包含服务器、函数后端、API 密钥或后台启动命令。
React + TypeScript + Vite；Node≥22.18 用于构建，不是线上后端。

## 导入与发布

上传此目录的源码 ZIP；安装 `npm ci`，构建 `npm run build`，静态发布目录 `dist`。
开发预览 `npm run dev`（或 `npm start`）。请直接沿用现有产品，首轮只处理导入/构建兼容。

首页右上角可切换两种风格。A：`/?theme=editorial`；B：`/?theme=notebook`。
同时保留 `/notebook.html` 与 `/compare.html` 作为可选入口。若平台只允许一个 HTML，优先保留首页的 query 风格入口。

上传风景/参考、分类上传与个人参考管理、构图和姿态目标、光线建议、相机、本地 MediaPipe 检测、重拍、收藏、本机记录、下载、双风格用户手册均保留。
云端分析 UI 保留但明确未接入；不请求 `/api/*`、不索取密钥、不把示例套在用户图上。
MediaPipe 模型随源码提供，构建脚本从已安装依赖生成本地 WASM 和 worker，不依赖运行时外部模型 CDN。
相机需要 HTTPS 与浏览器权限；平台 iframe 权限受限时使用照片上传和手动流程，发布后在独立网址测试。
完整源码交互约束见原仓库 PRD。该版本不宣称具有真实云端图片理解能力。
""")
(DEST / "REDcowork-任务.txt").write_text("""请导入附件中的现有纯前端 Vite 项目，保留页面、素材、交互和两种视觉。首轮只完成安装、构建、预览、发布，以及阻塞这些步骤的最小修复。先读 README.md 和 package.json，按报错定点读取文件；图片和模型作为静态资源处理，避免逐个分析。沿用已有图片、用户手册和设计。使用首页右上角切换杂志版/笔记版；保留上传、手动构图、光线建议、相机、本地检测、收藏、记录和导出。云端 AI 明确未接入，不添加后端或密钥。构建命令 npm run build，发布目录 dist。构建成功后检查两种风格能打开、上传可进入方案，即发布并返回作品链接。交付简短说明与实际结果，不自动展开重构或新增功能。\n""")

# Run again with --zip after npm has generated this edition's lockfile.
import sys
if "--zip" in sys.argv:
    assert (DEST / "package-lock.json").exists()
    output = ROOT / "downloads/zhaozhepai-redcowork-frontend-v0.7.zip"
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted(DEST.rglob("*")):
            relative = path.relative_to(DEST)
            if not path.is_file() or any(p in {"node_modules", "dist", "vision"} for p in relative.parts):
                continue
            if path.name.endswith(".tsbuildinfo"):
                continue
            bundle.write(path, relative.as_posix())
    with zipfile.ZipFile(output) as bundle:
        assert bundle.testzip() is None
        assert 'package.json' in bundle.namelist()
        assert not any(p.startswith(('server/', 'netlify/', 'node_modules/')) or p == '.env' for p in bundle.namelist())
    print(f"Frontend source ZIP: {output.stat().st_size:,} bytes")
else:
    print("Prepared independent frontend project; generate its lockfile and verify before packaging.")
