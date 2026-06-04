import { useState, useEffect, useRef } from 'react'
import { X, Zap, ExternalLink } from 'lucide-react'
import type { SSEAlert } from '@/types'
import { cn } from '@/lib/utils'

interface Toast extends SSEAlert { id: number; visible: boolean }

let counter = 0

export default function AlertBanner({ alerts }: { alerts: SSEAlert[] }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const prevLen = useRef(0)

  useEffect(() => {
    if (alerts.length <= prevLen.current) return
    const latest = alerts[alerts.length - 1]
    prevLen.current = alerts.length
    const id = ++counter
    setToasts(prev => [...prev.slice(-3), { ...latest, id, visible: true }])
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t))
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300)
    }, 7000)
  }, [alerts])

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 items-end pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto w-72 glass-card rounded-xl border-amber-400/30 shadow-glow-alert overflow-hidden transition-all duration-300',
            t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          )}
        >
          {/* amber top bar */}
          <div className="h-0.5 w-full bg-gradient-to-r from-amber-500 to-amber-300" />

          <div className="p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={13} className="text-amber-400 shrink-0" />
              <span className="text-amber-400 text-xs font-mono font-semibold">关键词命中</span>
              <span className="ml-auto text-[10px] font-mono bg-amber-400/10 text-amber-400 border border-amber-400/20 px-1.5 py-0.5 rounded">
                {(t.confidence * 100).toFixed(0)}%
              </span>
              <button
                onClick={() => setToasts(p => p.map(x => x.id === t.id ? { ...x, visible: false } : x))}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mb-1 font-mono">
              「<span className="text-amber-300">{t.keyword}</span>」
            </p>
            <p className="text-slate-100 text-sm font-medium leading-snug line-clamp-2 mb-2.5">
              {t.title}
            </p>

            <a
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              查看原文 <ExternalLink size={10} />
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
