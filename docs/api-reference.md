# 极客雷达 · 外部 API 对接参考

> 版本: 1.0 · 日期: 2026-06-03 · 基于实时 MCP 查询结果

---

## 一、OpenRouter API

### 1.1 基本信息

| 项 | 值 |
|---|---|
| Endpoint | `https://openrouter.ai/api/v1/chat/completions` |
| Method | POST |
| Auth | `Authorization: Bearer <OPENROUTER_API_KEY>` |
| 文档来源 | https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request |

### 1.2 必需 Headers

```
Authorization: Bearer <key>
HTTP-Referer: http://localhost:3001        # 用于出现在 OpenRouter 排行榜
X-OpenRouter-Title: Jitang Hot Monitor    # 应用名称（注意：不是 X-Title）
Content-Type: application/json
```

> ⚠️ 注意：正确的 header 名为 `X-OpenRouter-Title`，不是 `X-Title`

### 1.3 请求体

```json
{
  "model": "deepseek/deepseek-chat",
  "messages": [{ "role": "user", "content": "..." }],
  "temperature": 0.1
}
```

### 1.4 推荐模型

| 模型 | Provider | 特点 | 用途 |
|---|---|---|---|
| `deepseek/deepseek-chat` | DeepSeek | 极低成本，中文优秀 | 默认（热点分析） |
| `google/gemini-flash-2.0` | Google | 速度快，性价比高 | 备选 |
| `anthropic/claude-haiku-4-5` | Anthropic | 准确度高 | 高精度验证 |

### 1.5 响应格式

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "<回复文本>"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
  }
}
```

### 1.6 错误码

| 状态码 | 含义 |
|---|---|
| 401 | API Key 无效 |
| 402 | 余额不足 |
| 429 | 速率限制 |
| 500/502 | 上游模型服务异常 |

---

## 二、HackerNews Firebase API

### 2.1 基本信息

| 项 | 值 |
|---|---|
| Base URL | `https://hacker-news.firebaseio.com/v0` |
| Auth | 无需认证 |
| Rate Limit | 无 |
| 文档来源 | https://github.com/HackerNews/API |

### 2.2 接口

```
GET /topstories.json
  返回: [12345, 67890, ...]  最多 500 个 ID

GET /item/{id}.json
  返回: {
    id, title, url, text,
    time (Unix timestamp),
    score, by, kids, type
  }
```

### 2.3 使用方式

```typescript
// 获取 Top 30 故事
const idsRes = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json')
const top30Ids = idsRes.data.slice(0, 30)
// 并行获取详情
const items = await Promise.allSettled(
  top30Ids.map(id => axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`))
)
```

---

## 三、Reddit RSS

### 3.1 RSS 地址格式

```
https://www.reddit.com/r/{subreddit}/.rss
```

| Subreddit | RSS URL |
|---|---|
| r/MachineLearning | https://www.reddit.com/r/MachineLearning/.rss |
| r/LocalLLaMA | https://www.reddit.com/r/LocalLLaMA/.rss |
| r/artificial | https://www.reddit.com/r/artificial/.rss |

### 3.2 注意事项

- 无需 API Key，免费公开
- 需要设置 User-Agent，否则 Reddit 可能返回 429
- 建议使用: `Mozilla/5.0 (compatible; JitangHotMonitor/1.0)`

---

## 四、HuggingFace Blog RSS

```
URL: https://huggingface.co/blog/feed.xml
Auth: 无
Limit: 建议每次取最新 10 条
```

---

## 五、The Verge AI RSS

```
URL: https://www.theverge.com/ai-artificial-intelligence/rss/index.xml
Auth: 无
```

---

## 六、nodemailer SMTP 对接

### 6.1 版本信息

| 包 | 版本 |
|---|---|
| nodemailer | ^6.9.x |
| @types/nodemailer | 8.0.0 |

### 6.2 核心代码

```typescript
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',     // 或其他 SMTP 服务商
  port: 587,
  secure: false,              // port 465 时为 true，587 时为 false
  auth: {
    user: 'your@gmail.com',
    pass: 'app_password'      // Gmail 需使用"应用专用密码"
  }
})

await transporter.sendMail({
  from: '"极客雷达" <your@gmail.com>',
  to: 'recipient@example.com',
  subject: '主题',
  html: '<b>HTML内容</b>'
})
```

### 6.3 Gmail 配置说明

1. 开启两步验证
2. 生成"应用专用密码"（Google 账号 → 安全性 → 两步验证 → 应用密码）
3. 使用应用密码代替账号密码

---

## 七、rss-parser 使用

### 7.1 版本信息

| 包 | 版本 | 状态 |
|---|---|---|
| rss-parser | 3.13.0 | 稳定但 3 年未更新，仍可用 |

### 7.2 核心代码

```typescript
import RSSParser from 'rss-parser'

const parser = new RSSParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JitangHotMonitor/1.0)'
  }
})

const feed = await parser.parseURL('https://www.reddit.com/r/MachineLearning/.rss')
// feed.items 是条目数组，每条有 title, link, pubDate, contentSnippet 等字段
```

---

## 八、better-sqlite3

### 8.1 版本信息

| 包 | 版本 | 状态 |
|---|---|---|
| better-sqlite3 | 12.10.0 | 活跃维护（21天前更新） |
| @types/better-sqlite3 | — | 类型定义内置 |

### 8.2 关键 API

```typescript
import Database from 'better-sqlite3'
const db = new Database('path/to/db.sqlite')

// 开启 WAL 模式（更好的并发读性能）
db.pragma('journal_mode = WAL')

// 预编译语句（推荐）
const stmt = db.prepare('SELECT * FROM table WHERE id = ?')
const row = stmt.get(1)      // 返回单行
const rows = stmt.all()      // 返回多行
const info = stmt.run(...)   // INSERT/UPDATE，返回 {changes, lastInsertRowid}
```
