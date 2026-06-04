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
    await keywordsApi.update(kw.id, { active: kw.active ? 0 : 1 }); onRefresh()
  }

  const handleDelete = async (id: number) => {
    await keywordsApi.remove(id); onRefresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-matcha-300 uppercase tracking-widest">监控词</span>
        <button
          onClick={() => setShowInput(v => !v)}
          className="flex items-center gap-1 text-[11px] text-matcha-500 hover:text-matcha-700 transition-colors"
        >
          <Plus size={11} />添加
        </button>
      </div>

      {showInput && (
        <form onSubmit={handleAdd} className="flex gap-1.5 animate-slide-up">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="输入关键词..."
            autoFocus
            className="flex-1 bg-cream-200 border border-matcha-100 rounded-lg px-2.5 py-1.5 text-xs text-matcha-900 placeholder-matcha-300 focus:outline-none focus:border-matcha-400 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-2.5 py-1.5 bg-matcha-500 hover:bg-matcha-600 disabled:opacity-40 rounded-lg text-xs text-white transition-colors"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : '确认'}
          </button>
        </form>
      )}

      {keywords.length === 0 ? (
        <p className="text-matcha-300 text-xs py-3 text-center font-mono">暂无监控词</p>
      ) : (
        <div className="flex flex-col gap-1">
          {keywords.map(kw => (
            <div
              key={kw.id}
              className={cn(
                'group flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all border',
                kw.active
                  ? 'bg-matcha-50 border-matcha-100 hover:border-matcha-200'
                  : 'bg-cream-200 border-cream-300 opacity-50'
              )}
            >
              <div className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                kw.active ? 'bg-matcha-400 animate-pulse-dot' : 'bg-cream-300'
              )} />
              <span className={cn('flex-1 text-xs font-mono truncate', kw.active ? 'text-matcha-800' : 'text-matcha-300')}>
                {kw.keyword}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleToggle(kw)} className="p-1 text-matcha-300 hover:text-matcha-600 transition-colors">
                  {kw.active ? <ToggleRight size={13} className="text-matcha-500" /> : <ToggleLeft size={13} />}
                </button>
                <button onClick={() => handleDelete(kw.id)} className="p-1 text-matcha-200 hover:text-clay-500 transition-colors">
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
