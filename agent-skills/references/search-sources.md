# 搜索源技术文档

各搜索源的 API 细节、参数说明与注意事项。供 hot-scan / hot-watch / hot-digest 在执行时按需读取。

---

## 1. HackerNews Algolia（免费，无需 Key）

**按关键词搜索（最近 N 天）：**
```
GET https://hn.algolia.com/api/v1/search
  ?query=<URL编码关键词>
  &tags=story
  &hitsPerPage=10
  &numericFilters=created_at_i><Unix时间戳>
```

**按热度搜索最新（用于 hot-digest）：**
```
GET https://hn.algolia.com/api/v1/search_by_date
  ?query=<关键词>
  &tags=story
  &hitsPerPage=20
  &numericFilters=created_at_i><Unix时间戳>,points>30
```

**计算 N 天前时间戳（Bash）：**
```bash
echo $(($(date +%s) - N * 86400))
```

**响应字段：**
- `hits[].title` — 标题
- `hits[].url` — 原文链接（无则用 `https://news.ycombinator.com/item?id=<objectID>`）
- `hits[].story_text` — 文章摘要（部分条目有）
- `hits[].points` — 热度积分
- `hits[].num_comments` — 评论数
- `hits[].created_at` — 发布时间（ISO 8601）
- `hits[].author` — 作者

**注意：** 每次请求限 1000 条，生产环境无需鉴权。

---

## 2. Google News via Serper（需 SERPER_API_KEY，可选）

**新闻搜索：**
```bash
curl -s -X POST https://google.serper.dev/news \
  -H "X-API-KEY: $SERPER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q": "<关键词>", "num": 6, "gl": "us", "hl": "en"}'
```

**中文新闻（百度区域）：**
```bash
curl -s -X POST https://google.serper.dev/news \
  -H "X-API-KEY: $SERPER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q": "<关键词>", "num": 5, "gl": "cn", "hl": "zh-cn"}'
```

**响应字段：**
- `news[].title` — 标题
- `news[].link` — 链接
- `news[].snippet` — 摘要
- `news[].source` — 媒体名
- `news[].date` — 时间

**注意：** 免费额度初始 2500 次，超出后按量付费。检查 Key 是否存在：`echo ${SERPER_API_KEY:-""}`

---

## 3. Bilibili（免费，无需 Key）

**视频搜索 API：**
```
GET https://api.bilibili.com/x/web-interface/search/type
  ?search_type=video
  &keyword=<URL编码关键词>
  &page=1
  &pagesize=5
```

**推荐用 Python 脚本处理**（见 `../scripts/search_china.py`）：
```bash
python ../scripts/search_china.py "<关键词>" --source bilibili --limit 5
```

输出 JSON 数组，字段：`title`, `url`, `content`, `source`, `publishedAt`, `points`（播放量）

**响应字段（直接调用时）：**
- `data.result[].title` — 标题（含 `<em>` 高亮标签，需清理）
- `data.result[].bvid` — 视频 ID，URL 为 `https://www.bilibili.com/video/<bvid>`
- `data.result[].description` — 描述
- `data.result[].play` — 播放量
- `data.result[].pubdate` — Unix 时间戳

---

## 4. 微博（可能需要 Cookie，建议用脚本）

**移动端搜索 API（无登录态时部分生效）：**
```
GET https://m.weibo.cn/api/container/getIndex
  ?containerid=100103type=1&q=<关键词>&t=0
  &page_type=searchall
  &page=1
```

**推荐用 Python 脚本处理**（见 `../scripts/search_china.py`）：
```bash
python ../scripts/search_china.py "<关键词>" --source weibo --limit 5
```

**注意：** 微博 API 频繁改变且有反爬，脚本调用失败时跳过该源，不影响整体流程。

---

## 5. 脚本统一调用（Bilibili + 微博）

若 Python 环境可用，推荐一次性搜索两个中文源：
```bash
python ../scripts/search_china.py "<关键词>" --source all --limit 5
```

输出统一格式的 JSON，直接进入相关性验证流程。

若 Python 不可用，降级为仅用 HN + Serper（功能仍完整，仅缺中文覆盖）。

---

## 各源优先级与特点对比

| 来源 | 语言 | 需要 Key | 内容类型 | 优先级 |
|------|------|----------|----------|--------|
| HackerNews | 英文为主 | 否 | 技术讨论/产品发布 | 最高（永远可用）|
| Bilibili | 中文 | 否（脚本） | 视频/UP主内容 | 高（中文优质内容）|
| Google News | 多语言 | SERPER_API_KEY | 媒体报道 | 高（覆盖广）|
| 微博 | 中文 | 否（脚本） | 社区讨论/实时舆情 | 中（反爬风险）|
| 百度新闻（Serper） | 中文 | SERPER_API_KEY | 中文媒体报道 | 中 |
