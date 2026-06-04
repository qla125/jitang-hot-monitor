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
    try { setKeywords((await keywordsApi.getAll()).data) } catch (e) { console.error(e) }
  }, [])

  const loadAlerts = useCallback(async () => {
    try {
      const { data } = await alertsApi.getAll()
      setAlerts(data.alerts); setUnreadCount(data.unreadCount)
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
      const p = data as SSEAlert
      sseAlertsRef.current = [...sseAlertsRef.current, p]
      setSSEAlerts([...sseAlertsRef.current])
      if (Notification.permission === 'granted') {
        new Notification(`⚡ 命中「${p.keyword}」`, { body: p.title })
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
    <div className="flex h-screen bg-cream-100 text-matcha-900 font-body overflow-hidden">
      <BackgroundGrid />

      {/* ── Sidebar ── */}
      <aside className="relative z-10 w-56 flex-none flex flex-col sidebar-panel">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-matcha-100">
          <div className="relative shrink-0">
            <div className="w-6 h-6 rounded-full bg-matcha-50 border border-matcha-200 flex items-center justify-center">
              <Radio size={12} className="text-matcha-500" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-matcha-400 animate-pulse-dot border-2 border-cream-100" />
          </div>
          <span className="font-display font-bold text-sm text-matcha-900">极客雷达</span>
          <span className="ml-auto text-[9px] font-mono bg-matcha-50 text-matcha-500 border border-matcha-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
            Live
          </span>
        </div>

        {/* Radar */}
        <div className="px-3 pt-3 pb-1">
          <p className="text-[9px] font-mono text-matcha-300 uppercase tracking-widest mb-2 px-1">
            信号扫描 · {topics.length} 个
          </p>
          <RadarCanvas topics={topics} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-1.5 px-3 py-2">
          <div className="bg-white rounded-lg px-2.5 py-2 text-center shadow-card">
            <p className="font-mono font-bold text-lg text-matcha-600 leading-none">{topics.length}</p>
            <p className="text-[10px] text-matcha-300 mt-0.5">热点</p>
          </div>
          <div className="bg-white rounded-lg px-2.5 py-2 text-center shadow-card">
            <p className="font-mono font-bold text-lg text-clay-500 leading-none">{hotCount}</p>
            <p className="text-[10px] text-matcha-300 mt-0.5">高热</p>
          </div>
        </div>

        {/* Keywords */}
        <div className="flex-1 overflow-y-auto px-3 py-2 border-t border-matcha-50">
          <KeywordManager keywords={keywords} onRefresh={loadKeywords} />
        </div>

        {/* Recent alerts */}
        {alerts.slice(0, 3).length > 0 && (
          <div className="px-3 py-2 border-t border-matcha-50">
            <p className="text-[9px] font-mono text-matcha-300 uppercase tracking-widest mb-1.5">最新告警</p>
            <div className="flex flex-col gap-1">
              {alerts.slice(0, 3).map(a => (
                <a key={a.id} href={a.topic_url} target="_blank" rel="noopener noreferrer"
                   onClick={() => alertsApi.markRead(a.id)}
                   className="flex items-start gap-1.5 text-[11px] hover:text-clay-600 transition-colors">
                  <Zap size={9} className="text-clay-400 mt-0.5 shrink-0" />
                  <span className={cn('line-clamp-1', a.is_read ? 'text-matcha-300' : 'text-clay-500')}>
                    {a.topic_title}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1 p-3 border-t border-matcha-100">
          <Link to="/settings"
            className="flex items-center gap-1.5 text-[11px] text-matcha-400 hover:text-matcha-700 transition-colors px-2 py-1.5 rounded-lg hover:bg-matcha-50">
            <Settings size={12} /> 设置
          </Link>
          {unreadCount > 0 && (
            <button onClick={() => alertsApi.markAllRead()} className="ml-auto flex items-center gap-1 text-[11px] text-clay-400 hover:text-clay-600 transition-colors">
              <Bell size={11} /><span className="font-mono">{unreadCount}</span>
            </button>
          )}
          {notifyPerm !== 'granted' && (
            <button
              onClick={() => Notification.requestPermission().then(p => setNotifyPerm(p))}
              className="ml-auto text-[10px] text-matcha-300 hover:text-matcha-500 transition-colors"
            >
              开启通知
            </button>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-3 px-5 py-3 border-b border-matcha-100 bg-white/60 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={cn(
                  'shrink-0 text-[11px] font-mono px-2.5 py-1.5 rounded-lg transition-all',
                  filter === f.key
                    ? 'bg-matcha-50 text-matcha-700 border border-matcha-200 font-semibold'
                    : 'text-matcha-400 hover:text-matcha-600 hover:bg-matcha-50'
                )}>
                {f.label}
              </button>
            ))}
            <span className="ml-2 text-[10px] text-matcha-300 font-mono shrink-0">{filtered.length} 条</span>
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {lastUpdate && (
              <span className="text-[10px] font-mono text-matcha-300 hidden md:block">
                更新 {lastUpdate}
              </span>
            )}

            <MovingBorderButton
              containerClassName="h-8 w-auto rounded-lg"
              className="text-xs font-medium gap-1.5 px-4 text-matcha-700"
              borderRadius="0.5rem"
              duration={3000}
              onClick={handleScan}
              disabled={refreshing}
            >
              {searching
                ? <><RefreshCw size={11} className="animate-spin" />搜索中</>
                : <><Search size={11} />立即扫描</>}
            </MovingBorderButton>

            <button
              onClick={loadTopics}
              disabled={refreshing}
              className="p-1.5 text-matcha-300 hover:text-matcha-600 hover:bg-matcha-50 rounded-lg transition-all disabled:opacity-40"
            >
              <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
            </button>
          </div>
        </header>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 gap-4">
              <div className="w-12 h-12 rounded-full bg-matcha-50 border border-matcha-200 flex items-center justify-center">
                <Radio size={20} className="text-matcha-300" />
              </div>
              <p className="text-matcha-300 text-sm font-mono">暂无热点数据</p>
              <button onClick={handleScan}
                className="text-xs text-matcha-600 bg-matcha-50 border border-matcha-200 px-4 py-2 rounded-lg hover:bg-matcha-100 transition-all">
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

      {/* Search result modal */}
      {searchResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-matcha-900/20 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(42,51,32,0.15)] border border-matcha-100 w-full max-w-xl max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-matcha-100">
              <div>
                <h2 className="font-display font-bold text-base text-matcha-900">关键词搜索结果</h2>
                <p className="text-xs text-matcha-400 mt-0.5 font-mono">
                  共命中 <span className="text-matcha-600 font-bold">{searchResults.totalFound}</span> 条相关内容
                </p>
              </div>
              <button onClick={() => setSearchResults(null)} className="text-matcha-300 hover:text-matcha-700 transition-colors p-1 rounded-lg hover:bg-matcha-50">✕</button>
            </div>
            <div className="overflow-y-auto p-4 flex flex-col gap-3">
              {searchResults.results.map(r => (
                <div key={r.keyword} className="bg-cream-100 rounded-xl border border-matcha-100 p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-xs font-mono font-semibold text-clay-500">「{r.keyword}」</span>
                    <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-md border',
                      r.count > 0 ? 'text-matcha-600 bg-matcha-50 border-matcha-200' : 'text-matcha-300 bg-cream-200 border-cream-300')}>
                      {r.count > 0 ? `${r.count} 条命中` : '暂无'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {r.items.filter(i => i.matched).map((item, idx) => (
                      <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer"
                         className="flex items-start gap-2 p-2 rounded-lg hover:bg-white transition-all group">
                        <span className="text-matcha-400 text-xs mt-0.5 shrink-0 font-mono">▸</span>
                        <div className="min-w-0">
                          <p className="text-matcha-800 text-xs leading-snug line-clamp-2 group-hover:text-matcha-900">{item.title}</p>
                          <p className="text-matcha-300 text-[10px] mt-0.5 font-mono">{item.source} · {(item.confidence * 100).toFixed(0)}%</p>
                        </div>
                      </a>
                    ))}
                    {r.items.filter(i => i.matched).length === 0 && (
                      <p className="text-matcha-300 text-xs font-mono">近期 HackerNews 未找到高相关内容</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {searching && !searchResults && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-white rounded-xl shadow-card border border-matcha-100 px-5 py-2.5 flex items-center gap-2.5 animate-fade-in">
          <RefreshCw size={12} className="text-matcha-500 animate-spin" />
          <span className="text-xs text-matcha-600 font-mono">正在搜索关键词相关内容...</span>
        </div>
      )}

      <AlertBanner alerts={sseAlerts} />
    </div>
  )
}
