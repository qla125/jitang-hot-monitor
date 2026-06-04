import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Settings, Bell, Zap, Radio, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { MovingBorderButton } from '@/components/aceternity/moving-border'
import { BackgroundGrid } from '@/components/aceternity/background-grid'
import RadarCanvas from '@/components/RadarCanvas'
import HotTopicCard from '@/components/HotTopicCard'
import KeywordManager from '@/components/KeywordManager'
import AlertBanner from '@/components/AlertBanner'
import { topicsApi, keywordsApi, alertsApi } from '@/api'
import { useSSE } from '@/hooks/useSSE'
import type { HotTopic, Keyword, Alert, SSEAlert, TopicCategory, SSESearchComplete } from '@/types'

type Filter = 'all' | TopicCategory

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'model-release', label: '模型' },
  { key: 'tool-update', label: '工具' },
  { key: 'research', label: '研究' },
  { key: 'funding', label: '融资' },
  { key: 'discussion', label: '讨论' },
]

export default function Dashboard() {
  const [topics, setTopics] = useState<HotTopic[]>([])
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [searching, setSearching] = useState(false)
  const [lastUpdate, setLastUpdate] = useState('')
  const [sseAlerts, setSSEAlerts] = useState<SSEAlert[]>([])
  const [searchResults, setSearchResults] = useState<SSESearchComplete | null>(null)
  const [notifyPerm, setNotifyPerm] = useState<NotificationPermission>('default')
  const sseAlertsRef = useRef<SSEAlert[]>([])

  const loadTopics = useCallback(async () => {
    try {
      const res = await topicsApi.getAll(48)
      setTopics(res.data)
      setLastUpdate(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) { console.error(e) }
  }, [])

  const loadKeywords = useCallback(async () => {
    try { const res = await keywordsApi.getAll(); setKeywords(res.data) } catch (e) { console.error(e) }
  }, [])

  const loadAlerts = useCallback(async () => {
    try {
      const res = await alertsApi.getAll()
      setAlerts(res.data.alerts); setUnreadCount(res.data.unreadCount)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    loadTopics(); loadKeywords(); loadAlerts()
    setNotifyPerm(Notification.permission)
  }, [loadTopics, loadKeywords, loadAlerts])

  const handleScan = async () => {
    setSearching(true); setRefreshing(true); setSearchResults(null)
    try {
      await topicsApi.searchKeywords()
      setTimeout(() => { loadTopics(); loadAlerts(); setRefreshing(false) }, 20000)
    } catch (e) { console.error(e); setRefreshing(false); setSearching(false) }
  }

  useSSE({
    alert: (data) => {
      const payload = data as SSEAlert
      sseAlertsRef.current = [...sseAlertsRef.current, payload]
      setSSEAlerts([...sseAlertsRef.current])
      if (Notification.permission === 'granted') {
        new Notification(`⚡ 关键词命中「${payload.keyword}」`, { body: payload.title })
      }
      loadAlerts()
    },
    refresh: () => { loadTopics(); loadAlerts() },
    'search-complete': (data) => {
      setSearchResults(data as SSESearchComplete)
      setSearching(false); setRefreshing(false)
      loadTopics(); loadAlerts()
    },
  })

  const filtered = filter === 'all' ? topics : topics.filter(t => t.category === filter)
  const hotCount = topics.filter(t => t.score >= 8).length

  return (
    <div className="flex h-screen bg-[#030712] text-slate-100 font-body overflow-hidden">
      <BackgroundGrid />

      {/* ── Sidebar ── */}
      <aside className="relative z-10 w-56 flex-none flex flex-col border-r border-white/[0.06] bg-slate-950/60 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/[0.06]">
          <div className="relative shrink-0">
            <Radio size={15} className="text-indigo-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-live animate-pulse-dot" />
          </div>
          <span className="font-display font-bold text-sm text-slate-100">极客雷达</span>
          <span className="ml-auto text-[9px] font-mono bg-live/10 text-live border border-live/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
            Live
          </span>
        </div>

        {/* Radar */}
        <div className="px-3 pt-3 pb-1">
          <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-1.5 px-1">
            信号扫描 · {topics.length} 个
          </p>
          <RadarCanvas topics={topics} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-1.5 px-3 py-2">
          <div className="glass-card rounded-lg px-2.5 py-2 text-center">
            <p className="font-mono font-bold text-lg text-indigo-400 leading-none">{topics.length}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">热点</p>
          </div>
          <div className="glass-card rounded-lg px-2.5 py-2 text-center">
            <p className="font-mono font-bold text-lg text-amber-400 leading-none">{hotCount}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">高热</p>
          </div>
        </div>

        {/* Keywords */}
        <div className="flex-1 overflow-y-auto px-3 py-2 border-t border-white/[0.04]">
          <KeywordManager keywords={keywords} onRefresh={loadKeywords} />
        </div>

        {/* Recent alerts */}
        {alerts.slice(0, 3).length > 0 && (
          <div className="px-3 py-2 border-t border-white/[0.04]">
            <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">最新告警</p>
            <div className="flex flex-col gap-1">
              {alerts.slice(0, 3).map(a => (
                <a key={a.id} href={a.topic_url} target="_blank" rel="noopener noreferrer"
                   onClick={() => alertsApi.markRead(a.id)}
                   className="flex items-start gap-1.5 text-[11px] hover:text-amber-300 transition-colors">
                  <Zap size={9} className="text-amber-400 mt-0.5 shrink-0" />
                  <span className={cn('line-clamp-1', a.is_read ? 'text-slate-500' : 'text-amber-300/80')}>
                    {a.topic_title}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1 p-3 border-t border-white/[0.06]">
          <Link to="/settings"
            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors px-2 py-1.5 rounded-md hover:bg-white/[0.04]">
            <Settings size={12} /> 设置
          </Link>
          {unreadCount > 0 && (
            <button onClick={() => alertsApi.markAllRead()} className="ml-auto flex items-center gap-1 text-[11px] text-amber-400/70 hover:text-amber-400 transition-colors">
              <Bell size={11} />
              <span className="font-mono">{unreadCount}</span>
            </button>
          )}
          {notifyPerm !== 'granted' && (
            <button
              onClick={() => Notification.requestPermission().then(p => setNotifyPerm(p))}
              className="ml-auto text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              开启通知
            </button>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] bg-slate-950/40 backdrop-blur-sm shrink-0">
          {/* Filters */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={cn(
                  'shrink-0 text-[11px] font-mono px-2.5 py-1.5 rounded-md transition-all',
                  filter === f.key
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                )}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {lastUpdate && (
              <span className="text-[10px] font-mono text-slate-600 hidden md:block">
                {lastUpdate}
              </span>
            )}

            {/* Scan button with MovingBorder */}
            <MovingBorderButton
              containerClassName="h-8 w-auto rounded-lg"
              className="text-xs font-medium gap-1.5 px-4 text-slate-200"
              borderRadius="0.5rem"
              duration={2500}
              onClick={handleScan}
              disabled={refreshing}
            >
              {searching ? (
                <><RefreshCw size={11} className="animate-spin" /> 搜索中</>
              ) : (
                <><Search size={11} /> 立即扫描</>
              )}
            </MovingBorderButton>

            <button
              onClick={loadTopics}
              disabled={refreshing}
              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] rounded-md transition-all disabled:opacity-40"
              title="刷新热点列表"
            >
              <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
            </button>
          </div>
        </header>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 gap-4">
              <div className="w-12 h-12 rounded-full border border-indigo-500/20 flex items-center justify-center">
                <Radio size={20} className="text-indigo-400 opacity-50" />
              </div>
              <p className="text-slate-500 text-sm font-mono">暂无热点数据</p>
              <button onClick={handleScan}
                className="text-xs text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-lg hover:bg-indigo-500/10 transition-all">
                立即扫描
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
              {filtered.map(t => <HotTopicCard key={t.id} topic={t} />)}
            </div>
          )}
        </div>
      </main>

      {/* ── Search result modal ── */}
      {searchResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-card border-indigo-500/20 rounded-2xl w-full max-w-xl max-h-[75vh] flex flex-col shadow-glow">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h2 className="font-display font-bold text-base text-slate-100">关键词搜索结果</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  共命中 <span className="text-indigo-400 font-bold">{searchResults.totalFound}</span> 条相关内容
                </p>
              </div>
              <button onClick={() => setSearchResults(null)} className="text-slate-500 hover:text-slate-200 transition-colors p-1">✕</button>
            </div>
            <div className="overflow-y-auto p-4 flex flex-col gap-3">
              {searchResults.results.map(r => (
                <div key={r.keyword} className="bg-slate-900/50 rounded-xl border border-white/[0.06] p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-xs font-mono font-semibold text-amber-400">「{r.keyword}」</span>
                    <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border',
                      r.count > 0 ? 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20' : 'text-slate-500 bg-slate-500/10 border-slate-500/20')}>
                      {r.count > 0 ? `${r.count} 条命中` : '暂无'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {r.items.filter(i => i.matched).map((item, idx) => (
                      <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer"
                         className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/[0.04] transition-all group">
                        <span className="text-indigo-400 text-xs mt-0.5 shrink-0 font-mono">▸</span>
                        <div className="min-w-0">
                          <p className="text-slate-200 text-xs leading-snug line-clamp-2 group-hover:text-white">{item.title}</p>
                          <p className="text-slate-500 text-[10px] mt-0.5 font-mono">{item.source} · {(item.confidence * 100).toFixed(0)}%</p>
                        </div>
                      </a>
                    ))}
                    {r.items.filter(i => i.matched).length === 0 && (
                      <p className="text-slate-600 text-xs font-mono">近期 HackerNews 未找到高相关内容</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {searching && !searchResults && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 glass-card border-indigo-500/20 rounded-xl px-5 py-2.5 flex items-center gap-2.5 shadow-glow-sm animate-fade-in">
          <RefreshCw size={12} className="text-indigo-400 animate-spin" />
          <span className="text-xs text-slate-300 font-mono">正在搜索关键词相关内容...</span>
        </div>
      )}

      <AlertBanner alerts={sseAlerts} />
    </div>
  )
}
