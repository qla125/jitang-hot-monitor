import { useState } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import { keywordsApi } from '@/api'
import type { Keyword } from '@/types'
import { cn } from '@/lib/utils'

interface Props { keywords: Keyword[]; onRefresh: () => void }

export default function KeywordManager({ keywords, onRefresh }: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showInput, setShowInput] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    try {
      await keywordsApi.create({ keyword: input.trim() })
      setInput(''); setShowInput(false); onRefresh()
    } finally { setLoading(false) }
  }

  const handleToggle = async (kw: Keyword) => {
    await keywordsApi.update(kw.id, { active: kw.active ? 0 : 1 })
    onRefresh()
  }

  const handleDelete = async (id: number) => {
    await keywordsApi.remove(id); onRefresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">监控词</span>
        <button
          onClick={() => setShowInput(v => !v)}
          className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Plus size={11} /> 添加
        </button>
      </div>

      {showInput && (
        <form onSubmit={handleAdd} className="flex gap-1.5 animate-slide-up">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="输入关键词..."
            autoFocus
            className="flex-1 bg-slate-900 border border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-md text-xs text-white transition-colors"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : '确认'}
          </button>
        </form>
      )}

      {keywords.length === 0 ? (
        <p className="text-slate-600 text-xs py-3 text-center font-mono">暂无监控词</p>
      ) : (
        <div className="flex flex-col gap-1">
          {keywords.map(kw => (
            <div
              key={kw.id}
              className={cn(
                'group flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all',
                kw.active
                  ? 'bg-indigo-500/5 border-indigo-500/15 hover:border-indigo-500/30'
                  : 'bg-slate-900/30 border-white/[0.04] opacity-50'
              )}
            >
              <div
                className={cn('w-1.5 h-1.5 rounded-full shrink-0 animate-pulse-dot', kw.active ? 'bg-live' : 'bg-slate-600')}
              />
              <span className={cn('flex-1 text-xs font-mono truncate', kw.active ? 'text-slate-200' : 'text-slate-500')}>
                {kw.keyword}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleToggle(kw)} className="p-1 text-slate-500 hover:text-indigo-400 transition-colors">
                  {kw.active ? <ToggleRight size={13} className="text-live" /> : <ToggleLeft size={13} />}
                </button>
                <button onClick={() => handleDelete(kw.id)} className="p-1 text-slate-600 hover:text-red-400 transition-colors">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
