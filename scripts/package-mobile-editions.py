"""Package independent mobile editions and one comparison folder; preserve older ZIPs."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib,json,re
root=Path(__file__).resolve().parent.parent
dist=root/'dist'
required=['index.html','notebook.html','compare.html','magazine-guide.html','notebook-guide.html','guide/magazine-handbook-v0.7.pdf','guide/notebook-handbook-v0.7.pdf','guide/mobile-v0.7.css','models/pose_landmarker_full.task','vision/pose-worker.js','vision/wasm/vision_wasm_internal.wasm']
for name in required:
 assert (dist/name).is_file(),f'Missing dist/{name}; build and render manuals first.'
all_files={p.relative_to(dist).as_posix():p.read_bytes() for p in dist.rglob('*') if p.is_file()}
records=[]
for slug,label,prefix in [('magazine','A · 杂志版','a'),('notebook','B · 笔记版','b'),('comparison','A/B 手机双版本',None)]:
 payload={}
 for name,data in all_files.items():
  if name.startswith('guide/'):
   if name=='guide/mobile-v0.7.css':pass
   elif name.startswith('guide/v0.7/') and (prefix is None or Path(name).name.startswith(prefix+'-')):pass
   elif name in ['guide/magazine-handbook-v0.7.pdf','guide/notebook-handbook-v0.7.pdf'] and (prefix is None or slug in name):pass
   else:continue
  if name.startswith('review/') and prefix is not None and not name.startswith('review/'+slug+'/'):continue
  if name.endswith('.html') and name not in ['index.html','notebook.html','compare.html','handbook.html','magazine-guide.html','notebook-guide.html','legacy.html','legacy-notebook.html']:continue
  if name.endswith('.map') or Path(name).name.startswith('.env'):raise RuntimeError('Unexpected private or source file: '+name)
  payload[name]=data
 if slug=='comparison':
  payload['classic.html']=payload['index.html']
  payload['compare.html']=payload['compare.html'].decode().replace('href="./index.html"','href="./classic.html"').encode()
  payload['index.html']=payload['compare.html']
  payload['magazine-guide.html']=payload['magazine-guide.html'].decode().replace('href="./index.html"','href="./classic.html"').encode()
 else:
  own=payload['index.html' if slug=='magazine' else 'notebook.html']
  for name in ['compare.html','legacy.html','legacy-notebook.html','magazine-guide.html' if slug=='notebook' else 'notebook-guide.html']:
   payload.pop(name,None)
  if slug=='magazine':payload.pop('notebook.html',None)
  payload['index.html']=own
  payload['handbook.html']=payload[slug+'-guide.html']
 for edition in (['magazine','notebook'] if slug=='comparison' else [slug]):
  payload[edition+'-handbook-offline.html']=(root/'downloads'/f'{edition}-handbook-offline-v0.7.html').read_bytes()
 payload['api/health']=json.dumps({'configured':False,'sceneConfigured':False,'mode':'static-mobile','version':'0.7.0'}).encode()
 payload['_headers']=b'/api/health\n  Content-Type: application/json\n  Cache-Control: no-store\n/*.html\n  Cache-Control: no-cache\n/guide/*.pdf\n  Content-Type: application/pdf\n'
 payload['先读我.txt']=f'''照着拍 v0.7 · {label}

产品只设计手机拍摄体验，电脑呈现同一套手机宽度预览。

体验产品：
1. 解压后找到直接有 index.html、assets、images、models、vision、guide 的文件夹。
2. 在你的 Netlify 项目 Deploys 中上传整个文件夹；不要只上传 HTML。
3. 等 Published 后，用手机系统浏览器打开 HTTPS 体验网址并允许相机。
4. 分类上传在「找参考」；图片归到当前类别，之后从「我的参考」找回与管理。

阅读手册：
网页点「怎么用」，会进入对应版本手册。
无需部署时，可直接打开本包里的 *-handbook-offline.html，或 guide 中的 PDF。
每份手册10页，包含清晰实际界面；手册下载与产品拍摄是两种打开方式。

个人参考最多24张，拍摄记录最多12条，均只在当前浏览器。最近6张只在会话中。
重要原片请导出。同款地点尚未核实；内置日常图与教学图注明来源。
AI 风景／参考接口在仓库实现，本静态包尚未配置云端视觉服务。
手动构图、端侧人物检测、光影、相机、重拍、保存与导出可以体验。

排查部署：在网址后加 /preview-manifest.json，应看到 version: 0.7.0。
GitHub 文件更新不会自动更新手动部署的站点。读 PRD 与代码请打开本版 GitHub 交付目录。
'''.encode()
 for name in ['index.html','notebook.html','classic.html','legacy.html','legacy-notebook.html']:
  if name not in payload:continue
  for asset in re.findall(r'(?:src|href)="(/assets/[^\"]+)"',payload[name].decode()):assert asset[1:] in payload,(name,asset)
 for edition in (['magazine','notebook'] if slug=='comparison' else [slug]):
  for asset in re.findall(r'(?:src|href|data-full)="\./((?:guide|images)/[^\"]+)"',payload[edition+'-guide.html'].decode()):assert asset in payload,(edition,asset)
 checksums={name:hashlib.sha256(data).hexdigest() for name,data in payload.items()}
 payload['preview-manifest.json']=json.dumps({'version':'0.7.0','edition':label,'referenceCount':20,'personalReferenceLimit':24,'shootingRecordLimit':12,'manualPages':10,'files':checksums},ensure_ascii=False,indent=2).encode()
 output=root/'downloads'/f'zhaozhepai-{slug}-v0.7.zip'
 with ZipFile(output,'w',ZIP_DEFLATED,compresslevel=9) as archive:
  for name,data in payload.items():archive.writestr(name,data)
 with ZipFile(output) as archive:assert archive.testzip() is None
 records.append({'edition':slug,'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'files':len(payload)})
 print(output.name,output.stat().st_size,'bytes')
(root/'artifacts/package-v0.7.json').write_text(json.dumps(records,indent=2))
