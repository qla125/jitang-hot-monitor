---
name: hot-scan
description: 针对指定关键词跨多源搜索最新热点，AI 直接验证相关性后输出命中内容。完全自包含，无需启动任何本地服务，无必填 API Key，支持中英文来源。
---

# hot-scan

针对用户提供的关键词，从 HackerNews、Bilibili、微博、Google News 等来源抓取最新内容，由你（AI）直接判断相关性，输出真正命中的热点条目。

## When to use

用户想立即了解某个关键词的最新互联网动态：
- `/hot-scan Claude Sonnet 5`
- `/hot-scan Cursor AI editor`
- `/hot-scan 程序员鱼皮`

## Instructions

### Step 1：解析关键词 + 生成扩展词

从用户消息中提取关键词（`/hot-scan` 后面的内容）。

生成 3-5 个语义相近的别名/变体扩大召回范围（规则详见 `../references/relevance-guide.md` 的"特殊情形"部分）：
- 中英文变体、常见简称/全称
- 产品型号/代号保留原样，不翻译

输出：
```
🔍 关键词：<keyword>  扩展词：<term1>, <term2>...
```

### Step 2：从 HackerNews 搜索（始终执行）

调用 HN Algolia API 搜索关键词本身（API 细节见 `../references/search-sources.md` → 第1节）：
- 最近 7 天内容，取 10 条
- 7天前时间戳：`echo $(($(date +%s) - 604800))`

### Step 3：从中文源搜索（优先用脚本）

**若 Python 可用**，执行脚本获取 Bilibili + 微博结果（详见 `../references/search-sources.md` → 第5节）：
```bash
python ../scripts/search_china.py "<关键词>" --limit 5
```

**若 Python 不可用**，跳过此步骤，继续。

### Step 4：从 Google News 搜索（可选）

检查 `SERPER_API_KEY` 是否存在（`echo ${SERPER_API_KEY:-""}`）。若存在，按 `../references/search-sources.md` → 第2节调用；若不存在，跳过。

### Step 5：AI 相关性验证

对所有候选条目逐一判断相关性。

**判断标准见 `../references/relevance-guide.md`**，核心：宁缺毋滥，confidence ≥ 0.7 才保留。

### Step 6：格式化输出

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 hot-scan：「<关键词>」
命中 <N> 条 / 已过滤 <M> 条不相关
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1] <标题>
    来源：<来源名> · <时间>
    链接：<URL>
    相关理由：<一句话>
    热度：<分数/播放量等>

[2] ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
提示：如需监控策略分析，可用 /hot-watch <关键词>
```

若无任何命中：提示尝试更宽泛的关键词或使用 `/hot-watch`。
