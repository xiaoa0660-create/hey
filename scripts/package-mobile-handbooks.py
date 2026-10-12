"""Embed each mobile guide as an independent offline reading file."""
from pathlib import Path
import base64,mimetypes,re
root=Path(__file__).resolve().parent.parent
public=root/'public'
def inline(relative):
 p=public/relative
 return 'data:'+str(mimetypes.guess_type(p.name)[0] or 'application/octet-stream')+';base64,'+base64.b64encode(p.read_bytes()).decode()
for slug in ['magazine','notebook']:
 source=(public/f'{slug}-guide.html').read_text()
 source,count=re.subn(r'<link rel="stylesheet" href="\./guide/mobile-v0\.7\.css"\s*/>',lambda _: '<style>'+(public/'guide/mobile-v0.7.css').read_text()+'</style>',source)
 assert count==1
 source=re.sub(r'\b(src|href|data-full)="\./((?:guide|images)/[^\"]+)"',lambda m:m[1]+'="'+inline(m[2])+'"',source)
 source=re.sub(r'(class="[^"]*product-link[^"]*" href=")\./(?:index|notebook)\.html"',r'\1#quick"',source)
 source=source.replace('回产品 ↗','上手步骤 ↗').replace('回到产品，开始拍','重看上手步骤').replace('>回到产品<','>上手步骤<')
 assert not re.search(r'(?:src|href|data-full)="\./',source)
 output=root/'downloads'/f'{slug}-handbook-offline-v0.7.html'
 output.write_text(source)
 print(output.name,output.stat().st_size,'bytes; self-contained images, style and PDF')
