import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Eye, EyeOff, Loader2, CheckCircle2, Settings as SettingsIcon } from 'lucide-react'
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
      <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          type={showToggle ? (show ? 'text' : 'password') : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-slate-900 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors pr-10 font-mono"
        />
        {showToggle && (
          <button type="button" onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-slate-600">{hint}</p>}
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-xl p-5 border-white/[0.06]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-4">
        <span>{icon}</span>{title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
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
    <div className="h-screen bg-[#030712] flex items-center justify-center">
      <Loader2 size={20} className="text-indigo-400 animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#030712] font-body text-slate-100 relative">
      <BackgroundGrid />
      <div className="relative z-10 max-w-xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="p-2 text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] rounded-lg transition-all">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2.5">
            <SettingsIcon size={16} className="text-indigo-400" />
            <h1 className="font-display font-bold text-base text-slate-100">系统配置</h1>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Section title="AI 服务 · OpenRouter" icon="🤖">
            <Field label="API Key" value={settings.openrouter_api_key || ''} onChange={set('openrouter_api_key')}
              placeholder="sk-or-v1-..." showToggle hint="从 openrouter.ai 获取" />
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">使用模型</label>
              <select value={settings.openrouter_model || 'deepseek/deepseek-chat'} onChange={e => set('openrouter_model')(e.target.value)}
                className="bg-slate-900 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono">
                {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </Section>

          <Section title="抓取间隔" icon="⏱">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">每隔几分钟自动抓取</label>
              <select value={settings.check_interval || '30'} onChange={e => set('check_interval')(e.target.value)}
                className="bg-slate-900 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono">
                <option value="15">15 分钟</option>
                <option value="30">30 分钟（推荐）</option>
                <option value="60">60 分钟</option>
              </select>
              <p className="text-[11px] text-slate-600">修改后需重启后端服务生效</p>
            </div>
          </Section>

          <Section title="邮件通知 · SMTP" icon="📧">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">启用邮件通知</span>
              <button type="button"
                onClick={() => set('email_enabled')(settings.email_enabled === 'true' ? 'false' : 'true')}
                className={cn('relative w-10 h-5.5 rounded-full border-2 transition-all',
                  settings.email_enabled === 'true' ? 'bg-indigo-500/20 border-indigo-500/60' : 'bg-slate-800 border-slate-700')}>
                <div className={cn('absolute top-0.5 w-4 h-4 rounded-full transition-all',
                  settings.email_enabled === 'true' ? 'left-[18px] bg-indigo-400' : 'left-0.5 bg-slate-500')} />
              </button>
            </div>
            {settings.email_enabled === 'true' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="SMTP 服务器" value={settings.email_smtp_host || ''} onChange={set('email_smtp_host')} placeholder="smtp.gmail.com" />
                  <Field label="端口" value={settings.email_smtp_port || '587'} onChange={set('email_smtp_port')} placeholder="587" />
                </div>
                <Field label="邮件账号" value={settings.email_smtp_user || ''} onChange={set('email_smtp_user')} placeholder="your@gmail.com" />
                <Field label="密码 / 应用专用密码" value={settings.email_smtp_pass || ''} onChange={set('email_smtp_pass')} showToggle hint="Gmail 请使用应用专用密码" />
                <Field label="收件人" value={settings.email_to || ''} onChange={set('email_to')} placeholder="notify@example.com" />
              </>
            )}
          </Section>

          <button type="submit" disabled={saving}
            className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all text-sm">
            {saving ? <><Loader2 size={15} className="animate-spin" /> 保存中...</>
             : saved ? <><CheckCircle2 size={15} /> 已保存</>
             : <><Save size={15} /> 保存配置</>}
          </button>
        </form>
      </div>
    </div>
  )
}
