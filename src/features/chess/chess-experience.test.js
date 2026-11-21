import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClock, formatClock, settleClock } from './clock.js'
import { buildReplay, SAMPLE_HISTORY } from './replay.js'

test('replay rebuilds legal sample moves, including castling, without mutating earlier frames', () => {
  const frames = buildReplay()
  assert.equal(frames.length, SAMPLE_HISTORY.length + 1)
  assert.equal(frames[0].pieces.find((piece) => piece.row === 6 && piece.col === 4)?.type, 'PAWN')
  assert.equal(frames[1].pieces.find((piece) => piece.row === 4 && piece.col === 4)?.type, 'PAWN')
  assert.equal(frames[9].pieces.find((piece) => piece.row === 7 && piece.col === 6)?.type, 'KING')
  assert.equal(frames[9].pieces.find((piece) => piece.row === 7 && piece.col === 5)?.type, 'ROOK')
  assert.equal(frames[0].pieces.length, 32)
})

test('clock deducts elapsed time and awards increment exactly once on a completed move', () => {
  const initial = createClock('10 + 5', 100)
  const whiteMove = settleClock(initial, { now: 2100, turn: 'BLACK', ply: 1 })
  assert.equal(whiteMove.remaining.WHITE, 603000)
  assert.equal(whiteMove.remaining.BLACK, 600000)
  const tick = settleClock(whiteMove, { now: 2600, turn: 'BLACK', ply: 1 })
  assert.equal(tick.remaining.WHITE, 603000)
  assert.equal(tick.remaining.BLACK, 599500)
  const blackMove = settleClock(tick, { now: 3100, turn: 'WHITE', ply: 2 })
  assert.equal(blackMove.remaining.BLACK, 604000)
  assert.equal(initial.remaining.WHITE, 600000)
})

test('a background-tab timeout cannot be rescued by increment and a stopped clock stays frozen', () => {
  const expired = settleClock(createClock('1 + 5', 0), { now: 61000, turn: 'BLACK', ply: 1 })
  assert.equal(expired.timedOut, 'WHITE')
  assert.equal(expired.remaining.WHITE, 0)
  const paused = settleClock(createClock('5 + 0', 0), { now: 1200, turn: 'WHITE', ply: 0, running: false })
  assert.deepEqual(settleClock(paused, { now: 8000, turn: 'WHITE', ply: 0 }), paused)
  assert.equal(formatClock(-100), '00:00')
  assert.equal(formatClock(59001), '01:00')
})
