import React, { useRef } from 'react'
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useTransform,
} from 'motion/react'
import { cn } from '@/lib/utils'

export function MovingBorderButton({
  borderRadius = '0.5rem',
  children,
  as: Component = 'button',
  containerClassName,
  borderClassName,
  duration = 3000,
  className,
  ...otherProps
}: {
  borderRadius?: string
  children: React.ReactNode
  as?: React.ElementType
  containerClassName?: string
  borderClassName?: string
  duration?: number
  className?: string
  [key: string]: unknown
}) {
  return (
    <Component
      className={cn('relative overflow-hidden bg-transparent p-[1.5px]', containerClassName)}
      style={{ borderRadius }}
      {...otherProps}
    >
      <div className="absolute inset-0" style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}>
        <MovingBorder duration={duration} rx="30%" ry="30%">
          <div
            className={cn(
              'h-14 w-14 bg-[radial-gradient(#7a9e78_40%,transparent_65%)] opacity-80',
              borderClassName
            )}
          />
        </MovingBorder>
      </div>
      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center border border-matcha-200 bg-white/90 antialiased backdrop-blur-sm',
          className
        )}
        style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}
      >
        {children}
      </div>
    </Component>
  )
}

export function MovingBorder({
  children,
  duration = 3000,
  rx,
  ry,
  ...otherProps
}: {
  children: React.ReactNode
  duration?: number
  rx?: string
  ry?: string
  [key: string]: unknown
}) {
  const pathRef = useRef<SVGRectElement>(null)
  const progress = useMotionValue<number>(0)

  useAnimationFrame((time) => {
    const length = pathRef.current?.getTotalLength()
    if (length) {
      progress.set((time * (length / duration)) % length)
    }
  })

  const x = useTransform(progress, (val) => pathRef.current?.getPointAtLength(val).x ?? 0)
  const y = useTransform(progress, (val) => pathRef.current?.getPointAtLength(val).y ?? 0)
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`

  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="absolute h-full w-full"
        width="100%"
        height="100%"
        {...otherProps}
      >
        <rect fill="none" width="100%" height="100%" rx={rx} ry={ry} ref={pathRef} />
      </svg>
      <motion.div style={{ position: 'absolute', top: 0, left: 0, display: 'inline-block', transform }}>
        {children}
      </motion.div>
    </>
  )
}
