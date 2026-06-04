import { useEffect, useRef, useState, useCallback } from 'react'
import type { HotTopic } from '@/types'

interface Props { topics: HotTopic[] }

interface Blip { topic: HotTopic; x: number; y: number }

const GOLDEN_ANGLE = 137.508 * (Math.PI / 180)
const SPEED = 0.011

// indigo palette
const C_PRIMARY = '#6366f1'
const C_ALERT   = '#f59e0b'

function computeBlips(topics: HotTopic[], cx: number, cy: number, maxR: number): Blip[] {
  return topics.map(t => {
    const r = maxR * (0.14 + ((10 - Math.min(10, Math.max(1, t.score))) / 9) * 0.62)
    const a = (t.id * GOLDEN_ANGLE) % (Math.PI * 2)
    return { topic: t, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

function draw(ctx: CanvasRenderingContext2D, W: number, H: number, angle: number, blips: Blip[], hovered: number | null) {
  const cx = W / 2, cy = H / 2, maxR = Math.min(W, H) * 0.44

  ctx.fillStyle = '#030712'
  ctx.fillRect(0, 0, W, H)

  // range rings
  for (let i = 1; i <= 4; i++) {
    ctx.strokeStyle = i === 4 ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.07)'
    ctx.lineWidth = i === 4 ? 1.2 : 0.8
    ctx.beginPath(); ctx.arc(cx, cy, (maxR / 4) * i, 0, Math.PI * 2); ctx.stroke()
  }

  // crosshairs
  ctx.save(); ctx.strokeStyle = 'rgba(99,102,241,0.07)'; ctx.lineWidth = 0.7
  ctx.setLineDash([3, 9])
  ctx.beginPath(); ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy)
  ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR); ctx.stroke(); ctx.restore()

  // sweep trail
  for (let s = 0; s < 20; s++) {
    const frac = s / 20
    ctx.fillStyle = `rgba(99,102,241,${frac * 0.1})`
    ctx.beginPath(); ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, maxR, angle - Math.PI * 0.45 * (1 - frac), angle - Math.PI * 0.45 * (1 - (s + 1) / 20))
    ctx.closePath(); ctx.fill()
  }

  // sweep line
  ctx.save(); ctx.strokeStyle = C_PRIMARY; ctx.lineWidth = 1.5
  ctx.shadowBlur = 14; ctx.shadowColor = C_PRIMARY
  ctx.beginPath(); ctx.moveTo(cx, cy)
  ctx.lineTo(cx + maxR * Math.cos(angle), cy + maxR * Math.sin(angle)); ctx.stroke(); ctx.restore()

  // center
  ctx.save(); ctx.fillStyle = C_PRIMARY; ctx.shadowBlur = 10; ctx.shadowColor = C_PRIMARY
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore()

  // blips
  for (const { topic, x, y } of blips) {
    const bAngle = (topic.id * GOLDEN_ANGLE) % (Math.PI * 2)
    const diff = ((angle - bAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
    const pulse = diff < 0.22
    const isAlert = topic.alert_count > 0
    const isHovered = topic.id === hovered
    const color = isAlert ? C_ALERT : C_PRIMARY
    const r = isHovered ? 6 : topic.score >= 8 ? 5 : 3.5
    const opacity = pulse ? 1 : isHovered ? 0.95 : 0.65

    if (pulse || isHovered) {
      ctx.save(); ctx.strokeStyle = isAlert ? 'rgba(245,158,11,0.35)' : 'rgba(99,102,241,0.3)'
      ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
    }

    ctx.save()
    ctx.fillStyle = isAlert ? `rgba(245,158,11,${opacity})` : `rgba(99,102,241,${opacity})`
    ctx.shadowBlur = pulse ? 20 : isHovered ? 14 : 7; ctx.shadowColor = color
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  }
}

export default function RadarCanvas({ topics }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const angleRef = useRef(0)
  const rafRef = useRef<number>()
  const blipsRef = useRef<Blip[]>([])
  const sizeRef = useRef({ W: 300, H: 300 })
  const [tooltip, setTooltip] = useState<{ topic: HotTopic; sx: number; sy: number } | null>(null)
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current
    if (!canvas || !container) return
    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      const rect = container.getBoundingClientRect()
      const s = Math.min(rect.width, rect.height)
      canvas.width = s * dpr; canvas.height = s * dpr
      canvas.style.width = `${s}px`; canvas.style.height = `${s}px`
      const ctx = canvas.getContext('2d')!; ctx.scale(dpr, dpr)
      sizeRef.current = { W: s, H: s }
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(container)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const animate = () => {
      angleRef.current = (angleRef.current + SPEED) % (Math.PI * 2)
      const { W, H } = sizeRef.current; const maxR = Math.min(W, H) * 0.44
      blipsRef.current = computeBlips(topics, W / 2, H / 2, maxR)
      draw(ctx, W, H, angleRef.current, blipsRef.current, hoveredId)
      rafRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [topics, hoveredId])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const mx = (e.clientX - rect.left) * dpr, my = (e.clientY - rect.top) * dpr
    let found: Blip | null = null, minD = 16 * dpr
    for (const b of blipsRef.current) {
      const d = Math.hypot(b.x - mx, b.y - my)
      if (d < minD) { minD = d; found = b }
    }
    if (found) { setTooltip({ topic: found.topic, sx: e.clientX, sy: e.clientY }); setHoveredId(found.topic.id) }
    else { setTooltip(null); setHoveredId(null) }
  }, [])

  return (
    <div ref={containerRef} className="relative w-full aspect-square">
      <canvas ref={canvasRef} className="cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setTooltip(null); setHoveredId(null) }}
        onClick={() => tooltip?.topic.url && window.open(tooltip.topic.url, '_blank')}
      />
      {tooltip && (
        <div className="fixed z-50 pointer-events-none max-w-[220px]"
          style={{ left: Math.min(tooltip.sx + 12, window.innerWidth - 230), top: Math.min(tooltip.sy - 8, window.innerHeight - 100) }}>
          <div className="glass-card rounded-lg p-2.5 text-xs shadow-glow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-mono font-bold" style={{ color: tooltip.topic.alert_count > 0 ? C_ALERT : C_PRIMARY }}>
                {tooltip.topic.score}/10
              </span>
              <span className="text-slate-400 truncate">{tooltip.topic.source}</span>
            </div>
            <p className="text-slate-200 font-medium leading-snug line-clamp-2">{tooltip.topic.title}</p>
            {tooltip.topic.summary && <p className="text-slate-400 mt-1 line-clamp-1">{tooltip.topic.summary}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
