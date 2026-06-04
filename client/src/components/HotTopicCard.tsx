import { ExternalLink } from 'lucide-react'
import { CardSpotlight } from '@/components/aceternity/card-spotlight'
import { cn } from '@/lib/utils'
import type { HotTopic, TopicCategory } from '@/types'

interface Props { topic: HotTopic }

const CATEGORY: Record<TopicCategory, { label: string; dot: string }> = {
  'model-release': { label: '模型发布', dot: 'bg-matcha-400' },
  'tool-update':   { label: '工具更新', dot: 'bg-matcha-300' },
  research:        { label: '研究论文', dot: 'bg-matcha-300' },
  funding:         { label: '融资动态', dot: 'bg-clay-400' },
  discussion:      { label: '社区讨论', dot: 'bg-matcha-200' },
  other:           { label: '资讯',     dot: 'bg-cream-300' },
}

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

export default function HotTopicCard({ topic }: Props) {
  const meta = CATEGORY[topic.category] || CATEGORY.other
  const isAlert = topic.alert_count > 0

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

            {topic.summary && (
              <p className="text-matcha-400 text-xs leading-relaxed line-clamp-1 mb-2">
                {topic.summary}
              </p>
            )}

            <div className="flex items-center gap-1.5 text-[10px] font-mono text-matcha-300">
              <span>{topic.source}</span>
              <span>·</span>
              <span>
                {new Date(topic.created_at).toLocaleString('zh-CN', {
                  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>
      </CardSpotlight>
    </a>
  )
}
