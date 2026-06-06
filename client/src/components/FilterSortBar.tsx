import { useEffect, useRef, useState } from 'react'
import { ChevronDown, SlidersHorizontal, X, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SORT_LABELS, PRIORITY_LABELS, TIME_LABELS, AUTH_LABELS,
  DEFAULT_FILTERS, getPriority,
  type FilterState, type SortBy, type Priority, type Authenticity, type TimeRange,
} from '@/hooks/useTopicFilters'
import type { Keyword } from '@/types'

interface Props {
  filters: FilterState
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  resetFilters: () => void
  activeCount: number
  availableSources: string[]
  keywords: Keyword[]
}

// ── 通用下拉面板 wrapper ─────────────────────────────────────────────────────

function Dropdown({
  label, active, icon, children,
}: {
  label: string; active: boolean; icon?: React.ReactNode; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1 text-[11px] font-mono px-2.5 py-1.5 rounded-lg border transition-all whitespace-nowrap',
          active
            ? 'bg-matcha-50 text-matcha-700 border-matcha-300 font-semibold'
            : 'bg-white text-matcha-400 border-matcha-100 hover:border-matcha-200 hover:text-matcha-600',
        )}
      >
        {icon}
        <span>{label}</span>
        <ChevronDown size={10} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-matcha-100 rounded-xl shadow-[0_4px_20px_rgba(42,51,32,0.12)] min-w-[160px] py-1.5 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  )
}

// ── 单选行 ────────────────────────────────────────────────────────────────────

function RadioItem({
  label, checked, onClick,
}: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono text-left transition-colors',
        checked ? 'text-matcha-700 bg-matcha-50 font-semibold' : 'text-matcha-500 hover:bg-cream-100',
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full border flex-none', checked ? 'bg-matcha-500 border-matcha-500' : 'border-matcha-300')} />
      {label}
    </button>
  )
}

// ── 多选行（来源）─────────────────────────────────────────────────────────────

function CheckItem({
  label, checked, onClick,
}: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono text-left transition-colors',
        checked ? 'text-matcha-700 bg-matcha-50 font-semibold' : 'text-matcha-500 hover:bg-cream-100',
      )}
    >
      <span className={cn(
        'w-3.5 h-3.5 rounded border flex-none flex items-center justify-center text-[9px]',
        checked ? 'bg-matcha-500 border-matcha-500 text-white' : 'border-matcha-300',
      )}>
        {checked && '✓'}
      </span>
      {label}
    </button>
  )
}

// ── 分隔线 ────────────────────────────────────────────────────────────────────

function Divider() {
  return <div className="h-px bg-matcha-50 my-1" />
}

// ── FilterSortBar 主组件 ──────────────────────────────────────────────────────

export default function FilterSortBar({ filters, updateFilter, resetFilters, activeCount, availableSources, keywords }: Props) {
  const activeKeywords = keywords.filter(k => k.active === 1)
  const priorityActive = filters.priority !== DEFAULT_FILTERS.priority
  const timeActive = filters.timeRange !== DEFAULT_FILTERS.timeRange
  const authActive = filters.authenticity !== DEFAULT_FILTERS.authenticity
  const sourcesActive = filters.sources.length > 0
  const keywordActive = filters.keyword !== ''
  const sortActive = filters.sortBy !== DEFAULT_FILTERS.sortBy

  return (
    <div className="flex items-center gap-1.5 px-5 py-2 border-b border-matcha-50 bg-cream-100/60 flex-wrap">
      {/* 左侧：筛选项 */}
      <SlidersHorizontal size={11} className="text-matcha-300 shrink-0" />

      {/* 数据来源 */}
      <Dropdown
        label={sourcesActive ? `来源 (${filters.sources.length})` : '来源'}
        active={sourcesActive}
      >
        <CheckItem
          label="全部来源"
          checked={filters.sources.length === 0}
          onClick={() => updateFilter('sources', [])}
        />
        <Divider />
        {availableSources.map(s => (
          <CheckItem
            key={s}
            label={s}
            checked={filters.sources.includes(s)}
            onClick={() => {
              const next = filters.sources.includes(s)
                ? filters.sources.filter(x => x !== s)
                : [...filters.sources, s]
              updateFilter('sources', next)
            }}
          />
        ))}
      </Dropdown>

      {/* 重要程度 */}
      <Dropdown
        label={priorityActive ? PRIORITY_LABELS[filters.priority] : '重要程度'}
        active={priorityActive}
      >
        {(Object.keys(PRIORITY_LABELS) as Priority[]).map(p => (
          <RadioItem
            key={p}
            label={PRIORITY_LABELS[p]}
            checked={filters.priority === p}
            onClick={() => updateFilter('priority', p)}
          />
        ))}
      </Dropdown>

      {/* 关联关键词 */}
      <Dropdown
        label={keywordActive ? `关键词: ${filters.keyword}` : '关联关键词'}
        active={keywordActive}
      >
        <RadioItem label="全部关键词" checked={!keywordActive} onClick={() => updateFilter('keyword', '')} />
        {activeKeywords.length > 0 && <Divider />}
        {activeKeywords.map(k => (
          <RadioItem
            key={k.id}
            label={k.keyword}
            checked={filters.keyword === k.keyword}
            onClick={() => updateFilter('keyword', k.keyword)}
          />
        ))}
        {activeKeywords.length === 0 && (
          <p className="px-3 py-2 text-[10px] text-matcha-300 font-mono">暂无监控关键词</p>
        )}
      </Dropdown>

      {/* 时间范围 */}
      <Dropdown
        label={timeActive ? TIME_LABELS[filters.timeRange] : '时间范围'}
        active={timeActive}
      >
        {(Object.entries(TIME_LABELS) as [TimeRange, string][]).map(([k, v]) => (
          <RadioItem
            key={k}
            label={v}
            checked={filters.timeRange === k}
            onClick={() => updateFilter('timeRange', k)}
          />
        ))}
      </Dropdown>

      {/* 真实性 */}
      <Dropdown
        label={authActive ? AUTH_LABELS[filters.authenticity] : '真实性'}
        active={authActive}
      >
        {(Object.entries(AUTH_LABELS) as [Authenticity, string][]).map(([k, v]) => (
          <RadioItem
            key={k}
            label={v}
            checked={filters.authenticity === k}
            onClick={() => updateFilter('authenticity', k)}
          />
        ))}
        <Divider />
        <p className="px-3 py-1.5 text-[9px] text-matcha-200 font-mono leading-relaxed">
          基于 AI 评分 (≥7分=已验证, ≤2分=疑似虚假)
        </p>
      </Dropdown>

      {/* 重置按钮 */}
      {activeCount > 0 && (
        <button
          onClick={resetFilters}
          className="flex items-center gap-1 text-[11px] font-mono text-clay-400 hover:text-clay-600 px-2 py-1.5 rounded-lg hover:bg-clay-400/10 transition-all border border-transparent hover:border-clay-400/20"
        >
          <X size={10} />
          重置 ({activeCount})
        </button>
      )}

      {/* 右侧：排序 */}
      <div className="ml-auto">
        <Dropdown
          icon={<ArrowUpDown size={10} />}
          label={SORT_LABELS[filters.sortBy]}
          active={sortActive}
        >
          {(Object.entries(SORT_LABELS) as [SortBy, string][]).map(([k, v]) => (
            <RadioItem
              key={k}
              label={v}
              checked={filters.sortBy === k}
              onClick={() => updateFilter('sortBy', k)}
            />
          ))}
        </Dropdown>
      </div>
    </div>
  )
}
