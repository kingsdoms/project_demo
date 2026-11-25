import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Flag, Handshake, History, LoaderCircle, RefreshCw, Swords, Trophy, Volume2, VolumeX, X } from 'lucide-react'
import { PieceArt } from '../ChessBoard'
import ServerBoard from './ServerBoard'
import { moveNeedsPromotion, pendingPromotionPiece, squareName } from './boardModel'
import { DecisionOverlay, ExtendedPlayer, RoundTrack } from './SeasonPanels'
import { describeCode, modeName, PIECE_NAMES, REASONS, SIDE_NAMES } from './labels'
import { clockRemaining, countdown } from './timing'
import styles from './OnlineChess.module.css'

function useNow() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(timer) }, [])
  return now
}

function Modal({ title, children, onClose }) {
  const ref = useRef(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { if (dialog?.open) dialog.close() } }, [])
  return <dialog ref={ref} className={styles.modal} aria-labelledby="room-dialog-title" onCancel={(e) => { e.preventDefault(); onClose?.() }}><header><h2 id="room-dialog-title">{title}</h2>{onClose && <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Đóng"><X size={19} /></button>}</header>{children}</dialog>
}

function Player({ side, view, snapshot, state, now, account, disabled, abilityMode, onAbility }) {
  const self = side === view.you
  const seat = view.seats?.find((s) => s.side === side)
  const connected = self ? state.status === 'ready' : snapshot.opponent_connected !== false
  const ms = clockRemaining(snapshot, side, state.receivedAt, now)
  const extPlayer = view.ext?.players?.find((p) => p.side === side)
  const captures = state.captured?.[side] || []
  return <section className={styles.player} aria-label={self ? 'Thông tin của bạn' : 'Thông tin đối thủ'} data-active={!view.result && view.turn === side && view.phase === 'PLAYING'}>
    <div className={styles.playerMain}><span className={styles.playerAvatar}><PieceArt type={seat?.bot ? 'KNIGHT' : 'KING'} side={side} /><i data-connected={connected} /></span><div className={styles.playerName}><strong>{self ? account?.name || 'Bạn' : seat?.bot ? `Máy · ${seat.bot}` : 'Đối thủ'}{self && <small> BẠN</small>}</strong><span>{SIDE_NAMES[side]}{!connected ? ' · Mất kết nối' : seat?.bot ? ' · Máy chủ điều khiển' : ' · Trực tuyến'}</span><div className={styles.captures} aria-label="Quân đã bắt">{captures.map((p, i) => <PieceArt key={`${p.id}-${i}`} type={p.kind} side={p.side} />)}</div></div>{ms != null && <time className={styles.clock} data-low={ms < 30000} data-running={snapshot.clock.running === side} aria-label={`Đồng hồ quân ${SIDE_NAMES[side]} ${countdown(ms)}`}>{countdown(ms)}</time>}</div>
    {extPlayer && <ExtendedPlayer player={extPlayer} view={view} disabled={disabled} abilityMode={abilityMode} onAbility={onAbility} />}
  </section>
}

function eventMessage(events) {
  const event = [...events].reverse().find((e) => ['ROUND_STARTED', 'COIN_FLIP', 'CARD_PICKED', 'CHARACTERS_REVEALED', 'TURN_SKIPPED', 'DRAW_DECLINED'].includes(e.type))
  if (!event) return null
  const text = {
    ROUND_STARTED: `Vòng ${event.round} · ${event.slot?.type === 'EXTREME_WEATHER' ? 'Thời tiết cực đoan' : event.slot?.type === 'CARD_PICK' ? 'Lượt chọn thẻ' : 'Vòng đấu mới'}`,
    COIN_FLIP: `${SIDE_NAMES[event.first]} đi trước`,
    CARD_PICKED: `${SIDE_NAMES[event.side]} chọn ${describeCode(event.card)}`,
    CHARACTERS_REVEALED: 'Hai nhân vật đã sẵn sàng',
    TURN_SKIPPED: `${SIDE_NAMES[event.side]} không có nước đi, mất lượt`,
    DRAW_DECLINED: 'Đề nghị hoà đã bị từ chối',
  }[event.type]
  return { text, coin: event.type === 'COIN_FLIP' }
}

function useGameSound(state, enabled, clockMs) {
  const audio = useRef(null)
  const lastWarning = useRef(null)
  const soundedEvents = useRef(null)
  const lowClock = clockMs != null && clockMs > 0 && clockMs <= 10000
  useEffect(() => () => { audio.current?.close().catch(() => {}) }, [])
  useEffect(() => {
    if (!enabled) return
    const events = soundedEvents.current === state.events ? [] : state.events.map((e) => e.type === 'GAME' ? e.event : e)
    soundedEvents.current = state.events
    const warning = lowClock && lastWarning.current !== state.room
    if (!events.length && !warning) return
    if (warning) lastWarning.current = state.room
    const Audio = window.AudioContext || window.webkitAudioContext
    if (!Audio) return
    try {
      const ctx = audio.current || new Audio()
      audio.current = ctx
      ctx.resume().catch(() => {})
      const tone = ctx.createOscillator(), gain = ctx.createGain()
      tone.frequency.value = warning ? 800 : events.some((e) => e?.type === 'FINISHED') ? 660 : events.some((e) => e?.type === 'CHECK') ? 720 : events.some((e) => e?.type === 'CAPTURED') ? 260 : 430
      gain.gain.setValueAtTime(0.035, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13)
      tone.connect(gain).connect(ctx.destination); tone.start(); tone.stop(ctx.currentTime + 0.15)
      tone.onended = () => { tone.disconnect(); gain.disconnect() }
    } catch { /* Audio availability does not affect the game. */ }
  }, [enabled, state.events, state.room, lowClock])
}

export default function OnlineRoom({ state, client, catalog, account, sound, onSound, onExit, onNewGame }) {
  const now = useNow()
  const { snapshot } = state
  const view = snapshot?.view
  const [selection, setSelection] = useState(null)
  const [promotion, setPromotion] = useState(null)
  const [ability, setAbility] = useState(null)
  const [confirmResign, setConfirmResign] = useState(false)
  const [dismissedResult, setDismissedResult] = useState(false)
  const historyEnd = useRef(null)
  useEffect(() => {
    const list = historyEnd.current?.parentElement
    if (list) list.scrollTop = list.scrollHeight
  }, [state.history.length])
  useEffect(() => {
    const cancel = (e) => { if (e.key === 'Escape') { setAbility(null); setSelection(null) } }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [])
  useGameSound(state, sound, view ? clockRemaining(snapshot, view.you, state.receivedAt, now) : null)
  if (!view) return <section className={styles.loadingRoom}><LoaderCircle className={styles.spinner} size={30} /><h1>Đang chuẩn bị bàn cờ…</h1><p>Ván đấu sẽ xuất hiện khi kết nối được đồng bộ.</p><button className={styles.secondaryButton} type="button" disabled={state.status !== 'ready'} onClick={() => client.send({ type: 'SYNC' })}><RefreshCw size={16} /> Đồng bộ</button></section>
  const disabled = state.status !== 'ready' || Boolean(state.pending)
  const selectedId = selection?.view === view ? selection.id : null
  const abilityMode = ability === view
  const opponent = view.you === 'WHITE' ? 'BLACK' : 'WHITE'
  const pendingPiece = pendingPromotionPiece(view)
  const queuedPromotion = promotion?.view === view ? promotion.move : null
  const result = view.result
  const status = result ? result.winner == null ? 'Hoà cờ' : result.winner === view.you ? 'Bạn đã thắng!' : 'Bạn đã thua' : view.phase === 'CHARACTER_SELECT' ? 'Chọn nhân vật' : view.phase === 'CARD_PICK' ? 'Chọn thẻ bài' : view.turn === view.you ? 'Đến lượt bạn' : 'Đang chờ đối thủ'
  const decideMs = snapshot.decide_in_ms == null ? null : Math.max(0, snapshot.decide_in_ms - (now - state.receivedAt))
  const banner = now - state.receivedAt < 3500 ? eventMessage(state.events) : null
  function send(message) { if (!disabled) return client.send(message); return false }
  function move(moveEntry, promotionKind) {
    if (!view.legal_moves?.includes(moveEntry)) return
    if (moveNeedsPromotion(view, moveEntry) && !promotionKind) { setPromotion({ view, move: moveEntry }); return }
    if (send({ type: 'GAME', action: { type: 'MOVE', piece: moveEntry.piece, to: moveEntry.to, ...(promotionKind ? { promotion: promotionKind } : {}) } })) { setSelection(null); setPromotion(null) }
  }
  function choosePromotion(kind) {
    if (queuedPromotion) move(queuedPromotion, kind)
    else if (pendingPiece) send({ type: 'GAME', action: { type: 'PROMOTE', kind } })
  }
  return <div className={styles.room}>
    <div className={styles.roomHeading}><div><span className={styles.eyebrow}>{modeName(view.mode)}{view.ext ? ` · ${view.ext.season}` : ''}</span><h1>Mỗi nước đi đều đáng giá.</h1></div><div className={styles.roomTools}><button type="button" className={styles.iconButton} aria-label={sound ? 'Tắt âm thanh' : 'Bật âm thanh'} aria-pressed={sound} onClick={onSound}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button><button type="button" className={styles.secondaryButton} disabled={disabled} onClick={() => client.send({ type: 'SYNC' })}><RefreshCw size={15} /> Đồng bộ</button></div></div>
    {state.opponentDeadline && !result && <div className={styles.notice} role="status">Đối thủ mất kết nối, xử thua sau {countdown(state.opponentDeadline - now)}.</div>}
    <div className={styles.roomLayout}><section className={styles.playArea} aria-label="Ván cờ">
      {view.ext && <RoundTrack ext={view.ext} />}
      <Player side={opponent} {...{ view, snapshot, state, now, account, disabled }} />
      <div className={styles.boardFrame}>
        <ServerBoard view={view} selectedId={selectedId} onSelect={(id) => setSelection({ id, view })} onMove={move} lastMove={state.lastMove} abilityMode={abilityMode} onAbilityTarget={(target) => { if (send({ type: 'USE_ABILITY', target })) setAbility(null) }} events={state.events} blocked={disabled || Boolean(queuedPromotion) || Boolean(pendingPiece)} />
        {banner && <div className={styles.eventBanner} data-coin={banner.coin} role="status">{banner.coin && <span>✦</span>}{banner.text}</div>}
        <DecisionOverlay view={view} seasons={catalog.seasons} decideMs={decideMs} onSend={send} disabled={disabled} />
      </div>
      <Player side={view.you} {...{ view, snapshot, state, now, account, disabled, abilityMode }} onAbility={() => { setAbility(abilityMode ? null : view); setSelection(null) }} />
      <p className={styles.boardHint}>{abilityMode ? 'Chọn ô mục tiêu được tô sáng · Esc để huỷ' : 'Bấm quân rồi bấm ô đến, hoặc kéo thả · Phím mũi tên và Enter'}</p>
    </section><aside className={styles.matchSidebar}>
      <section className={styles.matchStatus} role="status"><span>{result ? <Trophy size={22} /> : <Swords size={22} />}</span><div><small>{result ? 'KẾT QUẢ VÁN ĐẤU' : 'TRÊN BÀN CỜ'}</small><h2>{status}</h2><p>{result ? REASONS[result.reason] || result.reason : view.in_check ? `Vua ${SIDE_NAMES[view.turn]} đang bị chiếu` : snapshot.clock ? '10 phút + 5 giây mỗi nước' : 'Luyện tập · Không đồng hồ'}</p></div></section>
      <section className={styles.historyPanel}><header><h2><History size={17} /> Nước đi</h2><span>{view.ply} lượt</span></header><div className={styles.moveList} aria-live="polite">{state.history.length ? <table><thead><tr><th>Lượt</th><th>Trắng</th><th>Đen</th></tr></thead><tbody>{state.history.reduce((rows, entry) => { const n = Math.floor((entry.ply - 1) / 2); let row = rows.at(-1); if (!row || row.n !== n || row[entry.side]) { row = { n, key: entry.id }; rows.push(row) } row[entry.side] = entry; return rows }, []).map((row) => <tr key={row.key}><th>{row.n + 1}.</th>{['WHITE', 'BLACK'].map((side) => { const e = row[side]; return <td key={side}>{e && <><PieceArt type={e.kind} side={e.side} /><span>{squareName(e.from, view.rows)}{e.capture ? '×' : ' → '}{squareName(e.to, view.rows)}{e.castle ? ' · Nhập thành' : ''}{e.promotion ? ` = ${PIECE_NAMES[e.promotion] || e.promotion}` : ''}</span></>}</td> })}</tr>)}</tbody></table> : <div className={styles.emptyHistory}><History size={25} /><p>{view.ply ? 'Lịch sử bắt đầu từ khi bạn kết nối lại.' : 'Những nước đi đầu tiên đang chờ bạn.'}</p></div>}<div ref={historyEnd} /></div></section>
      {view.draw_offer && view.draw_offer !== view.you && !result && <section className={styles.drawOffer}><Handshake size={22} /><h3>Đối thủ đề nghị hoà</h3><p>Bạn có muốn kết thúc ván với kết quả hoà?</p><div className={styles.buttonRow}><button type="button" className={styles.primaryButton} disabled={disabled} onClick={() => send({ type: 'ACCEPT_DRAW' })}><Check size={16} /> Đồng ý</button><button type="button" className={styles.secondaryButton} disabled={disabled} onClick={() => send({ type: 'DECLINE_DRAW' })}>Từ chối</button></div></section>}
      {!result && <div className={styles.matchActions}>{view.mode !== 'PRACTICE' && <button type="button" className={styles.secondaryButton} disabled={disabled || view.draw_offer === view.you} onClick={() => send({ type: 'OFFER_DRAW' })}><Handshake size={17} />{view.draw_offer === view.you ? 'Đã đề nghị hoà' : 'Xin hoà'}</button>}<button type="button" className={styles.dangerButton} disabled={disabled} onClick={() => setConfirmResign(true)}><Flag size={17} /> Đầu hàng</button></div>}
      {state.pending && <p className={styles.boardHint} role="status"><LoaderCircle className={styles.spinner} size={14} /> Đang chờ xác nhận…</p>}
      {result && <div className={styles.matchActions}><button type="button" className={styles.primaryButton} disabled={state.status !== 'ready'} onClick={onNewGame}><Swords size={17} /> Tìm trận mới</button><button type="button" className={styles.secondaryButton} onClick={onExit}><ArrowLeft size={17} /> Về sảnh</button></div>}
    </aside></div>
    {(pendingPiece || queuedPromotion) && <Modal title="Phong cấp tốt" onClose={queuedPromotion ? () => setPromotion(null) : undefined}><p>Chọn quân bạn muốn đổi thành.</p><div className={styles.promotionChoices}>{['QUEEN', 'ROOK', 'BISHOP', 'KNIGHT'].map((kind) => <button type="button" key={kind} disabled={disabled} onClick={() => choosePromotion(kind)}><PieceArt type={kind} side={view.you} />{PIECE_NAMES[kind]}</button>)}</div></Modal>}
    {confirmResign && !result && <Modal title="Bạn muốn đầu hàng?" onClose={() => setConfirmResign(false)}><p>Đối thủ sẽ được ghi nhận thắng ván này.</p><div className={styles.buttonRow}><button type="button" className={styles.secondaryButton} onClick={() => setConfirmResign(false)}>Tiếp tục chơi</button><button type="button" className={styles.dangerButton} disabled={disabled} onClick={() => { send({ type: 'RESIGN' }); setConfirmResign(false) }}>Xác nhận đầu hàng</button></div></Modal>}
    {result && !dismissedResult && <Modal title={status} onClose={() => setDismissedResult(true)}><div className={styles.resultHero}><Trophy size={42} /><h3>{REASONS[result.reason] || result.reason}</h3><p>{view.ply} lượt đi · {modeName(view.mode)}</p></div><div className={styles.buttonRow}><button type="button" className={styles.secondaryButton} onClick={onExit}>Về sảnh</button><button type="button" className={styles.primaryButton} disabled={state.status !== 'ready'} onClick={onNewGame}><Swords size={17} /> Tìm trận mới</button></div></Modal>}
  </div>
}

export function OnlineQueue({ state, onCancel }) {
  const now = useNow()
  const queue = state.queue
  return <section className={styles.queue}><span className={styles.queueIcon}><SearchMark /></span><span className={styles.eyebrow}>MỘT ĐỐI THỦ MỚI ĐANG ĐỢI</span><h1>Đang tìm đối thủ…</h1><p>Giữ kết nối. Ván cờ sẽ bắt đầu ngay khi tìm thấy người chơi.</p><div className={styles.queueMeta}><span>{modeName(queue?.mode)}{queue?.season ? ` · ${queue.season}` : ''}</span><strong>{countdown(now - (queue?.since || now))}</strong><span>10 phút + 5 giây</span></div><button type="button" className={styles.secondaryButton} disabled={state.status !== 'ready' || Boolean(state.pending)} onClick={onCancel}>Huỷ tìm trận</button></section>
}

function SearchMark() { return <Swords size={34} /> }



