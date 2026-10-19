// src/world/WorldScene.jsx
import ScenePlaceholder from '@/components/ScenePlaceholder'
import { SCENES } from '@/config/scenes'
import { useSceneStore } from '@/stores/useSceneStore'

export default function WorldScene() {
  const setScene = useSceneStore((s) => s.setScene)
  return (
    // TODO: khởi tạo map / world renderer ở đây
    <ScenePlaceholder title="World" description="Map sẽ được khởi tạo ở đây.">
      <button onClick={() => setScene(SCENES.DEBUG)}>← Quay lại</button>
    </ScenePlaceholder>
  )
}