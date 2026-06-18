---
name: hot-watch
description: 关键词深度分析：生成语义扩展词、多源并发搜索（含中文源）、AI 验证命中结果，并输出监控策略建议。完全自包含，无需本地服务或必填 API Key。
---

# hot-watch

对用户提供的关键词做完整的「监控准备」：类型分析 → 扩展词生成 → 多源搜索 → 相关性验证 → 监控策略建议。

## When to use

用户想为某个话题建立持续关注策略：
- `/hot-watch GPT-5`
- `/hot-watch 程序员鱼皮`
- `/hot-watch Cursor 编辑器`

与 `/hot-scan` 的区别：`/hot-scan` 侧重「立即找热点」，`/hot-watch` 侧重「帮你理解这个词怎么监控」，输出更多分析和建议。

## Instructions

### Step 1：关键词类型判断 + 扩展词生成

分析关键词类型（选一）：`产品/模型` / `人物/账号` / `事件/话题` / `技术概念`

生成 5-8 个扩展词，覆盖：
- 中英文变体、简称/全称
- 人物类：相关账号名/常见标签
- 产品型号保留原样，不翻译

输出：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔭 hot-watch 分析：「<关键词>」
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
类型：<类型>
扩展词：
  • <term1>（说明）
  • <term2>（说明）...
```

### Step 2：多源并发搜索

对关键词本身 + 前 2 个扩展词各执行搜索（API 细节见 `../references/search-sources.md`）：

**HackerNews**（3 个词分别搜，按 url 去重合并，取前 15 条）：
```
GET https://hn.algolia.com/api/v1/search?query=<词>&tags=story&hitsPerPage=5&numericFilters=created_at_i><7天前时间戳>
```
7天前时间戳：`echo $(($(date +%s) - 604800))`

**中文源**（若 Python 可用，见 `../references/search-sources.md` → 第5节）：
```bash
python ../scripts/search_china.py "<关键词>" --limit 5
```

**Google News**（若 `SERPER_API_KEY` 存在，见 `../references/search-sources.md` → 第2节）

### Step 3：AI 相关性验证

判断标准见 `../references/relevance-guide.md`，confidence ≥ 0.7 才保留。

### Step 4：输出监控报告

```
📊 近期热点（过去 7 天，<N> 条命中）

[1] <标题>
    来源：<来源> · <时间> | 链接：<URL>
    相关度：<confidence> — <reason>

[2] ...

若无命中：「过去 7 天暂无相关热点」

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗂️ 监控策略建议

推荐监控词（按优先级）：
  1. <原词>      必选，最精准
  2. <扩展词A>   建议，覆盖英文场景
  3. <扩展词B>   可选，扩大召回

监控频率：<根据关键词热度给出，如"每天一次"/"每 6 小时一次">

搭配使用：
  /hot-scan <原词>   随时查看最新命中
  /hot-digest        查看今日整体 AI 热点概览
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
