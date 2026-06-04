import { useEffect, useRef, useState, useCallback } from 'react'
import type { HotTopic } from '../types'

interface Props {
  topics: HotTopic[]
}

interface Blip {
  topic: HotTopic
  x: number
  y: number
  logicalX: number
  logicalY: number
}

interface Tooltip {
  topic: HotTopic
  screenX: number
  screenY: number
}

const GOLDEN_ANGLE = 137.508 * (Math.PI / 180)
const ROTATION_SPEED = 0.012 // radians per frame

function computeBlips(topics: HotTopic[], cx: number, cy: number, maxR: number): Blip[] {
  return topics.map((topic) => {
    const r = maxR * (0.14 + ((10 - Math.min(10, Math.max(1, topic.score))) / 9) * 0.62)
    const angle = (topic.id * GOLDEN_ANGLE) % (Math.PI * 2)
    const lx = cx + r * Math.cos(angle)
    const ly = cy + r * Math.sin(angle)
    return { topic, x: lx, y: ly, logicalX: lx, logicalY: ly }
  })
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  angle: number,
  blips: Blip[],
  hoveredId: number | null
) {
  const cx = W / 2
  const cy = H / 2
  const maxR = Math.min(W, H) * 0.44

  // Background
  ctx.fillStyle = '#050810'
  ctx.fillRect(0, 0, W, H)

  // Outer faint glow
  const outerGlow = ctx.createRadialGradient(cx, cy, maxR * 0.85, cx, cy, maxR * 1.15)
  outerGlow.addColorStop(0, 'rgba(0,245,212,0.06)')
  outerGlow.addColorStop(1, 'rgba(0,245,212,0)')
  ctx.fillStyle = outerGlow
  ctx.beginPath()
  ctx.arc(cx, cy, maxR * 1.15, 0, Math.PI * 2)
  ctx.fill()

  // Range rings
  for (let i = 1; i <= 4; i++) {
    const opacity = i === 4 ? 0.18 : 0.08
    ctx.strokeStyle = `rgba(0,245,212,${opacity})`
    ctx.lineWidth = i === 4 ? 1.5 : 0.8
    ctx.beginPath()
    ctx.arc(cx, cy, (maxR / 4) * i, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Cross-hairs
  ctx.save()
  ctx.strokeStyle = 'rgba(0,245,212,0.08)'
  ctx.lineWidth = 0.8
  ctx.setLineDash([3, 9])
  ctx.beginPath()
  ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy)
  ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR)
  ctx.stroke()
  ctx.restore()

  // Tick marks on outer ring
  for (let i = 0; i < 36; i++) {
    const a = (i * Math.PI * 2) / 36
    const r0 = maxR * (i % 3 === 0 ? 0.93 : 0.96)
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(0,245,212,0.25)' : 'rgba(0,245,212,0.1)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a))
    ctx.lineTo(cx + maxR * Math.cos(a), cy + maxR * Math.sin(a))
    ctx.stroke()
  }

  // Sweep trail (arc sector fill with gradient opacity)
  const trailSpan = Math.PI * 0.5 // 90° trail
  const steps = 24
  for (let s = 0; s < steps; s++) {
    const frac = s / steps
    const a0 = angle - trailSpan * (1 - frac)
    const a1 = angle - trailSpan * (1 - (s + 1) / steps)
    const opacity = frac * 0.14
    ctx.fillStyle = `rgba(0,245,212,${opacity})`
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, maxR, a0, a1)
    ctx.closePath()
    ctx.fill()
  }

  // Sweep line
  ctx.save()
  ctx.strokeStyle = '#00f5d4'
  ctx.lineWidth = 1.8
  ctx.shadowBlur = 18
  ctx.shadowColor = '#00f5d4'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + maxR * Math.cos(angle), cy + maxR * Math.sin(angle))
  ctx.stroke()
  ctx.restore()

  // Center dot
  ctx.save()
  ctx.fillStyle = '#00f5d4'
  ctx.shadowBlur = 12
  ctx.shadowColor = '#00f5d4'
  ctx.beginPath()
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Blips
  for (const blip of blips) {
    const { topic, logicalX: bx, logicalY: by } = blip
    const blipAngle = (topic.id * GOLDEN_ANGLE) % (Math.PI * 2)

    const diff = ((angle - blipAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
    const isPulsing = diff < 0.25 && diff >= 0
    const isAlert = topic.alert_count > 0
    const isHovered = topic.id === hoveredId

    const color = isAlert ? '#f5a623' : '#00f5d4'
    const baseOpacity = 0.7
    const opacity = isPulsing ? 1 : isHovered ? 0.95 : baseOpacity
    const blipRadius = isHovered ? 7 : topic.score >= 8 ? 5.5 : topic.score >= 5 ? 4 : 3

    // Pulse ring for hot topics
    if (isPulsing || isHovered) {
      ctx.save()
      ctx.strokeStyle = isAlert ? 'rgba(245,166,35,0.4)' : 'rgba(0,245,212,0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(bx, by, blipRadius + 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Core blip dot
    ctx.save()
    ctx.fillStyle = isPulsing ? color : isAlert ? `rgba(245,166,35,${opacity})` : `rgba(0,245,212,${opacity})`
    ctx.shadowBlur = isPulsing ? 24 : isHovered ? 18 : isAlert ? 12 : 8
    ctx.shadowColor = isAlert ? '#f5a623' : '#00f5d4'
    ctx.beginPath()
    ctx.arc(bx, by, blipRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Score label on hover
    if (isHovered) {
      ctx.save()
      ctx.font = '500 11px Inter, sans-serif'
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.fillText(`${topic.score}`, bx, by - blipRadius - 5)
      ctx.restore()
    }
  }

  // Compass labels
  const labels = [
    { label: 'N', a: -Math.PI / 2 },
    { label: 'E', a: 0 },
    { label: 'S', a: Math.PI / 2 },
    { label: 'W', a: Math.PI },
  ]
  ctx.save()
  ctx.font = '600 10px Orbitron, sans-serif'
  ctx.fillStyle = 'rgba(0,245,212,0.35)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const { label, a } of labels) {
    const lx = cx + (maxR + 16) * Math.cos(a)
    const ly = cy + (maxR + 16) * Math.sin(a)
    ctx.fillText(label, lx, ly)
  }
  ctx.restore()
}

export default function RadarCanvas({ topics }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const angleRef = useRef(0)
  const rafRef = useRef<number>()
  const blipsRef = useRef<Blip[]>([])
  const sizeRef = useRef({ W: 500, H: 500 })
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      const rect = container.getBoundingClientRect()
      const size = Math.min(rect.width, rect.height)
      canvas.width = size * dpr
      canvas.height = size * dpr
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`
      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      sizeRef.current = { W: size, H: size }
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const animate = () => {
      angleRef.current = (angleRef.current + ROTATION_SPEED) % (Math.PI * 2)
      const { W, H } = sizeRef.current
      const maxR = Math.min(W, H) * 0.44
      blipsRef.current = computeBlips(topics, W / 2, H / 2, maxR)
      drawFrame(ctx, W, H, angleRef.current, blipsRef.current, hoveredId)
      rafRef.current = requestAnimationFrame(animate)
    }

    animate()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [topics, hoveredId])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const mx = (e.clientX - rect.left) * dpr
    const my = (e.clientY - rect.top) * dpr

    let found: Blip | null = null
    let minDist = 18 * dpr

    for (const blip of blipsRef.current) {
      const d = Math.hypot(blip.x - mx, blip.y - my)
      if (d < minDist) {
        minDist = d
        found = blip
      }
    }

    if (found) {
      setTooltip({ topic: found.topic, screenX: e.clientX, screenY: e.clientY })
      setHoveredId(found.topic.id)
    } else {
      setTooltip(null)
      setHoveredId(null)
    }
  }, [])

  const CATEGORY_ICONS: Record<string, string> = {
    'model-release': '🤖',
    'tool-update': '🔧',
    research: '📄',
    funding: '💰',
    discussion: '💬',
    other: '📡',
  }

  return (
    <div ref={containerRef} className="relative w-full aspect-square">
      <canvas
        ref={canvasRef}
        className="cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setTooltip(null); setHoveredId(null) }}
        onClick={() => tooltip?.topic.url && window.open(tooltip.topic.url, '_blank')}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none max-w-xs"
          style={{
            left: Math.min(tooltip.screenX + 14, window.innerWidth - 280),
            top: Math.min(tooltip.screenY - 10, window.innerHeight - 120),
          }}
        >
          <div className="bg-elevated border border-primary/20 rounded-lg p-3 shadow-glow text-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-base">{CATEGORY_ICONS[tooltip.topic.category]}</span>
              <span className="text-ink-3 text-xs font-mono">{tooltip.topic.source}</span>
              <span
                className="ml-auto text-xs font-mono font-bold"
                style={{ color: tooltip.topic.alert_count > 0 ? '#f5a623' : '#00f5d4' }}
              >
                {tooltip.topic.score}/10
              </span>
            </div>
            <p className="text-ink-1 font-medium leading-snug line-clamp-2 mb-1">
              {tooltip.topic.title}
            </p>
            {tooltip.topic.summary && (
              <p className="text-ink-3 text-xs leading-relaxed">{tooltip.topic.summary}</p>
            )}
            <p className="text-ink-4 text-xs mt-1.5">点击打开原文 →</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {topics.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-ink-4 text-sm font-mono animate-pulse">扫描中，等待信号...</p>
        </div>
      )}
    </div>
  )
}
