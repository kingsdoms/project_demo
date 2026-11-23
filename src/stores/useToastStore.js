import { create } from 'zustand'

let nextId = 1
const timers = new Map()

export const useToastStore = create((set, get) => ({
  toasts: [],
  push(kind, message, { duration = kind === 'error' ? 6000 : 3800 } = {}) {
    if (!message) return null
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, kind, message: String(message) }] }))
    if (typeof window !== 'undefined' && duration > 0) {
      timers.set(id, window.setTimeout(() => get().dismiss(id), duration))
    }
    return id
  },
  dismiss(id) {
    const timer = timers.get(id)
    if (timer) { clearTimeout(timer); timers.delete(id) }
    set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }))
  },
}))

const push = (kind) => (message, options) => useToastStore.getState().push(kind, message, options)

export const toast = {
  success: push('success'),
  error: push('error'),
  info: push('info'),
}
