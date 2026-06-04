import type { HotTopic, TopicCategory } from '../types'
import { ExternalLink } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  topic: HotTopic
}

const CATEGORY_META: Record<TopicCategory, { icon: string; label: string; color: string }> = {
  'model-release': { icon: '🤖', label: '模型发布', color: 'text-primary' },
  'tool-update':   { icon: '🔧', label: '工具更新', color: 'text-accent' },
  research:        { icon: '📄', label: '研究论文', color: 'text-blue-400' },
  funding:         { icon: '💰', label: '融资动态', color: 'text-yellow-400' },
  discussion:      { icon: '💬', label: '社区讨论', color: 'text-ink-3' },
  other:           { icon: '📡', label: '其他资讯', color: 'text-ink-4' },
}

function ScoreBar({ score }: { score: number }) {
  const bars = 5
  const filled = Math.round((score / 10) * bars)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            'w-1.5 rounded-full transition-all',
            i < filled
              ? score >= 8 ? 'bg-alert h-3.5' : score >= 6 ? 'bg-primary h-2.5' : 'bg-ink-4 h-2'
              : 'bg-elevated h-1.5'
          )}
        />
      ))}
    </div>
  )
}

export default function HotTopicCard({ topic }: Props) {
  const meta = CATEGORY_META[topic.category] || CATEGORY_META.other
  const isHot = topic.score >= 8
  const isAlert = topic.alert_count > 0

  return (
    <a
      href={topic.url}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        'group block p-4 rounded-xl border transition-all duration-200 hover:-translate-y-0.5',
        isAlert
          ? 'bg-alert/5 border-alert/30 hover:border-alert/60 hover:shadow-glow-alert'
          : isHot
          ? 'bg-surface border-primary/20 hover:border-primary/50 hover:shadow-glow'
          : 'bg-surface border-elevated hover:border-primary/20'
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm">{meta.icon}</span>
          <span className={clsx('text-xs font-mono font-medium', meta.color)}>{meta.label}</span>
          {isAlert && (
            <span className="text-xs bg-alert/15 text-alert px-1.5 py-0.5 rounded font-mono border border-alert/30">
              🎯 关键词命中
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScoreBar score={topic.score} />
          <ExternalLink size={12} className="text-ink-4 group-hover:text-ink-2 transition-colors" />
        </div>
      </div>

      <h3 className="text-ink-1 font-medium text-sm leading-snug line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">
        {topic.title}
      </h3>

      {topic.summary && (
        <p className="text-ink-3 text-xs leading-relaxed line-clamp-2 mb-2">{topic.summary}</p>
      )}

      <div className="flex items-center justify-between text-xs font-mono text-ink-4">
        <span>{topic.source}</span>
        <span>{new Date(topic.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </a>
  )
}
