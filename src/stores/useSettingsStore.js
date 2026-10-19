// src/stores/useSettingsStore.js
import { create } from 'zustand'

export const useSettingsStore = create((set) => ({
  sound: true,
  music: true,
  quality: 'high', // 'low' | 'medium' | 'high'
  toggleSound: () => set((s) => ({ sound: !s.sound })),
  toggleMusic: () => set((s) => ({ music: !s.music })),
  setQuality: (quality) => set({ quality }),
}))