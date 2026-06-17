---
name: hot-digest
description: 一键生成今日 AI/科技热点日报，从 HackerNews 抓取过去 24 小时热门讨论，由 AI 分类汇总。完全自包含，无需任何 API Key 或本地服务。
---

# hot-digest

从 HackerNews 抓取过去 24 小时（可自定义）的热门 AI/科技相关讨论，由你（AI）分类汇总，输出结构化的热点日报。

## When to use

用户想获取今日 AI/科技动态概览时调用，不需要指定具体关键词：
- `/hot-digest`
- `/hot-digest 48`（过去 48 小时）

## Instructions

### Step 1：解析时间范围参数

从用户消息中提取小时数参数（`/hot-digest` 后面的数字）。

若没有参数，默认使用 **24 小时**。

输出：`📅 正在获取过去 <N> 小时的 AI/科技热点...`

### Step 2：从 HackerNews 抓取热门故事

用 Bash 工具计算起始 Unix 时间戳（N 小时前）：
```bash
echo $(($(date +%s) - <N> * 3600))
```

用 WebFetch 工具调用 HackerNews Algolia API（分两次请求，扩大覆盖）：

**请求 1 — AI/LLM 相关：**
```
GET https://hn.algolia.com/api/v1/search?query=AI+LLM+Claude+GPT+machine+learning&tags=story&hitsPerPage=15&numericFilters=created_at_i><时间戳>
```

**请求 2 — 通用科技热点（按热度排序）：**
```
GET https://hn.algolia.com/api/v1/search_by_date?query=&tags=story&hitsPerPage=20&numericFilters=created_at_i><时间戳>,points>50
```

合并两次结果，按 `points`（热度分数）降序排列，去掉重复的 `objectID`，取前 20 条。

### Step 3：AI 内容分类与筛选

对每条内容判断：
1. 是否与 AI/科技/编程/产品/开源 相关（无关的跳过，如纯政治/体育/娱乐）
2. 归属类别（从下列选一）：
   - `model-release`（模型发布/更新）
   - `tool-update`（工具/产品更新）
   - `research`（研究/论文）
   - `funding`（融资/商业动态）
   - `discussion`（社区热门讨论）
   - `other`（其他科技资讯）
3. 给出一句话中文摘要（不超过 30 字）

### Step 4：格式化输出日报

按类别分组，输出结构化日报：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 AI 热点日报 · 过去 <N> 小时
来源：HackerNews  共 <N> 条
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 模型发布 / 更新
  • <标题>（<points>分）— <一句话摘要>
    <链接>

🛠️ 工具 / 产品更新
  • ...

🔬 研究 / 论文
  • ...

💬 社区热门讨论
  • ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 想深入了解某个话题，可使用 /hot-scan <关键词>
```

若某类别没有内容，跳过该分组（不显示空标题）。

若完全没有相关内容（极少见），输出：
```
过去 <N> 小时暂无显著 AI/科技热点。可尝试拉长时间范围：/hot-digest 48
```
