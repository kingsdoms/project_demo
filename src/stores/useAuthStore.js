import { create } from 'zustand'
import {
  clearAuthSession,
  getAuthSession,
  setAuthSession,
} from '@/services/api/client'

export const useAuthStore = create((set) => ({
  session: getAuthSession(),
  account: null,
  notice: '',
  setSession: (session, persist = true) => {
    setAuthSession(session, { persist })
    set({ session: getAuthSession(), account: null, notice: '' })
  },
  updateSession: () => set({ session: getAuthSession() }),
  setAccount: (account) => set({ account }),
  setNotice: (notice) => set({ notice }),
  clearNotice: () => set({ notice: '' }),
  clear: () => {
    clearAuthSession()
    set({ session: null, account: null })
  },
}))
