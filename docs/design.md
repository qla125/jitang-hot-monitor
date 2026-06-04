# 极客雷达 · 技术设计文档

> 版本: 1.0 · 日期: 2026-06-03

---

## 一、技术选型

| 层级 | 技术 | 版本 | 理由 |
|---|---|---|---|
| 后端运行时 | Node.js | ≥18 | 跨平台，异步 I/O 适合爬虫 |
| 后端框架 | Express | ^4.18 | 轻量稳定，路由清晰 |
| 数据库 | better-sqlite3 | ^12.0 | 同步 API，零配置，本地文件 |
| 定时任务 | node-cron | ^3.0 | 轻量 cron，无需外部服务 |
| HTTP 客户端 | axios | ^1.6 | 支持 timeout/interceptor |
| RSS 解析 | rss-parser | ^3.13 | 轻量稳定，支持自定义字段 |
| 邮件 | nodemailer | ^6.9 | 最主流的 Node.js 邮件库 |
| 实时推送 | SSE (内置) | — | 比 WebSocket 更轻量，单向推送够用 |
| 前端构建 | Vite + React | ^5 / ^18 | 极速构建，TypeScript 友好 |
| CSS | Tailwind CSS | ^3 | 原子化，响应式，配合自定义设计 |
| 动画 | Canvas 2D API | 原生 | 雷达动画，避免 SVG 动画性能问题 |
| 语言 | TypeScript | ^5.3 | 全栈类型安全 |

---

## 二、系统架构

```
┌────────────────────────────────────────────────────┐
│                  Web Client (React)                  │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │  雷达视图      │  │  关键词管理   │  │  通知中心 │  │
│  │  (Canvas)     │  │  CRUD Panel  │  │  Alerts  │  │
│  └───────┬───────┘  └──────┬───────┘  └────┬─────┘  │
│          │         REST API │               │ SSE    │
└──────────┼─────────────────┼───────────────┼────────┘
           │                 │               │
┌──────────▼─────────────────▼───────────────▼────────┐
│               Express Server (Port 3001)              │
│  ┌──────────────────────────────────────────────┐    │
│  │                  路由层 /api/*                │    │
│  │  /keywords  /hot-topics  /alerts  /settings  │    │
│  │  /events (SSE)                               │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  ┌──────────┐  ┌───────────┐  ┌────────────────┐    │
│  │ Scheduler │  │  AI 服务  │  │   通知服务      │    │
│  │ (cron)   │  │(OpenRouter)│  │ SSE + Email    │    │
│  └────┬─────┘  └─────┬─────┘  └────────────────┘    │
│       │              │                                │
│  ┌────▼──────────────▼────────────────────────────┐  │
│  │              数据层 (better-sqlite3)             │  │
│  │   keywords  raw_items  hot_topics  alerts       │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────┐
│              外部数据源 (定时抓取)                      │
│  HackerNews API  Reddit RSS  HuggingFace  Verge AI  │
└─────────────────────────────────────────────────────┘
```

---

## 三、数据库 Schema

```sql
-- 用户监控的关键词
CREATE TABLE keywords (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword     TEXT NOT NULL,
  description TEXT DEFAULT '',
  active      INTEGER DEFAULT 1,  -- 0=暂停 1=监控中
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);

-- 从数据源抓取的原始条目（去重用 url UNIQUE）
CREATE TABLE raw_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT NOT NULL,
  title        TEXT NOT NULL,
  url          TEXT UNIQUE,
  content      TEXT DEFAULT '',
  published_at TEXT,
  crawled_at   TEXT DEFAULT (datetime('now','localtime')),
  processed    INTEGER DEFAULT 0  -- 0=待处理 1=已AI分析
);

-- AI 处理后的热点（展示用）
CREATE TABLE hot_topics (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  raw_item_id  INTEGER,
  title        TEXT NOT NULL,
  url          TEXT,
  source       TEXT NOT NULL,
  summary      TEXT DEFAULT '',   -- AI 生成的中文摘要
  score        INTEGER DEFAULT 5, -- AI 热度分 1-10
  category     TEXT DEFAULT 'other',
  published_at TEXT,
  created_at   TEXT DEFAULT (datetime('now','localtime'))
);

-- 关键词命中的告警记录
CREATE TABLE alerts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_id   INTEGER NOT NULL,
  keyword_text TEXT NOT NULL,
  hot_topic_id INTEGER NOT NULL,
  topic_title  TEXT NOT NULL,
  topic_url    TEXT DEFAULT '',
  confidence   REAL DEFAULT 0,    -- AI 判断置信度 0.0-1.0
  reason       TEXT DEFAULT '',   -- AI 判断理由
  is_read      INTEGER DEFAULT 0, -- 0=未读 1=已读
  created_at   TEXT DEFAULT (datetime('now','localtime'))
);

-- 全局配置（KV 表）
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
```

**默认配置键：**
| Key | 默认值 | 说明 |
|---|---|---|
| openrouter_api_key | '' | OpenRouter API Key |
| openrouter_model | deepseek/deepseek-chat | 使用的模型 |
| email_enabled | false | 是否启用邮件通知 |
| email_smtp_host | '' | SMTP 服务器 |
| email_smtp_port | 587 | SMTP 端口 |
| email_smtp_user | '' | 邮件账号 |
| email_smtp_pass | '' | 邮件密码/应用密码 |
| email_to | '' | 收件人 |
| check_interval | 30 | 抓取间隔（分钟） |

---

## 四、API 路由设计

| Method | Path | 说明 |
|---|---|---|
| GET | /api/keywords | 获取所有关键词 |
| POST | /api/keywords | 添加关键词 |
| PUT | /api/keywords/:id | 修改关键词（含 active 状态） |
| DELETE | /api/keywords/:id | 删除关键词 |
| GET | /api/hot-topics | 获取热点列表（?hours=48） |
| POST | /api/hot-topics/refresh | 手动触发抓取 |
| GET | /api/alerts | 获取告警列表 |
| PUT | /api/alerts/:id/read | 标记单条已读 |
| PUT | /api/alerts/read-all | 全部已读 |
| GET | /api/settings | 获取配置（密码脱敏） |
| PUT | /api/settings | 保存配置 |
| GET | /events | SSE 实时推送连接 |

**SSE 事件类型：**
| event | data | 触发时机 |
|---|---|---|
| connected | `{status:"ok"}` | 客户端建立连接 |
| alert | `{keyword, title, url, summary, confidence}` | 关键词命中 |
| refresh | `{newItems, newTopics}` | 新热点入库 |
| ping | `{ts}` | 每次 pipeline 完成 |
| heartbeat | — | 每 25s 保活 |

---

## 五、AI 调用设计（OpenRouter）

### 5.1 热点分析（批量）

```
POST https://openrouter.ai/api/v1/chat/completions
Headers:
  Authorization: Bearer <key>
  HTTP-Referer: http://localhost:3001
  X-OpenRouter-Title: Jitang Hot Monitor
  Content-Type: application/json

Body:
  model: deepseek/deepseek-chat (可配置)
  temperature: 0.1
  messages: [{ role: "user", content: "批量分析 prompt" }]
```

**Prompt 设计（批量分析）：** 传入 10 条原始标题+摘要，要求返回 JSON 数组，含 index/score/summary/category。

**Fallback：** AI 调用失败时，默认 score=5，summary=标题前40字，category=other。

### 5.2 关键词验证（单条）

**Prompt 设计：** 传入内容（≤800字）+ 关键词，要求返回 `{matched, confidence, reason}`。

**阈值：** confidence ≥ 0.65 才触发告警。

**前置优化：** 先做本地文本 includes 预筛，命中后才调用 AI，节省 API 费用。

---

## 六、前端视觉设计

### 6.1 设计关键词

> **深宇宙黑 · 电青脉冲 · 雷达扫描**

### 6.2 色彩系统

| Token | 色值 | 用途 |
|---|---|---|
| bg-void | #050810 | 页面背景 |
| bg-surface | #0a0e1a | 卡片/面板背景 |
| bg-elevated | #0f1525 | 悬浮层背景 |
| primary | #00f5d4 | 雷达线/主操作 |
| primary-dim | rgba(0,245,212,0.15) | 同心圆/网格 |
| accent | #7f5af0 | 次要强调 |
| alert | #f5a623 | 关键词告警 blip |
| danger | #ff4d4f | 高危告警 |
| text-primary | #e8eaf6 | 主要文字 |
| text-secondary | #7c8db5 | 辅助文字 |
| border | rgba(0,245,212,0.15) | 边框 |

### 6.3 雷达视图逻辑（Canvas 2D）

```
绘制元素：
1. 4 条同心圆（range rings）
2. 十字准星线
3. 旋转扫描线 + 磷光余晖（arc fill 渐变透明度）
4. 热点 blip（圆点）
   - 位置：极坐标，半径 ∝ (10 - score)，角度用黄金分割角分布
   - 颜色：普通=#00f5d4，告警=#f5a623
   - 大小：score>7 → r=5，else r=3
   - 脉冲：扫描线经过时亮度提升
5. 悬浮 Tooltip：展示 title + summary + source

动画：RAF 驱动，扫描线每帧旋转 0.8°
```

### 6.4 字体

- 标题/Logo: Orbitron（Google Fonts，科技感）
- 正文: Inter（清晰易读）
- 代码/数据: JetBrains Mono

---

## 七、项目目录结构

```
jitang-hot-monitor/
├── docs/                         # 文档
│   ├── requirements.md
│   ├── design.md
│   └── api-reference.md
├── server/                       # Express 后端
│   ├── src/
│   │   ├── app.ts                # 入口，路由挂载
│   │   ├── db.ts                 # SQLite 初始化 + 查询对象
│   │   ├── scheduler.ts          # node-cron 调度
│   │   ├── routes/
│   │   │   ├── keywords.ts
│   │   │   ├── hotTopics.ts
│   │   │   ├── alerts.ts
│   │   │   ├── settings.ts
│   │   │   └── sse.ts
│   │   └── services/
│   │       ├── ai.ts             # OpenRouter 调用
│   │       ├── crawler.ts        # 多源抓取
│   │       ├── monitor.ts        # 关键词匹配 pipeline
│   │       └── notify.ts         # SSE广播 + 邮件
│   ├── data/                     # SQLite 数据库文件（git ignore）
│   ├── .env                      # 实际配置（git ignore）
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── client/                       # React 前端
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── types/index.ts
│   │   ├── api/index.ts
│   │   ├── hooks/
│   │   │   └── useSSE.ts
│   │   ├── components/
│   │   │   ├── RadarCanvas.tsx   # 核心雷达动画
│   │   │   ├── HotTopicCard.tsx
│   │   │   ├── KeywordManager.tsx
│   │   │   ├── AlertBanner.tsx
│   │   │   └── Layout.tsx
│   │   └── pages/
│   │       ├── Dashboard.tsx
│   │       └── Settings.tsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── postcss.config.js
└── agent-skill/                  # Phase 2: Claude Skills
```

---

## 八、开发阶段

| 阶段 | 任务 | 状态 |
|---|---|---|
| Phase 1a | 后端：DB + 爬虫 + AI + 调度 | ✅ |
| Phase 1b | 后端：路由 + SSE + 邮件通知 | ✅ |
| Phase 2 | 前端：雷达 UI + 关键词管理 + 设置页 | 🚧 |
| Phase 3 | 联调测试 + 浏览器通知集成 | ⬜ |
| Phase 4 | Agent Skills 封装 | ⬜ |
