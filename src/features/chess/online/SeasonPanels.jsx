import { useEffect, useRef, useState } from 'react'
import { Check, Circle, Coins, Crown, Layers3, LoaderCircle, Mountain, RefreshCw, Repeat2, ShieldCheck, Snowflake, Sparkles, Timer, X, Zap } from 'lucide-react'
import { CARDS, CHARACTERS, EFFECTS, SIDE_NAMES, WEATHER, describeCode } from './labels.js'
import styles from './SeasonPanels.module.css'

const TIERS = { BRONZE: 'Đồng', SILVER: 'Bạc', GOLD: 'Vàng' }
const codeOf = (entry) => typeof entry === 'string' ? entry : entry?.id ?? entry?.code ?? entry?.character ?? entry?.card ?? ''
const seasonId = (season) => season?.id ?? season?.season ?? season?.code
const asArray = (value) => Array.isArray(value) ? value : []
const metadata = (dictionary, entry) => {
  const code = codeOf(entry)
  return { code, name: dictionary[code]?.name ?? code, ...(dictionary[code] || {}) }
}

function SymbolArt({ icon, className, size = 24 }) {
  const Icon = { mountain: Mountain, snowflake: Snowflake, shield: ShieldCheck, timer: Timer, king: Crown }[icon] ?? Sparkles
  if (icon === 'pawn' || icon === 'rook' || icon === 'knight') return <span className={[styles.chessSymbol, className].filter(Boolean).join(' ')} aria-hidden="true">{{ pawn: '♟', rook: '♜', knight: '♞' }[icon]}</span>
  return <Icon className={className} size={size} aria-hidden="true" />
}

function CharacterCard({ entry, onPick, disabled = false, compact = false }) {
  const character = metadata(CHARACTERS, entry)
  return <article className={styles.characterCard} data-compact={compact}>
    <div className={styles.characterPortrait} data-code={character.code}><SymbolArt icon={character.icon} size={44} /><span className={styles.portraitRing} aria-hidden="true" /></div>
    <div className={styles.characterContent}>
      <h3>{character.name}</h3>
      {character.description && <p>{character.description}</p>}
      <dl className={styles.abilities}>
        <div><dt>Bị động</dt><dd>{character.passive || character.code}</dd></div>
        <div><dt>Chủ động</dt><dd>{character.active || character.code}</dd></div>
      </dl>
      {character.cooldown != null && <span className={styles.cooldown}><RefreshCw size={12} /> Hồi sau {character.cooldown} vòng · Không tốn nước đi</span>}
      {onPick && <button type="button" className={styles.primaryButton} disabled={disabled} onClick={() => onPick(character.code)}>Chọn {character.name}</button>}
    </div>
  </article>
}

function CardChoice({ entry, tier, onPick, disabled = false }) {
  const card = metadata(CARDS, entry)
  const cardTier = tier ?? entry?.tier ?? card.tier
  return <article className={styles.cardChoice} data-tier={cardTier}>
    <span className={styles.tier}>{TIERS[cardTier] || cardTier || 'Thẻ bài'}</span>
    <span className={styles.cardSigil}><SymbolArt icon={card.icon} size={34} /></span>
    <h3>{card.name}</h3>
    <p>{card.description || card.code}</p>
    {onPick && <button type="button" className={styles.primaryButton} disabled={disabled} onClick={onPick}>Chọn thẻ này</button>}
  </article>
}

function TrackIcon({ slot, size = 17 }) {
  const type = typeof slot === 'string' ? slot : slot?.type
  const Icon = { COIN_FLIP: Coins, CARD_PICK: Layers3, EXTREME_WEATHER: Zap, NORMAL: Circle }[type] ?? Sparkles
  return <Icon size={size} aria-hidden="true" />
}

function trackName(slot) {
  const type = typeof slot === 'string' ? slot : slot?.type
  return { COIN_FLIP: 'Tung đồng xu', CARD_PICK: `Chọn thẻ ${TIERS[slot?.tier] || slot?.tier || ''}`.trim(), EXTREME_WEATHER: 'Thời tiết cực đoan', NORMAL: 'Vòng thường' }[type] || type
}

export function RoundTrack({ ext }) {
  const currentRef = useRef(null)
  useEffect(() => {
    const active = currentRef.current, track = active?.parentElement
    if (track) track.scrollTo?.({ left: active.offsetLeft - track.offsetLeft - (track.clientWidth - active.clientWidth) / 2, behavior: 'smooth' })
  }, [ext?.track_pos])
  if (!ext) return null
  const matchEffects = asArray(ext.effects).filter((effect) => effect.target?.on === 'MATCH' && effect.effect !== 'skid')
  return <section className={styles.roundTrack} aria-label="Thanh vòng đấu">
    <div className={styles.roundHeading}><strong>Vòng {ext.round}</strong><span>{SIDE_NAMES[ext.first] || ext.first || '—'} đi trước</span><small>{ext.season}</small></div>
    <ol className={styles.trackList}>
      {asArray(ext.track).map((slot, index) => <li key={index} ref={index === ext.track_pos ? currentRef : undefined} className={styles.trackSlot} data-active={index === ext.track_pos} data-tier={slot?.tier} aria-current={index === ext.track_pos ? 'step' : undefined} title={`${index + 1}. ${trackName(slot)}${index === ext.track_loops_from ? ' · Bắt đầu đoạn lặp' : ''}`}>
        {index === ext.track_loops_from && <Repeat2 size={10} className={styles.loopMark} aria-label="Bắt đầu đoạn lặp" />}
        <TrackIcon slot={slot} /><span className={styles.slotNumber}>{index + 1}</span><span className={styles.srOnly}>{trackName(slot)}</span>
      </li>)}
    </ol>
    {matchEffects.length > 0 && <div className={styles.matchEffects} aria-label="Hiệu ứng đang có hiệu lực">{matchEffects.map((effect) => {
      const info = WEATHER[effect.effect] || CARDS[effect.effect] || CHARACTERS[effect.effect] || EFFECTS[effect.effect]
      const duration = effect.expires == null ? 'cả ván' : `còn ${Math.max(0, effect.expires - ext.round)} vòng`
      return <details key={effect.uid} className={styles.effectDetails}><summary title={`${describeCode(effect.effect)} · ${duration}`}><SymbolArt icon={info?.icon} size={13} /><span>{describeCode(effect.effect)} · {duration}</span></summary><p>{info?.description || effect.effect}</p></details>
    })}</div>}
  </section>
}

export function ExtendedPlayer({ player, view, onAbility, abilityMode = false, disabled = false }) {
  if (!player) return null
  const character = metadata(CHARACTERS, player.character)
  const isYou = player.side === view.you
  const remaining = Math.max(0, (player.ability_ready_at ?? 0) - (view.ext?.round ?? 0))
  const canUse = Boolean(player.character) && isYou && view.phase === 'PLAYING' && view.turn === view.you && remaining === 0 && !disabled
  return <div className={styles.extendedPlayer}>
    <details className={styles.characterDetails}>
      <summary><span className={styles.miniPortrait} data-code={character.code}><SymbolArt icon={character.icon} size={18} /></span><strong>{player.character ? character.name : 'Chưa lộ nhân vật'}</strong></summary>
      {player.character && <div className={styles.characterTooltip}><p><strong>Bị động:</strong> {character.passive || character.code}</p><p><strong>Chủ động:</strong> {character.active || character.code}</p>{character.cooldown != null && <small>Hồi chiêu {character.cooldown} vòng. Không tốn nước đi.</small>}</div>}
    </details>
    {isYou && player.character && <button type="button" className={styles.abilityButton} data-active={abilityMode} aria-pressed={abilityMode} disabled={!canUse} onClick={onAbility} title={character.active || character.code}><Zap size={14} /><span>{abilityMode ? 'Huỷ chọn ô' : remaining ? `Còn ${remaining} vòng` : 'Kỹ năng'}</span></button>}
    {asArray(player.cards).length > 0 && <div className={styles.ownedCards} aria-label={`Thẻ bài của ${isYou ? 'bạn' : 'đối thủ'}`}>
      {player.cards.map((entry, index) => { const card = metadata(CARDS, entry); return <details className={styles.ownedCard} key={`${card.code}-${index}`} data-tier={entry?.tier ?? card.tier}><summary title={`${card.name}: ${card.description || card.code}`} aria-label={card.name}><SymbolArt icon={card.icon} size={17} /></summary><p><strong>{card.name}</strong>{card.description || card.code}</p></details> })}
    </div>}
  </div>
}

export function DecisionOverlay({ view, seasons, decideMs, onSend, disabled = false }) {
  if (!['CHARACTER_SELECT', 'CARD_PICK'].includes(view?.phase)) return null
  const isCharacter = view.phase === 'CHARACTER_SELECT'
  const self = asArray(view.ext?.players).find((player) => player.side === view.you)
  const opponent = asArray(view.ext?.players).find((player) => player.side !== view.you)
  const season = asArray(seasons).find((item) => seasonId(item) === view.ext?.season)
  const waiting = self?.deciding === false || (isCharacter ? Boolean(self?.character) : self?.chosen != null)
  const timedOut = decideMs != null && decideMs <= 0
  const seconds = decideMs == null ? null : Math.ceil(Math.max(0, decideMs) / 1000)
  const choices = isCharacter ? asArray(season?.characters) : asArray(self?.offer?.cards)
  const chosenCard = typeof self?.chosen === 'number' ? self?.offer?.cards?.[self.chosen] : self?.chosen
  const chosenCode = codeOf(isCharacter ? self?.character : chosenCard)
  const unavailable = disabled || timedOut || waiting || !self
  return <div className={styles.decisionOverlay}>
    <section className={styles.decisionPanel} aria-labelledby="decision-title" aria-describedby="decision-description">
      <header className={styles.decisionHeader}><span className={styles.decisionEyebrow}><Sparkles size={14} /> {view.ext?.season} · Vòng {view.ext?.round ?? 0}</span><span className={styles.decisionTimer} data-low={seconds != null && seconds <= 5}><Timer size={15} />{seconds == null ? '—' : `${seconds}s`}</span></header>
      <h2 id="decision-title">{isCharacter ? 'Chọn người dẫn lối.' : 'Một lá bài. Một lợi thế mới.'}</h2>
      <p id="decision-description">{isCharacter ? 'Mỗi nhân vật có một bị động và kỹ năng riêng. Bạn sẽ giữ nhân vật này suốt ván.' : `Chọn một lá ${TIERS[self?.offer?.tier] || self?.offer?.tier || ''} để thay đổi thế trận.`}</p>
      {waiting ? <div className={styles.waitingChoice} role="status"><span className={styles.chosenCheck}><Check size={28} /></span><strong>{chosenCode ? `Đã chọn ${describeCode(chosenCode)}` : 'Bạn đã chọn xong'}</strong><p>Đang chờ đối thủ…</p><LoaderCircle className={styles.spinner} size={20} /></div> : <>
        <div className={isCharacter ? styles.characterChoices : styles.cardChoices}>
          {choices.map((entry, index) => isCharacter
            ? <CharacterCard entry={entry} key={codeOf(entry) || index} disabled={unavailable} onPick={(character) => onSend({ type: 'PICK_CHARACTER', character })} />
            : <CardChoice entry={entry} tier={self?.offer?.tier} key={`${codeOf(entry)}-${index}`} disabled={unavailable} onPick={() => onSend({ type: 'PICK_CARD', index })} />)}
        </div>
        {!choices.length && <p className={styles.loadingChoices} role="status"><LoaderCircle className={styles.spinner} size={18} /> Đang chờ lựa chọn từ máy chủ…</p>}
        {!isCharacter && self?.offer && <button type="button" className={styles.rerollButton} disabled={unavailable || self.offer.rerolls_left <= 0} onClick={() => onSend({ type: 'REROLL' })}><RefreshCw size={15} /> Đổi bài <span>{self.offer.rerolls_left} lần còn lại</span></button>}
      </>}
      <footer className={styles.decisionFooter} role="status">{disabled ? 'Đang kết nối lại với máy chủ…' : timedOut ? 'Hết thời gian. Đang chờ máy chủ chọn…' : opponent?.deciding === false ? <><Check size={14} /> Đối thủ đã chọn xong</> : 'Máy chủ sẽ chọn ngẫu nhiên khi hết thời gian.'}</footer>
    </section>
  </div>
}

export function SeasonGuide({ seasons, onClose }) {
  const dialogRef = useRef(null)
  const [selected, setSelected] = useState(() => seasonId(asArray(seasons).find((season) => season.current) ?? seasons?.[0]))
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal?.()
    return () => { if (dialog?.open) dialog.close() }
  }, [])
  const season = asArray(seasons).find((item) => seasonId(item) === selected) ?? asArray(seasons)[0]
  const cards = asArray(season?.cards)
  const tiers = [...new Set(cards.map((card) => card?.tier ?? CARDS[codeOf(card)]?.tier ?? 'OTHER'))]
  return <dialog ref={dialogRef} className={styles.guideDialog} aria-labelledby="season-guide-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <header className={styles.guideHeader}><div><p className={styles.decisionEyebrow}><Sparkles size={14} /> CỜ VUA MỞ RỘNG</p><h2 id="season-guide-title">Season này có gì?</h2></div><button type="button" className={styles.closeButton} aria-label="Đóng thông tin season" onClick={onClose}><X size={21} /></button></header>
    {asArray(seasons).length > 1 && <label className={styles.seasonSelect}>Season<select value={seasonId(season) ?? ''} onChange={(event) => setSelected(event.target.value)}>{seasons.map((item) => <option key={seasonId(item)} value={seasonId(item)}>{item.name || seasonId(item)}{item.current ? ' · Hiện tại' : ''}</option>)}</select></label>}
    {!season ? <p className={styles.loadingChoices}>Chưa tải được nội dung season. Hãy đóng và thử tải lại ở sảnh.</p> : <div className={styles.guideContent}>
      <div className={styles.seasonSummary}><span className={styles.seasonBadge}>{season.name || seasonId(season)}</span><p>Cờ vua quen thuộc, thêm nhân vật, thẻ bài và một bàn cờ luôn biến đổi.</p><span>{season.offer_size ?? '—'} lá mỗi lượt chọn · {season.rerolls ?? '—'} lần đổi · {season.decision_seconds ?? '—'} giây quyết định</span></div>
      <section className={styles.guideSection}><h3>Nhân vật</h3><p>Chủ động dùng trong lượt của bạn và không tốn nước đi.</p><div className={styles.characterChoices}>{asArray(season.characters).map((entry) => <CharacterCard key={codeOf(entry)} entry={entry} compact />)}</div></section>
      <section className={styles.guideSection}><h3>Thẻ bài</h3>{tiers.map((tier) => <div key={tier} className={styles.tierGroup}><h4 data-tier={tier}>{TIERS[tier] || tier}</h4><div className={styles.cardChoices}>{cards.filter((card) => (card?.tier ?? CARDS[codeOf(card)]?.tier ?? 'OTHER') === tier).map((entry) => <CardChoice key={codeOf(entry)} entry={entry} tier={tier} />)}</div></div>)}</section>
      <section className={styles.guideSection}><h3>Thời tiết cực đoan</h3><div className={styles.weatherList}>{asArray(season.extreme_weather).map((entry) => { const weather = metadata(WEATHER, entry); return <article key={weather.code} className={styles.weatherItem}><span><SymbolArt icon={weather.icon} size={23} /></span><div><h4>{weather.name}</h4><p>{weather.description || weather.code}</p></div></article> })}</div></section>
      <section className={styles.guideSection}><h3>Nhịp của season</h3><p>Các ô lần lượt diễn ra theo vòng. Sau ô cuối, thanh lượt quay về đoạn có biểu tượng lặp.</p><RoundTrack ext={{ ...season, season: seasonId(season), round: 0, track_pos: -1, first: null }} /></section>
    </div>}
  </dialog>
}
