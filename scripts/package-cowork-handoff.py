"""Package review material for another coding tool, without credentials or binaries."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "zhaozhepai-cowork-handoff"
OUT = ROOT / "downloads/zhaozhepai-cowork-handoff-v0.7.zip"
files = {ROOT / "docs/cowork-handoff.md", ROOT / "docs/netlify-ark.md", ROOT / "docs/render-ark.md"}
for edition in ["magazine", "notebook"]:
    base = ROOT / f"docs/editions/{edition}"
    files.add(base / "prd.md")
    files.update((base / "figures").glob("*.svg"))
for style in ["a", "b"]:
    for screen in ["home", "guide", "scene", "scene-plan", "discover", "upload", "plan", "light", "handoff", "camera", "result", "reference-manage", "mine"]:
        files.add(ROOT / f"docs/ui-preview/mobile-v0.7/{style}-{screen}.png")
for path in [
    "public/images/review/scenarios.png", "server/schema.ts", "src/product/scene.ts",
    "docs/image-sources-v0.7.md", "docs/image-sources-v0.6.md",
    "downloads/magazine-handbook-v0.7.pdf", "downloads/notebook-handbook-v0.7.pdf",
]:
    files.add(ROOT / path)
readme = """# 照着拍 cowork 交接包

先读取 docs/cowork-handoff.md，末尾有可直接粘贴的任务提示词。
然后读取两版 PRD、交互设计图及关键手机截图。downloads 中是两份对应风格的用户手册。
本包是重建/评审材料，包含模型业务协议；不是可运行源码，也不包含 API Key。
完整源码在私有仓库 https://github.com/xiaoa0660-create/hey/tree/preview/mobile-v07-20261012 。读取源码需要授权，不能读取时先按本包重建并说明差异。
截图是现有实现参考；相机画面为受控测试视频，不能充当实体手机测试结果。
PRD 末尾少数 GitHub 外部链接需要有仓库访问权限。
"""
screens = "# 本包关键手机截图\n\n" + "\n".join(
    f"- [{p.name}]({p.name})" for p in sorted(files) if p.parent.name == "mobile-v0.7"
) + "\n"
manifest = {}
with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
    bundle.writestr(f"{PREFIX}/README.md", readme)
    bundle.writestr(f"{PREFIX}/docs/ui-preview/mobile-v0.7/README.md", screens)
    for path in sorted(files):
        relative = path.relative_to(ROOT).as_posix()
        data = path.read_bytes()
        if path.name == "prd.md":
            text = data.decode()
            for edition in ["magazine", "notebook"]:
                for original in [f"../../../public/{edition}-guide.html", f"../../../downloads/zhaozhepai-{edition}-v0.7.zip"]:
                    text = text.replace(original, "https://github.com/xiaoa0660-create/hey/blob/preview/mobile-v07-20261012/" + original.replace("../../../", ""))
            data = text.encode()
        bundle.writestr(f"{PREFIX}/{relative}", data)
        manifest[relative] = hashlib.sha256(data).hexdigest()
    bundle.writestr(f"{PREFIX}/manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
with zipfile.ZipFile(OUT) as bundle:
    assert bundle.testzip() is None
    assert not any(p.endswith('/.env') or p.startswith('/') for p in bundle.namelist())
    for path, checksum in manifest.items():
        assert hashlib.sha256(bundle.read(f"{PREFIX}/{path}")).hexdigest() == checksum
print(f"{OUT.name}: {OUT.stat().st_size:,} bytes, {len(manifest)} verified files, no credentials")
