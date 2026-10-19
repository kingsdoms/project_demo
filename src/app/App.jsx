// src/app/App.jsx
import GameLayout from '@/layouts/GameLayout'
import SceneHost from '@/scenes/SceneHost'
import { PlayerStatusHud } from '@/features/player-status'
import { UserMenu } from '@/features/user-menu'

export default function App() {
  return (
    <GameLayout topLeft={<PlayerStatusHud />} topRight={<UserMenu />}>
      <SceneHost />
    </GameLayout>
  )
}