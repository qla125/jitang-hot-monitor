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
            'pointer-events-auto w-72 bg-white rounded-xl shadow-glow-clay border border-clay-400/20 overflow-hidden transition-all duration-300',
            t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          )}
        >
          <div className="h-0.5 w-full bg-gradient-to-r from-clay-400 to-clay-500/60" />
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={13} className="text-clay-500 shrink-0" />
              <span className="text-clay-600 text-xs font-mono font-semibold">关键词命中</span>
              <span className="ml-auto text-[10px] font-mono bg-clay-400/10 text-clay-500 border border-clay-400/20 px-1.5 py-0.5 rounded-md">
                {(t.confidence * 100).toFixed(0)}%
              </span>
              <button
                onClick={() => setToasts(p => p.map(x => x.id === t.id ? { ...x, visible: false } : x))}
                className="text-matcha-300 hover:text-matcha-600 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
            <p className="text-[11px] text-matcha-400 mb-1 font-mono">
              「<span className="text-clay-500 font-medium">{t.keyword}</span>」
            </p>
            <p className="text-matcha-900 text-sm font-medium leading-snug line-clamp-2 mb-3">
              {t.title}
            </p>
            <a
              href={t.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-matcha-500 hover:text-matcha-700 font-medium transition-colors"
            >
              查看原文 <ExternalLink size={10} />
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
