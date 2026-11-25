import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { PieceArt } from '../ChessBoard'
import {
  createBoardAnimationStore, EFFECT_INFO, effectText, getAbilityTargets,
  legalTargets, pieceEffectId, posKey, samePos, selectablePieceIds,
  squareName, visibleEffects, visualPosition,
} from './boardModel.js'
import styles from './ServerBoard.module.css'

const PIECE_NAMES = { KING: 'Vua', QUEEN: 'Hậu', ROOK: 'Xe', BISHOP: 'Tượng', KNIGHT: 'Mã', PAWN: 'Tốt' }
const NO_EVENTS = []

export default function ServerBoard({ view, selectedId, onSelect, onMove, lastMove, abilityMode = false, onAbilityTarget, events = NO_EVENTS, blocked = false }) {
  const rows = view?.rows || 8
  const cols = view?.cols || 8
  const [animation] = useState(() => createBoardAnimationStore(view))
  const display = useSyncExternalStore(animation.subscribe, animation.getSnapshot, animation.getSnapshot)
  const [focused, setFocused] = useState({ row: 0, col: 0 })
  const [inspectionKey, setInspectionKey] = useState(null)
  const boardRef = useRef(null)
  const cells = useRef(new Map())
  const pointer = useRef(null)
  const suppressClick = useRef(false)
  const selectable = selectablePieceIds(view)
  const targets = legalTargets(view, selectedId)
  const abilities = new Set(abilityMode ? getAbilityTargets(view).map(posKey) : [])
  const pieces = new Map((view?.pieces || []).map((piece) => [posKey(piece.pos), piece]))
  const effects = visibleEffects(view)
  const inspectedPiece = pieces.get(inspectionKey)
  const inspectionText = effects.filter((effect) =>
    effect.target?.on === 'TILE' && posKey(effect.target.pos) === inspectionKey ||
    effect.target?.on === 'PIECE' && inspectedPiece && pieceEffectId(effect) === inspectedPiece.id,
  ).map((effect) => effectText(effect, view?.ext?.round)).join('\n')
  const inactive = blocked || display.animating || !view || Boolean(view.result) || view.phase !== 'PLAYING'
  const boardPosition = (visual) => view?.you === 'BLACK' ? { row: rows - 1 - visual.row, col: cols - 1 - visual.col } : visual

  useEffect(() => {
    animation.update(view, events)
    return animation.stop
  }, [animation, view, events])

  function activate(pos, fromId = selectedId) {
    if (inactive) return
    if (abilityMode) {
      if (abilities.has(posKey(pos))) onAbilityTarget?.(pos)
      return
    }
    const move = legalTargets(view, fromId).find((candidate) => samePos(candidate.to, pos))
    if (move) { onMove?.(move); return }
    const piece = pieces.get(posKey(pos))
    onSelect?.(piece && selectable.has(piece.id) && piece.id !== selectedId ? piece.id : null)
  }

  function keyDown(event, visualRow, visualCol) {
    if (event.altKey || event.metaKey) return
    let row = visualRow
    let col = visualCol
    switch (event.key) {
      case 'ArrowUp': row = Math.max(0, row - 1); break
      case 'ArrowDown': row = Math.min(rows - 1, row + 1); break
      case 'ArrowLeft': col = Math.max(0, col - 1); break
      case 'ArrowRight': col = Math.min(cols - 1, col + 1); break
      case 'Home': col = 0; if (event.ctrlKey) row = 0; break
      case 'End': col = cols - 1; if (event.ctrlKey) row = rows - 1; break
      case 'Escape': onSelect?.(null); return
      default: return
    }
    event.preventDefault()
    const pos = boardPosition({ row, col })
    cells.current.get(posKey(pos))?.focus()
  }

  function pointerDown(event, piece) {
    if (inactive || abilityMode || event.button !== 0 || !piece || !selectable.has(piece.id)) return
    pointer.current = { id: event.pointerId, piece: piece.id, startX: event.clientX, startY: event.clientY, dragged: false }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function pointerMove(event) {
    const drag = pointer.current
    if (!drag || drag.id !== event.pointerId) return
    if (!drag.dragged && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) {
      drag.dragged = true
      onSelect?.(drag.piece)
    }
  }

  function pointerUp(event) {
    const drag = pointer.current
    pointer.current = null
    if (!drag || drag.id !== event.pointerId || !drag.dragged || inactive) return
    suppressClick.current = true
    const rect = boardRef.current?.getBoundingClientRect()
    if (rect && event.clientX >= rect.left && event.clientX < rect.right && event.clientY >= rect.top && event.clientY < rect.bottom) {
      activate(boardPosition({ row: Math.floor((event.clientY - rect.top) / rect.height * rows), col: Math.floor((event.clientX - rect.left) / rect.width * cols) }), drag.piece)
    }
    window.setTimeout(() => { suppressClick.current = false }, 0)
  }

  const positionStyle = (pos) => {
    const visual = visualPosition(pos, { ...view, rows, cols })
    return { width: `${100 / cols}%`, height: `${100 / rows}%`, transform: `translate(${visual.col * 100}%, ${visual.row * 100}%)` }
  }

  return <div ref={boardRef} className={styles.board} data-ability={abilityMode || undefined} data-animating={display.animating || undefined} style={{ '--rows': rows, '--cols': cols, aspectRatio: `${cols} / ${rows}` }} role="grid" aria-label="Bàn cờ vua" aria-rowcount={rows} aria-colcount={cols} aria-busy={!view}>
    {Array.from({ length: rows }, (_, visualRow) => <div key={visualRow} className={styles.row} role="row">
      {Array.from({ length: cols }, (_, visualCol) => {
        const pos = boardPosition({ row: visualRow, col: visualCol })
        const key = posKey(pos)
        const piece = pieces.get(key)
        const target = targets.find((candidate) => samePos(candidate.to, pos))
        const capture = Boolean(target && (piece || target.kind === 'EN_PASSANT'))
        const selected = piece != null && piece.id === selectedId
        const checked = view?.in_check && piece?.kind === 'KING' && piece.side === view.turn
        const recent = samePos(lastMove?.from, pos) || samePos(lastMove?.to, pos)
        const tileEffects = effects.filter((effect) => effect.target?.on === 'TILE' && samePos(effect.target.pos, pos))
        const pieceEffects = piece ? effects.filter((effect) => effect.target?.on === 'PIECE' && pieceEffectId(effect) === piece.id) : []
        const description = [...tileEffects, ...pieceEffects].map((effect) => effectText(effect, view?.ext?.round)).join('\n')
        const label = [squareName(pos, rows), piece && `${PIECE_NAMES[piece.kind] || piece.kind} ${piece.side === 'WHITE' ? 'trắng' : 'đen'}`, selected && 'đang chọn', checked && 'bị chiếu', target && (capture ? 'có thể bắt quân' : 'có thể đi tới'), abilityMode && abilities.has(key) && 'mục tiêu kỹ năng', description].filter(Boolean).join(', ')
        const cellClass = [styles.square, (pos.row + pos.col) % 2 ? styles.dark : styles.light, selected && styles.selected, recent && styles.recent, checked && styles.checked, abilityMode && abilities.has(key) && styles.abilityTarget].filter(Boolean).join(' ')
        return <div key={visualCol} className={styles.cell} role="gridcell" aria-selected={selected}>
          <button type="button" className={cellClass} aria-label={label} title={description || undefined} aria-disabled={inactive || undefined}
            tabIndex={samePos(focused, pos) ? 0 : -1} ref={(node) => { if (node) cells.current.set(key, node); else cells.current.delete(key) }}
            onFocus={() => { setFocused(pos); setInspectionKey(key) }} onBlur={() => setInspectionKey(null)} onKeyDown={(event) => keyDown(event, visualRow, visualCol)}
            onPointerEnter={() => setInspectionKey(key)} onPointerLeave={() => setInspectionKey((current) => current === key ? null : current)}
            onPointerDown={(event) => pointerDown(event, piece)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { pointer.current = null }}
            onClick={() => { setInspectionKey(key); if (!suppressClick.current) activate(pos); suppressClick.current = false }}>
            {visualCol === 0 && <span className={styles.rank} aria-hidden="true">{rows - pos.row}</span>}
            {visualRow === rows - 1 && <span className={styles.file} aria-hidden="true">{squareName(pos, rows).replace(/[0-9]+$/, '')}</span>}
            {tileEffects.map((effect) => <span key={effect.uid} className={[styles.tileEffect, styles[effect.effect] || styles.unknown].join(' ')} aria-hidden="true"><span>{EFFECT_INFO[effect.effect]?.icon || '◇'}</span><small>{effect.expires == null ? '∞' : Math.max(0, effect.expires - (view?.ext?.round || 0))}</small></span>)}
            {target && !abilityMode && <span className={capture ? styles.capture : styles.target} aria-hidden="true" />}
          </button>
        </div>
      })}
    </div>)}
    <div className={styles.pieces} aria-hidden="true">
      {display.pieces.map((piece) => {
        if (!piece.pos) return null
        const pieceEffects = effects.filter((effect) => effect.target?.on === 'PIECE' && pieceEffectId(effect) === piece.id)
        return <div key={piece.id} className={[styles.pieceSlot, selectedId === piece.id && styles.selectedPiece, pieceEffects.some((effect) => effect.effect === 'frozen') && styles.frozenPiece, piece.exit && styles[piece.exit]].filter(Boolean).join(' ')} style={positionStyle(piece.pos)}>
          <PieceArt className={styles.pieceArt} type={piece.kind} side={piece.side} />
          {pieceEffects.length > 0 && <span className={styles.badges}>{pieceEffects.map((effect) => <span key={effect.uid} className={[styles.badge, styles[effect.effect] || styles.unknown].join(' ')} title={effectText(effect, view?.ext?.round)}>{EFFECT_INFO[effect.effect]?.icon || '◇'}<small>{effect.expires == null ? '∞' : Math.max(0, effect.expires - (view?.ext?.round || 0))}</small></span>)}</span>}
        </div>
      })}
    </div>
    {display.signal?.pos && <span className={styles.signal} style={positionStyle(display.signal.pos)} aria-hidden="true">✦</span>}
    {inspectionText && <span className={styles.tooltip} role="tooltip">{inspectionText}</span>}
  </div>
}
