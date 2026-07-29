// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic function constraint, matches TS's own Function typing
type Throttled<T extends (...args: any[]) => void> = T & { cancel: () => void }

/**
 * Leading + trailing throttle: runs immediately on the first call, then at most
 * once every `waitMs` after that, always firing a final trailing call so the
 * last-known state is never dropped.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic function constraint, matches TS's own Function typing
export function throttle<T extends (...args: any[]) => void>(fn: T, waitMs: number): Throttled<T> {
  let timeout: NodeJS.Timeout | null = null
  let pendingArgs: Parameters<T> | null = null
  let lastRanAt = 0

  const run = (args: Parameters<T>) => {
    lastRanAt = Date.now()
    fn(...args)
  }

  const throttled = ((...args: Parameters<T>) => {
    const remaining = waitMs - (Date.now() - lastRanAt)

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      run(args)
      return
    }

    pendingArgs = args
    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null
        if (pendingArgs) run(pendingArgs)
        pendingArgs = null
      }, remaining)
    }
  }) as Throttled<T>

  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    pendingArgs = null
  }

  return throttled
}
