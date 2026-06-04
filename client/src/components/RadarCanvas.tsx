import { useEffect, useRef, useState, useCallback } from 'react'
import type { HotTopic } from '@/types'

interface Props { topics: HotTopic[] }
interface Blip { topic: HotTopic; x: number; y: number }

const GOLDEN_ANGLE = 137.508 * (Math.PI / 180)
const SPEED = 0.01

// Morandi matcha palette
const C_BG      = '#f7f6f2'
const C_RING    = 'rgba(122,158,120,0.15)'
const C_RING_EM = 'rgba(122,158,120,0.28)'
const C_SWEEP   = '#7a9e78'
const C_BLIP    = '#7a9e78'
const C_ALERT   = '#c4906a'

function computeBlips(topics: HotTopic[], cx: number, cy: number, maxR: number): Blip[] {
  return topics.map(t => {
    const r = maxR * (0.13 + ((10 - Math.min(10, Math.max(1, t.score))) / 9) * 0.62)
    const a = (t.id * GOLDEN_ANGLE) % (Math.PI * 2)
    return { topic: t, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

function draw(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  angle: number,
  blips: Blip[],
  hovered: number | null
) {
  const cx = W / 2, cy = H / 2, maxR = Math.min(W, H) * 0.44

  // Background
  ctx.fillStyle = C_BG
  ctx.fillRect(0, 0, W, H)

  // Range rings
  for (let i = 1; i <= 4; i++) {
    ctx.strokeStyle = i === 4 ? C_RING_EM : C_RING
    ctx.lineWidth = i === 4 ? 1.2 : 0.8
    ctx.beginPath(); ctx.arc(cx, cy, (maxR / 4) * i, 0, Math.PI * 2); ctx.stroke()
  }

  // Crosshairs
  ctx.save()
  ctx.strokeStyle = 'rgba(122,158,120,0.10)'; ctx.lineWidth = 0.7; ctx.setLineDash([4, 10])
  ctx.beginPath()
  ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy)
  ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR)
  ctx.stroke(); ctx.restore()

  // Sweep trail — soft matcha gradient
  for (let s = 0; s < 18; s++) {
    const frac = s / 18
    ctx.fillStyle = `rgba(122,158,120,${frac * 0.07})`
    ctx.beginPath(); ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, maxR, angle - Math.PI * 0.42 * (1 - frac), angle - Math.PI * 0.42 * (1 - (s + 1) / 18))
    ctx.closePath(); ctx.fill()
  }

  // Sweep line
  ctx.save()
  ctx.strokeStyle = C_SWEEP; ctx.lineWidth = 1.5
  ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(122,158,120,0.5)'
  ctx.beginPath(); ctx.moveTo(cx, cy)
  ctx.lineTo(cx + maxR * Math.cos(angle), cy + maxR * Math.sin(angle))
  ctx.stroke(); ctx.restore()

  // Center dot
  ctx.save()
  ctx.fillStyle = C_SWEEP; ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(122,158,120,0.4)'
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore()

  // Blips
  for (const { topic, x, y } of blips) {
    const bAngle = (topic.id * GOLDEN_ANGLE) % (Math.PI * 2)
    const diff = ((angle - bAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
    const pulse = diff < 0.2
    const isAlert = topic.alert_count > 0
    const isHov = topic.id === hovered
    const color = isAlert ? C_ALERT : C_BLIP
    const r = isHov ? 6 : topic.score >= 8 ? 5 : 3.5
    const opacity = pulse ? 1 : isHov ? 0.9 : 0.55

    // Pulse ring
    if (pulse || isHov) {
      ctx.save()
      ctx.strokeStyle = isAlert ? 'rgba(196,144,106,0.3)' : 'rgba(122,158,120,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()
    }

    ctx.save()
    ctx.fillStyle = isAlert
      ? `rgba(196,144,106,${opacity})`
      : `rgba(122,158,120,${opacity})`
    ctx.shadowBlur = pulse ? 14 : isHov ? 10 : 5
    ctx.shadowColor = color
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  // Compass labels
  for (const [label, a] of [['N', -Math.PI/2], ['E', 0], ['S', Math.PI/2], ['W', Math.PI]] as [string, number][]) {
    ctx.save()
    ctx.font = '600 9px "Space Grotesk", sans-serif'
    ctx.fillStyle = 'rgba(154,171,144,0.6)'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(label, cx + (maxR + 14) * Math.cos(a), cy + (maxR + 14) * Math.sin(a))
    ctx.restore()
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
    const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1
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
      <canvas
        ref={canvasRef}
        className="cursor-crosshair rounded-xl"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setTooltip(null); setHoveredId(null) }}
        onClick={() => tooltip?.topic.url && window.open(tooltip.topic.url, '_blank')}
      />
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none max-w-[200px]"
          style={{ left: Math.min(tooltip.sx + 12, window.innerWidth - 210), top: Math.min(tooltip.sy - 8, window.innerHeight - 90) }}
        >
          <div className="card rounded-lg p-2.5 text-xs">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-mono font-bold text-matcha">{tooltip.topic.score}/10</span>
              <span className="text-matcha-600 truncate">{tooltip.topic.source}</span>
            </div>
            <p className="text-matcha-900 font-medium leading-snug line-clamp-2">{tooltip.topic.title}</p>
          </div>
        </div>
      )}
    </div>
  )
}
