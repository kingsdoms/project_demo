export function clockRemaining(snapshot, side, receivedAt, now) {
  const clock = snapshot?.clock
  if (!clock) return null
  const base = side === 'WHITE' ? clock.white_ms : clock.black_ms
  return Math.max(0, base - (clock.running === side && !snapshot.view?.result ? Math.max(0, now - receivedAt) : 0))
}

export function countdown(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
