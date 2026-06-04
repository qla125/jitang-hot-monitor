import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Bell, Settings, Activity, BellRing } from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import RadarCanvas from '../components/RadarCanvas'
import HotTopicCard from '../components/HotTopicCard'
import KeywordManager from '../components/KeywordManager'
import AlertBanner from '../components/AlertBanner'
import { topicsApi, keywordsApi, alertsApi } from '../api'
import { useSSE } from '../hooks/useSSE'
import type { HotTopic, Keyword, Alert, SSEAlert, TopicCategory, SSESearchComplete } from '../types'

type Filter = 'all' | TopicCategory

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'model-release', label: '🤖 模型' },
  { key: 'tool-update', label: '🔧 工具' },
  { key: 'research', label: '📄 研究' },
  { key: 'funding', label: '💰 融资' },
  { key: 'discussion', label: '💬 讨论' },
]

export default function Dashboard() {
  const [topics, setTopics] = useState<HotTopic[]>([])
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [sseAlerts, setSSEAlerts] = useState<SSEAlert[]>([])
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission>('default')
  const sseAlertsRef = useRef<SSEAlert[]>([])
  const [searchResults, setSearchResults] = useState<SSESearchComplete | null>(null)
  const [searching, setSearching] = useState(false)

  const loadTopics = useCallback(async () => {
    try {
      const res = await topicsApi.getAll(48)
      setTopics(res.data)
      setLastUpdate(new Date().toLocaleTimeString('zh-CN'))
    } catch (e) {
      console.error('[loadTopics] failed:', e)
    }
  }, [])

  const loadKeywords = useCallback(async () => {
    try {
      const res = await keywordsApi.getAll()
      setKeywords(res.data)
    } catch (e) {
      console.error('[loadKeywords] failed:', e)
    }
  }, [])

  const loadAlerts = useCallback(async () => {
    try {
      const res = await alertsApi.getAll()
      setAlerts(res.data.alerts)
      setUnreadCount(res.data.unreadCount)
    } catch (e) {
      console.error('[loadAlerts] failed:', e)
    }
  }, [])

  useEffect(() => {
    loadTopics()
    loadKeywords()
    loadAlerts()
    setNotifyPermission(Notification.permission)
  }, [loadTopics, loadKeywords, loadAlerts])

  const handleManualRefresh = async () => {
    setRefreshing(true)
    setSearching(true)
    setSearchResults(null)
    try {
      await topicsApi.searchKeywords()
      // 结果通过 SSE search-complete 事件返回，这里只等一段时间后刷新列表
      setTimeout(() => { loadTopics(); loadAlerts(); setRefreshing(false) }, 20000)
    } catch (e) {
      console.error('[refresh] failed:', e)
      setRefreshing(false)
      setSearching(false)
    }
  }

  const requestBrowserNotify = async () => {
    const perm = await Notification.requestPermission()
    setNotifyPermission(perm)
  }

  // SSE handlers
  useSSE({
    alert: (data) => {
      const payload = data as SSEAlert
      sseAlertsRef.current = [...sseAlertsRef.current, payload]
      setSSEAlerts([...sseAlertsRef.current])

      // Browser notification
      if (Notification.permission === 'granted') {
        new Notification(`🎯 极客雷达：关键词命中 "${payload.keyword}"`, {
          body: payload.title,
          icon: '/favicon.ico',
        })
      }
      loadAlerts()
    },
    refresh: () => {
      loadTopics()
      loadAlerts()
    },
    'search-complete': (data) => {
      const result = data as SSESearchComplete
      setSearchResults(result)
      setSearching(false)
      setRefreshing(false)
      loadTopics()
      loadAlerts()
    },
  })

  const filtered = filter === 'all' ? topics : topics.filter((t) => t.category === filter)

  return (
    <div className="min-h-screen bg-void font-body text-ink-1">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/3 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent/4 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-elevated">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-full border-2 border-primary/60 flex items-center justify-center">
              <Activity size={14} className="text-primary" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
          </div>
          <div>
            <h1 className="font-display text-primary font-bold text-lg tracking-wider leading-none">
              极客雷达
            </h1>
            <p className="text-ink-4 text-xs font-mono">AI 热点监控系统</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {notifyPermission !== 'granted' && (
            <button
              onClick={requestBrowserNotify}
              className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-alert border border-elevated hover:border-alert/30 px-3 py-1.5 rounded-lg transition-all"
            >
              <BellRing size={13} />
              开启通知
            </button>
          )}

          {lastUpdate && (
            <span className="text-xs text-ink-4 font-mono hidden md:block">
              更新: {lastUpdate}
            </span>
          )}

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all disabled:opacity-60"
          >
            <RefreshCw size={13} className={clsx(refreshing && 'animate-spin')} />
            {refreshing ? '扫描中' : '立即扫描'}
          </button>

          <Link
            to="/settings"
            className="p-1.5 text-ink-3 hover:text-ink-1 border border-elevated hover:border-ink-4/50 rounded-lg transition-all"
          >
            <Settings size={16} />
          </Link>

          {unreadCount > 0 && (
            <Link
              to="/alerts"
              className="relative p-1.5 text-alert border border-alert/30 rounded-lg"
            >
              <Bell size={16} />
              <span className="absolute -top-1 -right-1 bg-alert text-void text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold font-mono">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </Link>
          )}
        </div>
      </header>

      {/* Main layout */}
      <main className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] gap-0 min-h-[calc(100vh-65px)]">

        {/* Left: Radar + Hot Topics */}
        <div className="flex flex-col">
          {/* Radar section */}
          <div className="flex flex-col md:flex-row gap-0">
            {/* Radar */}
            <div className="p-6 md:w-[420px] xl:w-[480px] shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-mono text-ink-3 uppercase tracking-widest">信号扫描</span>
                </div>
                <span className="text-xs font-mono text-ink-4">{topics.length} 个信号</span>
              </div>
              <RadarCanvas topics={topics} />
            </div>

            {/* Right of radar: recent alerts preview */}
            <div className="flex-1 p-6 pt-6 md:pt-6 border-l border-elevated hidden md:flex flex-col gap-4">
              <div>
                <h3 className="text-xs font-mono text-ink-3 uppercase tracking-widest mb-3">最新告警</h3>
                {alerts.slice(0, 5).length === 0 ? (
                  <p className="text-ink-4 text-xs font-mono">暂无告警，持续监控中...</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {alerts.slice(0, 5).map((alert) => (
                      <a
                        key={alert.id}
                        href={alert.topic_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => alertsApi.markRead(alert.id)}
                        className={clsx(
                          'p-2.5 rounded-lg border text-xs transition-all hover:border-alert/40',
                          alert.is_read ? 'bg-elevated border-elevated' : 'bg-alert/5 border-alert/25'
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-alert font-mono">🎯</span>
                          <span className="text-alert font-medium">{alert.keyword_text}</span>
                          {!alert.is_read && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-alert shrink-0" />
                          )}
                        </div>
                        <p className="text-ink-2 line-clamp-1 leading-snug">{alert.topic_title}</p>
                        <p className="text-ink-4 mt-0.5 font-mono">
                          {new Date(alert.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {' · '}置信度 {(alert.confidence * 100).toFixed(0)}%
                        </p>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="mt-auto pt-4 border-t border-elevated">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-elevated rounded-lg p-3">
                    <p className="text-2xl font-display font-bold text-primary">{topics.length}</p>
                    <p className="text-ink-4 text-xs mt-0.5">热点信号</p>
                  </div>
                  <div className="bg-elevated rounded-lg p-3">
                    <p className="text-2xl font-display font-bold text-alert">{unreadCount}</p>
                    <p className="text-ink-4 text-xs mt-0.5">未读告警</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="px-6 py-3 border-t border-elevated">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={clsx(
                    'shrink-0 text-xs px-3 py-1.5 rounded-lg border font-mono transition-all',
                    filter === key
                      ? 'bg-primary/10 border-primary/40 text-primary'
                      : 'border-elevated text-ink-3 hover:border-primary/25 hover:text-ink-2'
                  )}
                >
                  {label}
                </button>
              ))}
              <span className="ml-auto text-xs text-ink-4 font-mono shrink-0">
                {filtered.length} 条
              </span>
            </div>
          </div>

          {/* Hot topics grid */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <p className="text-ink-4 text-sm font-mono">暂无热点数据</p>
                <button
                  onClick={handleManualRefresh}
                  className="text-xs text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/10 transition-all"
                >
                  立即扫描
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-3">
                {filtered.map((topic) => (
                  <HotTopicCard key={topic.id} topic={topic} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar: Keywords */}
        <aside className="border-l border-elevated bg-surface/50 p-6">
          <KeywordManager keywords={keywords} onRefresh={loadKeywords} />

          {/* Quick tips */}
          <div className="mt-6 pt-4 border-t border-elevated">
            <h3 className="text-xs font-mono text-ink-4 uppercase tracking-widest mb-3">使用提示</h3>
            <div className="flex flex-col gap-2 text-xs text-ink-4">
              <p>• 添加关键词后，AI 会自动验证内容真实性</p>
              <p>• 置信度 ≥ 65% 才会触发告警</p>
              <p>• 雷达内圈 = 热度更高的内容</p>
              <p>• 橙色信号点 = 已命中监控关键词</p>
            </div>
          </div>
        </aside>
      </main>

      {/* 关键词搜索结果弹窗 */}
      {searchResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-primary/20 rounded-2xl shadow-glow w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-elevated">
              <div>
                <h2 className="font-display text-primary font-bold">关键词搜索结果</h2>
                <p className="text-ink-3 text-xs mt-0.5">
                  共找到 <span className="text-primary font-bold">{searchResults.totalFound}</span> 条相关内容
                </p>
              </div>
              <button
                onClick={() => setSearchResults(null)}
                className="text-ink-3 hover:text-ink-1 text-lg px-2"
              >✕</button>
            </div>
            <div className="overflow-y-auto p-4 flex flex-col gap-4">
              {searchResults.results.map((r) => (
                <div key={r.keyword} className="border border-elevated rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-alert font-mono text-sm font-bold">🔍 "{r.keyword}"</span>
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded font-mono border',
                      r.count > 0 ? 'bg-primary/10 text-primary border-primary/30' : 'bg-elevated text-ink-4 border-elevated'
                    )}>
                      {r.count > 0 ? `${r.count} 条命中` : '暂无相关内容'}
                    </span>
                  </div>
                  {r.items.filter(i => i.matched).length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {r.items.filter(i => i.matched).map((item, idx) => (
                        <a
                          key={idx}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2 p-2.5 bg-elevated rounded-lg hover:border-primary/20 border border-transparent transition-all"
                        >
                          <span className="text-primary mt-0.5 shrink-0">▸</span>
                          <div className="min-w-0">
                            <p className="text-ink-1 text-sm leading-snug line-clamp-2">{item.title}</p>
                            <p className="text-ink-4 text-xs mt-1 font-mono">{item.source} · 置信度 {(item.confidence * 100).toFixed(0)}%</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-ink-4 text-xs">HackerNews 近期未找到高度相关内容</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 搜索中提示 */}
      {searching && !searchResults && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-surface border border-primary/30 rounded-xl px-5 py-3 shadow-glow flex items-center gap-3">
          <RefreshCw size={14} className="text-primary animate-spin" />
          <span className="text-sm text-ink-2">正在搜索关键词相关内容...</span>
        </div>
      )}

      {/* Alert toasts */}
      <AlertBanner alerts={sseAlerts} />
    </div>
  )
}
