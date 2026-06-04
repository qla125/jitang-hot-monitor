import { cn } from '@/lib/utils'

export function BackgroundGrid({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {/* Subtle dot pattern */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(122,158,120,0.25) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* Warm radial glow top-right */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_80%_0%,rgba(240,244,236,0.8),transparent)]" />
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-cream-100 to-transparent" />
    </div>
  )
}
