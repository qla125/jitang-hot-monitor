import { useMemo, useState } from 'react'
import type { HotTopic, TopicCategory } from '@/types'

export type SortBy =
  | 'newest-created'    // 最新发现
  | 'newest-published'  // 最新发布
  | 'priority'          // 重要程度优先
  | 'relevance'         // 相关性最高
  | 'heat'              // 热度综合排名

export type Priority = 'all' | 'urgent' | 'high' | 'medium' | 'low'
export type Authenticity = 'all' | 'verified' | 'suspicious'
export type TimeRange = 'all' | '1h' | 'today' | '7d' | '30d'

export const SORT_LABELS: Record<SortBy, string> = {
  'newest-created':   '最新发现',
  'newest-published': '最新发布',
  priority:           '重要程度优先',
  relevance:          '相关性最高',
  heat:               '热度综合排名',
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
  sortBy: 'newest-created',
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
  if (score >= 7) return 'high'
  if (score >= 5) return 'medium'
  return 'low'
}

const PRIORITY_ORDER: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 }

function getAuthenticity(topic: HotTopic): 'verified' | 'suspicious' | 'unknown' {
  if (topic.score >= 7 || topic.alert_count > 0) return 'verified'
  if (topic.score <= 2) return 'suspicious'
  return 'unknown'
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

// "热度综合" 计算：score 本身已经综合了来源权重，这里略加一点加速度（alert触发加成）
function heatScore(topic: HotTopic): number {
  return topic.score * 10 + (topic.alert_count > 0 ? 15 : 0)
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
      case 'newest-created':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'newest-published':
        return (
          new Date(b.published_at || b.created_at).getTime() -
          new Date(a.published_at || a.created_at).getTime()
        )
      case 'priority':
        return PRIORITY_ORDER[getPriority(b.score)] - PRIORITY_ORDER[getPriority(a.score)]
      case 'relevance':
        return b.score - a.score
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
