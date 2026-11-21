export function createClock(timeControl = '5 + 0', now = 0) {
  const [minutes, increment] = timeControl.split('+').map(Number)
  const initial = (Number.isFinite(minutes) && minutes > 0 ? minutes : 5) * 60000
  return { remaining: { WHITE: initial, BLACK: initial }, increment: (increment || 0) * 1000, active: 'WHITE', ply: 0, anchor: now, running: true, timedOut: null }
}

// Account for wall time, including a throttled/background tab, before switching turns.
export function settleClock(clock, { now, turn, ply, running = true }) {
  if (!clock.running) return clock
  const remaining = { ...clock.remaining }
  remaining[clock.active] = Math.max(0, remaining[clock.active] - Math.max(0, now - clock.anchor))
  const timedOut = remaining[clock.active] === 0 ? clock.active : null
  if (ply > clock.ply && !timedOut) remaining[clock.active] += clock.increment
  return { ...clock, remaining, active: turn, ply, anchor: now, timedOut, running: running && !timedOut }
}

export function formatClock(milliseconds = 0) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
