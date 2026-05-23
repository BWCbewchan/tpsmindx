type BodyScrollLockState = {
  count: number
  bodyOverflow: string
  htmlOverflow: string
}

declare global {
  interface Window {
    __tpsBodyScrollLockState?: BodyScrollLockState
  }
}

function getState(): BodyScrollLockState {
  if (!window.__tpsBodyScrollLockState) {
    window.__tpsBodyScrollLockState = {
      count: 0,
      bodyOverflow: '',
      htmlOverflow: '',
    }
  }

  return window.__tpsBodyScrollLockState
}

export function lockBodyScroll() {
  if (typeof window === 'undefined') return

  const state = getState()
  if (state.count === 0) {
    state.bodyOverflow = document.body.style.overflow
    state.htmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }

  state.count += 1
}

export function unlockBodyScroll() {
  if (typeof window === 'undefined') return

  const state = getState()
  state.count = Math.max(0, state.count - 1)

  if (state.count === 0) {
    document.body.style.overflow = state.bodyOverflow
    document.documentElement.style.overflow = state.htmlOverflow
  }
}
