# -*- coding: utf-8 -*-
"""生成《人工智能基础与应用》实验报告（青养项目）"""
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn

OUT = r"C:\Users\小新AIR\Documents\qingyunapp\《人工智能基础与应用》实验报告-青养.docx"
E2E = r"C:\Users\小新AIR\Documents\qingyunapp\scripts\e2e"

doc = Document()

# 页面与默认字体
for section in doc.sections:
    section.top_margin = Cm(2.54)
    section.bottom_margin = Cm(2.54)
    section.left_margin = Cm(2.4)
    section.right_margin = Cm(2.4)

def set_ea(run, name):
    run.font.name = name
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn('w:eastAsia'), name)

def para(text, font='宋体', size=12, bold=False, align=None, indent=True,
         spacing=1.5, color=None, underline=False, space_after=6):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.line_spacing = spacing
    pf.space_after = Pt(space_after)
    if indent:
        pf.first_line_indent = Pt(size * 2)
    if align is not None:
        p.alignment = align
    r = p.add_run(text)
    r.font.size = Pt(size)
    r.font.bold = bold
    if color:
        r.font.color.rgb = RGBColor(*color)
    r.font.underline = underline
    set_ea(r, font)
    return p

def heading(text):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(14)
    pf.space_after = Pt(8)
    pf.line_spacing = 1.5
    r = p.add_run(text)
    r.font.size = Pt(14)
    r.font.bold = True
    set_ea(r, '黑体')
    return p

def fig(path, caption, width_cm=13.0):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(8)
    p.add_run().add_picture(path, width=Cm(width_cm))
    c = doc.add_paragraph()
    c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    c.paragraph_format.space_after = Pt(10)
    r = c.add_run(caption)
    r.font.size = Pt(10.5)
    r.font.color.rgb = RGBColor(0x60, 0x60, 0x60)
    set_ea(r, '宋体')

def page_break():
    doc.add_page_break()

# ============ 封面 ============
para('', indent=False, space_after=0)
para('《人工智能基础与应用》', font='黑体', size=24, align=WD_ALIGN_PARAGRAPH.CENTER, indent=False, spacing=1.5, space_after=10)
para('实 验 报 告', font='黑体', size=24, align=WD_ALIGN_PARAGRAPH.CENTER, indent=False, spacing=1.5, space_after=30)

def cover_field(label, value=None):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 2.0
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.left_indent = Cm(2.2)
    r1 = p.add_run(label)
    r1.font.size = Pt(16)
    set_ea(r1, '黑体')
    fill = value if value is not None else '            ' * 2 + '      '
    r2 = p.add_run(fill)
    r2.font.size = Pt(16)
    r2.font.underline = True
    set_ea(r2, '黑体')

cover_field('实验名称：', '基于 AI 辅助开发的食疗健康 Web 应用「青养」')
cover_field('学    号：')
cover_field('姓    名：')
cover_field('班    级：')
cover_field('成果链接：', 'https://zhaoqingyun122.github.io/qingyang/')

page_break()

# ============ 一、项目概述 ============
heading('一、项目概述')
para('本作品是面向大众的食疗健康生活 Web 应用「青养」，也是本人将“人工智能 × 食品（食疗）”交叉方向落实到课程作业中的尝试。作品采用纯前端、零第三方框架的原生技术栈（HTML + CSS + ES Module 原生 JavaScript），不依赖任何网络请求，全部数据保存在浏览器本地数据库（IndexedDB）中，实现了真正“离线、私密、随身可用”的健康知识工具。')
para('选题背景与原因：近年来亚健康人群持续增多，“脾胃虚弱”“湿气重”“容易上火”等中式健康表述频繁出现在日常生活中，大众对“吃得对、调得好”的需求旺盛，但网络上的食疗内容鱼龙混杂、广告软文泛滥，信息来源与权威性无从判断。本项目希望把分散的中医食疗常识整理成结构化、可检索、彼此交叉关联的知识体系，结合 AI 辅助的开发效率，做出一款不夸大、有依据、可离线使用的健康助手。')
para('目标用户与使用场景：关注日常调理与养生的普通成年人、学生群体，以及帮父母查询信息的子女。主要使用场景包括：日常“吃什么更合适”的知识查询；身体小状况自助自查并获取对应的药膳、泡茶建议；购买药食同源食材前的鉴别比对；在单机社区里交流食疗心得。')
para('作品价值体现在三方面：一是知识价值，将 40 种药食同源物质、12 种常见身体状况、42 道药膳、12 款泡茶饮、就医导航建议整理为互相交叉引用的结构化知识网；二是隐私价值，所有用户数据只保存在本机浏览器，不上传任何服务器；三是工程价值，通过 585 项自测与 60 项浏览器端到端测试保障质量，并以 Git 全量版本管理、GitHub Pages 公开部署，做到了一个可交付的完整产品。')

# ============ 二、项目目标与方案设计 ============
heading('二、项目目标与方案设计')
para('项目目标：交付一个功能完整、体验流畅、可离线使用的食疗健康单机应用，并完成公开部署。核心目标拆分为四大模块：① 物质鉴别——为 40 种药食同源物质提供百科查询与“拍照 / 特征”两种鉴别方式；② 身体状况→药膳——覆盖 12 种身体状况，自动匹配药膳、泡茶饮，并给出就医导航建议；③ 单机社区——支持发帖、评论、点赞、收藏的轻量交流圈；④ 数据与设置——IndexedDB 持久化、自动保存、手动保存、备份与恢复。')
para('模块结构（三层架构）：数据层（js/data/）包含 substances（40 种物质）、conditions（12 种状况）、recipes（42 道药膳）、teas（12 款泡茶饮）、medical（就医导航）五套结构化数据，通过物质—药膳—状况交叉引用形成知识网（共 157 处引用）。基础层（js/lib/）包含 IndexedDB 数据库封装（含 localStorage 降级）、全局状态 store（每次操作即时落盘）、检索、备份、分享与拍照识别等能力。视图层（js/views/）提供首页（物质百科与鉴别）、身体状况（自查→药膳/茶饮/就医导航）、社区、数据与设置四个页面，配合 hash 路由实现单页应用跳转。')
para('关键技术原理：一是纯浏览器端单页应用，无服务端、无构建工具，原生 ES Module 模块化，天然适合静态托管；二是拍照鉴别算法，通过 Canvas 提取照片主色并与 40 种物质色板比对打分，同时支持“形状、颜色、质地、气味、断面”五维特征的多选匹配，给出候选物质与匹配度排序；三是身体状况匹配，将症状关键词做同义词归一后与 12 种状况匹配，按命中数与权重排序，再联动推荐关联药膳与茶饮；四是内容安全口径设计，所有剂量标注“参考量”、注明“不替代医生诊断”，孕期与慢性病人群均提示咨询医师。')
para('界面风格与操作流程：整体采用护眼绿色系、卡片化布局与全中文界面；典型流程为：首页搜索或浏览物质→详情页查看药典条目与鉴别要点；身体状况页勾选自查→获得药膳与茶饮清单及就医提醒；社区页发布交流；数据页查看统计并管理备份。')

# ============ 三、制作工具与实施过程 ============
heading('三、制作工具与实施过程')
para('AI 工具与模型：开发全程使用 DeepSeek 大模型。其一，使用 DeepSeek 对话能力进行代码生成、方案讨论与调试答疑；其二，使用 DeepSeek Harness 编程代理在本机执行命令、运行测试与 Git 操作，形成“我定需求与验收标准、AI 负责落地实现、我再逐项验收”的人机协作闭环。')
para('其他制作工具：Node.js 作为本地静态服务器与测试运行环境；Git 与 GitHub 用于版本管理与 Pages 部署；Microsoft Edge 无头模式作为自动化端到端测试浏览器；VS Code 用于源码审阅与比对。')
para('实施步骤：① 需求分析与 PRD 编写——明确四大模块边界、内容规模与验收标准，形成 10 个开发阶段的开发计划；② 内容数据建设——整理 40 种物质、12 种状况、42 道药膳及交叉引用，逐条审核医学表述与安全口径；③ 分阶段迭代开发——按计划依次实现数据层、存储层、首页、状况页、社区、数据页，每完成一个阶段即编写并运行对应的有效测试，不允许以删减或降低标准换取通过；④ 测试与修复——建立 585 项自测与 60 项端到端测试，全量回归通过后再进入下一阶段；⑤ Git 版本管理——每完成一个功能点创建一次提交，8 次提交完整记录演进过程；⑥ 部署——将静态发布内容推送至 GitHub 仓库并启用 GitHub Pages，获得公开访问链接。')
para('本人承担的工作：需求定义与验收标准、界面文案的编写与校对（含全部中医安全口径审核）、功能验收与体验走查、GitHub 仓库与部署管理。AI 辅助完成的工作：绝大部分代码实现（视图、数据、存储、鉴别与匹配算法）、测试用例编写、Bug 定位与修复、技术文档生成、环境配置与命令执行。')

# ============ 四、作品成果展示 ============
heading('四、作品成果展示')
para('成果一：可运行、可公开访问的 Web 应用。应用由本地命令一键启动，同时已部署至 GitHub Pages：页面地址 https://zhaoqingyun122.github.io/qingyang/ ，仓库地址 https://github.com/zhaoqingyun122/qingyang 。首页效果见图 1。')
fig(E2E + r"\01-home.png", '图 1  青养首页（物质总数、搜索框、分类入口与“身体小状况自查”快捷入口）')
para('成果二：结构化食疗知识库。包含 40 种药食同源物质、12 种身体状况、42 道药膳、12 款泡茶饮与 12 组就医导航建议。物质详情页展示正名、别名、性味归经、功效、用量、禁忌与五维外形鉴别要点（图 2）。')
fig(E2E + r"\03-substance.png", '图 2  物质详情页（山药：药典条目、成人/青少年参考量、外形鉴别特征）')
para('成果三：身体状况 → 药膳 / 泡茶 / 就医导航的联动闭环。用户自述症状后可匹配到最可能状况，获得“能做的药膳”（成人/青少年分栏显示参考量，见图 3）、“适合的泡茶”（配料与双份量，见图 4）以及“就医导航”（建议科室、就医警示信号与就诊前准备，见图 5）。')
fig(E2E + r"\06-recipe.png", '图 3  药膳详情（成人/青少年份量分栏与用料做法）')
fig(E2E + r"\13-tea.png", '图 4  状况详情中的“适合的泡茶”区块（12 款茶饮覆盖 12 种状况）')
fig(E2E + r"\12-medical.png", '图 5  就医导航区块（建议科室、尽快就医信号、就诊准备与通用警示）')
para('成果四：数据与设置。数据页提供统计看板、14 天发帖趋势、内容管理与“立即保存”按钮（图 6），所有数据经 IndexedDB 自动持久化，刷新、关闭、重启均不丢失，并支持备份导出与恢复。')
fig(E2E + r"\11-data.png", '图 6  数据与设置页（统计卡、备份/恢复与手动保存）')
para('成果五：单机社区与鉴别闭环。社区支持发帖、评论、点赞、收藏与访客身份切换；鉴别支持拍照（自动主色比对）与特征逐项选择两种方式，均给出候选物质，完整链路全部通过自动化测试。')

# ============ 五、项目总结与学习体会 ============
heading('五、项目总结与学习体会')
para('目标完成情况：四大模块全部按计划交付。最终验收结果为：数据与逻辑自测 585 项全部通过、浏览器端到端测试 60 项全部通过，覆盖首页、搜索、详情、状况匹配、药膳、泡茶、就医导航、社区、持久化、备份恢复与鉴别全链路；代码经 8 次 Git 提交完整管理，并成功部署至 GitHub Pages 公开访问。项目目标全部达成。',)
para('开发中遇到的主要问题与解决：第一，数据持久化的可靠性问题——用户数据要跨刷新与重启不丢失，最初考虑 localStorage，后改用 IndexedDB 事务化写入并保留降级，同时新增“立即保存”按钮与保存时间反馈，消除用户对“是否保存成功”的疑虑。第二，自动化测试的准确性问题——浏览器对 ES Module 有缓存，修改代码后测试仍可能加载旧版本，导致误判，最终在端到端测试前置一次整页强制刷新解决。第三，环境与工程问题——Windows 批处理启动脚本因编码（UTF-8+LF）导致 cmd 解析错乱，通过改为 GBK+CRLF 编码并加入多路径自动探测修复；Git 的 MSYS 组件在受限环境无法运行，通过放宽权限并改用系统 SSH 完成认证与推送。第四，需求取舍问题——原计划的“实物图”素材因当前网络受限无法获取，经评估放弃该需求并回退代码，保证交付内容完整可用，这本身就是一次典型的“人工判断与取舍”。第五，专业内容的安全性问题——AI 生成的剂量与禁忌存在幻觉风险，所有医学表述均经人工逐条审核，统一补充“不替代医生诊断”“孕/慢性病人群咨询医师”等口径，并将这些口径写入测试断言，防止后续误删。')
para('对 AI 能力与局限的认识：本次开发约九成代码与全部测试由 AI 生成，AI 在编码速度、测试编写、Bug 定位与文档产出上体现出远超人工的效率，尤其在“重复性工程劳动”上几乎可无限复用。但 AI 的局限同样深刻：其一，专业知识易产生“自信的幻觉”，医学表述必须人工复核；其二，AI 不掌握产品的整体目标与审美取向，需求不明时容易做出方向性偏差，需要人给出清晰边界；其三，遇到环境级故障（网络、编码、沙箱权限）时，AI 能定位但最终取舍仍依赖人的决策。我的体会是：AI 是效率放大器而非替代者，人机合理分工是“人定方向、定标准、定取舍，AI 负责执行与迭代”。')
para('学习体会：从“想要一个手机 App”到“交付一个可发布的产品”，这门课让我完整体验了需求分析、数据建设、分层开发、自动化测试、版本管理与部署的工程全流程。我学会了用测试说话——每个功能点先用测试定义再实现，让“完成”有客观依据；学会了拆分与节奏——把大目标拆成 10 个可验收的阶段，每个阶段小步快跑；更学会了如何与 AI 协作——会提问、会给标准、会验收，才能把 AI 用成真正的生产力工具。这次实验让我真切体会到“AI 不是替代思考，而是放大思考”的道理。')

# ============ 补充材料：AI 协作与迭代改进 ============
heading('补充材料：AI 协作与迭代改进')
para('本部分提炼五轮关键迭代（完整交互记录作为附件另行提交）。每轮按“发现的问题 → 向 AI 提出的要求 → AI 的输出 → 本人判断与取舍 → 修改后的效果”说明。')
para('迭代一（产品定义）：发现只有模糊想法、没有完整需求；向 AI 提出“为四个模块写出完整 PRD 与 10 阶段开发计划”。AI 输出包含项目背景、功能范围、数据规模与验收标准的 PRD.md 与 DEVPLAN.md。本人逐条确认范围、补充验收标准与医学安全口径后采纳，开发自此有据可依。')
para('迭代二（分阶段开发与测试）：担心一次性开发不可控；要求“按 10 个阶段开发，每完成一个阶段必须添加并运行有效的测试，不允许删除或降低标准通过”。AI 逐阶段实现并配套测试，本人每阶段现场验收、不合格即退回重做。效果：最终 585 项自测与 60 项端到端测试全绿，项目质量可控。')
para('迭代三（体验调整）：首版体验存在 7 处不足（如搜索结果命中原因展示、剂量双档展示、社区交互细节等）；要求“落地全部 7 条调整建议并补测试”。AI 全部实现并新增断言；本人逐条点击验证后确认。效果：交互细节显著完善。')
para('迭代四（需求新增与取舍）：用户提出四项改进（中医问诊模块、物质实物图、状况泡茶、手动保存按钮）；要求“每次只解决一个，逐个完成测试并各自提交”。AI 完成了就医导航（因离线约束将线上问诊调整为本地就医导航，经用户确认）、12 款泡茶饮与手动保存按钮，各自提交并测试通过；实物图因网络无法获取素材，本人判断后与用户确认放弃并回退代码。效果：三项新功能上线、一项需求明确否决，范围可控。')
para('迭代五（部署发布）：需要将作品公开；提出“检查构建命令、推送 GitHub 仓库并配置 GitHub Pages”。AI 完成环境诊断（识别纯静态项目无需构建）、SSH 密钥生成与公钥配置指引、main 与 gh-pages 分支推送；本人提供账号与在网页完成公钥添加。效果：仓库 https://github.com/zhaoqingyun122/qingyang 与页面 https://zhaoqingyun122.github.io/qingyang/ 可访问，完成交付闭环。')
para('通过这五轮迭代，本人实践了“问题-提问-输出-判断-验证”的完整 AI 协作模式，也印证了：AI 的产出质量与提问质量直接相关，而最终的产品判断权始终应掌握在开发者手中。')

doc.save(OUT)
print("saved:", OUT)