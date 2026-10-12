"""Build independently reviewable, illustrated specifications for both editions."""
from pathlib import Path
from html import escape
import shutil

root = Path(__file__).resolve().parent.parent
spec = (root / 'docs/review-v1.6-spec.md').read_text()

for slug, name, prefix, accent, soft, paper, style in [
    ('magazine','A · 杂志版','a','#273f35','#e9edde','#f7f5ef','杂志版以奶油白、墨绿、衬线标题和留白组织信息。按钮表达动作，正文对比度优先于装饰；单列手机结构不变。'),
    ('notebook','B · 笔记版','b','#f04457','#fff0f2','#ffffff','笔记版以白底、红色强调、无衬线标题和双列参考卡组织信息。上传与拍法同样前置，主操作位置与另一版一致。'),
]:
    folder = root / 'docs/editions' / slug
    figures = folder / 'figures'
    figures.mkdir(parents=True,exist_ok=True)
    shared = root / 'public/review' / slug
    shared.mkdir(parents=True,exist_ok=True)
    def text(x,y,value,size=20,color='#252b26',weight='400'):
        return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}">{escape(value)}</text>'
    def box(x,y,w,h,title,lines=(),number=None):
        s=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{soft}" stroke="{accent}" stroke-width="1.5"/>'
        if number:
            s+=f'<circle cx="{x+26}" cy="{y+27}" r="14" fill="{accent}"/>'+text(x+19,y+33,str(number),16,'white','600')
        s+=text(x+(50 if number else 20),y+35,title,22,accent,'600')
        for i,line in enumerate(lines):s+=text(x+20,y+67+i*28,line,18)
        return s
    def arrow(x1,y1,x2,y2,label=''):
        s=f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{accent}" stroke-width="2" fill="none" marker-end="url(#arrow)"/>'
        if label:s+=text((x1+x2)/2+10,(y1+y2)/2-9,label,16,accent)
        return s
    def save(filename,title,subtitle,body,height=1000,width=900):
        svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{escape(title)}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="{accent}"/></marker></defs><rect width="100%" height="100%" fill="{paper}"/><g font-family="Noto Sans CJK SC,Microsoft YaHei,sans-serif">'+text(40,48,name+' / DESIGN SPECIFICATION',16,accent)+text(40,99,title,34,accent,'600')+text(40,137,subtitle,18)+body+'</g></svg>'
        (figures/filename).write_text(svg)
        (shared/filename).write_text(svg)
    save('cover.svg','照着拍｜立项与研发评审','从用户问题到交互规则，再到模型合同与验收标准',box(40,185,820,118,'手机拍摄，两个人共同完成',('本期：明确输入入口、双方拍法、相机与重拍、可找回的个人参考',)) + box(40,330,820,110,'评审依据',('真实体验反馈标注证据范围；生成图表达设计；截图验证实现',))+text(40,502,'PRD v1.6 · APPLICATION v0.7 · 2026.10.12',22,accent),560)
    b=''
    for x,title,lines in [(40,'拍现场风景',('先拍空景，人物稍后入画',)),(325,'导入自己的参考',('分类上传，自动进入拍法',)),(610,'选内置参考',('详情确认想借的构图与光',))]:
        b+=box(x,175,250,110,title,lines)+arrow(x+125,285,450,338)
    b+=box(215,350,470,134,'这张怎么拍',('先看人物位置示意','拿手机的人一句，镜头前的人一句'),1)
    b+=arrow(450,484,450,535)+box(215,550,470,110,'首次交接 → 主动开相机',('高级编辑可选；不挡住第一张'),2)
    b+=arrow(450,660,450,711)+box(215,725,470,115,'拍摄结果',('导出 / 明确保存 / 只改一点再拍'),3)
    b+=f'<path d="M685 783H825V603H688" fill="none" stroke="{accent}" stroke-width="2" marker-end="url(#arrow)"/>'+text(711,697,'直接重拍',16,accent)
    b+=text(40,910,'收藏保存参考偏好；我的拍摄保存拍法与一张结果；两者不混用。',20,accent)
    save('journey.svg','从一张照片到第一张成片','页面少跳转，每次只强调一个下一步',b,960)
    b=f'<rect x="40" y="165" width="390" height="730" rx="24" fill="{paper}" stroke="{accent}" stroke-width="2"/>'
    b+=text(66,212,'找参考',28,accent,'600')+text(65,249,'全部  日常人像  同款打卡  画作复刻',18)
    b+=box(65,273,340,118,'上传想复刻的画作',('相册选图，直接看拍法',),1)
    b+=text(65,429,'全部参考    我的参考 · 1',20,accent)+text(65,475,'全部场景                         1 个拍法',16)
    b+=f'<rect x="65" y="503" width="153" height="195" rx="12" fill="{soft}"/><rect x="236" y="503" width="169" height="195" rx="12" fill="{soft}"/>'
    b+=text(80,594,'参考图',20,accent)+text(258,594,'个人参考',20,accent)+text(65,735,'名称                         管理  ♡',18)
    b+=text(65,857,'开始拍    找参考    收藏    我的拍摄',18,accent)
    b+=box(475,175,380,120,'U1 · 输入在分类旁',('每类都可上传；按钮明确输入内容','不要求用户返回首页找上传'))
    b+=box(475,325,380,120,'U2 · 来源与分类可组合',('个人参考属于对应类别','不新建第五个底部 TAB'))
    b+=box(475,475,380,120,'U3 · 选图后直接 P5',('保存参考失败仍能继续拍','成功才提示已加入个人参考'))
    b+=box(475,625,380,150,'U4 · 管理可找回',('改名 / 改分类 / 删除确认','改分类后切到新类别','删除参考不删除已保存拍摄'))
    save('upload.svg','上传入口与个人参考管理','交互线框规定位置与行为，图中不是最终界面截图',b,950)
    b=''
    for x,title,px,py,pw,ph in [(40,'多留风景',190,455,38,91),(330,'人景平衡',475,407,56,140),(620,'突出人物',730,298,93,248)]:
        b+=text(x,210,title,25,accent,'600')+f'<rect x="{x}" y="235" width="240" height="335" rx="14" fill="#d7e4e4"/><path d="M{x} 360L{x+80} 290L{x+140} 330L{x+200} 285L{x+240} 360" fill="#a8bbbb"/><path d="M{x} 380H{x+240}" stroke="#6c8d8d"/><rect x="{x}" y="480" width="240" height="90" fill="#ded8c9"/><rect x="{px}" y="{py}" width="{pw}" height="{ph}" fill="none" stroke="{accent}" stroke-width="2" stroke-dasharray="6 5"/>'
        b+=f'<circle cx="{px+pw/2}" cy="{py+ph*.14}" r="{pw*.17}" fill="{accent}"/><path d="M{px+pw/2} {py+ph*.29}V{py+ph*.65}M{px+pw*.25} {py+ph*.44}H{px+pw*.75}M{px+pw/2} {py+ph*.65}L{px+pw*.3} {py+ph*.95}M{px+pw/2} {py+ph*.65}L{px+pw*.7} {py+ph*.95}" stroke="{accent}" stroke-width="{max(2,pw*.08)}" fill="none"/>'
    b+=box(40,620,820,130,'框是画面建议，不是地面导航',('x/y/width/height 用 0–1 坐标表示；三种人物高度依次增加','拿手机的人调整取景；镜头前的人先确认真实平坦站位'))
    b+=text(40,800,'不可由单图编造精确米数、可走路径或真实光源位置。',22,accent)
    save('placement.svg','三种人景比例，三个可比较的选择','图中为设计示意；不是模型检测出的真实人物',b,860)
    b=''
    xs=[125,340,555,775]
    for x,title in zip(xs,['用户','手机前端','Node 后端','视觉模型']):
        b+=box(x-85,172,170,65,title)+f'<path d="M{x} 240V760" stroke="#b5b9b1" stroke-dasharray="6 6"/>'
    for x1,x2,y,label in [(125,340,290,'选图，点 AI'),(340,555,355,'M1 health，不传图'),(125,340,420,'M2 明确同意'),(340,555,475,'POST scene / interpret'),(555,775,530,'图片＋约束，20秒上限'),(775,555,585,'结构化 JSON'),(555,340,640,'M3 schema＋语义校验'),(125,340,710,'M4 选择并应用方案')]:
        b+=arrow(x1,y,x2,y)+text(min(x1,x2)+12,y-12,label,17,accent)
    b+=box(40,795,820,118,'M5 · 开相机后，实时模型在手机本地',('相机帧 → 人物与关键点 → 几何规则 → 一句提示；不持续调用大模型',))
    b+=text(40,957,'失败或未配置：保留原图 → 手动拍法；取消：旧结果不能覆盖新输入。',19,accent)
    save('model-sequence.svg','模型调用时序与边界','授权、输入、验证、用户确认分别负责；一次调用解决一个问题',b,1010)
    b=f'<rect x="40" y="175" width="390" height="740" rx="24" fill="#1b2722"/>'
    b+=text(65,218,'返回拍法                     一起拍',18,'white')+f'<rect x="90" y="245" width="290" height="300" rx="12" fill="#668078"/><rect x="190" y="292" width="130" height="213" stroke="#e4f2b4" stroke-width="2" stroke-dasharray="6 5" fill="none"/>'+text(126,408,'实际相机画面',22,'white')
    b+=text(65,586,'拿手机的人 · 你来调整',17,'#dce7b7')+text(65,626,'人物在画面里再靠右一点',23,'white','600')+text(65,685,'镜头前的人 · 保持站位，先看同伴',18,'white')+text(65,735,'用光建议 →              辅助线显隐',16,'#c2cbbc')
    b+=f'<circle cx="234" cy="810" r="34" fill="white" stroke="#dce7b7" stroke-width="4"/>'+text(120,880,'随时按快门，不必等完美',17,'#c2cbbc')
    for y,title,lines in [(175,'C1 · 视觉目标',('位置、大小与参考小窗',)),(340,'C2 · 先构图，再动作',('优先提示拿手机的人调整',)),(505,'C3 · 双方知道各做什么',('被拍者一句静态／动作提示',)),(670,'C4 / C5 · 简单且可控',('快门首屏可达，用光次级展开',))]:b+=box(475,y,380,118,title,lines)
    save('camera.svg','拍摄时的角色分工与信息优先级','线框指导实时页面布局；相机照片与辅助图层分别保存',b,970)
    md=spec.replace('{{NAME}}',name).replace('{{PREFIX}}',prefix).replace('{{SLUG}}',slug).replace('{{STYLE}}',style)
    md=md.replace('## 1. 用户问题与证据','![本版评审封面](figures/cover.svg)\n\n## 1. 用户问题与证据')
    (folder/'prd.md').write_text(md)
    (folder/'README.md').write_text(f'''# 照着拍 · {name}\n\n本版手机产品、评审文档和用户手册独立交付。应用 v0.7.0 / PRD v1.6。\n\n![本版封面](figures/cover.svg)\n\n- [立项与研发评审 PRD](prd.md)：真实反馈与证据范围、设计图、交互状态、模型协议和验收门槛。\n- [用户手册 PDF](../../../downloads/{slug}-handbook-v0.7.pdf?raw=true)：下载后用浏览器或系统 PDF 阅读器打开。\n- [离线图文手册](../../../downloads/{slug}-handbook-offline-v0.7.html)：下载后可单独阅读。\n- [本版手机体验包](../../../downloads/zhaozhepai-{slug}-v0.7.zip)：整个文件夹部署后体验。\n- [双版本截图](../../ui-preview/mobile-v0.7/README.md) · [交付步骤](../../delivery-v0.7.md) · [验收记录](../../acceptance-v1.6.md)\n\nGitHub 是私有仓库。请在浏览器登录有权限的账号；下载文件可用文件页右上角的 Download raw file。聊天里的本地文件预览不能可靠阅读 PDF。产品相机从 HTTPS 网址使用，手册文件可下载阅读。\n''')
print('Generated two PRDs and 12 edition-specific SVG design figures.')
