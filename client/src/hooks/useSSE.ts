import { useEffect, useRef } from 'react'

type SSEHandlers = Record<string, (data: unknown) => void>

export function useSSE(handlers: SSEHandlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    let es: EventSource
    let retryTimer: ReturnType<typeof setTimeout>

    const connect = () => {
      es = new EventSource('/events')

      es.addEventListener('open', () => {
        console.log('[SSE] Connected')
      })

      // Attach all event listeners dynamically
      const eventNames = Object.keys(handlersRef.current)
      eventNames.forEach((event) => {
        es.addEventListener(event, (e: Event) => {
          try {
            const data = JSON.parse((e as MessageEvent).data)
            handlersRef.current[event]?.(data)
          } catch {
            // ignore parse errors
          }
        })
      })

      es.onerror = () => {
        es.close()
        retryTimer = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      es?.close()
      clearTimeout(retryTimer)
    }
  }, []) // intentionally empty – handlers updated via ref
}
