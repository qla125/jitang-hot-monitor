# 极客雷达 · Jitang Hot Monitor

> AI 驱动的热点监控系统 — 让热点无法遁形

[极客雷达界面预览]<img width="2560" height="1245" alt="极客雷达 · AI 热点监控 和另外 24 个页面 - 个人 - Microsoft​ Edge 2026_6_4 4_50_18" src="https://github.com/user-attachments/assets/4fb98816-d289-4ec2-a1b5-d33b9051e8d6" />


## 简介

极客雷达是一款面向 AI 编程博主的轻量级热点监控工具。它能自动从多个数据源抓取 AI/科技热点，利用 AI 对内容进行分析评分，并在你关注的关键词出现时第一时间推送通知。

## 功能特性

- **雷达视觉仪表盘** — Canvas 2D 动画雷达，热点以信号点形式呈现，橙色信号代表命中关键词
- **关键词主动监控** — 设置关键词后，AI 自动验证内容真实性（置信度阈值 65%），触发告警
- **关键词主动搜索** — 点击「立即扫描」，针对关键词实时检索 HackerNews 最新内容
- **AI 热点分析** — 自动打分（1-10）、生成中文摘要、归类（模型发布 / 工具更新 / 研究 / 融资 / 讨论）
- **OpenRouter 模型监控** — 实时跟踪 300+ 模型列表，新模型上线自动入库告警
- **实时推送** — SSE 长连接 + 浏览器通知 + 邮件通知（SMTP）
- **响应式界面** — 深色宇宙主题，适配桌面与移动端

## 数据源

| 数据源 | 内容 |
|--------|------|
| HackerNews | 全球科技/AI 热门讨论 |
| Reddit (ML / LocalLLaMA / artificial) | AI 社区第一手讨论 |
| HuggingFace Blog | 模型与工具官方发布 |
| The Verge AI | AI 科技媒体 |
| VentureBeat AI | AI 商业动态 |
| OpenRouter API | 300+ 模型新上线检测 |
| HackerNews Search | 关键词定向搜索 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express + TypeScript |
| 数据库 | SQLite (better-sqlite3) |
| 定时任务 | node-cron |
| AI 服务 | OpenRouter API |
| 前端 | React + Vite + TypeScript |
| 样式 | Tailwind CSS |
| 动画 | Canvas 2D API |
| 实时推送 | Server-Sent Events (SSE) |

## 快速开始

### 前置要求

- Node.js >= 18
- [OpenRouter](https://openrouter.ai/) API Key

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

复制并编辑后端配置文件：

```bash
cp server/.env.example server/.env
```

编辑 `server/.env`：

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
PORT=3001
```

也可以在运行后通过网页设置页面填入 API Key。

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

1. **添加关键词** — 在右侧「关键词监控」面板添加你关注的词（如 `GPT-5 发布`、`Claude 4`）
2. **立即扫描** — 点击顶部按钮，针对关键词实时搜索最新内容，弹窗展示结果
3. **雷达解读** — 内圈信号 = 热度更高；橙色信号 = 命中监控关键词；悬停查看详情
4. **设置通知** — 进入设置页配置浏览器通知授权和邮件 SMTP

## 项目结构

```
jitang-hot-monitor/
├── server/                  # Express 后端
│   ├── src/
│   │   ├── services/
│   │   │   ├── ai.ts        # OpenRouter AI 调用
│   │   │   ├── crawler.ts   # 多源数据抓取
│   │   │   ├── monitor.ts   # 关键词监控 pipeline
│   │   │   ├── search.ts    # 关键词主动搜索
│   │   │   └── notify.ts    # SSE + 邮件通知
│   │   ├── routes/          # API 路由
│   │   ├── db.ts            # SQLite 数据库
│   │   └── scheduler.ts     # 定时任务
│   └── .env.example
├── client/                  # React 前端
│   └── src/
│       ├── components/
│       │   └── RadarCanvas.tsx  # 雷达动画核心
│       └── pages/
│           ├── Dashboard.tsx
│           └── Settings.tsx
└── docs/                    # 需求与设计文档
```

## API 说明

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/hot-topics` | 获取热点列表 |
| POST | `/api/hot-topics/search-keywords` | 关键词主动搜索 |
| GET/POST/PUT/DELETE | `/api/keywords` | 关键词管理 |
| GET | `/api/alerts` | 告警记录 |
| GET/PUT | `/api/settings` | 配置管理 |
| GET | `/events` | SSE 实时推送 |

## License

MIT
