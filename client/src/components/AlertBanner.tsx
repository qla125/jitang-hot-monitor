import { useState, useEffect } from 'react'
import { X, Bell, ExternalLink } from 'lucide-react'
import type { SSEAlert } from '../types'
import clsx from 'clsx'

interface ToastItem extends SSEAlert {
  id: number
  visible: boolean
}

let toastCounter = 0

interface Props {
  alerts: SSEAlert[]
}

export default function AlertBanner({ alerts }: Props) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    if (alerts.length === 0) return
    const latest = alerts[alerts.length - 1]
    const id = ++toastCounter
    const toast: ToastItem = { ...latest, id, visible: true }

    setToasts((prev) => [...prev.slice(-4), toast])

    // Auto-dismiss after 8s
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, visible: false } : t)))
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300)
    }, 8000)
  }, [alerts])

  const dismiss = (id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, visible: false } : t)))
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            'pointer-events-auto w-80 bg-elevated border border-alert/40 rounded-xl shadow-glow-alert p-4 transition-all duration-300',
            toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-alert animate-pulse" />
              <span className="text-alert text-xs font-mono font-bold">关键词命中</span>
              <span className="bg-alert/15 text-alert text-xs px-1.5 py-0.5 rounded border border-alert/30 font-mono">
                {(toast.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-ink-4 hover:text-ink-2 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-ink-3 text-xs mb-1">
            关键词: <span className="text-alert font-medium">"{toast.keyword}"</span>
          </p>
          <p className="text-ink-1 text-sm font-medium leading-snug line-clamp-2 mb-2">
            {toast.title}
          </p>
          {toast.summary && (
            <p className="text-ink-3 text-xs line-clamp-2 mb-2">{toast.summary}</p>
          )}
          <a
            href={toast.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            查看详情 <ExternalLink size={10} />
          </a>
        </div>
      ))}
    </div>
  )
}
