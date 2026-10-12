"""Make the illustrated handbook readable as a single offline HTML file."""

import base64
import json
import mimetypes
import re
import shutil
from pathlib import Path

root = Path(__file__).resolve().parent.parent
public = root / "public"
source = (public / "handbook.html").read_text()


def data_url(relative):
    path = public / relative
    mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


names = sorted(set(re.findall(r'data-screen="([^"]+)"', source)))
screens = {
    f"{edition}-{name}": data_url(f"guide/{edition}-{name}.png")
    for edition in ("a", "b")
    for name in names
}
source, count = re.subn(
    r'<link rel="stylesheet" href="\./guide/handbook\.css"\s*/>',
    lambda _: "<style>" + (public / "guide/handbook.css").read_text() + "</style>",
    source,
)
assert count == 1, "Expected one handbook stylesheet"
source, count = re.subn(
    r'"\./guide/"\s*\+ theme \+ "-" \+ img\.dataset\.screen \+ "\.png"',
    'OFFLINE_SCREENS[theme + "-" + img.dataset.screen]',
    source,
)
assert count == 1, "Expected the screenshot theme switch"
source = source.replace(
    "<script>",
    "<script>\nconst OFFLINE_SCREENS=" + json.dumps(screens) + ";\n",
    1,
)
source = re.sub(
    r'\b(src|href)="\./((?:guide|images)/[^\"]+)"',
    lambda match: match[1] + '="' + data_url(match[2]) + '"',
    source,
)
source, count = re.subn(
    r'document\.querySelector\("#back-product"\)\.href = document\.querySelector\(\s*'
    r'"#finish-product",?\s*\)\.href = theme === "a" \? "\./index\.html" : "\./notebook\.html";',
    'document.querySelector("#back-product").href = '
    'document.querySelector("#finish-product").href = "#quick";',
    source,
)
assert count == 1, "Expected the two product return links"
source = source.replace('href="./index.html"', 'href="#quick"')
source = source.replace("回到产品 ↗", "上手步骤 ↗")
source = source.replace("去拍第一张 <span>", "重看上手步骤 <span>")
source = source.replace(
    "download>", 'download="zhaozhepai-handbook-v0.6.pdf">'
)
source = source.replace(
    '本手册截图来自照着拍 v0.6 双版本。',
    '离线阅读版，自带图片，可直接双击打开。产品体验请使用 HTTPS 网址。'
    '本手册截图来自照着拍 v0.6 双版本。',
)
assert not re.search(r'(?:src|href)="\./', source), "Unembedded asset or link"
assert not re.search(r'(?:src|href)="https?://', source), "Unexpected external asset"

downloads = root / "downloads"
downloads.mkdir(exist_ok=True)
output = downloads / "zhaozhepai-handbook-offline-v0.6.html"
output.write_text(source)
shutil.copyfile(
    public / "guide/照着拍-产品手册-v0.6.pdf",
    downloads / "zhaozhepai-handbook-v0.6.pdf",
)
print(f"Created {output.name}: {output.stat().st_size:,} bytes")
print(f"Embedded {len(screens)} screenshots, images, styles and full PDF.")
