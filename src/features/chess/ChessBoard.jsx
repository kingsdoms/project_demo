import { useRef, useState } from 'react'
import styles from './ChessBoard.module.css'

const EDGE = 7
const FILES = 'abcdefgh'
const INDICES = Array.from({ length: EDGE + 1 }, (_, index) => index)
const PIECE_NAMES = {
  KING: 'Vua', QUEEN: 'Hậu', ROOK: 'Xe', BISHOP: 'Tượng', KNIGHT: 'Mã', PAWN: 'Tốt',
}

const rowColKey = (row, col) => row * (EDGE + 1) + col
const matches = (square, row, col) => square?.row === row && square?.col === col

const art = {
  KING: (
    <>
      <path d="M23 38c-2-4-9-9-9-16 0-5 3-8 8-8 4 0 8 3 10 7 2-4 6-7 10-7 5 0 8 3 8 8 0 7-7 12-9 16l3 9 3 4v4H17v-4l3-4z" />
      <path d="M23 38h18m-21 9h24m-27 4h30M32 21v11m-7-23h14m-7-5v12" fill="none" className={styles.detail} />
    </>
  ),
  QUEEN: (
    <>
      <path d="M20 39 13 18l12 9 7-15 7 15 12-9-7 21-2 7 5 5v4H17v-4l5-5z" />
      <circle cx="12.5" cy="15" r="3.1" /><circle cx="32" cy="9" r="3.5" /><circle cx="51.5" cy="15" r="3.1" />
      <path d="M20 39h24m-22 7h20m-25 5h30m-19-17 4-5 4 5-4 3z" fill="none" className={styles.detail} />
    </>
  ),
  ROOK: (
    <>
      <path d="M14 12h8v7h6v-7h8v7h6v-7h8v13l-8 7v13l5 5v5H17v-5l5-5V32l-8-7z" />
      <path d="M14 25h36m-28 7h20m-20 13h20m-25 5h30m-15-16v9" fill="none" className={styles.detail} />
    </>
  ),
  BISHOP: (
    <>
      <path d="M32 13c6 5 15 12 15 21 0 6-3 9-7 11l7 5v5H17v-5l7-5c-4-2-7-5-7-11 0-9 9-16 15-21Z" />
      <circle cx="32" cy="10" r="4" />
      <path d="m38 22-9 12m-11 5h28m-22 6h16m-23 5h30" fill="none" className={styles.detail} />
    </>
  ),
  KNIGHT: (
    <>
      <path d="M19 50v-7c0-6 5-10 10-15l-5 2-4 4-8-2 1-5 9-10 2-9 7 6 5-5 3 8c9 4 13 13 12 24l-2 9 2 5H16v-3z" />
      <path d="M19 50h30m-25-6c6-7 14-12 15-21m-14-2h1m-11 8h2" fill="none" className={styles.detail} />
    </>
  ),
  PAWN: (
    <>
      <path d="M25 27h14v5c0 7 1 12 8 18v5H17v-5c7-6 8-11 8-18z" />
      <circle cx="32" cy="20" r="9" />
      <path d="M25 32h14m-22 18h30" fill="none" className={styles.detail} />
    </>
  ),
}

export function PieceArt({ type, side, className, ...props }) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 64 64"
      className={[styles.art, side === 'BLACK' ? styles.black : styles.white, className].filter(Boolean).join(' ')}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <g>{art[type]}</g>
    </svg>
  )
}

export default function ChessBoard({ view, flipped = false, onSquare, blocked = false }) {
  const [focused, setFocused] = useState({ row: 6, col: 4 })
  const cellRefs = useRef([])
  const dragFrom = useRef(null)
  const suppressClick = useRef(false)
  const pieces = new Map(view?.pieces.map((piece) => [rowColKey(piece.row, piece.col), piece]))
  const targets = new Map(view?.targets.map((target) => [rowColKey(target.row, target.col), target]))
  const visualToBoard = (index) => flipped ? EDGE - index : index

  function handleKeyDown(event, visualRow, visualCol) {
    const { key, ctrlKey, metaKey, altKey } = event
    if (altKey || ((ctrlKey || metaKey) && key !== 'Home' && key !== 'End')) return
    let row = visualRow
    let col = visualCol

    switch (key) {
      case 'ArrowUp': row = Math.max(0, row - 1); break
      case 'ArrowDown': row = Math.min(EDGE, row + 1); break
      case 'ArrowLeft': col = Math.max(0, col - 1); break
      case 'ArrowRight': col = Math.min(EDGE, col + 1); break
      case 'Home': col = 0; if (ctrlKey || metaKey) row = 0; break
      case 'End': col = EDGE; if (ctrlKey || metaKey) row = EDGE; break
      default: return
    }

    event.preventDefault()
    cellRefs.current[rowColKey(visualToBoard(row), visualToBoard(col))]?.focus()
  }

  return (
    <div className={styles.board} role="grid" aria-label="Bàn cờ vua" aria-rowcount={8} aria-colcount={8} aria-busy={!view}>
      {INDICES.map((visualRow) => {
        const row = visualToBoard(visualRow)
        return (
          <div key={row} className={styles.row} role="row">
            {INDICES.map((visualCol) => {
              const col = visualToBoard(visualCol)
              const key = rowColKey(row, col)
              const piece = pieces.get(key)
              const target = targets.get(key)
              const selected = piece != null && piece.id === view?.selectedId
              const recent = matches(view?.lastMove?.from, row, col) || matches(view?.lastMove?.to, row, col)
              const checked = matches(view?.checkedKing, row, col)
              const coordinate = `${FILES[col]}${EDGE + 1 - row}`
              const label = [
                coordinate,
                piece && `${PIECE_NAMES[piece.type]} ${piece.side === 'WHITE' ? 'trắng' : 'đen'}`,
                selected && 'đang chọn',
                checked && 'bị chiếu',
                target && (target.capture ? 'có thể bắt quân' : 'có thể đi tới'),
              ].filter(Boolean).join(', ')
              const cellClass = [
                styles.square,
                (row + col) % 2 ? styles.dark : styles.light,
                recent && styles.recent,
                selected && styles.selected,
                checked && styles.checked,
              ].filter(Boolean).join(' ')

              return (
                <div key={col} className={styles.cell} role="gridcell" aria-selected={selected}>
                  <button
                    type="button"
                    className={cellClass}
                    aria-label={label}
                    aria-disabled={blocked || undefined}
                    tabIndex={matches(focused, row, col) ? 0 : -1}
                    ref={(button) => { cellRefs.current[key] = button }}
                    onFocus={() => setFocused((previous) => matches(previous, row, col) ? previous : { row, col })}
                    onKeyDown={(event) => handleKeyDown(event, visualRow, visualCol)}
                    draggable={!blocked && piece?.side === view?.turn}
                    onDragStart={(event) => {
                      if (blocked || !piece || piece.side !== view?.turn) { event.preventDefault(); return }
                      dragFrom.current = { row, col }
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', coordinate)
                      if (view?.selectedId !== piece.id) onSquare?.(row, col)
                    }}
                    onDragOver={(event) => { if (!blocked && dragFrom.current) event.preventDefault() }}
                    onDrop={(event) => {
                      event.preventDefault()
                      const from = dragFrom.current
                      dragFrom.current = null
                      if (!blocked && from && !matches(from, row, col)) { suppressClick.current = true; onSquare?.(row, col) }
                    }}
                    onDragEnd={() => { dragFrom.current = null; window.setTimeout(() => { suppressClick.current = false }, 0) }}
                    onClick={() => { if (!blocked && !suppressClick.current) onSquare?.(row, col); suppressClick.current = false }}
                  >
                    {visualCol === 0 && <span className={styles.rank} aria-hidden="true">{EDGE + 1 - row}</span>}
                    {visualRow === EDGE && <span className={styles.file} aria-hidden="true">{FILES[col]}</span>}
                    {target && <span className={target.capture ? styles.capture : styles.target} aria-hidden="true" />}
                    {piece && <PieceArt className={styles.piece} side={piece.side} type={piece.type} />}
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
