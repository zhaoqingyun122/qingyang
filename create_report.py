# -*- coding: utf-8 -*-
"""按《人工智能基础与应用》实验报告样例生成「青养」课程报告。

以最新样例 docx 为模板（保留已填封面与 ReportBody/ReportHeading1 样式），
把大纲说明替换为真实项目内容，并在「作品成果展示」插入验收截图。
输出：项目目录下的《人工智能基础与应用》实验报告-青养.docx
"""
import shutil
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

SAMPLE = r"C:\Users\小新AIR\Documents\《人工智能基础与应用》_实验报告样例.docx"
OUT = r"C:\Users\小新AIR\Documents\qingyunapp\《人工智能基础与应用》实验报告-青养.docx"
SHOTS = r"C:\Users\小新AIR\Documents\qingyunapp\scripts\e2e"

# 发布地址
URL_DEMO = "https://zhaoqingyun122.github.io/qingyang/"
URL_REPO = "https://github.com/zhaoqingyun122/qingyang"

shutil.copy(SAMPLE, OUT)
doc = Document(OUT)


def para_text(p):
    return p.text.strip()


def find_startswith(prefix, start=0):
    for i, p in enumerate(doc.paragraphs[start:], start=start):
        if para_text(p).startswith(prefix):
            return i
    return -1


def new_para_after(anchor, text, template, size=None, align=None):
    """在 anchor 段后插入新段落（复制 template 段的 XML 以继承样式/字体）。"""
    import copy
    from docx.text.paragraph import Paragraph

    el = copy.deepcopy(template._p)
    anchor._p.addnext(el)
    np = Paragraph(el, anchor._parent)
    # 清空 runs，写入新文本
    for r in list(np.runs):
        r._r.getparent().remove(r._r)
    run = np.add_run(text)
    if size is not None:
        run.font.size = Pt(size)
    if align is not None:
        np.alignment = align
    return np


def add_picture_para_after(anchor, img_path, width_in):
    """在 anchor 段后插入居中图片段落。"""
    import copy
    from docx.text.paragraph import Paragraph

    el = copy.deepcopy(template_body._p)
    anchor._p.addnext(el)
    np = Paragraph(el, anchor._parent)
    for r in list(np.runs):
        r._r.getparent().remove(r._r)
    np.alignment = WD_ALIGN_PARAGRAPH.CENTER
    np.add_run().add_picture(img_path, width=Inches(width_in))
    return np


# ---- 定位关键段 ----
idx_body0 = find_startswith("（本节应介绍项目名称")
idx_body1 = find_startswith("（本节应说明项目的具体目标")
idx_body2 = find_startswith("（本节应列出实际使用的 AI 工具")
idx_body3 = find_startswith("（本节应展示最终作品的主要成果")
idx_body4 = find_startswith("（本节应总结项目目标的完成情况")
idx_body5 = find_startswith("（展示多轮 AI 协作中的关键迭代")
idx_link = find_startswith("成果链接")
idx_guidelist = find_startswith("提交课程主页")

assert idx_body0 >= 0 and idx_body5 >= 0, "样例段落定位失败"

template_body = doc.paragraphs[idx_body0]  # ReportBody 样式模板
CENTER = WD_ALIGN_PARAGRAPH.CENTER

# 保存段落对象引用（doc.paragraphs 每次访问会重扫，插入后旧索引失效）
B0 = doc.paragraphs[idx_body0]
B1 = doc.paragraphs[idx_body1]
B2 = doc.paragraphs[idx_body2]
B3 = doc.paragraphs[idx_body3]
B4 = doc.paragraphs[idx_body4]
B5 = doc.paragraphs[idx_body5]

# ============ 封面：成果链接 ============
if idx_link >= 0:
    doc.paragraphs[idx_link].add_run(" " + URL_DEMO)

# ============ 标题 "课程大作业报告大纲" → 报告标题 ============
idx = find_startswith("课程大作业报告大纲")
if idx >= 0 and doc.paragraphs[idx].runs:
    for r in doc.paragraphs[idx].runs:
        r.text = ""
    doc.paragraphs[idx].runs[0].text = "课程大作业报告"
    doc.paragraphs[idx].alignment = CENTER

# ============ 一、项目概述 ============
first = B0
for r in list(first.runs):
    r._r.getparent().remove(r._r)
first.add_run(
    "本项目名称为「食疗增益——青养」（青养 · 食疗健康生活），作品形式是一个零第三方依赖的纯前端 Web 应用"
    "（HTML/CSS/ES Modules 编写），支持安装到桌面（PWA）并离线运行，所有数据保存在本机浏览器（IndexedDB），"
    "不需要任何服务器，天然适合静态托管。"
)
anchor = first
for t in [
    "选题背景：药食同源物质在外观上很容易混淆——怀山药与普通菜山药、杭白菊与野菊花，认错品种，性味和用量都会偏；"
    "同时网络上的食疗信息零散、剂量口径不一，家庭烹调时还常常拿不准成人、青少年分别该吃多少。项目希望把"
    "「鉴别—剂量—药膳—记录」串成一个完整的闭环，降低认错物质的风险，给出分龄参考量，帮助家庭把食疗调理坚持下来。",
    "目标用户：关注日常食疗养生的家庭用户、慢性调理人群，尤其是需要照顾老人和孩子的非专业用户——界面尽量大字、"
    "清晰、温和，数据不出本机，注重隐私与离线可用。",
    "作品价值：这是一次与「AI+食品」主题结合的实践——整个应用由 AI 辅助完成需求分析、代码实现、测试体系搭建与"
    "发布部署，最终形成可直接运行的食疗健康工具，可以作为 AI 辅助开发 Web 应用的全流程样例。",
]:
    anchor = new_para_after(anchor, t, template_body)

# ============ 二、项目目标与方案设计 ============
first = B1
for r in list(first.runs):
    r._r.getparent().remove(r._r)
first.add_run(
    "项目目标：做一个「先认清这是什么，再想怎么吃」的家庭食疗助手，包含四大模块："
    "①首页·物质鉴别与百科——支持拍照辅助鉴别、按外形特征逐项筛选，每种物质展示性味归经、功效、用法用量、"
    "用药禁忌、外形鉴别特征以及成人/青少年分龄参考量；"
    "②身体状况·对症药膳——用户选择一个身体小信号或写一句话自述，应用自动匹配身体状况，列出适用的药食同源物质与药膳，"
    "给出分龄份量、泡茶配方，并附就医导航（出现哪些情况应尽快就医）；"
    "③药膳社区——记录自己做的药膳与感受，支持浏览、点赞、按药膳或物质筛选，形成互相交流的病友经验库；"
    "④数据管理——数据全部保存在本机浏览器，支持导出备份、恢复、立即保存与重新初始化。"
)
anchor = first
for t in [
    "在四模块之外，根据真实使用反馈迭代增加了八项体验功能：PWA 安装化（可安装到桌面/开始菜单并离线运行）、深色模式、"
    "字号调节（标准/大/特大）、知识收藏与「我的食谱本」、每日调理打卡（14 天日历条+当天备注）、药膳购物清单导出"
    "（收藏药膳用料自动合并、复制/下载）、无黑窗口本地启动、新用户引导。",
    "技术原理与整体设计：采用零依赖的 ES Modules 架构，hash 路由实现单页导航；IndexedDB 负责持久化"
    "（不支持时降级到 localStorage）；Service Worker 采用 network-first 策略实现在线取新、断网回退离线缓存；"
    "界面为绿色系食疗配色、卡片式布局，成人/青少年剂量用不同色块区分，支持深色模式与字号放大，对长辈友好。"
    "整站无后端、纯客户端运行，因此可以原样部署到 GitHub Pages。",
]:
    anchor = new_para_after(anchor, t, template_body)

# ============ 三、制作工具与实施过程 ============
first = B2
for r in list(first.runs):
    r._r.getparent().remove(r._r)
first.add_run(
    "主要 AI 工具：DeepSeek（对话式大模型），用于需求梳理、架构设计、代码生成与重构、测试用例设计、食疗资料的结构化整理、"
    "报错定位与修复建议、文档撰写辅助。"
)
anchor = first
for t in [
    "其他工具与软件：Windows + Microsoft Edge（Chromium 内核，开发与无头浏览器自动化测试环境）、Node.js（本地静态服务器与"
    "测试脚本运行）、Python + Pillow（生成 PWA 应用图标）、Git + GitHub（版本管理、代码托管与 GitHub Pages 发布）、文本编辑器。",
    "实施步骤：第一步，需求分析与方案设计——与 AI 多轮讨论，确定四模块范围与「先鉴别再吃」的产品主张，并确立两条关键规则："
    "成人/青少年剂量必须分开、数据必须只保存在本机；"
    "第二步，内容数据整理——在 AI 辅助下把药食同源物质的性味归经、功效、用量、鉴别特征，家常药膳的用料与做法，"
    "身体状况关键词与药膳关联，泡茶配方与就医导航资料整理成结构化数据文件；"
    "第三步，架构与编码——采用纯前端 ES Modules + IndexedDB 架构，AI 生成大部分页面、交互与核心算法代码，本人逐项审查校对，"
    "重点把控数据准确性与剂量安全口径；"
    "第四步，测试体系建设——建立静态自测（661 项断言）与基于 Edge 无头浏览器的端到端测试（103 项），坚持"
    "「完成一项功能→先写测试→测试通过→再提交」的开发纪律，验收前做全量回归；"
    "第五步，迭代改进——根据试用反馈完成八项体验改进并逐项测试提交；"
    "第六步，发布部署——将项目提交到 GitHub（main 分支），生成纯静态发布副本并推送到 gh-pages 分支用于 GitHub Pages 部署。",
    "本人承担的工作：产品定位与需求取舍、界面交互把关、内容准确性审查、测试验收、GitHub 发布管理与本报告撰写；"
    "AI 辅助完成的工作：代码主体生成、测试用例设计、数据结构化、错误排查指导。值得说明的是，AI 生成的代码并不总是正确——"
    "在实现「收藏」功能时端到端测试抓到了一个因方法同名被覆盖而静默失效的缺陷，经 AI 协助定位后修复，这一过程体现了"
    "「用自动化测试给 AI 生成代码兜底」的必要性。",
]:
    anchor = new_para_after(anchor, t, template_body)

# ============ 四、作品成果展示 ============
first = B3
for r in list(first.runs):
    r._r.getparent().remove(r._r)
first.add_run(
    "最终作品是一个可安装、可离线使用的食疗健康 Web 应用，代码托管于 GitHub 仓库，发布副本已部署到 gh-pages 分支。"
    "以下是主要界面与核心功能的截图（自上而下依次为首页、物质详情、身体状况、药膳详情、数据管理与新用户引导）："
)
anchor = first
shots = [
    ("01-home.png", "图 1  首页：拍照/特征鉴别入口、物质库分类、我的食谱本与每日调理打卡"),
    ("03-substance.png", "图 2  物质详情：性味归经、功效、成人/青少年分龄参考量与用药禁忌"),
    ("04-conditions.png", "图 3  身体状况：选择身体小信号，匹配适用物质与药膳"),
    ("06-recipe.png", "图 4  药膳详情：成人/青少年参考份量、用料与做法步骤"),
    ("11-data.png", "图 5  数据管理：本地存储状态、备份导出/恢复/重新初始化"),
    ("19-onboard.png", "图 6  新用户引导：首次打开介绍四大模块"),
]
for img, cap in shots:
    anchor = add_picture_para_after(anchor, SHOTS + "\\" + img, 5.4)
    anchor = new_para_after(anchor, cap, template_body, size=9, align=CENTER)

for t in [
    "成果与目标对照：鉴别功能（拍照/外形特征）直接降低认错物质的风险；成人/青少年分龄剂量满足家庭成员差异化用量的需求；"
    "状况→药膳推荐把知识变成可执行的日常方案；社区、打卡与食谱本帮助用户把调理坚持下来并快速回看；备份恢复保障数据安全。",
    "质量结果：静态自测 661 项全部通过（覆盖数据一致性、持久化语义、安全口径、PWA、深色模式、收藏、打卡、购物清单、引导等）；"
    "端到端测试 103 项全部通过（覆盖全部页面与核心操作流，包含刷新持久化与安装态验证）。",
    "作品链接（GitHub Pages）：" + URL_DEMO + "；代码仓库：" + URL_REPO + "。",
]:
    anchor = new_para_after(anchor, t, template_body)

# ============ 五、项目总结与学习体会 ============
first = B4
for r in list(first.runs):
    r._r.getparent().remove(r._r)
first.add_run(
    "目标完成情况：四大模块与八项体验改进全部实现并通过测试；代码已提交并托管到 GitHub，发布分支就绪；"
    "原定的「鉴别—剂量—药膳—记录」闭环全部打通，达到了预期的作品效果。"
)
anchor = first
for t in [
    "主要不足：内容库规模还有限（物质、药膳、泡茶条目数量有限，需要持续扩充）；拍照鉴别采用外形特征比对而非深度模型，"
    "识别准确度存在上限；数据只保存在本机浏览器，多设备之间无法同步；剂量信息为家庭日常参考量，不能替代医生处方。",
    "后续改进方向：扩充内容库并支持用户自定义条目；尝试接入大模型实现图像识别与自然语言症状匹配；引入账号体系与云端备份；"
    "增加一键打印/分享等生活化功能。",
    "对 AI 能力与局限的认识：AI 极大提升了从想法到可运行应用的效率——需求、代码、测试都可以交给 AI 快速产出，"
    "这是本次实践最大的收益；但 AI 的产出不能直接采信——剂量、禁忌等安全信息需要人工逐条核对，代码也出现过"
    "「同名方法覆盖导致功能静默失效」这类隐蔽问题，必须依靠自动化测试发现。清晰、结构化的提问（明确要求分龄剂量、零依赖、测试先行）"
    "是获得高质量 AI 输出的关键。",
    "学习体会：AI 不会替人做产品决策，但它能把想法快速变成可验证的工程；测试与迭代是保证质量的基石，"
    "「先写测试、通过再提交、验收前全量回归」的纪律让这个项目始终处于可交付状态。",
]:
    anchor = new_para_after(anchor, t, template_body)

# ============ 补充材料：AI 协作与迭代改进 ============
first = B5
for r in list(first.runs):
    r._r.getparent().remove(r._r)
first.add_run(
    "第 1 轮——从想法到方案：向 AI 提出「做一个离线可用的食疗健康小应用」，AI 输出四模块构想与「先鉴别再吃」的定位；"
    "本人采纳并补充两条关键规则（成人/青少年剂量分开、数据只存本机），形成项目 PRD。"
)
anchor = first
for t in [
    "第 2 轮——测试先行：要求 AI「每完成一项功能先加有效测试、跑通后再提交」，AI 设计出静态断言自测与浏览器端到端测试"
    "双层测试体系；本人在此基础上增加验收前全量回归要求，整个项目共沉淀 661 项静态断言与 103 项端到端测试。",
    "第 3 轮——真实缺陷的定位与修复：新增「收藏到食谱本」后，端到端测试发现点击收藏没有效果；AI 协助排查发现新增的收藏方法"
    "与既有帖子收藏方法同名而被类内后定义覆盖，改为独立命名（toggleBookmark）后测试全部通过。这轮迭代说明：自动化测试可以抓住"
    "AI 生成代码的隐性错误，是 AI 协作开发中不可缺少的一环。",
    "第 4 轮——体验改进清单：向 AI 提问「这个 app 有哪些可以改进的地方」，AI 列出八项建议；本人全部采纳并逐项实现、测试与提交，"
    "包括 PWA 安装化、深色模式、字号调节、收藏食谱本、每日打卡、购物清单导出、无黑窗口启动与新人引导。",
    "第 5 轮——发布部署：指导 AI 输出 GitHub Pages 发布方案（纯静态零依赖、发布副本独立目录、gh-pages 分支）；"
    "在本机网络受限的情况下，改用 SSH 推送完成远程分支同步，网页端启用由本人在浏览器完成。",
    "说明：以上为关键迭代节点，完整 AI 交互记录已随本报告作为附件提交，可对照查看从初稿到成品的逐步完善过程。",
]:
    anchor = new_para_after(anchor, t, template_body)

# ============ 删除「作业提交方式」说明与截止时间 ============
delete_prefixes = ["作业提交方式", "提交课程主页", "需要提交的内容", "《人工智能基础与应用》实验报告", "作品源代码", "AI交互记录", "补充材料（可选）", "如碰到课程主页无法提交", "2640871704@qq.com", "1721131971@qq.com", "截止时间"]
for p in list(doc.paragraphs):
    t = para_text(p)
    if any(t.startswith(x) or t == x for x in delete_prefixes):
        p._p.getparent().remove(p._p)

doc.save(OUT)
print("已生成:", OUT)