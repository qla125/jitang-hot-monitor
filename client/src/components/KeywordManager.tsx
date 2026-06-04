import { useState } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import { keywordsApi } from '../api'
import type { Keyword } from '../types'
import clsx from 'clsx'

interface Props {
  keywords: Keyword[]
  onRefresh: () => void
}

export default function KeywordManager({ keywords, onRefresh }: Props) {
  const [input, setInput] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    try {
      await keywordsApi.create({ keyword: input.trim(), description: desc.trim() })
      setInput('')
      setDesc('')
      setShowForm(false)
      onRefresh()
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (kw: Keyword) => {
    await keywordsApi.update(kw.id, { active: kw.active ? 0 : 1 })
    onRefresh()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除该关键词？')) return
    await keywordsApi.remove(id)
    onRefresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-ink-2 text-xs font-mono uppercase tracking-widest">关键词监控</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={clsx(
            'flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all',
            showForm
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'border-elevated text-ink-3 hover:border-primary/30 hover:text-primary'
          )}
        >
          <Plus size={12} />
          添加
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 p-3 bg-elevated rounded-xl border border-primary/20">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="关键词，如：GPT-5 发布"
            className="bg-surface border border-ink-4/30 rounded-lg px-3 py-2 text-sm text-ink-1 placeholder-ink-4 focus:outline-none focus:border-primary/50 transition-colors"
            autoFocus
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="备注（可选）"
            className="bg-surface border border-ink-4/30 rounded-lg px-3 py-2 text-xs text-ink-1 placeholder-ink-4 focus:outline-none focus:border-primary/30 transition-colors"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-sm py-2 rounded-lg transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              确认添加
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-2 text-ink-3 text-sm rounded-lg border border-elevated hover:border-ink-4/50 transition-all"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {keywords.length === 0 ? (
        <p className="text-ink-4 text-xs text-center py-4 font-mono">暂无监控关键词</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {keywords.map((kw) => (
            <div
              key={kw.id}
              className={clsx(
                'flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all',
                kw.active
                  ? 'bg-surface border-primary/15 hover:border-primary/30'
                  : 'bg-elevated border-elevated opacity-50 hover:opacity-70'
              )}
            >
              <div className="flex-1 min-w-0">
                <p className={clsx('text-sm font-medium truncate', kw.active ? 'text-ink-1' : 'text-ink-3')}>
                  {kw.keyword}
                </p>
                {kw.description && (
                  <p className="text-xs text-ink-4 truncate">{kw.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggle(kw)}
                  className="text-ink-3 hover:text-primary transition-colors p-1"
                  title={kw.active ? '暂停监控' : '启动监控'}
                >
                  {kw.active ? (
                    <ToggleRight size={18} className="text-primary" />
                  ) : (
                    <ToggleLeft size={18} />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(kw.id)}
                  className="text-ink-4 hover:text-danger transition-colors p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
