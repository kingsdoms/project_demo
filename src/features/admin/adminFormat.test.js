import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mmss, parseIdList, pickText, rolePermissions, statEntries, toRfc3339 } from './adminFormat.js'

test('datetime-local converts to RFC 3339 with an explicit offset', () => {
  assert.equal(toRfc3339('2026-12-31T23:59', 420), '2026-12-31T23:59:00+07:00')
  assert.equal(toRfc3339('2026-01-02T03:04:05', -150), '2026-01-02T03:04:05-02:30')
  assert.equal(toRfc3339(''), undefined)
  assert.equal(toRfc3339('31/12/2026'), undefined)
})

test('account id lists accept commas and spaces but reject junk', () => {
  assert.deepEqual(parseIdList(' 1, 2 ;3 2'), [1, 2, 3])
  assert.deepEqual(parseIdList(''), [])
  assert.equal(parseIdList('1, abc'), null)
  assert.equal(parseIdList('0'), null)
})

test('display helpers never leak undefined or tokens', () => {
  assert.equal(pickText([undefined, null, '  ']), '—')
  assert.equal(pickText([0]), '0')
  assert.equal(pickText(['Bearer abc.def']), 'Bearer [đã ẩn]')
  assert.equal(mmss(605), '10:05')
  assert.deepEqual(statEntries({ total: 3, label: 'x' }), [['total', 3]])
  assert.deepEqual(statEntries([{ type_code: 'INFO', count: 2 }]), [['INFO', 2]])
  assert.deepEqual([...rolePermissions({ permissions: ['A', { permission_code: 'B' }] })], ['A', 'B'])
})
