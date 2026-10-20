# 青养 · 食疗健康生活 APP — 开发计划（可执行版）

- 依据：`PRD.md` v1.0（已确认）
- 目标：按 PRD 第 8 节完成第一版全部功能，并按第 10 节验收标准交付
- 进度标注：✅ = 当前仓库已完成并通过验收；⬜ = 待执行
- 约定：本文档既是“从零开发”的路线图，也是“当前仓库后续维护/迭代”的检查清单；每个阶段结束都必须跑通该阶段的验收命令，全部阶段完成后整体回归见阶段 9。

---

## 阶段 0：项目骨架与运行形态（✅ 已完成）

**目标**：建立零依赖、本机离线的可运行骨架。

| 任务 | 文件 | 要点 |
| --- | --- | --- |
| 0.1 应用外壳 | `index.html` | 顶部栏（品牌/全局搜索/访客身份）、四模块 Tab、`#view` 内容区、`#modal-root` 模态层、toast 容器、底部安全口径脚注；viewport 中文站点 |
| 0.2 本地服务器 | `scripts/server.mjs` | 仅绑定 `127.0.0.1`；静态类型白名单（html/js/mjs/css/json/svg/md/txt）；路径穿越防护；端口被占提示；`--port` / `--no-open` 参数 |
| 0.3 一键启动 | `启动青养.cmd` | 优先 PATH 上的 node，否则用 `runtime\node.exe`；失败给中文提示 |
| 0.4 样式基座 | `css/app.css` | 变量（主绿/深绿/米白底/墨绿黑/蓝·成人/琥珀·青少年/警示红）、按钮/chip/标签/面板/表格/模态/toast/空状态 |
| 0.5 零依赖校验 | 手工 | DevTools Network 无外部请求；双击 `index.html` 与 `启动青养.cmd` 均可打开 |

**验收**：浏览器打开首页渲染正常；`selftest.mjs` 的「本地服务器」「安全口径」组通过。

---

## 阶段 1：内容数据层（✅ 已完成）

**目标**：按 PRD 第 5 节①/②的数据规范，构建 40 物质 / 12 状况 / 42 药膳精写内容，引用完整。

### 1.1 物质 `js/data/substances.js`（40 条）

每条必须完整包含：

```js
{
  id: 'shan-yao',            // 拼音短横线 id，全局唯一
  name: '山药',
  alias: ['怀山药', '薯蓣'],
  category: '补虚类',         // 10 类之一：补虚/祛湿/清热/消食导滞/理气/温里/安神/润肠/活血/其他
  nature: '甘，平。归脾、肺、肾经',   // 性味归经
  effects: '补脾养胃、生津益肺、补肾涩精。',  // 功效
  usage: '15～30g，煎汤或入膳。',     // 用法用量原文
  adultDose: '每日 15～30g（约 1～2 次）',  // 成人参考量，必含频次
  teenDose: '每日 10～15g（约 1～2 次）',   // 青少年 12–18 岁参考量，必须与成人不同
  cautions: ['湿盛中满者慎用'],     // 禁忌（可空数组）
  keywords: ['健脾', '养胃', '补气'],  // 搜索/症状匹配关键词
  features: { shape: [], color: [], texture: [], smell: [], section: [] },  // 外形鉴别 5 维度
}
```

- 剂量口径：`每日 …g（约 1～2 次）` 句式统一；“成人/青少年”两档必须数值不同。
- 全量 40 条覆盖 10 个类别，每类至少 3 条；`features` 每个维度平均 ≥2 词，供拍照颜色与特征选择使用。

### 1.2 身体状况 `js/data/conditions.js`（12 条）

```js
{ id: 'piwei', name: '脾虚湿盛', summary: '吃一点就饱、大便稀、易疲乏…', keywords: ['大便稀','容易疲乏','腹胀'], tips: ['少食生冷','规律作息'] }
```

- 覆盖常见亚健康小信号；`keywords` 与 `substances.keywords` 可交叉命中搜索。

### 1.3 药膳 `js/data/recipes.js`（42 条）

```js
{
  id: 'shan-yao-zhou',
  name: '山药芡实粥',
  ingredients: ['山药 30g', '芡实 15g', '粳米 50g'],
  steps: ['…'],
  fit: '适合脾虚湿盛、易疲乏者',
  adultPortion: '每日 1 碗（约 200ml）',
  teenPortion: '每日半碗（约 100ml）',   // 与成人不同
  cautions: [],
  substanceIds: ['shan-yao', 'qian-shi'],  // 全部有效
  conditionIds: ['piwei'],                  // 全部有效
}
```

- **硬性约束**：`substanceIds` / `conditionIds` 所有引用必须有效；每道药膳 `adultPortion` 与 `teenPortion` 不同。

### 1.4 数据完整性校验（并入自测）

- `scripts/selftest.mjs` 数据段断言：40/12/42 数量、必填字段、双档剂量不同、157 处交叉引用全部有效、10 分类覆盖、安全口径关键词存在。

**验收**：`node scripts/selftest.mjs` 数据段 0 失败。

---

## 阶段 2：基础设施（持久化 + 工具库）（✅ 已完成）

**目标**：单一数据源与可靠持久化（PRD 第 7 节）。

| 任务 | 文件 | 要点 |
| --- | --- | --- |
| 2.1 存储层 | `js/lib/db.js` | IndexedDB 封装（meta/posts/identifications）；不可用时自动降级 localStorage；`estimateStorage()` 供数据页展示 |
| 2.2 应用状态 | `js/lib/store.js` | EventTarget 单一数据源；`load(seed)`（含 `seeded` 防复现逻辑）；帖子/访客/鉴别/偏好增删改查；`toggleLike/toggleFavorite`；`exportBackup/importBackup/resetAll/updateSettings` |
| 2.3 种子数据 | `js/lib/seed.js` | 默认 4 访客（me/林小满/周叔的厨房/多多妈）；3 条示例帖（SVG 插图 data-URL）；10 分类 `CATEGORY_META`；`seedPosts()` |
| 2.4 DOM 工具 | `js/lib/dom.js` | `esc`（HTML 转义）、`html`（纯字符串拼接，无自动转义）、`qs/qsa/on`、`modal/confirmDialog`、`toast`、`readFileAsDataURL`、`downloadBlob/downloadText`、`debounce`、`fmtDate/relTime` |
| 2.5 搜索 | `js/lib/search.js` | `searchAll(q)` 对物质/药膳/状况/帖子打分排序；`routeFor` 映射直达路由 |
| 2.6 备份工具 | `js/lib/backup.js` | `qingyang-backup` v1 格式读写；恢复前摘要预览 |
| 2.7 分享图 | `js/lib/share.js` | Canvas 绘制 1080px 分享卡（头像/时间/图片/标签/正文/关联药膳/成人·青少年份量/免责底行） |
| 2.8 应用入口 | `js/main.js` + `js/router.js` | `boot()`：initDB → load → 挂全局 API（`window.qy = Object.assign(window.qy, {navigate, openPhoto, openFeature, seed})`）→ 路由；`render()` 每视图 try/catch 兜底；hashchange 监听；全局搜索 Enter、Tab 切换、`/` 快捷键 |
| 2.9 路由表 | `js/router.js` | `#/` 首页、`#/substance/:id`、`#/recipe/:id`、`#/conditions`、`#/community`、`#/data`；`?compose=1&recipe=..&substance=..` 预填参数 |

**验收**：`selftest.mjs` 的「持久化语义」「备份与恢复」组通过；e2e 的「IndexedDB 存储生效」「备份包含新帖与格式标识」「重置/恢复往返」「偏好刷新保留」通过。

---

## 阶段 3：首页与物质详情（✅ 已完成）

**目标**：PRD 第 3 节首页结构 + 第 8 节功能 2/3。

### 3.1 首页 `js/views/home.js`

按固定顺序渲染（PRD 3 节）：
1. Hero 区：口号 + 「📷 拍照辅助鉴别」（46px 大主按钮）+「按外形特征逐项选」「看身体状况」次按钮；
2. 物质库：页内关键词、10 类 chips（带计数）、卡片/列表切换、排序、结果计数、空状态；
3. 按身体状况找物质（6 个入口卡）；
4. 常翻的物质（收藏+鉴别热度 Top6，无热度给引导文案）；
5. 本机鉴别记录（最近 4 条）。

### 3.2 物质详情 `js/views/home.js#renderSubstancePage`

面包屑 → 标题/类别/别名/性味 → 成人·青少年剂量卡（蓝/琥珀底色）→ 药典条目 kv（正名/别名/性味归经/功效/用量/禁忌）→ 外形鉴别特征 5 维度 → 能做的药膳 → 适用身体状况标签 → 安全提示（固定口径）→ 相关操作（再鉴别/分享）。

### 3.3 药膳详情 `js/views/home.js#renderRecipePage`

标题 + 物质/状况标签 → 成人·青少年两档份量框 → 用料 → 做法 → 适用人群 → 注意事项 → 「分享这道药膳的日常」「看看别人怎么吃」。

### 3.4 全局搜索 `index.html` + `js/router.js`

顶部搜索输入 → 候选下拉（物质/药膳/状况/帖子，打分排序）→ Enter 或点击直达；首页内部搜索框实时过滤并保持焦点。

**验收**：e2e「首页」「全局搜索」「物质详情」组全过（含卡片数 ≥30、双档剂量、药典 ≥5 项、特征、安全提示）。

---

## 阶段 4：识图模块（✅ 已完成）

**目标**：PRD 第 8 节功能 2 的“拍照辅助鉴别 + 外形特征逐项选择”，全离线（PRD 第 6 节关系闭环的入口）。

| 任务 | 文件 | 要点 |
| --- | --- | --- |
| 4.1 颜色分析 | `js/lib/photo-id.js` | 64px 下采样 → 提取 6 个主色 → 与 `features.color/section` 文本按命名色锚点 + 容差比对打分 → Top 8 候选 |
| 4.2 拍照模态 | `js/photo.js` | 文件选择/摄像头（`capture=environment`）；背景先填充再绘制（透明图兼容）；压缩到 380px 存记录缩略图；候选卡含「就选这个 →」确认；提示“照片只参考颜色，请按特征核对实物”；无匹配时引导转特征选择 |
| 4.3 特征选择 | `js/feature-picker.js` | 5 维度（形状/颜色/质地/气味/断面）chips 多选；近义归并（“类…/…形”合并）减少干扰；覆盖度打分实时候选；「就选第一个：xxx」确认 |
| 4.4 记录闭环 | `store.addIdentification` | 每次确认/保存写 `identifications`（method/candidateIds/chosenId/palette 或 features），供首页「常翻/记录」与 ④ 内容管理消费 |

**验收**：e2e「特征逐项选择」「拍照鉴别链路」组全过；selftest 对 photo-id 算法断言通过。

---

## 阶段 5：身体状况 → 药膳（✅ 已完成）

**目标**：PRD 第 8 节功能 4。

| 任务 | 文件 | 要点 |
| --- | --- | --- |
| 5.1 自述匹配 | `js/views/conditions.js` | `#sym-input` 实时匹配 `conditions.keywords`；标签文案「你提到「症状」→ 状况」；datalist 提示词 |
| 5.2 状况详情 | 同上 | 状况头（名称/摘要/关键词/调理提示）+ 自述跳转时显示“因为你提到「…」所以为你对照”理由 + 物质×成人/青少年剂量对照表 + 药膳列表 + 安全口径 |
| 5.3 详情跳转 | 路由 | `#/conditions?c=:id` 深链直达；状况卡点击平滑滚动到详情 |

**验收**：e2e「身体状况 → 药膳」组全过（自述匹配、剂量对照表、药膳列表）。

---

## 阶段 6：单机社区（✅ 已完成）

**目标**：PRD 第 8 节功能 5/6 的社区部分。

| 任务 | 文件 | 要点 |
| --- | --- | --- |
| 6.1 信息流 | `js/views/community.js` | 全部/我的/收藏/点赞过 页签；标签、药膳、物质筛选；帖子卡片：作者行（含 🍲 关联药膳名标签）、标签、图片（≤3 图网格）、正文（超 4 行折叠 + 展开/收起）、点赞/收藏/评论/导出 |
| 6.2 发帖编辑器 | 同上 | 文字（≤800 字）+ 图片（≤4 张，压缩 1000px JPEG，可删除）+ 关联药膳/物质下拉 + 标签（≤4）；发布后落盘 |
| 6.3 互动 | 同上 | 点赞/收藏（按 activeVisitorId）、评论（Enter 发送、展开态保持）；**事件委托去重**：每次渲染先 `removeEventListener` 再挂具名 handler，避免双击抵消 |
| 6.4 导出 | `js/lib/share.js` + 同上 | 分享图 PNG（含成人/青少年份量）、纯文本 TXT（含免责行） |
| 6.5 访客 | `store.visitors` | 侧栏切换/新增/删除；删除访客保留其帖子但署名显示“已移除” |
| 6.6 深链 | 路由 | `#/community?compose=1&recipe=..&substance=..` 从详情/药膳页直达并预填 |

**验收**：e2e「社区」组全过（发帖/点赞/收藏/评论/收藏页签/访客切换/刷新重启持久化）。

---

## 阶段 7：数据与设置（✅ 已完成）

**目标**：PRD 第 8 节功能 7 + 第 7 节备份恢复。

| 任务 | 文件 | 要点 |
| --- | --- | --- |
| 7.1 统计 | `js/views/data.js` | 统计卡片（物质/药膳/帖子/鉴别/访客 ≥6 项）+ 14 天发帖柱状图 |
| 7.2 内容管理 | 同上 | 帖子/鉴别记录/访客三个管理模态（可删除） |
| 7.3 备份恢复 | `js/lib/backup.js` | 导出 JSON（含格式标识与导出时间）；恢复：选文件 → 摘要预览 → 确认覆盖；非法文件拒绝 |
| 7.4 导出 Markdown | 同上 | 全部帖子导出 .md |
| 7.5 偏好 | `store.updateSettings` | `activeVisitorId/cardDensity/showTeenDose/homeSort/safeNotice`，立即落盘 |
| 7.6 重置 | `store.resetAll(seed)` | 清空用户数据 → 重建默认访客与示例帖 → 置位 seeded；双重确认（红字） |

**验收**：e2e「数据与设置」组全过（统计/图表/备份/重置/恢复/偏好刷新保留）。

---

## 阶段 8：安全、转义与文档（✅ 已完成）

| 任务 | 要点 |
| --- | --- |
| 8.1 安全口径 | `index.html` 与各详情/状况/药膳/社区页面固定呈现：“不替代医生诊断/药物治疗”“慢性病服药期、孕产妇、婴幼儿、过敏体质请先咨询医师或药师”“青少年 12–18 岁，更小儿童再减半” |
| 8.2 转义纪律 | 所有动态文本过 `esc()`；`html()` 不做自动转义，靠调用方；`scripts/check-escape.mjs` 扫描未转义插值 |
| 8.3 文档 | `README.md`（使用/数据/安全/内容维护/自测）、`docs/design.html`（页面结构与交互设计，含实现状态）、`PRD.md`、本文件 |

**验收**：`node scripts/check-escape.mjs` 输出“未发现未转义插值”。

---

## 阶段 9：整体验收与发布（✅ 已完成，后续迭代每次必跑）

**回归命令（顺序执行）**：

```bash
node scripts/selftest.mjs        # 数据完整性/持久化/备份/服务器/安全口径（517 项）
node scripts/check-escape.mjs    # 模板转义检查
# 浏览器端到端（需先起本地服务器 + headless Edge 调试端口）：
node scripts/server.mjs --port 5199 --no-open
# 另开终端启动 headless Edge --remote-debugging-port=9333
node scripts/e2e.mjs --base http://127.0.0.1:5199/ --cdp 9333 --out scripts/e2e   # 50 项
```

**发布形态**：无构建、无打包；交付整个目录即可（用户双击 `index.html` 或 `启动青养.cmd`）。换机迁移 = ④ 导出备份 JSON + 拷贝目录。

**验收 = PRD 第 10 节全部通过**：自动化 517 + 50 + 转义全绿，手工清单（10.2）逐项勾选完成。

> 说明：测试脚本支持按阶段运行对应断言（`selftest.mjs --only 关键词` / `e2e.mjs --groups 关键词`），默认全量行为不变；517/50 为全量实测数（含 6 项 photo-id 纯函数断言与 1 项分享图生成断言）。

---

## 后续迭代建议（超出 v1，按 PRD 第 9 节暂缓）

1. 精确拍照识别（本地模型 / 图库比对，保持离线）——替换阶段 4.1 的“颜色辅助”为真识别，接口不变。
2. 体质自评问卷（全面版）——在阶段 5.1 自述匹配基础上扩展评分模型。
3. 内容铺量——阶段 1 数据文件追加条目，引用校验沿用 1.4。
4. 社区升级为真实多用户/云端——需推翻 PRD 第 1 节核心约束，另行立项。

每次迭代遵循：改内容 → 跑阶段 1.4 校验；改交互 → 跑阶段 9 回归；改 PRD → 同步 `PRD.md` 与 `docs/design.html` 对照表。