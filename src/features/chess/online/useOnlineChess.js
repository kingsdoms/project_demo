import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { createChessSession } from '@/services/chess/session'
import { chessApi } from '@/services/chess/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { toast } from '@/stores/useToastStore'

export function useOnlineChess() {
  const identity = useAuthStore((s) => s.session?.refreshToken || s.session?.accessToken || '')
  const [client] = useState(() => createChessSession({ onUnauthorized() {
    useAuthStore.getState().clear()
    useAuthStore.getState().setNotice('Phiên đã hết hạn. Hãy đăng nhập lại để tiếp tục ván cờ.')
  } }))
  const state = useSyncExternalStore(client.subscribe, client.getState, client.getState)
  const [catalog, setCatalog] = useState({ bots: [], seasons: [], loading: true, errors: {} })
  const [lobby, setLobby] = useState({ value: null, error: '', updatedAt: null })
  const [reload, setReload] = useState(0)
  const refresh = useCallback(() => setReload((n) => n + 1), [])

  useEffect(() => {
    if (identity) void client.connect()
    return () => client.disconnect()
  }, [client, identity])

  useEffect(() => {
    let active = true
    Promise.allSettled([chessApi.bots(), chessApi.seasons()]).then(([bots, seasons]) => {
      if (!active) return
      setCatalog({
        bots: bots.status === 'fulfilled' && Array.isArray(bots.value) ? bots.value : [],
        seasons: seasons.status === 'fulfilled' && Array.isArray(seasons.value) ? seasons.value : [],
        loading: false,
        errors: {
          ...(bots.status === 'rejected' ? { bots: bots.reason.message } : {}),
          ...(seasons.status === 'rejected' ? { seasons: seasons.reason.message } : {}),
        },
      })
    })
    return () => { active = false }
  }, [reload])

  useEffect(() => {
    let active = true
    let inFlight = false
    const load = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const value = await chessApi.lobby()
        if (active) setLobby({ value, error: '', updatedAt: Date.now() })
      } catch (error) {
        if (active) setLobby((previous) => ({ ...previous, error: error.message }))
      } finally { inFlight = false }
    }
    void load()
    const timer = setInterval(load, 10000)
    return () => { active = false; clearInterval(timer) }
  }, [reload])

  useEffect(() => {
    if (!state.error) return
    const { code, message } = state.error
    toast.error(code?.startsWith('RULE.') ? 'Nước đi không hợp lệ. Hãy chọn lại theo ô gợi ý.' : message)
    if (['CHESS.UNKNOWN_BOT', 'CHESS.UNKNOWN_SEASON'].includes(code)) refresh()
    client.clearError()
  }, [client, state.error, refresh])

  return { client, state, catalog, lobby, refresh }
}
