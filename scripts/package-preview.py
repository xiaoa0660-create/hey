"""Package an already-built static preview for manual hosting (Python 3)."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import hashlib
import json

root = Path(__file__).resolve().parent.parent
dist = root / "dist"
required = (
    "index.html",
    "vision/pose-worker.js",
    "vision/wasm/vision_wasm_internal.wasm",
    "vision/wasm/vision_wasm_nosimd_internal.wasm",
    "models/pose_landmarker_full.task",
    "images/city-sun.png",
)
for name in required:
    if not (dist / name).is_file():
        raise SystemExit(f"Missing dist/{name}. Run npm run build first.")

files = sorted(path for path in dist.rglob("*") if path.is_file())
for path in files:
    if path.name.startswith(".env") or path.suffix == ".map":
        raise SystemExit(f"Unexpected file in preview: {path.relative_to(dist)}")

output = root / "downloads/zhaozhepai-preview-v0.2.zip"
output.parent.mkdir(exist_ok=True)
folder = "zhaozhepai-preview"
manifest = {}
with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        relative = path.relative_to(dist).as_posix()
        archive.write(path, f"{folder}/{relative}")
        manifest[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    # The static preview intentionally has no cloud interpretation service.
    archive.writestr(
        f"{folder}/api/health",
        json.dumps({"configured": False, "mode": "static-preview"}),
    )
    archive.writestr(
        f"{folder}/preview-manifest.json",
        json.dumps({"version": "0.2.0", "files": manifest}, indent=2),
    )
    archive.writestr(
        "先读我.txt",
        "照着拍 · 可交互体验版 v0.2\n\n"
        "1. 解压这个压缩包。\n"
        "2. 打开 https://app.netlify.com/drop ，按页面提示登录。\n"
        "3. 把解压后的 zhaozhepai-preview 文件夹整体拖入上传区域。\n"
        "   正确的文件夹里面能直接看到 index.html、images、models、vision。\n"
        "4. 等待发布完成，打开 Netlify 给出的 https://…netlify.app 地址。\n\n"
        "不要直接双击 index.html；浏览器从本地文件打开时会限制模块和模型加载。\n"
        "可以体验：选参考、导入照片、裁切、涂抹选区、人体识别、确认目标、相机指导、拍摄保存和调色。\n"
        "首次识别需要加载人体模型，请稍等。允许相机权限后才能拍摄。\n"
        "电脑无摄像头时，可把生成的网址发到自己的手机，用系统浏览器打开。\n"
        "云端深度解读尚未接入；其余本地核心流程不需要 API 密钥。\n"
        "照片和相机画面在当前浏览器处理；刷新会清空会话。\n"
        "托管后的网址可供持有链接的人访问；这个包不含你的个人照片、密钥或后端源码。\n",
    )

with ZipFile(output) as archive:
    if archive.testzip() is not None:
        raise SystemExit("ZIP integrity check failed")
print(f"Created {output.relative_to(root)} ({output.stat().st_size:,} bytes)")
print(f"SHA-256: {hashlib.sha256(output.read_bytes()).hexdigest()}")
