"""Build one uploadable A/B folder from Vite output, preserving the v0.4 ZIP."""

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json
import re

root = Path(__file__).resolve().parent.parent
dist = root / 'dist'
required = ['index.html', 'notebook.html', 'compare.html', 'models/pose_landmarker_full.task',
            'vision/pose-worker.js', 'vision/wasm/vision_wasm_internal.wasm']
for name in required:
    if not (dist / name).is_file():
        raise SystemExit(f'Missing dist/{name}; run npm run build first.')

version = json.loads((root / 'package.json').read_text())['version']
short = '.'.join(version.split('.')[:2])
output = root / f'downloads/zhaozhepai-comparison-v{short}.zip'
payload = {}
for path in sorted(dist.rglob('*')):
    if not path.is_file():
        continue
    if path.name.startswith('.env') or path.suffix == '.map':
        raise SystemExit(f'Unexpected file in static output: {path.name}')
    name = path.relative_to(dist).as_posix()
    payload['classic.html' if name == 'index.html' else name] = path.read_bytes()

comparison = payload['compare.html'].decode().replace('href="./index.html"', 'href="./classic.html"')
if 'href="./classic.html"' not in comparison:
    raise SystemExit('Comparison page is missing the classic entry.')
payload['compare.html'] = comparison.encode()
payload['index.html'] = comparison.encode()
payload['api/health'] = json.dumps({'configured': False, 'mode': 'static-comparison'}).encode()
payload['_headers'] = b'/api/health\n  Content-Type: application/json\n  Cache-Control: no-store\n/*.html\n  Cache-Control: no-cache\n'
payload['先读我.txt'] = f'''照着拍 · 双版本对比体验包 v{short}

只需要上传一次，就能比较两个作品。

1. 下载并解压这个 ZIP。
2. 打开你的 Netlify 项目，在 Deploys 页面找到手动上传区域。
   也可以到 https://app.netlify.com/drop 新建一个体验站点。
3. 把“整个解压后的文件夹”拖进去。不要只拖 index.html！
   文件夹里面应直接看到 index.html、classic.html、notebook.html、assets、images、models、vision。
4. 等页面显示 Published，打开 Netlify 生成的 https://…netlify.app 网址。
5. 首页选择 A 暖色原版 或 B 笔记新版。

A：保留你喜欢的 v0.4 暖色风格、参考图库、光影与双人拍摄流程。
B：新增双列拍法笔记、收藏、现场取舍、自然动作、最近 6 张连续拍摄、下一张只改一点、本地拍摄小卡。

电脑也以手机界面显示。可以把同一个网址发到手机，用系统浏览器打开并允许相机权限。
不要直接双击 HTML；本地文件方式不能正常运行相机、网页模块与识别模型。

小卡最多 12 张，只保存在当前浏览器。清理网站数据或换设备后不会保留，请单独导出重要原片。
每张小卡保留参考、方案和最后明确保存的一张结果；小卡照片长边最多 1600px。
最近 6 张只保留在本次会话。刷新前，把想留下的一张明确保存进小卡。
光线和空间由你选择，不会假装自动看懂现场。动作提示是脚本，由同伴转达，手动按快门。
静态体验包没有云端模型服务；本地识别、构图、拍摄和收藏可以直接体验。

排查：打开网址后加 /preview-manifest.json，应能看到 version: {version}。
如果是 404，通常是文件夹层级或上传文件不完整；重新上传直接包含 index.html 的整个文件夹。
这个包不包含个人照片、密钥或后端源码。GitHub 上的新文件不会自动更新你手动部署的 Netlify 网站。
'''.encode()

for name in ['classic.html', 'notebook.html']:
    for asset in re.findall(r'(?:src|href)="(/assets/[^\"]+)"', payload[name].decode()):
        if asset.lstrip('/') not in payload:
            raise SystemExit(f'{name} points to a missing asset: {asset}')
manifest = {name: hashlib.sha256(data).hexdigest() for name, data in payload.items()}
payload['preview-manifest.json'] = json.dumps({'version': version, 'editions': {'A': 'classic.html', 'B': 'notebook.html'}, 'files': manifest}, ensure_ascii=False, indent=2).encode()
with ZipFile(output, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in payload.items():
        archive.writestr(name, data)
with ZipFile(output) as archive:
    if archive.testzip() is not None:
        raise SystemExit('ZIP integrity check failed.')
print(f'Created {output.relative_to(root)} ({output.stat().st_size:,} bytes)')
print(f'SHA-256: {hashlib.sha256(output.read_bytes()).hexdigest()}')
