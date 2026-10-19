// src/scenes/SceneHost.jsx
import { SCENES } from '@/config/scenes'
import { useSceneStore } from '@/stores/useSceneStore'
import { InputDebugScreen } from '@/features/input-debug'
import { WorldScene } from '@/world'
// import { BattleScene } from '@/games/battle'

const REGISTRY = {
  [SCENES.DEBUG]: InputDebugScreen,
  [SCENES.WORLD]: WorldScene,
  // [SCENES.BATTLE]: BattleScene,
}

export default function SceneHost() {
  const scene = useSceneStore((s) => s.scene)
  const Scene = REGISTRY[scene]
  return <Scene />
}