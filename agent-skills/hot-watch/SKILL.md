---
name: hot-watch
description: 对关键词进行深度分析：生成语义扩展词、多词并发搜索、展示命中热点，并给出长期监控建议。完全自包含，无需任何本地服务或必填 API Key。
---

# hot-watch

对用户提供的关键词做完整的「监控准备」：生成查询扩展词、用原词+扩展词分别搜索、汇总命中结果，并给出监控策略建议。

## When to use

用户想为某个话题建立持续关注策略时调用：
- `/hot-watch GPT-5`
- `/hot-watch 程序员鱼皮`
- `/hot-watch Cursor 编辑器`

与 `/hot-scan` 的区别：`/hot-scan` 侧重「立即找到当前热点」，`/hot-watch` 侧重「帮你理解这个关键词应该怎么监控」，输出更多分析和建议。

## Instructions

### Step 1：解析关键词

从用户消息中提取关键词（`/hot-watch` 后面的内容）。

### Step 2：关键词深度分析与扩展

用你的语言理解能力分析该关键词，输出：

**关键词类型判断**（选一）：
- `产品/模型`（如 "GPT-5"、"Cursor"）
- `人物/账号`（如 "程序员鱼皮"、"Andrej Karpathy"）
- `事件/话题`（如 "AI 替代程序员"、"大模型价格战"）
- `技术概念`（如 "MCP"、"RAG"、"Function Calling"）

**生成 5-8 个扩展词**，覆盖：
- 中英文变体
- 常见简称/全称互换
- 相关账号名/标签（针对人物类）
- 同类竞品/相关概念（仅2-3个，不要泛化）

输出：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔭 hot-watch 分析：「<关键词>」
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
类型：<关键词类型>
扩展词：
  • <term1>（说明）
  • <term2>（说明）
  ...
```

### Step 3：多词并发搜索 HackerNews

对 **关键词本身** 和 **前 3 个扩展词** 分别调用 HackerNews Algolia API：

```
GET https://hn.algolia.com/api/v1/search?query=<URL编码的词>&tags=story&hitsPerPage=5&numericFilters=created_at_i><7天前时间戳>
```

7 天前时间戳用 Bash 计算：`echo $(($(date +%s) - 604800))`

按 `url` 去重合并所有结果（优先保留分数高的），取前 15 条候选。

若有 `SERPER_API_KEY` 环境变量，对关键词追加调用 Google News：
```bash
curl -s -X POST https://google.serper.dev/news \
  -H "X-API-KEY: $SERPER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q": "<关键词>", "num": 5}'
```

### Step 4：AI 相关性验证

对所有候选条目逐一判断（宁缺毋滥原则，同 `/hot-scan`）：
- confidence ≥ 0.7 才保留
- 特别注意过滤「仅顺带提及」的内容

### Step 5：输出监控报告

```
📊 近期热点（过去 7 天）

[1] <标题>
    来源：<来源> · <时间>
    链接：<URL>
    相关度：<confidence> — <reason>

[2] ...

若无命中：「过去 7 天暂无相关热点」

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗂️ 监控建议

推荐监控词（按优先级）：
  1. <原词> — 必选，最精准
  2. <扩展词A> — 建议，覆盖英文场景
  3. <扩展词B> — 可选，扩大召回

监控频率建议：<根据关键词热度给出建议，如「每天一次」或「每 6 小时一次」>

配合使用：
  /hot-scan <原词>      → 随时查看最新命中
  /hot-digest          → 查看今日整体 AI 热点概览
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
