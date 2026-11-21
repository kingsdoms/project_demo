import ChessArenaApp from '@/app/ChessArenaApp'
import GameLayout from '@/layouts/GameLayout'
import SceneHost from '@/scenes/SceneHost'
import { PlayerStatusHud } from '@/features/player-status'
import { UserMenu } from '@/features/user-menu'

export default function App() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug')) {
    return (
      <GameLayout topLeft={<PlayerStatusHud />} topRight={<UserMenu />}>
        <SceneHost />
      </GameLayout>
    )
  }

  return <ChessArenaApp />
}
