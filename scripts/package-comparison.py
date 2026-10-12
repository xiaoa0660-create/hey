"""Build an uploadable A/B folder with the illustrated manual; preserve older ZIPs."""

import sys, subprocess
from pathlib import Path as _Path
import json as _json
if _json.loads((_Path(__file__).resolve().parent.parent / 'package.json').read_text())['version'].startswith('0.7.'):
    subprocess.run([sys.executable, str(_Path(__file__).with_name('package-mobile-editions.py'))], check=True)
    raise SystemExit(0)

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json
import re

root = Path(__file__).resolve().parent.parent
dist = root / 'dist'
required = ['index.html', 'notebook.html', 'compare.html', 'legacy.html',
            'legacy-notebook.html', 'models/pose_landmarker_full.task',
            'vision/pose-worker.js', 'vision/wasm/vision_wasm_internal.wasm',
            'handbook.html', 'guide/handbook.css',
            'guide/照着拍-产品手册-v0.6.pdf', 'guide/a-home.png', 'guide/b-home.png']
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
payload['handbook.html'] = payload['handbook.html'].decode().replace(
    './index.html', './classic.html').encode()
payload['api/health'] = json.dumps({'configured': False, 'sceneConfigured': False,
                                   'mode': 'static-comparison'}).encode()
payload['_headers'] = b'/api/health\n  Content-Type: application/json\n  Cache-Control: no-store\n/*.html\n  Cache-Control: no-cache\n'
payload['先读我.txt'] = f'''照着拍 · 双版本对比体验包 v{short}

只需要上传一次，就能比较两个作品。

1. 下载并解压这个 ZIP。
2. 打开你的 Netlify 项目，在 Deploys 页面找到手动上传区域。
   也可以到 https://app.netlify.com/drop 新建一个体验站点。
3. 把“整个解压后的文件夹”拖进去。不要只拖 index.html！
   文件夹里面应直接看到 index.html、classic.html、notebook.html、handbook.html、assets、images、models、vision、guide。
4. 等页面显示 Published，打开 Netlify 生成的 https://…netlify.app 网址。
5. 首页选择 A 暖色版 或 B 笔记版；两个版本的功能与流程相同，可以切换对比。
6. 第一次使用，点击“第一次来？30 秒看懂怎么拍”。也可点击“怎么用”阅读图文手册。

A：延续暖色、留白与编辑感，更新清晰的导航和全部拍摄流程。
B：笔记社区风格、双列参考图，同样更新全部拍摄流程。
旧版仍保存在旧 ZIP 中；本包也保留 legacy.html 和 legacy-notebook.html 供查看。

新版共有 9 个核心页面、20 张参考图，保留光影、双人指导、连续拍摄与本地保存。
开始拍有两个入口：“拍一下眼前的风景”和“导入想照着拍的照片”。
找参考可以搜索日常人像、同款打卡、画作复刻，收藏喜欢的参考，再点“照着这张拍”。
风景照片可以自己选择人物位置；内置湖边例子是固定教学素材，不是 AI 分析结果。
同款打卡目前为两张历史摄影参考，没有核实打卡地址；不会提供未经确认的导航地点。

产品手册：部署后打开 /handbook.html。9 页 PDF 在 guide/照着拍-产品手册-v0.6.pdf。
PDF 可以直接双击阅读。产品网页请部署后使用 HTTPS 网址打开。

电脑也以手机界面显示。可以把同一个网址发到手机，用系统浏览器打开并允许相机权限。
不要直接双击 HTML；本地文件方式不能正常运行相机、网页模块与识别模型。

“我的拍摄”最多保存 12 次，只保存在当前浏览器。清理网站数据或换设备后不会保留，请单独导出重要原片。
每次保存保留参考、最新方案和一张明确选择的结果；保存照片长边最多 1600px。
最近 6 张只保留在本次会话。刷新前，把想留下的一张明确保存到“我的拍摄”。
静态体验包没有云端模型服务；AI 按钮会如实提示未开启，不会上传照片或编造分析。
本地人物识别、构图、相机、光影调整、收藏和保存可以直接体验；相机需要系统浏览器与权限。
真实风景 AI 接口已在仓库实现，需要配置视觉模型并部署后端后才可使用。

排查：打开网址后加 /preview-manifest.json，应能看到 version: {version}。
如果是 404，通常是文件夹层级或上传文件不完整；重新上传直接包含 index.html 的整个文件夹。
这个包不包含个人照片、密钥或后端源码。GitHub 上的新文件不会自动更新你手动部署的 Netlify 网站。
'''.encode()

for name in ['classic.html', 'notebook.html', 'legacy.html', 'legacy-notebook.html']:
    for asset in re.findall(r'(?:src|href)="(/assets/[^\"]+)"', payload[name].decode()):
        if asset.lstrip('/') not in payload:
            raise SystemExit(f'{name} points to a missing asset: {asset}')
handbook = payload['handbook.html'].decode()
for asset in re.findall(r'(?:src|href)="(\./(?:guide|images)/[^\"]+)"', handbook):
    if asset[2:] not in payload:
        raise SystemExit(f'Handbook points to a missing asset: {asset}')
manifest = {name: hashlib.sha256(data).hexdigest() for name, data in payload.items()}
payload['preview-manifest.json'] = json.dumps({'version': version, 'referenceCount': 20,
    'editions': {'A': 'classic.html', 'B': 'notebook.html'},
    'manual': {'html': 'handbook.html', 'pdf': 'guide/照着拍-产品手册-v0.6.pdf', 'pages': 9},
    'files': manifest}, ensure_ascii=False, indent=2).encode()
with ZipFile(output, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in payload.items():
        archive.writestr(name, data)
with ZipFile(output) as archive:
    if archive.testzip() is not None:
        raise SystemExit('ZIP integrity check failed.')
print(f'Created {output.relative_to(root)} ({output.stat().st_size:,} bytes)')
print(f'SHA-256: {hashlib.sha256(output.read_bytes()).hexdigest()}')
