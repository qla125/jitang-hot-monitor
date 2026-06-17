---
name: hot-scan
description: 针对指定关键词，跨公开信息源搜索最新热点，由 AI 直接验证相关性后输出命中内容。完全自包含，无需启动任何本地服务，无必填 API Key。
---

# hot-scan

针对用户提供的关键词，从 HackerNews 等公开信息源抓取最新内容，由你（AI）直接判断相关性（宁缺毋滥原则），输出真正命中的热点条目。

## When to use

用户想立即了解某个关键词的最新互联网动态时调用，例如：
- `/hot-scan Claude Sonnet 5`
- `/hot-scan Cursor AI editor`
- `/hot-scan 鱼皮 AI 导航`

## Instructions

### Step 1：解析关键词并生成查询扩展词

从用户消息中提取关键词（`/hot-scan` 后面的内容）。

用你自己的语言理解能力为该关键词生成 3-5 个语义相近的别名/变体，用于扩大搜索召回。规则：
- 包括同义改写、中英文变体、常见简称/全称互换
- 如果包含产品型号/代号（如 "Sonnet"、"GPT-5"），保留原样不翻译
- 不要泛化到无关主题

输出：
```
🔍 关键词：<keyword>
📎 扩展词：<term1>, <term2>, <term3>...
```

### Step 2：从 HackerNews 搜索（免费，无需 Key）

对关键词调用 HackerNews Algolia API（用 WebFetch 工具）：

```
GET https://hn.algolia.com/api/v1/search?query=<URL编码的关键词>&tags=story&hitsPerPage=10&numericFilters=created_at_i><7天前Unix时间戳>
```

7 天前 Unix 时间戳 = 当前时间戳 - 604800。用 Bash 工具计算：
```bash
echo $(($(date +%s) - 604800))
```

从响应的 `hits` 数组提取每条结果：`title`, `url`（无则用 `https://news.ycombinator.com/item?id=<objectID>`）, `points`, `num_comments`, `created_at`

### Step 3：从 Google News 搜索（可选，需要 SERPER_API_KEY）

用 Bash 检查 `SERPER_API_KEY` 是否存在：`echo ${SERPER_API_KEY:-""}` 。

若存在，调用 Serper Google News API：
```bash
curl -s -X POST https://google.serper.dev/news \
  -H "X-API-KEY: $SERPER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q": "<关键词>", "num": 6}'
```
从 `news` 数组提取：`title`, `link`, `snippet`, `source`, `date`。

若不存在，跳过此步骤。

### Step 4：AI 相关性验证（你直接判断，无需任何外部 API）

对所有候选条目，逐一判断是否与关键词「实质性相关」。

**宁缺毋滥原则** — 按以下标准严格筛选：

✅ 保留（matched=true）的情形：
- 内容的核心讨论对象就是该关键词所指代的具体事件、产品、人物或话题
- 即使没有逐字出现关键词，但明显在讨论同一件事

❌ 过滤掉（matched=false）的情形：
- 内容只是在列表/对比中「顺带提到」关键词，通篇讨论的是别的主体
- 标题包含关键词，但正文跑题（标题党）
- 关键词只是作为背景信息/对比举例出现

只保留 confidence ≥ 0.7 的条目。

### Step 5：格式化输出

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 hot-scan：「<关键词>」
命中 <N> 条 / 过滤 <M> 条不相关
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1] <标题>
    来源：<来源名> · <时间>
    链接：<URL>
    相关理由：<一句话说明>
    热度：<points 分 / 评论数>（若有）

[2] ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
提示：如需扩展词分析或持续关注建议，可使用 /hot-watch <关键词>
```

若无任何命中，输出：
```
未找到与「<关键词>」实质相关的近期内容。
建议：尝试更宽泛的关键词，或用 /hot-watch 查看查询扩展建议。
```
