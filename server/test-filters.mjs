/**
 * 排序与筛选逻辑单元测试（纯 ESM，无依赖）
 * 运行: node test-filters.mjs
 */

// ── 从 useTopicFilters.ts 提取的纯逻辑（去掉 React 依赖） ─────────────────────

function getSourceTag(source) {
  if (/twitter|x\.com/i.test(source)) return 'Twitter'
  if (/hackernews|hacker news/i.test(source)) return 'HackerNews'
  if (/google news/i.test(source)) return 'Google News'
  if (/bilibili|b站/i.test(source)) return 'Bilibili'
  if (/微博/i.test(source)) return '微博'
  if (/百度/i.test(source)) return '百度新闻'
  if (/github/i.test(source)) return 'GitHub'
  if (/reddit/i.test(source)) return 'Reddit'
  if (/openrouter/i.test(source)) return 'OpenRouter'
  return '其他'
}

function getPriority(score) {
  if (score >= 9) return 'urgent'
  if (score >= 7) return 'high'
  if (score >= 5) return 'medium'
  return 'low'
}

const PRIORITY_ORDER = { urgent: 4, high: 3, medium: 2, low: 1 }

function getAuthenticity(topic) {
  if (topic.score >= 7 || topic.alert_count > 0) return 'verified'
  if (topic.score <= 2) return 'suspicious'
  return 'unknown'
}

function isInTimeRange(dateStr, range) {
  if (range === 'all' || !dateStr) return true
  const d = new Date(dateStr).getTime()
  if (isNaN(d)) return true
  const now = Date.now()
  if (range === '1h') return d > now - 60 * 60 * 1000
  if (range === 'today') return new Date(dateStr).toDateString() === new Date().toDateString()
  if (range === '7d') return d > now - 7 * 24 * 60 * 60 * 1000
  if (range === '30d') return d > now - 30 * 24 * 60 * 60 * 1000
  return true
}

// 当前 heatScore（与 relevance 几乎等价）
function heatScoreCurrent(topic) {
  return topic.score * 10 + (topic.alert_count > 0 ? 15 : 0)
}

function applyFiltersAndSort(topics, filters, category = 'all') {
  let result = [...topics]
  if (category !== 'all') result = result.filter(t => t.category === category)
  if (filters.sources?.length > 0) result = result.filter(t => filters.sources.includes(getSourceTag(t.source)))
  if (filters.priority !== 'all') result = result.filter(t => getPriority(t.score) === filters.priority)
  if (filters.keyword) result = result.filter(t => {
    const kws = t.alert_keywords?.split(',').map(k => k.trim()) ?? []
    return kws.includes(filters.keyword)
  })
  if (filters.timeRange !== 'all') {
    // 当前逻辑：优先用 published_at
    result = result.filter(t => isInTimeRange(t.published_at || t.created_at, filters.timeRange))
  }
  if (filters.authenticity !== 'all') result = result.filter(t => {
    const auth = getAuthenticity(t)
    return filters.authenticity === 'verified' ? auth === 'verified' : auth === 'suspicious'
  })
  result.sort((a, b) => {
    switch (filters.sortBy) {
      case 'newest-created': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'newest-published': return new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime()
      case 'priority': return PRIORITY_ORDER[getPriority(b.score)] - PRIORITY_ORDER[getPriority(a.score)]
      case 'relevance': return b.score - a.score
      case 'heat': return heatScoreCurrent(b) - heatScoreCurrent(a)
      default: return 0
    }
  })
  return result
}

// ── 测试数据 ──────────────────────────────────────────────────────────────────

const now = Date.now()
const h = (n) => new Date(now - n * 3600 * 1000).toISOString()

const MOCK_TOPICS = [
  { id: 1,  title: 'urgent-new',    score: 10, source: 'Twitter/X Search',    category: 'model-release', created_at: h(1),  published_at: h(1),   alert_count: 1, alert_keywords: 'AI,Claude' },
  { id: 2,  title: 'urgent-old',    score: 9,  source: 'HackerNews Search',   category: 'research',      created_at: h(2),  published_at: h(200), alert_count: 0, alert_keywords: null },
  { id: 3,  title: 'high-1',        score: 8,  source: 'Google News · BBC',   category: 'tool-update',   created_at: h(3),  published_at: h(3),   alert_count: 0, alert_keywords: 'OpenAI' },
  { id: 4,  title: 'high-2',        score: 7,  source: 'Bilibili（1万播放）',  category: 'discussion',    created_at: h(4),  published_at: h(4),   alert_count: 1, alert_keywords: 'Claude' },
  { id: 5,  title: 'medium-1',      score: 6,  source: 'Twitter/X Search',    category: 'funding',       created_at: h(5),  published_at: h(5),   alert_count: 0, alert_keywords: null },
  { id: 6,  title: 'medium-2',      score: 5,  source: '微博热搜',             category: 'other',         created_at: h(6),  published_at: h(6),   alert_count: 0, alert_keywords: 'AI' },
  { id: 7,  title: 'low-1',         score: 4,  source: 'Reddit/MachineLearning',category: 'research',    created_at: h(7),  published_at: h(7),   alert_count: 0, alert_keywords: null },
  { id: 8,  title: 'low-2',         score: 3,  source: 'HuggingFace Blog',    category: 'other',         created_at: h(8),  published_at: h(8),   alert_count: 0, alert_keywords: null },
  { id: 9,  title: 'suspicious',    score: 2,  source: 'Google News · 来源不明',category: 'other',       created_at: h(9),  published_at: h(9),   alert_count: 0, alert_keywords: null },
  { id: 10, title: 'very-low',      score: 1,  source: '百度新闻 · 某平台',   category: 'other',         created_at: h(10), published_at: h(10),  alert_count: 0, alert_keywords: null },
  // 关键问题：old published_at but recent created_at（爬虫刚抓但原文很旧）
  { id: 11, title: 'crawled-recent-but-old-published', score: 7, source: 'HackerNews Search', category: 'research',
    created_at: h(0.5), published_at: h(24*10), alert_count: 0, alert_keywords: null },
]

// ── 测试框架 ──────────────────────────────────────────────────────────────────

let passed = 0, failed = 0

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ ${msg}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${msg}`)
    failed++
  }
}

function section(name) {
  console.log(`\n━━ ${name} ━━`)
}

// ── TEST 1: 默认（无筛选）应返回所有条目 ──────────────────────────────────────

section('TEST 1: 默认无筛选 → 返回全部')
{
  const DEFAULT = { sortBy: 'newest-created', sources: [], priority: 'all', keyword: '', timeRange: 'all', authenticity: 'all' }
  const result = applyFiltersAndSort(MOCK_TOPICS, DEFAULT)
  assert(result.length === MOCK_TOPICS.length, `全部 ${MOCK_TOPICS.length} 条都应显示，实际 ${result.length}`)
}

// ── TEST 2: 排序 —— 每种排序不应减少条目 ─────────────────────────────────────

section('TEST 2: 所有排序均不减少条目数')
{
  const BASE = { sources: [], priority: 'all', keyword: '', timeRange: 'all', authenticity: 'all' }
  for (const sortBy of ['newest-created', 'newest-published', 'priority', 'relevance', 'heat']) {
    const result = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, sortBy })
    assert(result.length === MOCK_TOPICS.length, `${sortBy}: 应有 ${MOCK_TOPICS.length} 条，实际 ${result.length}`)
  }
}

// ── TEST 3: 排序正确性 ────────────────────────────────────────────────────────

section('TEST 3: 排序结果正确性')
{
  const BASE = { sources: [], priority: 'all', keyword: '', timeRange: 'all', authenticity: 'all' }

  // newest-created: id=1 最新
  const nc = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, sortBy: 'newest-created' })
  assert(nc[0].id === 1, `newest-created 第1条应为 id=1（最新录入），实际 id=${nc[0].id}`)
  assert(nc[nc.length-1].id === 11, `newest-created 最后应为 id=11（最老录入）... 实际 id=${nc[nc.length-1].id}`)

  // newest-published: id=11 的 published_at 最早，id=1 最新
  const np = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, sortBy: 'newest-published' })
  assert(np[0].id === 1, `newest-published 第1条应为 id=1（发布最新），实际 id=${np[0].id}`)
  assert(np[np.length-1].id === 2, `newest-published 最后应为 id=2（published_at 最旧=200h前），实际 id=${np[np.length-1].id}`)

  // relevance: score=10 在前，score=1 在后
  const rel = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, sortBy: 'relevance' })
  assert(rel[0].score >= rel[1].score, `relevance: 第1条 score(${rel[0].score}) ≥ 第2条 score(${rel[1].score})`)
  assert(rel[rel.length-1].score === 1, `relevance: 最后一条 score 应为 1，实际 ${rel[rel.length-1].score}`)

  // priority: urgent(4) > high(3) > medium(2) > low(1)
  const pri = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, sortBy: 'priority' })
  const priBuckets = pri.map(t => getPriority(t.score))
  let priorityDescending = true
  for (let i = 0; i < priBuckets.length - 1; i++) {
    if (PRIORITY_ORDER[priBuckets[i]] < PRIORITY_ORDER[priBuckets[i+1]]) {
      priorityDescending = false
      break
    }
  }
  assert(priorityDescending, `priority 排序结果: [${priBuckets.join(',')}] 应单调不升`)

  // heat: 当前实现 vs relevance 是否等价（BUG检测）
  const heat = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, sortBy: 'heat' })
  const heatIds = heat.map(t => t.id).join(',')
  const relIds = rel.map(t => t.id).join(',')
  const isSameAsRelevance = heatIds === relIds
  console.log(`  ⚠️  heat 排序 IDs: [${heatIds}]`)
  console.log(`  ⚠️  relevance 排序 IDs: [${relIds}]`)
  if (isSameAsRelevance) {
    console.error(`  ❌ BUG: heat 和 relevance 排序结果完全相同！heat 排序未能真正区分热度`)
    failed++
  } else {
    console.log(`  ✅ heat 和 relevance 排序结果不同（符合预期）`)
    passed++
  }
}

// ── TEST 4: 各优先级筛选应涵盖对应 score 范围 ────────────────────────────────

section('TEST 4: 重要程度筛选')
{
  const BASE = { sortBy: 'newest-created', sources: [], keyword: '', timeRange: 'all', authenticity: 'all' }

  const urgentItems = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, priority: 'urgent' })
  assert(urgentItems.every(t => t.score >= 9), `urgent 筛选：所有条目 score ≥ 9，实际：[${urgentItems.map(t=>t.score).join(',')}]`)
  assert(urgentItems.length >= 1, `urgent 筛选：应有 ≥1 条，实际 ${urgentItems.length}`)

  const highItems = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, priority: 'high' })
  assert(highItems.every(t => t.score >= 7 && t.score < 9), `high 筛选：score 在 7-8，实际：[${highItems.map(t=>t.score).join(',')}]`)

  const mediumItems = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, priority: 'medium' })
  assert(mediumItems.every(t => t.score >= 5 && t.score < 7), `medium 筛选：score 在 5-6，实际：[${mediumItems.map(t=>t.score).join(',')}]`)

  const lowItems = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, priority: 'low' })
  assert(lowItems.every(t => t.score < 5), `low 筛选：score < 5，实际：[${lowItems.map(t=>t.score).join(',')}]`)
  assert(lowItems.length >= 1, `low 筛选应有 ≥1 条，实际 ${lowItems.length}`)

  // 四类合计 = 全部
  const total = urgentItems.length + highItems.length + mediumItems.length + lowItems.length
  assert(total === MOCK_TOPICS.length, `四类合计(${total}) 应等于总数(${MOCK_TOPICS.length})`)
}

// ── TEST 5: 时间范围筛选的 BUG ────────────────────────────────────────────────

section('TEST 5: 时间范围筛选 — 关键 BUG 检测')
{
  const BASE = { sortBy: 'newest-created', sources: [], priority: 'all', keyword: '', authenticity: 'all' }

  // id=11: created_at=0.5h前(新), published_at=240h前(旧)
  // 按当前逻辑 published_at || created_at → 用 published_at → 应被 7d 过滤掉
  // 但从用户视角：这条是刚被爬到的，应该显示！
  const result7d = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, timeRange: '7d' })
  const id11In7d = result7d.some(t => t.id === 11)
  if (!id11In7d) {
    console.error(`  ❌ BUG: id=11（created_at=0.5h前，published_at=240h前）在 7d 过滤下被隐藏了！`)
    console.error(`     原因：timeRange 优先用 published_at，导致刚爬到的旧文章被过滤`)
    failed++
  } else {
    console.log(`  ✅ id=11 在 7d 过滤下可见（符合期望）`)
    passed++
  }

  // id=2: published_at=200h前，created_at=2h前
  const id2In7d = result7d.some(t => t.id === 2)
  console.log(`  ℹ️  id=2 在 7d 过滤下 ${id2In7d ? '可见' : '被隐藏'}（published_at=200h前，created_at=2h前）`)

  // 7d 过滤后，created_at 在 7d 内的全部应该显示
  const recentByCreated = MOCK_TOPICS.filter(t => new Date(t.created_at).getTime() > Date.now() - 7*24*3600*1000)
  console.log(`  ℹ️  按 created_at 应有 ${recentByCreated.length} 条在7d内，当前7d过滤实际返回 ${result7d.length} 条`)
}

// ── TEST 6: 真实性筛选 ────────────────────────────────────────────────────────

section('TEST 6: 真实性筛选')
{
  const BASE = { sortBy: 'newest-created', sources: [], priority: 'all', keyword: '', timeRange: 'all' }

  const verified = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, authenticity: 'verified' })
  const suspicious = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, authenticity: 'suspicious' })
  const allCount = MOCK_TOPICS.length

  // score 3-6 且 alert_count=0 的条目既不是 verified 也不是 suspicious → 两个过滤都不显示
  const unknownCount = MOCK_TOPICS.filter(t => {
    const auth = getAuthenticity(t)
    return auth === 'unknown'
  }).length
  assert(unknownCount > 0, `应存在 'unknown' 真实性的条目（score 3-6 且 alert_count=0），实际 ${unknownCount} 个`)

  const hiddenCount = allCount - verified.length - suspicious.length
  if (hiddenCount > 0) {
    console.warn(`  ⚠️  ${hiddenCount} 条条目在 verified 和 suspicious 两个过滤下都不可见（authenticity=unknown）！`)
  }
  assert(verified.every(t => getAuthenticity(t) === 'verified'), `verified 过滤只含 verified 条目`)
  assert(suspicious.every(t => getAuthenticity(t) === 'suspicious'), `suspicious 过滤只含 suspicious 条目`)
}

// ── TEST 7: 来源多选筛选 ──────────────────────────────────────────────────────

section('TEST 7: 数据来源多选筛选')
{
  const BASE = { sortBy: 'newest-created', priority: 'all', keyword: '', timeRange: 'all', authenticity: 'all' }

  const twitterOnly = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, sources: ['Twitter'] })
  assert(twitterOnly.length === 2, `Twitter 来源应有 2 条，实际 ${twitterOnly.length}`)
  assert(twitterOnly.every(t => getSourceTag(t.source) === 'Twitter'), 'Twitter 过滤只含 Twitter 条目')

  const multiSource = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, sources: ['Twitter', 'HackerNews'] })
  assert(multiSource.length === 4, `Twitter+HackerNews 应有 4 条，实际 ${multiSource.length}`)
}

// ── TEST 8: 关键词筛选 ────────────────────────────────────────────────────────

section('TEST 8: 关联关键词筛选')
{
  const BASE = { sortBy: 'newest-created', sources: [], priority: 'all', timeRange: 'all', authenticity: 'all' }
  const claudeItems = applyFiltersAndSort(MOCK_TOPICS, { ...BASE, keyword: 'Claude' })
  assert(claudeItems.length === 2, `keyword=Claude 应有 2 条（id=1,4），实际 ${claudeItems.length}`)
  assert(claudeItems.every(t => t.alert_keywords?.includes('Claude')), '所有结果必须含 Claude 关键词')
}

// ── TEST 9: DB Score 分布问题（为什么没有 low 热度）────────────────────────────

section('TEST 9: Score 分布 — 线上 DB 中 low 热度条目为何不存在')
{
  // 模拟 search.ts 中的 score 计算
  const twitterScore = (likeCount) => Math.min(10, Math.round(likeCount / 50) + 5)
  const hnScore = (points) => Math.min(10, Math.round(points / 20) + 5)
  const biliScore = (play) => Math.min(10, Math.round(play / 5000) + 5)
  const serperScore = 7  // 固定值

  console.log('  Twitter score 计算：')
  console.log(`    likes=0   → score=${twitterScore(0)}  (medium)`)
  console.log(`    likes=50  → score=${twitterScore(50)} (high)`)
  console.log(`    likes=250 → score=${twitterScore(250)} (urgent)`)

  console.log('  HackerNews score 计算：')
  console.log(`    pts=0    → score=${hnScore(0)}  (medium)`)
  console.log(`    pts=100  → score=${hnScore(100)} (high)`)

  console.log('  Bilibili score 计算：')
  console.log(`    play=0     → score=${biliScore(0)}   (medium)`)
  console.log(`    play=5000  → score=${biliScore(5000)} (high)`)

  console.log(`  Serper/Google News → score=${serperScore} (high，固定)`)

  const minPossible = Math.min(twitterScore(0), hnScore(0), biliScore(0), serperScore)
  assert(minPossible >= 5, `❌ BUG: 所有来源最小 score=${minPossible}（medium），永远不会产生 low(score<5) 的条目！`)
  console.log(`  ⚠️  结论：search.ts 中 score 最小值为 ${minPossible}（medium），DB 里不会有 low 热度条目`)
}

// ── 汇总 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`)
console.log(`测试完成：${passed} 通过 / ${failed} 失败`)
if (failed > 0) console.error('存在 FAIL，需要修复！')
