// src/stores/usePlayerStore.js
import { create } from 'zustand'

export const usePlayerStore = create((set) => ({
  // Dữ liệu fake, sau này thay bằng dữ liệu từ server
  profile: { id: 'UID-100245', name: 'Hunter_01', level: 12 },
  stats: { hp: 720, maxHp: 1000, mp: 340, maxMp: 500, exp: 4200, maxExp: 6000 },

  damage: (n) =>
    set((s) => ({ stats: { ...s.stats, hp: Math.max(0, s.stats.hp - n) } })),
  heal: (n) =>
    set((s) => ({ stats: { ...s.stats, hp: Math.min(s.stats.maxHp, s.stats.hp + n) } })),
}))