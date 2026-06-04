import { ExternalLink } from 'lucide-react'
import { CardSpotlight } from '@/components/aceternity/card-spotlight'
import { cn } from '@/lib/utils'
import type { HotTopic, TopicCategory } from '@/types'

interface Props { topic: HotTopic }

const CATEGORY: Record<TopicCategory, { label: string; color: string }> = {
  'model-release': { label: '模型', color: 'text-violet-400 bg-violet-400/10 border-violet-400/20' },
  'tool-update':   { label: '工具', color: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
  research:        { label: '研究', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  funding:         { label: '融资', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  discussion:      { label: '讨论', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' },
  other:           { label: '资讯', color: 'text-slate-500 bg-slate-500/10 border-slate-500/20' },
}

function ScoreDisplay({ score, isAlert }: { score: number; isAlert: boolean }) {
  const color = isAlert
    ? 'text-amber-400'
    : score >= 8 ? 'text-indigo-400' : score >= 6 ? 'text-slate-300' : 'text-slate-500'
  return (
    <div className={cn('font-mono font-bold tabular-nums leading-none', color)}>
      <span className="text-2xl">{score}</span>
      <span className="text-xs opacity-60">/10</span>
    </div>
  )
}

export default function HotTopicCard({ topic }: Props) {
  const meta = CATEGORY[topic.category] || CATEGORY.other
  const isAlert = topic.alert_count > 0
  const isHot = topic.score >= 8

  return (
    <a href={topic.url} target="_blank" rel="noopener noreferrer" className="block group">
      <CardSpotlight
        className={cn(
          'glass-card rounded-xl p-4 transition-all duration-200',
          'hover:border-indigo-500/25 hover:shadow-glow-sm',
          isAlert && 'border-l-2 border-l-amber-400/60 hover:border-l-amber-400',
          isHot && !isAlert && 'border-indigo-500/15'
        )}
        color={isAlert ? 'rgba(245,158,11,0.08)' : 'rgba(99,102,241,0.1)'}
      >
        <div className="flex items-start gap-3">
          {/* Score */}
          <div className="shrink-0 pt-0.5">
            <ScoreDisplay score={topic.score} isAlert={isAlert} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', meta.color)}>
                {meta.label}
              </span>
              {isAlert && (
                <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                  ⚡ 命中
                </span>
              )}
              <ExternalLink
                size={11}
                className="ml-auto text-slate-600 group-hover:text-slate-400 transition-colors shrink-0"
              />
            </div>

            <h3 className="text-slate-100 font-medium text-sm leading-snug line-clamp-2 mb-1 group-hover:text-white transition-colors">
              {topic.title}
            </h3>

            {topic.summary && (
              <p className="text-slate-400 text-xs leading-relaxed line-clamp-1 mb-2">
                {topic.summary}
              </p>
            )}

            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-600">
              <span>{topic.source}</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span>
                {new Date(topic.created_at).toLocaleString('zh-CN', {
                  month: 'numeric', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>
      </CardSpotlight>
    </a>
  )
}
