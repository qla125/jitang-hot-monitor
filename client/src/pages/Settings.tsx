import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { settingsApi } from '@/api'
import type { Settings } from '@/types'
import { cn } from '@/lib/utils'
import { BackgroundGrid } from '@/components/aceternity/background-grid'

const MODELS = [
  { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat（推荐）' },
  { value: 'google/gemini-flash-2.0', label: 'Gemini Flash 2.0' },
  { value: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
]

function Field({ label, value, onChange, placeholder, hint, showToggle, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; hint?: string; showToggle?: boolean; type?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-mono text-matcha-400 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          type={showToggle ? (show ? 'text' : 'password') : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-cream-100 border border-matcha-100 rounded-lg px-3 py-2.5 text-sm text-matcha-900 placeholder-matcha-300 focus:outline-none focus:border-matcha-400 transition-colors font-mono"
        />
        {showToggle && (
          <button type="button" onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-matcha-300 hover:text-matcha-600 transition-colors">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-matcha-300">{hint}</p>}
    </div>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<Settings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { settingsApi.get().then(r => { setSettings(r.data); setLoading(false) }) }, [])

  const set = (key: keyof Settings) => (value: string) => setSettings(p => ({ ...p, [key]: value }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try { await settingsApi.save(settings); setSaved(true); setTimeout(() => setSaved(false), 2500) }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="h-screen bg-cream-100 flex items-center justify-center">
      <Loader2 size={20} className="text-matcha-400 animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-cream-100 font-body text-matcha-900 relative">
      <BackgroundGrid />
      <div className="relative z-10 max-w-xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/"
            className="p-2 text-matcha-400 hover:text-matcha-700 hover:bg-white rounded-lg transition-all border border-transparent hover:border-matcha-100 hover:shadow-card">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-display font-bold text-base text-matcha-900">系统配置</h1>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* AI */}
          <div className="bg-white rounded-2xl shadow-card p-5">
            <h2 className="text-sm font-semibold text-matcha-800 mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-matcha-50 border border-matcha-200 flex items-center justify-center text-xs">🤖</span>
              AI 服务 · OpenRouter
            </h2>
            <div className="flex flex-col gap-4">
              <Field label="API Key" value={settings.openrouter_api_key || ''} onChange={set('openrouter_api_key')}
                placeholder="sk-or-v1-..." showToggle hint="从 openrouter.ai 获取" />
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono text-matcha-400 uppercase tracking-wider">使用模型</label>
                <select value={settings.openrouter_model || 'deepseek/deepseek-chat'} onChange={e => set('openrouter_model')(e.target.value)}
                  className="bg-cream-100 border border-matcha-100 rounded-lg px-3 py-2.5 text-sm text-matcha-900 focus:outline-none focus:border-matcha-400 transition-colors font-mono">
                  {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Interval */}
          <div className="bg-white rounded-2xl shadow-card p-5">
            <h2 className="text-sm font-semibold text-matcha-800 mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-matcha-50 border border-matcha-200 flex items-center justify-center text-xs">⏱</span>
              抓取间隔
            </h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-matcha-400 uppercase tracking-wider">每隔几分钟自动抓取</label>
              <select value={settings.check_interval || '30'} onChange={e => set('check_interval')(e.target.value)}
                className="bg-cream-100 border border-matcha-100 rounded-lg px-3 py-2.5 text-sm text-matcha-900 focus:outline-none focus:border-matcha-400 transition-colors font-mono">
                <option value="15">15 分钟</option>
                <option value="30">30 分钟（推荐）</option>
                <option value="60">60 分钟</option>
              </select>
              <p className="text-[11px] text-matcha-300">修改后需重启后端服务生效</p>
            </div>
          </div>

          {/* Email */}
          <div className="bg-white rounded-2xl shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-matcha-800 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-matcha-50 border border-matcha-200 flex items-center justify-center text-xs">📧</span>
                邮件通知
              </h2>
              <button type="button"
                onClick={() => set('email_enabled')(settings.email_enabled === 'true' ? 'false' : 'true')}
                className={cn('relative w-10 h-5 rounded-full border-2 transition-all',
                  settings.email_enabled === 'true' ? 'bg-matcha-50 border-matcha-400' : 'bg-cream-200 border-cream-300')}>
                <div className={cn('absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all',
                  settings.email_enabled === 'true' ? 'left-[18px] bg-matcha-500' : 'left-0.5 bg-cream-300')} />
              </button>
            </div>
            {settings.email_enabled === 'true' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="SMTP 服务器" value={settings.email_smtp_host || ''} onChange={set('email_smtp_host')} placeholder="smtp.gmail.com" />
                  <Field label="端口" value={settings.email_smtp_port || '587'} onChange={set('email_smtp_port')} placeholder="587" />
                </div>
                <Field label="邮件账号" value={settings.email_smtp_user || ''} onChange={set('email_smtp_user')} placeholder="your@gmail.com" />
                <Field label="密码 / 应用专用密码" value={settings.email_smtp_pass || ''} onChange={set('email_smtp_pass')} showToggle hint="Gmail 请使用应用专用密码" />
                <Field label="收件人" value={settings.email_to || ''} onChange={set('email_to')} placeholder="notify@example.com" />
              </div>
            )}
          </div>

          <button type="submit" disabled={saving}
            className="flex items-center justify-center gap-2 w-full bg-matcha-500 hover:bg-matcha-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all text-sm shadow-glow">
            {saving ? <><Loader2 size={15} className="animate-spin" />保存中...</>
             : saved ? <><CheckCircle2 size={15} />已保存</>
             : <><Save size={15} />保存配置</>}
          </button>
        </form>
      </div>
    </div>
  )
}
