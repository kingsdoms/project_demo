import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildAnimationFrames, createBoardAnimationStore, effectText, getAbilityTargets,
  legalTargets, moveNeedsPromotion, pendingPromotionPiece, selectablePieceIds,
  squareName, visibleEffects, visualPosition,
} from './boardModel.js'

const piece = (id, kind, side, row, col) => ({ id, kind, side, pos: { row, col } })
function makeView(overrides = {}) {
  return {
    rows: 8, cols: 8, you: 'WHITE', turn: 'WHITE', phase: 'PLAYING', result: null,
    pieces: [piece(1, 'KING', 'WHITE', 7, 4), piece(2, 'PAWN', 'WHITE', 6, 4), piece(3, 'KING', 'BLACK', 0, 4), piece(4, 'ROOK', 'BLACK', 2, 3)],
    legal_moves: [{ piece: 2, from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, kind: 'NORMAL' }],
    ...overrides,
  }
}

test('selection and destinations are limited to legal_moves returned for the current player', () => {
  const view = makeView()
  assert.deepEqual([...selectablePieceIds(view)], [2])
  assert.strictEqual(legalTargets(view, 2)[0], view.legal_moves[0])
  assert.deepEqual(legalTargets(view, 1), [])
  assert.deepEqual([...selectablePieceIds(makeView({ turn: 'BLACK' }))], [])
  assert.deepEqual(legalTargets(makeView({ turn: 'BLACK' }), 2), [])
  assert.deepEqual([...selectablePieceIds(makeView({ phase: 'CARD_PICK' }))], [])
  assert.deepEqual([...selectablePieceIds(makeView({ pending_promotion: { piece: 2 } }))], [])
  assert.deepEqual(legalTargets(makeView({ pending_promotion: { piece: 2 } }), 2), [])
  assert.deepEqual([...selectablePieceIds(makeView({ legal_moves: [{ piece: 4, to: { row: 3, col: 3 } }] }))], [])
})

test('orientation and coordinates follow server dimensions including nonstandard boards', () => {
  assert.equal(squareName({ row: 0, col: 0 }), 'a8')
  assert.equal(squareName({ row: 7, col: 7 }), 'h1')
  assert.equal(squareName({ row: 9, col: 26 }, 10), 'aa1')
  assert.deepEqual(visualPosition({ row: 0, col: 0 }, makeView({ you: 'BLACK', rows: 10, cols: 12 })), { row: 9, col: 11 })
  assert.deepEqual(visualPosition({ row: 3, col: 4 }, makeView()), { row: 3, col: 4 })
})

test('promotion prompts only concern the server selected pawn and own pending promotion', () => {
  const view = makeView()
  assert.equal(moveNeedsPromotion(view, { piece: 2, to: { row: 0, col: 4 } }), true)
  assert.equal(moveNeedsPromotion(view, { piece: 1, to: { row: 0, col: 4 } }), false)
  assert.equal(moveNeedsPromotion(view, { piece: 2, to: { row: 4, col: 4 } }), false)
  assert.equal(pendingPromotionPiece(makeView({ pending_promotion: { piece: 2 } })).id, 2)
  assert.equal(pendingPromotionPiece(makeView({ pending_promotion: 2 })).id, 2)
  assert.equal(pendingPromotionPiece(makeView({ pending_promotion: { piece: 4 } })), null)
  const zero = makeView({ pending_promotion: 0, pieces: [piece(0, 'PAWN', 'WHITE', 0, 4)], ext: { round: 3, players: [{ side: 'WHITE', character: 'geomancer', ability_ready_at: 1 }] } })
  assert.equal(pendingPromotionPiece(zero).id, 0)
  assert.deepEqual([...selectablePieceIds(zero)], [])
  assert.deepEqual(legalTargets(zero, 2), [])
  assert.deepEqual(getAbilityTargets(zero), [])
})

test('ability highlighting observes each supplied character hint and readiness', () => {
  const extended = (character, changes = {}) => makeView({ ext: { round: 3, players: [{ side: 'WHITE', character, ability_ready_at: 2 }] }, ...changes })
  assert.equal(getAbilityTargets(extended('geomancer')).length, 60)
  assert.deepEqual(getAbilityTargets(extended('frost_witch')), [{ row: 2, col: 3 }])
  assert.deepEqual(getAbilityTargets(extended('commander')), [{ row: 6, col: 4 }])
  assert.deepEqual(getAbilityTargets(extended('commander', { pieces: [piece(2, 'PAWN', 'WHITE', 1, 4)] })), [])
  assert.deepEqual(getAbilityTargets(extended('commander', { pieces: [piece(2, 'PAWN', 'WHITE', 6, 4), piece(8, 'BISHOP', 'WHITE', 5, 4)] })), [])
  assert.deepEqual(getAbilityTargets(extended('frost_witch', { turn: 'BLACK' })), [])
  assert.deepEqual(getAbilityTargets(makeView({ ext: { round: 1, players: [{ side: 'WHITE', character: 'geomancer', ability_ready_at: 3 }] } })), [])
  const black = makeView({ you: 'BLACK', turn: 'BLACK', pieces: [piece(9, 'PAWN', 'BLACK', 1, 2)], ext: { round: 3, players: [{ side: 'BLACK', character: 'commander', ability_ready_at: 1 }] } })
  assert.deepEqual(getAbilityTargets(black), [{ row: 1, col: 2 }])
})

test('unknown effects have safe descriptions and internal skid is never displayed', () => {
  const effects = [{ uid: 1, effect: 'skid' }, { uid: 2, effect: 'future_effect', expires: null }, { uid: 3, effect: 'frozen', expires: 8 }]
  assert.deepEqual(visibleEffects(makeView({ ext: { effects } })).map((effect) => effect.uid), [2, 3])
  assert.equal(effectText(effects[1], 5), 'future_effect · cả trận')
  assert.match(effectText(effects[2], 5), /Đóng băng · còn 3 vòng/)
})

test('move, slide and falling frames run in order and never mutate a snapshot', () => {
  const before = makeView()
  const after = makeView({ pieces: before.pieces.filter((entry) => entry.id !== 2) })
  const frames = buildAnimationFrames(before, after, [
    { type: 'GAME', event: { type: 'MOVED', piece: 2, from: { row: 6, col: 4 }, to: { row: 4, col: 4 } } },
    { type: 'PIECE_MOVED', piece: 2, from: { row: 4, col: 4 }, to: { row: 3, col: 4 }, cause: 'ice' },
    { type: 'PIECE_REMOVED', piece: 2, cause: 'broken' },
  ])
  assert.equal(frames.length, 3)
  assert.deepEqual(frames[0].pieces.find((entry) => entry.id === 2).pos, { row: 4, col: 4 })
  assert.deepEqual(frames[1].pieces.find((entry) => entry.id === 2).pos, { row: 3, col: 4 })
  assert.equal(frames[2].pieces.find((entry) => entry.id === 2).exit, 'removed')
  assert.deepEqual(before.pieces.find((entry) => entry.id === 2).pos, { row: 6, col: 4 })
  assert.equal(after.pieces.length, 3)
})

test('new snapshots cancel an animation and show exact newest pieces', () => {
  const scheduled = new Map()
  let nextId = 0
  const store = createBoardAnimationStore(makeView(), { schedule: (fn) => { scheduled.set(++nextId, fn); return nextId }, cancel: (id) => scheduled.delete(id) })
  const moved = makeView({ pieces: [piece(2, 'PAWN', 'WHITE', 4, 4)] })
  store.update(moved, [{ type: 'GAME', event: { type: 'MOVED', piece: 2, to: { row: 4, col: 4 } } }])
  assert.equal(store.getSnapshot().animating, true)
  assert.equal(scheduled.size, 1)
  const latest = makeView({ pieces: [piece(2, 'QUEEN', 'WHITE', 0, 4)] })
  store.update(latest, [{ type: 'GAME', event: { type: 'PROMOTED', piece: 2, kind: 'QUEEN' } }])
  assert.equal(scheduled.size, 0)
  assert.equal(store.getSnapshot().animating, false)
  assert.strictEqual(store.getSnapshot().pieces, latest.pieces)
})

test('capture and castling frames preserve IDs and settle to exact final server data', () => {
  const scheduled = []
  const before = makeView({ pieces: [piece(1, 'KING', 'WHITE', 7, 4), piece(7, 'ROOK', 'WHITE', 7, 7), piece(4, 'ROOK', 'BLACK', 2, 3)] })
  const after = makeView({ pieces: [piece(1, 'KING', 'WHITE', 7, 6), piece(7, 'ROOK', 'WHITE', 7, 5)] })
  const events = [
    { type: 'GAME', event: { type: 'MOVED', piece: 1, to: { row: 7, col: 6 } } },
    { type: 'GAME', event: { type: 'CASTLED', rook: 7, to: { row: 7, col: 5 } } },
    { type: 'GAME', event: { type: 'CAPTURED', piece: 4 } },
  ]
  const frames = buildAnimationFrames(before, after, events)
  assert.deepEqual(frames[1].pieces.find((entry) => entry.id === 7).pos, { row: 7, col: 5 })
  assert.equal(frames[2].pieces.find((entry) => entry.id === 4).exit, 'captured')
  const store = createBoardAnimationStore(before, { schedule: (fn) => { scheduled.push(fn); return scheduled.length }, cancel: () => {} })
  let notifications = 0
  const unsubscribe = store.subscribe(() => { notifications++ })
  store.update(after, events)
  while (scheduled.length) scheduled.shift()()
  assert.equal(store.getSnapshot().animating, false)
  assert.strictEqual(store.getSnapshot().pieces, after.pieces)
  assert.equal(notifications, 5)
  unsubscribe()
  store.stop()
})
