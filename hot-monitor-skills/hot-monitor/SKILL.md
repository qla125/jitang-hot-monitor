---
name: hot-monitor
description: 热点监控一体化技能：自动识别意图，支持关键词即时搜索、今日热点日报、关键词监控策略三种模式。完全自包含，无需本地服务或必填 API Key。
---

# hot-monitor

从 HackerNews、Bilibili、微博、Google News 等来源抓取最新内容，由你（AI）验证相关性并输出结果。根据用户输入自动切换三种模式。

## When to use

用户想了解某个关键词的热点动态，或获取今日科技概览：
- `/hot-monitor Claude Sonnet 5` → 立即搜索该关键词的最新热点（**Scan 模式**）
- `/hot-monitor` 或 `/hot-monitor digest` → 今日 AI/科技热点日报（**Digest 模式**）
- `/hot-monitor watch GPT-5` → 关键词深度分析 + 监控策略建议（**Watch 模式**）

## Instructions

### Step 0：识别意图，路由到对应模式

| 用户输入 | 模式 |
|---------|------|
| `/hot-monitor`（无参数）或 `/hot-monitor digest [N小时]` | → **Digest 模式**（日报） |
| `/hot-monitor watch <关键词>` | → **Watch 模式**（深度分析） |
| `/hot-monitor <关键词>`（无 watch 前缀） | → **Scan 模式**（即时搜索） |

识别后输出一行提示，然后进入对应流程。

---

## 模式一：Scan — 关键词即时搜索

**触发**：`/hot-monitor <关键词>`

### S1：解析关键词 + 生成扩展词

从消息中提取关键词，生成 3-5 个别名/变体（规则见 `../references/relevance-guide.md` 的"特殊情形"部分）：
- 中英文变体、简称/全称
- 产品型号保留原样，不翻译

输出：
```
🔍 关键词：<keyword>  扩展词：<term1>, <term2>...
```

### S2：从 HackerNews 搜索（始终执行）

调用 HN Algolia API（API 细节见 `../references/search-sources.md` → 第1节）：
- 最近 7 天，取 10 条
- 7天前时间戳：`echo $(($(date +%s) - 604800))`

### S3：从中文源搜索（若 Python 可用）

```bash
python ../scripts/search_china.py "<关键词>" --limit 5
```

若 Python 不可用，跳过继续。

### S4：从 Google News 搜索（若 SERPER_API_KEY 存在）

检查 `echo ${SERPER_API_KEY:-""}`，若存在则调用（见 `../references/search-sources.md` → 第2节），否则跳过。

### S5：AI 相关性验证

逐一判断候选条目，判断标准见 `../references/relevance-guide.md`，confidence ≥ 0.7 才保留。

### S6：输出

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 hot-monitor scan：「<关键词>」
命中 <N> 条 / 已过滤 <M> 条不相关
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1] <标题>
    来源：<来源名> · <时间>
    链接：<URL>
    相关理由：<一句话>
    热度：<分数/播放量等>

[2] ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
提示：需要监控策略分析 → /hot-monitor watch <关键词>
```

若无命中：提示尝试更宽泛的关键词或使用 Watch 模式。

---

## 模式二：Digest — 今日热点日报

**触发**：`/hot-monitor` 或 `/hot-monitor digest [N]`

### D1：解析时间范围

从消息中提取小时数，默认 **24 小时**。

输出：`📅 正在获取过去 <N> 小时的 AI/科技热点...`

### D2：从 HackerNews 抓取（API 细节见 `../references/search-sources.md` → 第1节）

计算起始时间戳：`echo $(($(date +%s) - N * 3600))`

**请求 1 — AI/LLM 定向：**
```
GET https://hn.algolia.com/api/v1/search?query=AI+LLM+Claude+GPT&tags=story&hitsPerPage=15&numericFilters=created_at_i><时间戳>
```

**请求 2 — 高热度通用技术：**
```
GET https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=20&numericFilters=created_at_i><时间戳>,points>50
```

合并两次结果，按 `points` 降序，去重（以 `objectID` 为准），取前 20 条。

### D3：AI 分类与筛选

对每条内容判断：
1. 是否与 AI/科技/编程/产品/开源相关（无关的跳过）
2. 归属类别（选一）：`model-release` / `tool-update` / `research` / `funding` / `discussion` / `other`
3. 给出一句话中文摘要（不超过 30 字）

相关性原则见 `../references/relevance-guide.md`。

### D4：输出

按类别分组，空类别不显示：

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
深入了解某个话题 → /hot-monitor watch <关键词>
```

---

## 模式三：Watch — 关键词深度分析

**触发**：`/hot-monitor watch <关键词>`

### W1：关键词类型判断 + 扩展词生成

分析关键词类型（选一）：`产品/模型` / `人物/账号` / `事件/话题` / `技术概念`

生成 5-8 个扩展词，覆盖：
- 中英文变体、简称/全称
- 人物类：相关账号名/常见标签
- 产品型号保留原样，不翻译

输出：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔭 hot-monitor watch：「<关键词>」
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
类型：<类型>
扩展词：
  • <term1>（说明）
  • <term2>（说明）...
```

### W2：多源并发搜索

对关键词本身 + 前 2 个扩展词各执行搜索（API 细节见 `../references/search-sources.md`）：

**HackerNews**（3 个词分别搜，按 url 去重合并，取前 15 条）：
```
GET https://hn.algolia.com/api/v1/search?query=<词>&tags=story&hitsPerPage=5&numericFilters=created_at_i><7天前时间戳>
```

**中文源**（若 Python 可用）：
```bash
python ../scripts/search_china.py "<关键词>" --limit 5
```

**Google News**（若 `SERPER_API_KEY` 存在，见 `../references/search-sources.md` → 第2节）

### W3：AI 相关性验证

判断标准见 `../references/relevance-guide.md`，confidence ≥ 0.7 才保留。

### W4：输出监控报告

```
📊 近期热点（过去 7 天，<N> 条命中）

[1] <标题>
    来源：<来源> · <时间> | 链接：<URL>
    相关度：<confidence> — <reason>

若无命中：「过去 7 天暂无相关热点」

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗂️ 监控策略建议

推荐监控词（按优先级）：
  1. <原词>      必选，最精准
  2. <扩展词A>   建议，覆盖英文场景
  3. <扩展词B>   可选，扩大召回

监控频率：<根据关键词热度给出，如"每天一次"/"每 6 小时一次">

搭配使用：
  /hot-monitor <原词>        随时查看最新命中
  /hot-monitor digest        查看今日整体 AI 热点概览
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
