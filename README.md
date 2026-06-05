# 极客雷达 · Jitang Hot Monitor

> AI 驱动的热点监控系统 — 让热点无法遁形

[极客雷达界面预览]<img width="2560" height="1245" alt="极客雷达 · AI 热点监控 和另外 24 个页面 - 个人 - Microsoft​ Edge 2026_6_4 4_50_18" src="https://github.com/user-attachments/assets/4fb98816-d289-4ec2-a1b5-d33b9051e8d6" />


## 简介

极客雷达是一款面向 AI 编程博主的轻量级热点监控工具。它能自动从多个数据源抓取 AI/科技热点，利用 AI 对内容进行分析评分，并在你关注的关键词出现时第一时间推送通知。

## 功能特性

- **雷达视觉仪表盘** — Canvas 2D 动画雷达，热点以信号点形式呈现，橙色信号代表命中关键词
- **关键词主动监控** — 设置关键词后，AI 自动验证内容真实性（置信度阈值 65%），触发告警
- **关键词立即扫描** — 三路并发搜索：HackerNews + Twitter/X + Google 新闻，弹窗展示匹配结果
- **AI 热点分析** — 自动打分（1-10）、生成中文摘要、归类（模型发布 / 工具更新 / 研究 / 融资 / 讨论）
- **OpenRouter 模型监控** — 实时跟踪 300+ 模型列表，新模型上线自动入库告警
- **Twitter 质量过滤** — 严格筛选：点赞 ≥ 50、转发 ≥ 20、浏览 ≥ 2000、粉丝 ≥ 500，仅保留原创推文
- **实时推送** — SSE 长连接 + 浏览器通知 + 邮件通知（SMTP）
- **莫兰迪设计风格** — 抹茶绿 × 奶油白配色，Aceternity UI 动效组件

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
| GitHub Trending | AI/LLM 热门开源项目 | 否 |
| HackerNews Search | 关键词定向搜索 | 否 |

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
2. **立即扫描** — 点击顶部按钮，同时搜索 HackerNews + Twitter + Google 新闻，弹窗展示匹配结果
3. **雷达解读** — 内圈信号 = 热度更高；橙色信号 = 命中监控关键词；悬停查看详情
4. **设置通知** — 进入设置页配置浏览器通知授权和邮件 SMTP
5. **Twitter 质量** — 后台自动按点赞/转发/浏览量/粉丝数过滤，只保留原创高质量推文

## 项目结构

```
jitang-hot-monitor/
├── server/                  # Express 后端
│   ├── src/
│   │   ├── services/
│   │   │   ├── ai.ts        # OpenRouter AI 分析
│   │   │   ├── crawler.ts   # 多源数据抓取（HN/Reddit/Twitter/Google/GitHub）
│   │   │   ├── monitor.ts   # 关键词监控 pipeline
│   │   │   ├── search.ts    # 关键词立即扫描（三路并发）
│   │   │   └── notify.ts    # SSE + 邮件通知
│   │   ├── routes/          # API 路由
│   │   ├── db.ts            # SQLite 数据库
│   │   └── scheduler.ts     # 定时任务（每 30 分钟）
│   └── .env
├── client/                  # React 前端
│   └── src/
│       ├── components/
│       │   ├── RadarCanvas.tsx      # 雷达动画核心
│       │   ├── HotTopicCard.tsx     # 热点卡片
│       │   ├── KeywordManager.tsx   # 关键词管理
│       │   └── aceternity/          # Aceternity UI 组件
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
