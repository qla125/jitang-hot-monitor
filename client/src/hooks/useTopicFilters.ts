import { useMemo, useState } from 'react'
import type { HotTopic, TopicCategory } from '@/types'

export type SortBy =
  | 'newest'      // 最新（发布时间优先，无发布时间则用入库时间）
  | 'priority'    // 重要程度优先（score DESC，alert_count 次之）
  | 'relevance'   // 相关性最高（alert_count DESC，score 次之）
  | 'heat'        // 热度综合（score × 时间衰减）

export type Priority = 'all' | 'urgent' | 'high' | 'medium' | 'low'
export type Authenticity = 'all' | 'verified' | 'suspicious'
export type TimeRange = 'all' | '1h' | 'today' | '7d' | '30d'

export const SORT_LABELS: Record<SortBy, string> = {
  newest:   '最新',
  priority: '重要程度优先',
  relevance:'相关性最高',
  heat:     '热度综合排名',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  all: '全部', urgent: '🔴 紧急', high: '🟠 高', medium: '🟡 中', low: '⚪ 低',
}

export const TIME_LABELS: Record<TimeRange, string> = {
  all: '全部时间', '1h': '最近1小时', today: '今天', '7d': '近7天', '30d': '近30天',
}

export const AUTH_LABELS: Record<Authenticity, string> = {
  all: '全部', verified: '✅ 已验证', suspicious: '⚠️ 疑似虚假',
}

export interface FilterState {
  sortBy: SortBy
  sources: string[]       // 空 = 全部
  priority: Priority
  keyword: string         // '' = 全部
  timeRange: TimeRange
  authenticity: Authenticity
}

export const DEFAULT_FILTERS: FilterState = {
  sortBy: 'newest',
  sources: [],
  priority: 'all',
  keyword: '',
  timeRange: 'all',
  authenticity: 'all',
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

export function getSourceTag(source: string): string {
  if (/twitter|x\.com/i.test(source)) return 'Twitter'
  if (/hackernews|hacker news/i.test(source)) return 'HackerNews'
  if (/google news/i.test(source)) return 'Google News'
  if (/bilibili|b站/i.test(source)) return 'Bilibili'
  if (/微博/i.test(source)) return '微博'
  if (/百度/i.test(source)) return '百度新闻'
  if (/github/i.test(source)) return 'GitHub'
  if (/reddit/i.test(source)) return 'Reddit'
  if (/huggingface/i.test(source)) return 'HuggingFace'
  if (/venturebeat/i.test(source)) return 'VentureBeat'
  if (/verge/i.test(source)) return 'The Verge'
  if (/openrouter/i.test(source)) return 'OpenRouter'
  return '其他'
}

export function getPriority(score: number): 'urgent' | 'high' | 'medium' | 'low' {
  if (score >= 9) return 'urgent'
  if (score >= 8) return 'high'
  if (score >= 6) return 'medium'
  return 'low'
}

// 真实性判断：优先采用 AI 对内容本身的可信度判断（authenticity 字段）；
// 该字段缺失时（如关键词搜索直接入库的条目，未经过 AI 逐条分析），退化为基于分数/告警命中的启发式推断
export function getAuthenticity(topic: HotTopic): 'verified' | 'suspicious' | 'unknown' {
  if (topic.authenticity === 'real') return 'verified'
  if (topic.authenticity === 'suspicious') return 'suspicious'
  if (topic.score >= 7 || topic.alert_count > 0) return 'verified'
  if (topic.score <= 2) return 'suspicious'
  return 'unknown'
}

// 相对时间："刚刚" / "5分钟前" / "3小时前" / "2天前"，超过 30 天显示日期
export function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const t = new Date(dateStr).getTime()
  if (isNaN(t)) return ''
  const diffMs = Date.now() - t
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

// 粉丝数简写："12.3万" / "5,200"
export function formatFollowers(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return n.toLocaleString()
}

function isInTimeRange(dateStr: string | undefined, range: TimeRange): boolean {
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

// 热度 = score 减去时间衰减（每过 1 小时衰减 0.05 分，48h 后衰减 2.4 分）
export function heatScore(topic: HotTopic): number {
  const hoursAgo = (Date.now() - new Date(topic.created_at).getTime()) / (1000 * 3600)
  return topic.score - hoursAgo * 0.05
}

// 最新排序用的时间戳：有发布时间用发布时间，否则用入库时间
function newestTime(topic: HotTopic): number {
  if (topic.published_at) {
    const t = new Date(topic.published_at).getTime()
    if (!isNaN(t)) return t
  }
  return new Date(topic.created_at).getTime()
}

// ── 主筛选 + 排序逻辑 ──────────────────────────────────────────────────────────

export function applyFiltersAndSort(
  topics: HotTopic[],
  filters: FilterState,
  category: string,
): HotTopic[] {
  let result = [...topics]

  // 1. 分类（已有的 tab）
  if (category !== 'all') {
    result = result.filter(t => t.category === (category as TopicCategory))
  }

  // 2. 数据来源（多选）
  if (filters.sources.length > 0) {
    result = result.filter(t => filters.sources.includes(getSourceTag(t.source)))
  }

  // 3. 重要程度
  if (filters.priority !== 'all') {
    result = result.filter(t => getPriority(t.score) === filters.priority)
  }

  // 4. 关联关键词
  if (filters.keyword) {
    result = result.filter(t => {
      const kws = t.alert_keywords?.split(',').map(k => k.trim()) ?? []
      return kws.includes(filters.keyword)
    })
  }

  // 5. 时间范围（优先用发布时间，回退到入库时间）
  if (filters.timeRange !== 'all') {
    result = result.filter(t => isInTimeRange(t.published_at || t.created_at, filters.timeRange))
  }

  // 6. 真实性
  if (filters.authenticity !== 'all') {
    result = result.filter(t => {
      const auth = getAuthenticity(t)
      return filters.authenticity === 'verified' ? auth === 'verified' : auth === 'suspicious'
    })
  }

  // 排序
  result.sort((a, b) => {
    switch (filters.sortBy) {
      case 'newest':
        return newestTime(b) - newestTime(a)
      case 'priority':
        // 主：score 高分优先；次：触发关键词数量多的优先
        return b.score !== a.score
          ? b.score - a.score
          : b.alert_count - a.alert_count
      case 'relevance':
        // 主：触发关键词数量多的优先；次：score 高分优先
        return b.alert_count !== a.alert_count
          ? b.alert_count - a.alert_count
          : b.score - a.score
      case 'heat':
        return heatScore(b) - heatScore(a)
      default:
        return 0
    }
  })

  return result
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTopicFilters() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => setFilters(DEFAULT_FILTERS)

  const activeCount = useMemo(() => {
    let n = 0
    if (filters.sortBy !== DEFAULT_FILTERS.sortBy) n++
    if (filters.sources.length > 0) n++
    if (filters.priority !== 'all') n++
    if (filters.keyword !== '') n++
    if (filters.timeRange !== 'all') n++
    if (filters.authenticity !== 'all') n++
    return n
  }, [filters])

  return { filters, updateFilter, resetFilters, activeCount }
}
