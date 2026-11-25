import test from 'node:test'
import assert from 'node:assert/strict'
import { clockRemaining, countdown } from './timing.js'

const snapshot = { clock: { white_ms: 600000, black_ms: 597000, running: 'WHITE' }, view: { result: null } }

test('only the server-designated running side loses local elapsed time', () => {
  assert.equal(clockRemaining(snapshot, 'WHITE', 10000, 10950), 599050)
  assert.equal(clockRemaining(snapshot, 'BLACK', 10000, 10950), 597000)
})

test('clock uses the latest server base and receive time after a delayed repaint', () => {
  assert.equal(clockRemaining(snapshot, 'WHITE', 10000, 53000), 557000)
  const next = { ...snapshot, clock: { white_ms: 560500, black_ms: 597000, running: 'BLACK' } }
  assert.equal(clockRemaining(next, 'WHITE', 54000, 54500), 560500)
  assert.equal(clockRemaining(next, 'BLACK', 54000, 54500), 596500)
})

test('practice has no clock and paused decisions do not reduce either clock', () => {
  assert.equal(clockRemaining({ ...snapshot, clock: null }, 'WHITE', 10000, 20000), null)
  const paused = { ...snapshot, clock: { ...snapshot.clock, running: null } }
  assert.equal(clockRemaining(paused, 'WHITE', 10000, 20000), 600000)
  assert.equal(clockRemaining(paused, 'BLACK', 10000, 20000), 597000)
})

test('finished games freeze clocks and elapsed time cannot produce negative values', () => {
  const finished = { ...snapshot, view: { result: { winner: 'WHITE', reason: 'CHECKMATE' } } }
  assert.equal(clockRemaining(finished, 'WHITE', 10000, 900000), 600000)
  assert.equal(clockRemaining(snapshot, 'WHITE', 10000, 900000), 0)
  assert.equal(clockRemaining(snapshot, 'WHITE', 11000, 10000), 600000)
})

test('countdown rounds partial seconds up and clamps expired deadlines', () => {
  assert.equal(countdown(600000), '10:00')
  assert.equal(countdown(59950), '01:00')
  assert.equal(countdown(1001), '00:02')
  assert.equal(countdown(1), '00:01')
  assert.equal(countdown(0), '00:00')
  assert.equal(countdown(-5000), '00:00')
})
