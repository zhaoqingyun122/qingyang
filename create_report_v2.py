# -*- coding: utf-8 -*-
"""在用户已编辑的报告基底上，补充「配图 / 天气定位 / 节气推荐 / 自由搜索」四项增强与最新测试数据。

基底：C:\\Users\\小新AIR\\Documents\\《人工智能基础与应用》_实验报告样例.docx（用户已改）
输出：项目目录《人工智能基础与应用》实验报告-青养.docx
"""
import copy
import shutil

import docx
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt
from docx.text.paragraph import Paragraph

SRC = r"C:\Users\小新AIR\Documents\《人工智能基础与应用》_实验报告样例.docx"
OUT = r"C:\Users\小新AIR\Documents\qingyunapp\《人工智能基础与应用》实验报告-青养.docx"
SHOTS = r"C:\Users\小新AIR\Documents\qingyunapp\scripts\e2e"
URL_DEMO = "https://zhaoqingyun122.github.io/qingyang/"
URL_REPO = "https://github.com/zhaoqingyun122/qingyang"
CENTER = WD_ALIGN_PARAGRAPH.CENTER

shutil.copy(SRC, OUT)
doc = docx.Document(OUT)


def ptext(p):
    return p.text.strip()


def find(prefix, start=0):
    for i, p in enumerate(doc.paragraphs[start:], start=start):
        if ptext(p).startswith(prefix):
            return p
    return None


def set_text(p, text):
    for r in list(p.runs):
        r._r.getparent().remove(r._r)
    p.add_run(text)


def insert_text_after(anchor, text):
    el = copy.deepcopy(anchor._p)
    anchor._p.addnext(el)
    np = Paragraph(el, anchor._parent)
    for r in list(np.runs):
        r._r.getparent().remove(r._r)
    np.add_run(text)
    return np


def insert_picture_after(anchor, img, width=5.4):
    el = copy.deepcopy(anchor._p)
    anchor._p.addnext(el)
    np = Paragraph(el, anchor._parent)
    for r in list(np.runs):
        r._r.getparent().remove(r._r)
    np.alignment = CENTER
    np.add_run().add_picture(img, width=Inches(width))
    return np


# ---------- 二、方案设计：补四项能力增强 ----------
p = find("在四模块之外")
assert p is not None, "未找到「在四模块之外」段落"
insert_text_after(
    p,
    "在此基础上又完成了四项能力增强：①为药材、药膳、茶饮配上真实图片（按条目 id 命名、缺图自动回退示意图）；"
    "②首页「今日时令」支持浏览器定位获取实时天气，并按雨雪、炎热、寒冷、潮湿、干燥等天气推荐当天药膳；"
    "③按二十四节气（离线计算）推荐当季药膳并给出典籍出处；④身体状况页支持用自己的话搜索药膳——口语先映射到中医功效主题，"
    "再匹配状况与药膳，结果附推荐理由与文献出处。",
)

p = find("技术原理与整体设计")
assert p is not None, "未找到技术原理段落"
set_text(
    p,
    "技术原理与整体设计：采用零依赖的 ES Modules 架构，hash 路由实现单页导航；IndexedDB 负责持久化（不支持时降级到 localStorage）；"
    "Service Worker 采用 network-first 策略实现在线取新、断网回退离线缓存；图片按 assets/类别/条目id.jpg 的约定命名，"
    "前端按 id 直接引用、加载失败时回退为文字占位块；节气用天文近似公式离线计算，天气接口不可用或未授权定位时自动降级为按时令推荐；"
    "界面为绿色系食疗配色、卡片式布局，成人/青少年剂量用不同色块区分，支持深色模式与字号放大，对长辈友好。"
    "整站无后端、纯客户端运行，因此可以原样部署到 GitHub Pages。",
)

# ---------- 三、实施过程：更新数字并补配图过程 ----------
p = find("实施步骤")
assert p is not None, "未找到实施步骤段落"
set_text(
    p,
    "实施步骤：第一步，需求分析与方案设计——与 AI 多轮讨论，确定四模块范围与「先鉴别再吃」的产品主张，并确立两条关键规则："
    "成人/青少年剂量必须分开、数据必须只保存在本机；第二步，内容与素材整理——在 AI 辅助下把药食同源物质的性味归经、功效、用量、"
    "鉴别特征，家常药膳的用料与做法，身体状况关键词与药膳关联，泡茶配方与就医导航资料整理成结构化数据文件，同时为 94 个条目准备配图；"
    "第三步，架构与编码——采用纯前端 ES Modules + IndexedDB 架构，AI 生成大部分页面、交互与核心算法代码，本人逐项审查校对，"
    "重点把控数据准确性与剂量安全口径；第四步，测试体系建设——建立静态自测（690 项断言）与基于 Edge 无头浏览器的端到端测试（116 项），"
    "坚持「完成一项功能→先写测试→测试通过→再提交」的开发纪律，验收前做全量回归；第五步，迭代改进——完成八项体验改进与四项能力增强"
    "（配图、天气定位、节气推荐、自由搜索）并逐项测试提交；第六步，发布部署——将项目提交到 GitHub（main 分支），生成纯静态发布副本、"
    "补充 .nojekyll 后推送到 gh-pages 分支用于 GitHub Pages 部署。",
)
insert_text_after(
    p,
    "配图过程值得单独说明：本项目需要 94 张图片（40 味药材、42 道药膳、12 款茶饮）。第一版只按搜索词抓图，交付后出现「图与名不符」；"
    "于是改为解析每条搜索结果的图片标题与来源页，要求标题必须含条目名称，并优先「药材图谱／中华药典／中药大全／百科」来源，"
    "剔除土茯苓误当茯苓、小米手机误当小米等形近异种与商品广告页；药材再补充「购物图源」模式，改用淘宝、1688、京东的商品主图（实物拍摄）。"
    "最终 40 味药材全部为实拍图；药膳与茶饮中未找到匹配实拍图的条目，改用带插画并标注「示意图」的占位图——宁可标注示意图，也不放错图。",
)

# ---------- 四、成果展示：补 3 张截图并更新质量结果 ----------
p = find("最终作品是一个可安装")
assert p is not None, "未找到成果展示引言"
set_text(
    p,
    "最终作品是一个可安装、可离线使用的食疗健康 Web 应用，代码托管于 GitHub 仓库，发布副本已部署到 gh-pages 分支。"
    "以下是主要界面与核心功能的截图（依次为首页、物质详情、身体状况、药膳详情、数据管理、新用户引导、"
    "药材配图效果、今日时令与天气节气、按情况搜药膳）：",
)

p = find("新用户引导：首次打开介绍四大模块")
assert p is not None, "未找到图 6 图注"
anchor = p
for img, cap in [
    ("20-images.png", "图 7  配图效果：物质卡片与详情页展示药材实拍图"),
    ("21-season.png", "图 8  今日时令：二十四节气与天气定位，按天气/节气推荐药膳"),
    ("22-free-search.png", "图 9  按情况搜药膳：用自己的话描述，给出匹配药膳、推荐理由与文献出处"),
]:
    anchor = insert_picture_after(anchor, SHOTS + "\\" + img)
    anchor = insert_text_after(anchor, cap)

p = find("质量结果")
assert p is not None, "未找到质量结果段落"
set_text(
    p,
    "质量结果：静态自测 690 项全部通过（覆盖数据一致性、持久化语义、安全口径、PWA、深色模式、收藏、打卡、购物清单、引导、"
    "配图约定、天气节气、自由搜索等）；端到端测试 116 项全部通过（覆盖全部页面与核心操作流，包含刷新持久化、图片加载、"
    "定位不可用时的降级、自由搜索跳转等验证）。",
)

# ---------- 五、总结 ----------
p = find("目标完成情况")
assert p is not None, "未找到目标完成情况"
set_text(
    p,
    "目标完成情况：四大模块、八项体验改进与四项能力增强（配图、天气定位、节气推荐、自由搜索）全部实现并通过测试；"
    "代码已提交并托管到 GitHub，发布分支就绪；原定的「鉴别—剂量—药膳—记录」闭环全部打通，达到了预期的作品效果。",
)

p = find("主要不足")
assert p is not None, "未找到主要不足"
set_text(
    p,
    "主要不足：内容库规模还有限（物质、药膳、泡茶条目数量有限，需要持续扩充）；拍照鉴别采用外形特征比对而非深度模型，识别准确度存在上限；"
    "药膳与茶饮中仍有部分条目未取得匹配的实拍图，暂用标注「示意图」的插画占位；天气推荐依赖浏览器定位与网络，"
    "网络不可用时只能按时令推荐；节气日期为天文近似计算（误差约 ±1 天）；数据只保存在本机浏览器，多设备之间无法同步；"
    "剂量信息为家庭日常参考量，不能替代医生处方。",
)

# ---------- 补充材料：迭代轮次 ----------
p = find("第 2 轮")
if p is not None:
    set_text(p, ptext(p).replace("661 项静态断言与 103 项端到端测试", "690 项静态断言与 116 项端到端测试").replace("661", "690").replace("103 项端到端", "116 项端到端"))

p = find("第 4 轮——体验改进清单")
assert p is not None, "未找到第 4 轮"
anchor = p
for t in [
    "第 5 轮——配图三轮纠错（网络受限下的取舍）：提出「给药材和药膳配图」。第一版按搜索词直接抓图，交付后发现「图与名不符」；"
    "第二轮改为解析图片标题与来源页、要求标题含条目名，并优先药材图谱／药典／百科来源；仍有个别形近误判（土茯苓被当成茯苓、"
    "小米被当成小米手机），第三轮加入形近异种与商品广告过滤，并对药材启用购物图源（淘宝／1688 商品主图）。最终 40 味药材全部为实拍图，"
    "未匹配到合适实拍图的条目改为「示意图」占位。",
    "第 6 轮——天气定位与节气推荐：提出「首页加天气定位，按天气推荐药膳，并按节气推荐」。AI 给出浏览器定位 + 实时天气接口 + 降级策略的方案；"
    "由于本机 HTTPS 被阻断，只保留 HTTP 可达的天气源，失败时自动降级为按时令推荐；节气改为离线计算，不依赖网络。",
    "第 7 轮——按自己的情况搜药膳：提出「不能只按预设症状，要能自己描述」。AI 设计了「口语同义词 → 中医功效主题 → 状况／药膳」的三级匹配，"
    "并补充中医药文献出处；本人逐条核对了推荐理由的表述与安全口径。",
]:
    anchor = insert_text_after(anchor, t)

p = find("第 5 轮——发布部署")
assert p is not None, "未找到原第 5 轮发布部署"
set_text(
    p,
    "第 8 轮——发布部署：指导 AI 输出 GitHub Pages 发布方案（纯静态零依赖、发布副本独立目录、gh-pages 分支、.nojekyll）；"
    "在本机网络受限的情况下，改用 SSH 推送完成远程分支同步，网页端启用由本人在浏览器完成。",
)

doc.save(OUT)
print("saved", OUT)