# 极客雷达 · Jitang Hot Monitor

> AI 驱动的热点监控系统 — 让热点无法遁形

[极客雷达界面预览]<img width="2560" height="1242" alt="编程导航 - 一站式程序员学习交流社区 和另外 24 个页面 - 个人 - Microsoft​ Edge 2026_6_6 4_54_01" src="https://github.com/user-attachments/assets/e0552078-f692-4b96-b4ef-fd880fd62e52" />



## 简介

极客雷达是一款面向 AI 编程博主的轻量级热点监控工具。它能自动从多个数据源抓取 AI/科技热点，利用 AI 对内容进行分析评分，并在你关注的关键词出现时第一时间推送通知。

## 功能特性

- **雷达视觉仪表盘** — Canvas 2D 动画雷达，热点以信号点形式呈现，橙色信号代表命中关键词
- **关键词主动监控** — 设置关键词后，AI 判断内容是否与关键词「实质性相关」（统一置信度阈值 70%，遵循"宁缺毋滥"原则——验证失败时一律按未匹配处理，不回退到粗暴的子串匹配，避免误报持续污染信息流），命中后触发告警
- **查询扩展（Query Expansion）** — 关键词可一键让 AI 生成 4-6 个语义相近的别名/变体（如「Claude Sonnet 4.6」→「Claude 4.6 Sonnet」「Anthropic Claude Sonnet 4.6」），用于扩大搜索召回范围与预筛选命中率；扩展词在侧边栏「监控词」面板可查看、手动增删、一键重新生成
- **关键词立即扫描** — 多源并发搜索；AI 相关性验证结果按 URL 持久化缓存（重复扫描命中相同内容时直接复用判断、不再重复调用 AI），并在单个关键词内对候选内容做并发限制验证（最多 5 路并行），弹窗展示匹配结果，支持置信度/来源/热度排序
- **AI 热点分析** — 自动打分（1-10）、生成中文摘要、归类（模型发布 / 工具更新 / 研究 / 融资 / 讨论）
- **排序与筛选系统** — 4 种排序 × 5 种筛选维度，精准定位你关心的热点
- **热点可视化指示器** — 根据当前排序模式展示专属指示器（火焰热度条 / 相关性眼睛 / 优先级标签）
- **互动数据透明化** — 卡片展示真实点赞 / 评论 / 转发 / 浏览数（取自 Twitter / B站 / 微博 / HackerNews 的结构化数据，无数据则不显示）
- **AI 相关性理由 + 真实性判断** — 每条热点附带 AI 给出的一句话价值理由，以及对内容可信度的独立判断（真实 / 疑似营销软文 / 信息不足），筛选时优先采信该判断
- **发布时间 + 抓取时间双显示** — 卡片同时标注内容发布时间与入库抓取时间，悬浮可查看精确时刻
- **一键展开/折叠全部原文** — 列表顶部按钮一键同步所有卡片的原文展开状态，之后仍可单独切换
- **分页浏览** — 每页 20 条，切换筛选自动回到第 1 页
- **OpenRouter 模型监控** — 实时跟踪 300+ 模型列表，新模型上线自动入库告警
- **Twitter 质量过滤** — 严格筛选：点赞 ≥ 50、转发 ≥ 20、浏览 ≥ 2000、粉丝 ≥ 500，仅保留原创推文
- **实时推送** — SSE 长连接 + 浏览器通知 + 邮件通知（SMTP）
- **莫兰迪设计风格** — 抹茶绿 × 奶油白配色，Aceternity UI 动效组件

## 排序与筛选

### 4 种排序方式

| 排序 | 逻辑 | 视觉指示器 |
|------|------|-----------|
| 最新 | 发布时间优先，无发布时间则用入库时间 | 无 |
| 重要程度优先 | AI 评分 DESC，关键词命中数次之 | 头部彩色标签（URGENT / HIGH / MEDIUM / LOW） |
| 相关性最高 | 关键词命中数 DESC，AI 评分次之 | footer `👁 相关性XX%` |
| 热度综合排名 | 时间衰减公式：`score − 小时数 × 0.05` | footer `🔥🔥🔥 8.4` 火焰条 |

### 5 种筛选维度

- **数据来源** — 多选，按来源平台过滤（Twitter / HackerNews / Bilibili 等）
- **重要程度** — 单选，紧急 / 高 / 中 / 低（基于 AI 评分：≥9 紧急、≥8 高、≥6 中、<6 低）
- **关联关键词** — 单选，只看命中特定监控词的热点
- **时间范围** — 单选，最近1小时 / 今天 / 近7天 / 近30天
- **真实性** — 单选，已验证 / 疑似虚假。优先采用 AI 对内容可信度的独立判断；该判断缺失时（如关键词搜索直接入库的条目）退化为按评分推断（已验证：评分≥7 或命中关键词；疑似虚假：评分≤2）

## 数据源

| 数据源 | 内容 | 需要 Key |
|--------|------|----------|
| HackerNews | 全球科技/AI 热门讨论 | 否 |
| Reddit (ML / LocalLLaMA / artificial) | AI 社区第一手讨论 | 否 |
| HuggingFace Blog | 模型与工具官方发布 | 否 |
| The Verge AI | AI 科技媒体 | 否 |
| VentureBeat AI | AI 商业动态 | 否 |
| OpenRouter API | 300+ 模型新上线检测 | OpenRouter Key |
| Twitter/X | 高质量 AI 推文（严格质量过滤） | twitterapi.io Key |
| Google News | TechCrunch / Wired 等主流媒体 | Serper.dev Key |
| Bilibili | AI 相关视频与博主动态 | 否 |
| 新浪微博 | AI 话题中文社区讨论 | 否 |
| 百度新闻 | 中文 AI/科技资讯 | 否 |
| GitHub Trending | AI/LLM 热门开源项目 | 否 |
| HackerNews Search | 关键词定向搜索 | 否 |

## 打分说明

每条热点均有 1-10 的 AI 综合评分，综合互动热度与时效性：

| 来源 | 评分公式 |
|------|---------|
| Twitter | `min(10, round(点赞数 / 50) + 4)` |
| HackerNews | `min(10, round(积分 / 20) + 4)` |
| Bilibili | `min(10, round(播放量 / 5000) + 4)` |
| 微博 | `min(10, round(点赞数 / 100) + 4)` |
| Google News / 百度新闻 | 固定 6 分（无互动数据） |

热度综合排名在此基础上叠加时间衰减：每过 1 小时扣 0.05 分，48 小时后约衰减 2.4 分。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express + TypeScript |
| 数据库 | SQLite (better-sqlite3) |
| 定时任务 | node-cron |
| AI 服务 | OpenRouter API (deepseek/deepseek-chat 默认) |
| 前端 | React 18 + Vite 5 + TypeScript |
| 样式 | Tailwind CSS v3 (莫兰迪配色系统) |
| 动效 | Aceternity UI + Canvas 2D API |
| 实时推送 | Server-Sent Events (SSE) |

## 快速开始

### 前置要求

- Node.js >= 18
- [OpenRouter](https://openrouter.ai/) API Key（必须）
- [twitterapi.io](https://twitterapi.io) Key（可选，用于 Twitter 监控）
- [Serper.dev](https://serper.dev) Key（可选，用于 Google 新闻搜索）

### 安装

```bash
# 克隆项目
git clone https://github.com/qla125/jitang-hot-monitor.git
cd jitang-hot-monitor

# 安装后端依赖
cd server && npm install

# 安装前端依赖
cd ../client && npm install
```

### 配置

编辑 `server/.env`：

```env
# 必填
OPENROUTER_API_KEY=sk-or-v1-your-key-here
PORT=3001

# 可选：Twitter 监控（twitterapi.io）
TWITTERAPI_IO_KEY=your-twitterapi-key

# 可选：Google 新闻搜索（serper.dev，初始免费 2500 次）
SERPER_API_KEY=your-serper-key
```

> 也可以在运行后通过网页**设置页面**填入各项 API Key，无需手动编辑文件。

### 运行

开两个终端分别启动：

```bash
# 终端 1：后端
cd server && npm run dev

# 终端 2：前端
cd client && npm run dev
```

访问 **http://localhost:5173** 查看界面。

## 使用说明

1. **添加关键词** — 在侧边栏「监控词」面板添加你关注的词（如 `GPT-5`、`Claude 4`）
2. **立即扫描** — 点击顶部按钮，多源并发搜索，弹窗展示匹配结果
3. **排序筛选** — 顶部工具栏切换排序方式，侧边下拉筛选来源/重要程度/时间范围等
4. **雷达解读** — 内圈信号 = 热度更高；橙色信号 = 命中监控关键词；悬停查看详情
5. **设置通知** — 进入设置页配置浏览器通知授权和邮件 SMTP
6. **Twitter 质量** — 后台自动按点赞/转发/浏览量/粉丝数过滤，只保留原创高质量推文

## 项目结构

```
jitang-hot-monitor/
├── server/                  # Express 后端
│   ├── src/
│   │   ├── services/
│   │   │   ├── ai.ts        # OpenRouter AI 分析
│   │   │   ├── crawler.ts   # 多源数据抓取（HN/Reddit/Twitter/Google/GitHub/Bilibili/微博）
│   │   │   ├── monitor.ts   # 关键词监控 pipeline
│   │   │   ├── search.ts    # 关键词立即扫描（多路并发）
│   │   │   └── notify.ts    # SSE + 邮件通知
│   │   ├── routes/          # API 路由
│   │   ├── scripts/
│   │   │   └── eval-keyword-match.ts  # 相关性验证准确率评估脚本（金标准测试集，npm run eval:keyword-match）
│   │   ├── db.ts            # SQLite 数据库
│   │   └── scheduler.ts     # 定时任务（每 30 分钟）
│   └── .env
├── client/                  # React 前端
│   └── src/
│       ├── components/
│       │   ├── RadarCanvas.tsx      # 雷达动画核心
│       │   ├── HotTopicCard.tsx     # 热点卡片（含排序可视化指示器）
│       │   ├── FilterSortBar.tsx    # 排序 + 筛选工具栏
│       │   ├── KeywordManager.tsx   # 关键词管理
│       │   └── aceternity/          # Aceternity UI 组件
│       ├── hooks/
│       │   └── useTopicFilters.ts   # 排序/筛选逻辑 + 热度公式
│       └── pages/
│           ├── Dashboard.tsx
│           └── Settings.tsx
└── docs/
```

## API 说明

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/hot-topics` | 获取热点列表 |
| POST | `/api/hot-topics/refresh` | 手动触发抓取 |
| POST | `/api/hot-topics/search-keywords` | 关键词立即扫描 |
| GET/POST/PUT/DELETE | `/api/keywords` | 关键词管理 |
| GET | `/api/alerts` | 告警记录 |
| GET/PUT | `/api/settings` | 配置管理 |
| GET | `/events` | SSE 实时推送 |

## License

MIT
