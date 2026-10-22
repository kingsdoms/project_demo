import { SCENES } from '@/config/scenes'
import { useSceneStore } from '@/stores/useSceneStore'
import { InputDebugScreen } from '@/features/input-debug'
import { WorldScene } from '@/world'
import { ChessScreen } from '@/games/chess'
import ScenePlaceholder from '@/components/ScenePlaceholder'
// import { BattleScene } from '@/games/battle'

const REGISTRY = {
  [SCENES.DEBUG]: InputDebugScreen,
  [SCENES.WORLD]: WorldScene,
  [SCENES.CHESS]: ChessScreen,
  // [SCENES.BATTLE]: BattleScene,
}

export default function SceneHost() {
  const scene = useSceneStore((s) => s.scene)
  const Scene = REGISTRY[scene]
  if (!Scene)
    return <ScenePlaceholder title={scene} description="Scene này chưa được cài đặt." />
  return <Scene />
}