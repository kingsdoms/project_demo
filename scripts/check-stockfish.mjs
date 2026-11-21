import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOT_LEVELS } from '../src/games/chess/bot/stockfish/levels.js'
import { parseUciMove } from '../src/games/chess/bot/stockfish/position.js'
import { Game } from '../src/games/chess/core/models/Game.js'

// Exercise the exact vendored JS/WASM, rather than a fake UCI engine.
const folder = await mkdtemp(join(tmpdir(), 'chessarena-stockfish-'))
let child
try {
  await copyFile(fileURLToPath(new URL('../public/stockfish/stockfish.js', import.meta.url)), join(folder, 'stockfish.cjs'))
  await copyFile(fileURLToPath(new URL('../public/stockfish/stockfish.wasm', import.meta.url)), join(folder, 'stockfish.wasm'))
  const position = Game.initialStandard()
  const results = []
  let current = 0
  let pending = ''
  let engineName = ''
  let errors = ''
  child = spawn(process.execPath, [join(folder, 'stockfish.cjs')], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  const send = (command) => child.stdin.write(command + '\n')
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Stockfish smoke test timed out. ' + errors)), 30000)
    const fail = (error) => { clearTimeout(timer); reject(error) }
    child.on('error', fail)
    child.stderr.on('data', (data) => { errors += data.toString().slice(0, 1000) })
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code === 0 && results.length === BOT_LEVELS.length) resolve()
      else reject(new Error('Stockfish exited before all levels completed: ' + code + ' ' + errors))
    })
    child.stdout.on('data', (chunk) => {
      pending += chunk.toString()
      const lines = pending.split(/\r?\n/)
      pending = lines.pop()
      try {
        for (const line of lines) {
          if (line.startsWith('id name ')) engineName = line.slice(8)
          if (line === 'uciok') {
            send('setoption name Hash value 16')
            send('setoption name UCI_LimitStrength value false')
            send('setoption name Skill Level value ' + BOT_LEVELS[0].skill)
            send('isready')
          } else if (line === 'readyok') {
            const preset = BOT_LEVELS[current]
            send('position startpos')
            send('go depth ' + preset.depth + ' movetime ' + preset.moveTime)
          } else if (line.startsWith('bestmove ')) {
            const move = line.split(/\s+/)[1]
            assert.ok(parseUciMove(position, move)?.action, 'Engine must return a move accepted by the local rules')
            const preset = BOT_LEVELS[current]
            results.push({ level: preset.key, skill: preset.skill, depth: preset.depth, moveTime: preset.moveTime, move })
            current++
            if (current === BOT_LEVELS.length) send('quit')
            else { send('ucinewgame'); send('setoption name Skill Level value ' + BOT_LEVELS[current].skill); send('isready') }
          }
        }
      } catch (error) { fail(error) }
    })
    send('uci')
  })
  console.log(JSON.stringify({ engine: engineName, levelsPassed: results.length, results }, null, 2))
} finally {
  child?.kill()
  const cleanup = resolve(folder)
  if (!cleanup.startsWith(resolve(tmpdir()) + sep) || !basename(cleanup).startsWith('chessarena-stockfish-')) {
    throw new Error('Refusing cleanup outside the generated Stockfish test directory.')
  }
  await rm(cleanup, { recursive: true, force: true })
}
