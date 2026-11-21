import assert from 'node:assert/strict'
import { test } from 'node:test'
import { attachBot } from '../bot/attachBot.js'
import { Room } from '../core/engine/room.js'
import { Action } from '../core/models/Action.js'

test('restarting while an async bot thinks discards the stale move and schedules the new position', { timeout: 2000 }, async (t) => {
  const room = new Room()
  let resolveStale
  let started
  let calls = 0
  const thinking = new Promise((resolve) => { started = resolve })
  const bot = attachBot(room, {
    sides: ['WHITE'], delay: 0,
    choose: (game) => {
      calls++
      if (calls === 1) return new Promise((resolve) => { resolveStale = () => resolve(Action.move(game.board.pieceAt(6, 0).id, 5, 0)); started() })
      return Action.move(game.board.pieceAt(6, 4).id, 4, 4)
    },
  })
  t.after(() => { bot.stop(); room.destroy() })
  await thinking
  room.restart()
  const moved = new Promise((resolve) => {
    const off = room.subscribe((game) => { if (game.turn === 'BLACK') { off(); resolve() } })
  })
  resolveStale()
  await moved
  assert.equal(calls, 2)
  assert.ok(room.getState().board.pieceAt(6, 0), 'stale a2-a3 must not be applied')
  assert.equal(room.getState().board.pieceAt(5, 0), null)
  assert.equal(room.getState().board.pieceAt(4, 4)?.type, 'PAWN')
})
