import { useEffect, useRef, useState } from 'react'
import {
  ExternalLink, Flame, Eye, Zap, TrendingUp, Minus,
  User, BadgeCheck, AlertTriangle, ChevronDown,
  Heart, MessageCircle, Repeat2, Lightbulb,
} from 'lucide-react'
import { CardSpotlight } from '@/components/aceternity/card-spotlight'
import { cn } from '@/lib/utils'
import {
  getPriority, getAuthenticity, heatScore, formatRelativeTime, formatFollowers,
} from '@/hooks/useTopicFilters'
import type { HotTopic, TopicCategory } from '@/types'
import type { SortBy } from '@/hooks/useTopicFilters'

// 全局「一键展开/折叠所有」信号：version 每次变化时，所有卡片同步到 expand 状态
export interface ExpandSignal { expand: boolean; version: number }

interface Props { topic: HotTopic; sortMode?: SortBy; expandSignal?: ExpandSignal | null }

const CATEGORY: Record<TopicCategory, { label: string; dot: string }> = {
  'model-release': { label: '模型发布', dot: 'bg-matcha-400' },
  'tool-update':   { label: '工具更新', dot: 'bg-matcha-300' },
  research:        { label: '研究论文', dot: 'bg-matcha-300' },
  funding:         { label: '融资动态', dot: 'bg-clay-400' },
  discussion:      { label: '社区讨论', dot: 'bg-matcha-200' },
  other:           { label: '资讯',     dot: 'bg-cream-300' },
}

// ── 热度火焰条 ─────────────────────────────────────────────────────────────────

function HeatBar({ value }: { value: number }) {
  const level = value >= 8 ? 3 : value >= 6 ? 2 : value >= 4 ? 1 : 0
  const colors = ['text-clay-500', 'text-clay-400', 'text-amber-400']
  return (
    <span className="flex items-center gap-0.5">
      {[0, 1, 2].map(i => (
        <Flame key={i} size={11} className={cn('transition-colors', i < level ? colors[i] : 'text-matcha-200')} />
      ))}
      <span className="text-[9px] font-mono text-clay-400 ml-0.5 tabular-nums">
        {Math.max(0, value).toFixed(1)}
      </span>
    </span>
  )
}

// ── 重要程度标签（替换左侧分数 chip）──────────────────────────────────────────

function PriorityBadge({ score, isAlert }: { score: number; isAlert: boolean }) {
  const p = isAlert ? getPriority(Math.max(score, 7)) : getPriority(score)
  const cfg = {
    urgent: { label: 'URGENT', Icon: Zap,        cls: 'text-red-500    bg-red-50/80    border-red-200'       },
    high:   { label: 'HIGH',   Icon: Flame,       cls: 'text-clay-500  bg-clay-400/10  border-clay-400/30'   },
    medium: { label: 'MEDIUM', Icon: TrendingUp,  cls: 'text-amber-600 bg-amber-50     border-amber-200'     },
    low:    { label: 'LOW',    Icon: Minus,       cls: 'text-matcha-400 bg-matcha-50   border-matcha-200'    },
  }[p]
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 font-mono font-semibold text-[9px] border rounded-md px-1.5 py-0.5 leading-none',
      cfg.cls,
    )}>
      <cfg.Icon size={9} />
      {cfg.label}
    </span>
  )
}

// ── 相关性眼睛 ─────────────────────────────────────────────────────────────────

function RelevanceEye({ score, alertCount }: { score: number; alertCount: number }) {
  const pct = alertCount > 0
    ? Math.min(99, Math.round(score * 10 + 5))   // 关键词命中额外 +5%
    : Math.round(score * 10)
  const color = pct >= 80 ? 'text-matcha-600' : pct >= 60 ? 'text-matcha-400' : 'text-matcha-300'
  return (
    <span className={cn('flex items-center gap-0.5', color)}>
      <Eye size={10} />
      <span className="text-[9px] font-mono tabular-nums">相关性{pct}%</span>
    </span>
  )
}

// ── 作者信息（名称 / 粉丝数 / 认证状态）────────────────────────────────────────

function AuthorBadge({ name, followers, verified }: { name: string; followers: number; verified: boolean }) {
  if (!name) return null
  return (
    <div className="flex items-center gap-1 mb-1.5 text-[10px] font-mono text-matcha-400 min-w-0">
      <User size={10} className="text-matcha-300 shrink-0" />
      <span className="text-matcha-500 truncate max-w-[140px]">{name}</span>
      {verified && <BadgeCheck size={11} className="text-matcha-500 shrink-0" />}
      {followers > 0 && (
        <span className="text-matcha-300 shrink-0">· {formatFollowers(followers)}粉丝</span>
      )}
    </div>
  )
}

// ── 互动数据（点赞 / 评论 / 转发 / 浏览）────────────────────────────────────────

function InteractionStats({ topic }: { topic: HotTopic }) {
  const stats = [
    { Icon: Heart, value: topic.like_count || 0, label: '赞' },
    { Icon: MessageCircle, value: topic.comment_count || 0, label: '评论' },
    { Icon: Repeat2, value: topic.share_count || 0, label: '转发' },
    { Icon: Eye, value: topic.view_count || 0, label: '浏览' },
  ].filter(s => s.value > 0)
  if (stats.length === 0) return null
  return (
    <span className="flex items-center gap-1.5">
      {stats.map(({ Icon, value, label }) => (
        <span key={label} title={label} className="flex items-center gap-0.5">
          <Icon size={10} />
          {formatFollowers(value)}
        </span>
      ))}
    </span>
  )
}

// ── AI 相关性理由 ──────────────────────────────────────────────────────────────

function RelevanceReason({ reason }: { reason: string }) {
  if (!reason) return null
  return (
    <p className="flex items-start gap-1 text-[10px] font-mono text-matcha-300 mb-1.5">
      <Lightbulb size={10} className="shrink-0 mt-0.5 text-amber-400" />
      <span className="line-clamp-1">{reason}</span>
    </p>
  )
}

// ── 真实性警告标记 ─────────────────────────────────────────────────────────────

function AuthenticityWarning() {
  return (
    <span className="inline-flex items-center gap-0.5 font-mono font-semibold text-[9px] border rounded-md px-1.5 py-0.5 leading-none text-amber-600 bg-amber-50 border-amber-200">
      <AlertTriangle size={9} />
      疑似虚假
    </span>
  )
}

// ── 原始内容折叠展开 ───────────────────────────────────────────────────────────

function ExpandableContent({ content, expandSignal }: { content: string; expandSignal?: ExpandSignal | null }) {
  const [expanded, setExpanded] = useState(false)
  const lastVersion = useRef(-1)

  // 收到「一键展开/折叠所有」信号时，同步本卡片状态；之后用户仍可单独切换
  useEffect(() => {
    if (expandSignal && expandSignal.version !== lastVersion.current) {
      lastVersion.current = expandSignal.version
      setExpanded(expandSignal.expand)
    }
  }, [expandSignal])

  return (
    <div className="mt-1.5 pt-1.5 border-t border-cream-200/60">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(v => !v) }}
        className="flex items-center gap-1 text-[10px] font-mono text-matcha-300 hover:text-matcha-500 transition-colors"
      >
        <ChevronDown size={11} className={cn('transition-transform', expanded && 'rotate-180')} />
        {expanded ? '收起原文' : '查看原文'}
      </button>
      {expanded && (
        <p className="mt-1.5 text-matcha-400 text-xs leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
          {content}
        </p>
      )}
    </div>
  )
}

// ── 默认分数 chip ──────────────────────────────────────────────────────────────

function ScoreChip({ score, isAlert }: { score: number; isAlert: boolean }) {
  const style = isAlert
    ? 'text-clay-500 bg-clay-400/10 border-clay-400/25'
    : score >= 8
    ? 'text-matcha-600 bg-matcha-50 border-matcha-200'
    : 'text-matcha-400 bg-cream-200 border-cream-300'
  return (
    <span className={cn('inline-flex items-baseline gap-0.5 font-mono border rounded-md px-1.5 py-0.5', style)}>
      <span className="text-base font-bold leading-none">{score}</span>
      <span className="text-[9px] opacity-60">/10</span>
    </span>
  )
}

// ── 主组件 ─────────────────────────────────────────────────────────────────────

export default function HotTopicCard({ topic, sortMode, expandSignal }: Props) {
  const meta = CATEGORY[topic.category] || CATEGORY.other
  const isAlert = topic.alert_count > 0
  const suspicious = getAuthenticity(topic) === 'suspicious'
  const rawContent = topic.raw_content?.trim() || ''
  const showRawContent = rawContent.length > 0 && rawContent !== topic.title.trim()

  return (
    <a href={topic.url} target="_blank" rel="noopener noreferrer" className="block group">
      <CardSpotlight
        color={isAlert ? 'rgba(196,144,106,0.07)' : 'rgba(122,158,120,0.07)'}
        className={cn(
          'card card-hover rounded-xl p-4',
          isAlert && 'border-l-2 border-l-clay-400/50'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 pt-0.5">
            <ScoreChip score={topic.score} isAlert={isAlert} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', meta.dot)} />
              <span className="text-[10px] font-mono text-matcha-400 tracking-wide">{meta.label}</span>
              {sortMode === 'priority' && <PriorityBadge score={topic.score} isAlert={isAlert} />}
              {suspicious && <AuthenticityWarning />}
              {isAlert && (
                <span className="text-[10px] font-mono text-clay-500 bg-clay-400/10 border border-clay-400/20 px-1.5 py-0.5 rounded-md">
                  ⚡ 命中
                </span>
              )}
              <ExternalLink
                size={11}
                className="ml-auto text-matcha-200 group-hover:text-matcha-400 transition-colors shrink-0"
              />
            </div>

            <h3 className="text-matcha-900 font-medium text-sm leading-snug line-clamp-2 mb-1.5 group-hover:text-matcha-700 transition-colors">
              {topic.title}
            </h3>

            <AuthorBadge
              name={topic.author_name || ''}
              followers={topic.author_followers || 0}
              verified={!!topic.author_verified}
            />

            {topic.summary && (
              <p className="text-matcha-400 text-xs leading-relaxed line-clamp-1 mb-1.5">
                <span className="text-matcha-300 font-semibold mr-1">[AI 摘要]</span>
                {topic.summary}
              </p>
            )}

            <RelevanceReason reason={topic.relevance_reason || ''} />

            <div className="flex items-center gap-1.5 text-[10px] font-mono text-matcha-300">
              <span>{topic.source}</span>
              <span>·</span>
              {topic.published_at && (
                <>
                  <span title={new Date(topic.published_at).toLocaleString('zh-CN')}>
                    发布{formatRelativeTime(topic.published_at)}
                  </span>
                  <span>·</span>
                </>
              )}
              <span title={new Date(topic.created_at).toLocaleString('zh-CN')}>
                抓取{formatRelativeTime(topic.created_at)}
              </span>

              <span>·</span>
              <HeatBar value={heatScore(topic)} />

              {sortMode === 'relevance' && (
                <>
                  <span>·</span>
                  <RelevanceEye score={topic.score} alertCount={topic.alert_count} />
                </>
              )}

              <InteractionStats topic={topic} />
            </div>

            {showRawContent && <ExpandableContent content={rawContent} expandSignal={expandSignal} />}
          </div>
        </div>
      </CardSpotlight>
    </a>
  )
}
