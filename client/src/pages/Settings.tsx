import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { settingsApi } from '../api'
import type { Settings } from '../types'
import clsx from 'clsx'

const MODELS = [
  { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat (推荐，性价比最高)' },
  { value: 'google/gemini-flash-2.0', label: 'Gemini Flash 2.0 (速度快)' },
  { value: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5 (准确度高)' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
]

function Field({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  hint,
  showToggle,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  showToggle?: boolean
}) {
  const [show, setShow] = useState(false)
  const inputType = showToggle ? (show ? 'text' : 'password') : type

  return (
    <div>
      <label className="block text-xs font-mono text-ink-3 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-elevated border border-ink-4/30 rounded-lg px-3 py-2.5 text-sm text-ink-1 placeholder-ink-4 focus:outline-none focus:border-primary/50 transition-colors pr-10"
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-ink-4 mt-1">{hint}</p>}
    </div>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<Settings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    settingsApi.get().then((res) => {
      setSettings(res.data)
      setLoading(false)
    })
  }, [])

  const set = (key: keyof Settings) => (value: string) =>
    setSettings((prev) => ({ ...prev, [key]: value }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await settingsApi.save(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <Loader2 size={24} className="text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-void font-body text-ink-1">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-80 h-80 rounded-full bg-accent/4 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-8">
        {/* Back */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-ink-3 hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          返回雷达
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="text-xl">⚙️</span>
          </div>
          <div>
            <h1 className="font-display text-lg text-primary font-bold">系统配置</h1>
            <p className="text-ink-4 text-xs font-mono">配置 AI 服务 和 通知渠道</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-6">

          {/* AI 配置 */}
          <section className="bg-surface border border-elevated rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-ink-1 mb-4 flex items-center gap-2">
              <span>🤖</span> AI 服务（OpenRouter）
            </h2>
            <div className="flex flex-col gap-4">
              <Field
                label="OpenRouter API Key"
                value={settings.openrouter_api_key || ''}
                onChange={set('openrouter_api_key')}
                placeholder="sk-or-v1-..."
                showToggle
                hint="在 openrouter.ai 注册后获取 API Key"
              />
              <div>
                <label className="block text-xs font-mono text-ink-3 mb-1.5">使用模型</label>
                <select
                  value={settings.openrouter_model || 'deepseek/deepseek-chat'}
                  onChange={(e) => set('openrouter_model')(e.target.value)}
                  className="w-full bg-elevated border border-ink-4/30 rounded-lg px-3 py-2.5 text-sm text-ink-1 focus:outline-none focus:border-primary/50 transition-colors"
                >
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* 抓取间隔 */}
          <section className="bg-surface border border-elevated rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-ink-1 mb-4 flex items-center gap-2">
              <span>⏱️</span> 抓取间隔
            </h2>
            <div>
              <label className="block text-xs font-mono text-ink-3 mb-1.5">每隔几分钟抓取一次</label>
              <select
                value={settings.check_interval || '30'}
                onChange={(e) => set('check_interval')(e.target.value)}
                className="w-full bg-elevated border border-ink-4/30 rounded-lg px-3 py-2.5 text-sm text-ink-1 focus:outline-none focus:border-primary/50"
              >
                <option value="15">15 分钟</option>
                <option value="30">30 分钟（推荐）</option>
                <option value="60">60 分钟</option>
                <option value="120">120 分钟</option>
              </select>
              <p className="text-xs text-ink-4 mt-1">注意：修改后需要重启服务才能生效</p>
            </div>
          </section>

          {/* Twitter/X 监控 */}
          <section className="bg-surface border border-elevated rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-ink-1 flex items-center gap-2">
                <span>🐦</span> Twitter/X 监控
                <span className="text-xs bg-accent/15 text-accent px-2 py-0.5 rounded font-mono border border-accent/20">
                  需 Basic 付费版
                </span>
              </h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-ink-3 font-mono">
                  {settings.twitter_enabled === 'true' ? '已启用' : '已禁用'}
                </span>
                <div
                  onClick={() => set('twitter_enabled')(settings.twitter_enabled === 'true' ? 'false' : 'true')}
                  className={clsx(
                    'w-10 h-6 rounded-full border-2 transition-all cursor-pointer relative',
                    settings.twitter_enabled === 'true'
                      ? 'bg-accent/20 border-accent/60'
                      : 'bg-elevated border-ink-4/30'
                  )}
                >
                  <div
                    className={clsx(
                      'absolute top-0.5 w-4 h-4 rounded-full transition-all',
                      settings.twitter_enabled === 'true' ? 'left-[18px] bg-accent' : 'left-0.5 bg-ink-4'
                    )}
                  />
                </div>
              </label>
            </div>
            <div className="flex flex-col gap-3">
              <Field
                label="Bearer Token"
                value={settings.twitter_bearer_token || ''}
                onChange={set('twitter_bearer_token')}
                placeholder="AAAA..."
                showToggle
                hint="在 developer.x.com 项目设置中获取 Bearer Token（需要 Basic 及以上访问级别）"
              />
              {settings.twitter_enabled === 'true' && !settings.twitter_bearer_token && (
                <p className="text-xs text-alert bg-alert/10 border border-alert/20 rounded-lg px-3 py-2">
                  ⚠️ 请先填入 Bearer Token 再启用 Twitter 监控
                </p>
              )}
              <p className="text-xs text-ink-4">
                启用后，将搜索你配置的关键词相关推文，每次抓取最多 20 条。
              </p>
            </div>
          </section>

          {/* 邮件通知 */}
          <section className="bg-surface border border-elevated rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-ink-1 flex items-center gap-2">
                <span>📧</span> 邮件通知
              </h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-ink-3 font-mono">
                  {settings.email_enabled === 'true' ? '已启用' : '已禁用'}
                </span>
                <div
                  onClick={() => set('email_enabled')(settings.email_enabled === 'true' ? 'false' : 'true')}
                  className={clsx(
                    'w-10 h-6 rounded-full border-2 transition-all cursor-pointer relative',
                    settings.email_enabled === 'true'
                      ? 'bg-primary/20 border-primary/60'
                      : 'bg-elevated border-ink-4/30'
                  )}
                >
                  <div
                    className={clsx(
                      'absolute top-0.5 w-4 h-4 rounded-full transition-all',
                      settings.email_enabled === 'true' ? 'left-[18px] bg-primary' : 'left-0.5 bg-ink-4'
                    )}
                  />
                </div>
              </label>
            </div>

            {settings.email_enabled === 'true' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="SMTP 服务器" value={settings.email_smtp_host || ''} onChange={set('email_smtp_host')} placeholder="smtp.gmail.com" />
                  <Field label="端口" value={settings.email_smtp_port || '587'} onChange={set('email_smtp_port')} placeholder="587" />
                </div>
                <Field label="邮件账号" value={settings.email_smtp_user || ''} onChange={set('email_smtp_user')} placeholder="your@gmail.com" />
                <Field label="邮件密码 / 应用专用密码" value={settings.email_smtp_pass || ''} onChange={set('email_smtp_pass')} showToggle hint="Gmail 用户请使用应用专用密码（非账号密码）" />
                <Field label="收件人邮箱" value={settings.email_to || ''} onChange={set('email_to')} placeholder="notify@example.com" />
              </div>
            )}
          </section>

          {/* Save */}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 w-full bg-primary/10 hover:bg-primary/20 border border-primary/40 text-primary font-medium py-3 rounded-xl transition-all disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 size={16} className="animate-spin" /> 保存中...</>
            ) : saved ? (
              <><CheckCircle2 size={16} /> 已保存</>
            ) : (
              <><Save size={16} /> 保存配置</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
