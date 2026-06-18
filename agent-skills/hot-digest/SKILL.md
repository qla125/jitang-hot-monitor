---
name: hot-digest
description: 一键生成今日 AI/科技热点日报，从 HackerNews 抓取最新热门讨论，由 AI 分类汇总输出结构化报告。完全自包含，无需任何 API Key 或本地服务。
---

# hot-digest

从 HackerNews 抓取过去 N 小时的热门 AI/科技内容，由你（AI）分类汇总，输出结构化日报。

## When to use

用户想获取今日 AI/科技动态概览，不需要指定具体关键词：
- `/hot-digest`（默认过去 24 小时）
- `/hot-digest 48`（过去 48 小时）

## Instructions

### Step 1：解析时间范围

从消息中提取小时数，默认 **24 小时**。

输出：`📅 正在获取过去 <N> 小时的 AI/科技热点...`

### Step 2：从 HackerNews 抓取（API 细节见 `../references/search-sources.md`）

计算起始时间戳：`echo $(($(date +%s) - N * 3600))`

**请求 1 — AI/LLM 定向搜索：**
```
GET https://hn.algolia.com/api/v1/search?query=AI+LLM+Claude+GPT&tags=story&hitsPerPage=15&numericFilters=created_at_i><时间戳>
```

**请求 2 — 高热度通用技术内容：**
```
GET https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=20&numericFilters=created_at_i><时间戳>,points>50
```

合并两次结果，按 `points` 降序排列，去重（以 `objectID` 为准），取前 20 条。

### Step 3：AI 内容分类与筛选

对每条内容判断：

1. 是否与 AI/科技/编程/产品/开源相关（无关的跳过）
2. 归属类别（选一）：`model-release` / `tool-update` / `research` / `funding` / `discussion` / `other`
3. 给出一句话中文摘要（不超过 30 字）

相关性判断原则见 `../references/relevance-guide.md`。

### Step 4：格式化输出

按类别分组输出，空类别不显示：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 AI 热点日报 · 过去 <N> 小时 · 来源 HackerNews
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 模型发布 / 更新
  • <标题>（<points> 分）— <摘要>
    <链接>

🛠️ 工具 / 产品更新
  • ...

🔬 研究 / 论文
  • ...

💰 融资 / 商业
  • ...

💬 社区热门讨论
  • ...

📰 其他科技资讯
  • ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
深入了解某个话题 → /hot-scan <关键词>
```
