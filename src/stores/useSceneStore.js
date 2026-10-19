// src/stores/useSceneStore.js
import { create } from 'zustand'
import { SCENES } from '@/config/scenes'

export const useSceneStore = create((set) => ({
  scene: SCENES.DEBUG,
  setScene: (scene) => set({ scene }),
}))