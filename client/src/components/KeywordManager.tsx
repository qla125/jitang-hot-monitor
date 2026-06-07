import { useState } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, Loader2, Sparkles, RefreshCw, X } from 'lucide-react'
import { keywordsApi } from '@/api'
import type { Keyword } from '@/types'
import { cn } from '@/lib/utils'

interface Props { keywords: Keyword[]; onRefresh: () => void }

function parseTerms(raw?: string): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((t): t is string => typeof t === 'string' && t.trim().length > 0) : []
  } catch { return [] }
}

export default function KeywordManager({ keywords, onRefresh }: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [termInput, setTermInput] = useState('')
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null)

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

  const handleAddTerm = async (kw: Keyword, term: string) => {
    const trimmed = term.trim()
    if (!trimmed) return
    const terms = parseTerms(kw.expanded_terms)
    if (terms.includes(trimmed) || trimmed === kw.keyword) { setTermInput(''); return }
    await keywordsApi.update(kw.id, { expanded_terms: [...terms, trimmed] })
    setTermInput(''); onRefresh()
  }

  const handleRemoveTerm = async (kw: Keyword, term: string) => {
    const terms = parseTerms(kw.expanded_terms).filter(t => t !== term)
    await keywordsApi.update(kw.id, { expanded_terms: terms }); onRefresh()
  }

  const handleRegenerate = async (kw: Keyword) => {
    setRegeneratingId(kw.id)
    try {
      await keywordsApi.regenerateExpansion(kw.id); onRefresh()
    } finally { setRegeneratingId(null) }
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
          {keywords.map(kw => {
            const terms = parseTerms(kw.expanded_terms)
            const isOpen = expandedId === kw.id
            return (
              <div
                key={kw.id}
                className={cn(
                  'group rounded-lg transition-all border',
                  kw.active
                    ? 'bg-matcha-50 border-matcha-100 hover:border-matcha-200'
                    : 'bg-cream-200 border-cream-300 opacity-50'
                )}
              >
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    kw.active ? 'bg-matcha-400 animate-pulse-dot' : 'bg-cream-300'
                  )} />
                  <span className={cn('flex-1 text-xs font-mono truncate', kw.active ? 'text-matcha-800' : 'text-matcha-300')}>
                    {kw.keyword}
                  </span>
                  <button
                    onClick={() => { setExpandedId(isOpen ? null : kw.id); setTermInput('') }}
                    title="查询扩展词（用于扩大检索召回范围）"
                    className={cn(
                      'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors',
                      isOpen ? 'bg-matcha-200 text-matcha-700' : 'text-matcha-300 hover:text-matcha-600 hover:bg-matcha-100'
                    )}
                  >
                    <Sparkles size={10} />{terms.length > 0 ? terms.length : ''}
                  </button>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleToggle(kw)} className="p-1 text-matcha-300 hover:text-matcha-600 transition-colors">
                      {kw.active ? <ToggleRight size={13} className="text-matcha-500" /> : <ToggleLeft size={13} />}
                    </button>
                    <button onClick={() => handleDelete(kw.id)} className="p-1 text-matcha-200 hover:text-clay-500 transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-2.5 pb-2.5 flex flex-col gap-1.5 animate-slide-up">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-matcha-300 leading-tight">
                        扩展词用于扩大检索召回，不参与相关性判断
                      </span>
                      <button
                        onClick={() => handleRegenerate(kw)}
                        disabled={regeneratingId === kw.id}
                        className="flex items-center gap-1 shrink-0 whitespace-nowrap text-[10px] text-matcha-400 hover:text-matcha-600 disabled:opacity-40 transition-colors"
                      >
                        <RefreshCw size={10} className={regeneratingId === kw.id ? 'animate-spin' : ''} />
                        {regeneratingId === kw.id ? '生成中…' : '重新生成'}
                      </button>
                    </div>

                    {terms.length === 0 ? (
                      <p className="text-matcha-300 text-[11px] font-mono">暂无扩展词，可点击右上角让 AI 生成，或手动添加</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {terms.map(term => (
                          <span
                            key={term}
                            className="group/tag flex items-center gap-1 px-1.5 py-0.5 rounded bg-matcha-100 border border-matcha-200 text-[11px] font-mono text-matcha-700"
                          >
                            {term}
                            <button onClick={() => handleRemoveTerm(kw, term)} className="text-matcha-300 hover:text-clay-500 transition-colors">
                              <X size={9} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <form
                      onSubmit={(e) => { e.preventDefault(); handleAddTerm(kw, termInput) }}
                      className="flex gap-1.5"
                    >
                      <input
                        value={termInput}
                        onChange={e => setTermInput(e.target.value)}
                        placeholder="手动添加扩展词..."
                        className="flex-1 bg-cream-200 border border-matcha-100 rounded px-2 py-1 text-[11px] text-matcha-900 placeholder-matcha-300 focus:outline-none focus:border-matcha-400 transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={!termInput.trim()}
                        className="shrink-0 whitespace-nowrap px-2 py-1 bg-matcha-500 hover:bg-matcha-600 disabled:opacity-40 rounded text-[11px] text-white transition-colors"
                      >
                        添加
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
