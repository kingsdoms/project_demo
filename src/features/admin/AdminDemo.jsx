import { useEffect, useId, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, Bell, BookOpen, Check, CheckCheck, ChevronRight, CircleCheck, CircleHelp, ClipboardList, Clock3, Eye, FileText, Flag, History, Info, LockKeyhole, Search, Shield, ShieldCheck, Swords, Undo2, Users, X } from 'lucide-react'
import SelectMenu from '@/components/ui/SelectMenu'
import { DEFAULT_PERMISSIONS, DEMO_AUDIT, DEMO_MATCHES, DEMO_REPORTS, DEMO_USERS, PERMISSION_ROWS } from './demo-data'
import styles from './AdminDemo.module.css'

const number = (value) => new Intl.NumberFormat('vi-VN').format(value)
const date = (value) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'))
const fold = (value) => String(value).normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase().trim()
const copyPermissions = (value) => Object.fromEntries(Object.entries(value).map(([role, permissions]) => [role, { ...permissions }]))
const peopleWithStatus = (lockedUsers) => DEMO_USERS.map((user) => {
  const locked = lockedUsers[user.id] ?? (user.status === 'Đã khóa')
  return { ...user, locked, status: locked ? 'Đã khóa' : user.status === 'Đã khóa' ? 'Hoạt động' : user.status }
})
const reportsWithStatus = (resolvedReports) => DEMO_REPORTS.map((report) => ({ ...report, status: resolvedReports[report.id] ?? report.status }))

function Header({ eyebrow, title, description, actions }) {
  return <header className={styles.pageHeader}><div><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p className={styles.description}>{description}</p></div>{actions && <div className={styles.headerActions}>{actions}</div>}</header>
}

function Badge({ children, tone = 'neutral' }) {
  return <span className={styles.badge} data-tone={tone}>{children}</span>
}

function Status({ value }) {
  const tone = ['Hoạt động', 'Đã xử lý', 'Đã kết thúc'].includes(value) ? 'success' : ['Đã khóa', 'Đã báo cáo'].includes(value) ? 'danger' : 'warning'
  const Icon = tone === 'success' ? CircleCheck : tone === 'danger' ? LockKeyhole : Clock3
  return <Badge tone={tone}><Icon size={13} aria-hidden="true" />{value}</Badge>
}

function SearchInput({ label, placeholder, value, onChange }) {
  return <label className={styles.search}><Search size={17} aria-hidden="true" /><span className={styles.srOnly}>{label}</span><input type="search" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>
}

function Empty({ title = 'Không có kết quả phù hợp', text = 'Thử từ khóa khác hoặc xóa bộ lọc để xem lại dữ liệu mẫu.', onReset }) {
  return <div className={styles.empty}><Search size={24} aria-hidden="true" /><h2>{title}</h2><p>{text}</p>{onReset && <button className={styles.secondary} type="button" onClick={onReset}><Undo2 size={15} />Xóa bộ lọc</button>}</div>
}

function Pagination({ page, setPage, total, pageSize, onPageSize, label }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pages)
  return <footer className={styles.pagination}><span role="status">{total ? `${(current - 1) * pageSize + 1} đến ${Math.min(current * pageSize, total)}` : '0'} / {total} {label}</span><div>{onPageSize && <SelectMenu label="Số dòng mỗi trang" value={String(pageSize)} options={[{ value: '6', label: '6 dòng' }, { value: '12', label: '12 dòng' }]} onChange={(value) => onPageSize(Number(value))} />}<nav aria-label={`Phân trang ${label}`}><button type="button" aria-label="Trang trước" disabled={current <= 1} onClick={() => setPage(current - 1)}><ArrowLeft size={16} /></button><span>Trang {current}/{pages}</span><button type="button" aria-label="Trang tiếp" disabled={current >= pages} onClick={() => setPage(current + 1)}><ArrowRight size={16} /></button></nav></div></footer>
}

function Table({ caption, children }) {
  return <><p className={styles.scrollHint}><ArrowRight size={13} />Vuốt ngang để xem thêm cột</p><div className={styles.tableRegion} role="region" aria-label={caption} tabIndex={0}><table className={styles.table}><caption className={styles.srOnly}>{caption}</caption>{children}</table></div></>
}

function Dialog({ title, description, onClose, children }) {
  const ref = useRef(null)
  const id = useId()
  useEffect(() => {
    const element = ref.current
    element?.showModal()
    return () => { if (element?.open) element.close() }
  }, [])
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={id} onCancel={onClose}><header><div><p className={styles.eyebrow}>TÀI KHOẢN MẪU</p><h2 id={id}>{title}</h2></div><button className={styles.iconButton} type="button" onClick={onClose} aria-label="Đóng chi tiết"><X size={18} /></button></header><p className={styles.description}>{description}</p>{children}</dialog>
}

function Overview({ navigate, lockedUsers, resolvedReports, logs, onResolve, onReview }) {
  const people = peopleWithStatus(lockedUsers)
  const reports = reportsWithStatus(resolvedReports)
  const pending = reports.filter((report) => report.status !== 'Đã xử lý')
  const active = people.filter((person) => person.status === 'Hoạt động').length
  return <><Header eyebrow="KHÔNG GIAN VẬN HÀNH" title="Tổng quan quản trị" description="Bắt đầu từ những việc cần xem xét, rồi đi sâu vào từng hồ sơ." actions={<Badge><ShieldCheck size={14} />Dữ liệu mẫu</Badge>} />
    <section className={styles.overviewBand} aria-label="Tổng quan dữ liệu mẫu"><div className={styles.leadMetric}><div><span className={styles.eyebrow}>CẦN THEO DÕI</span><strong>{pending.length}</strong><h2>Báo cáo đang chờ bạn</h2><p>Kiểm tra bằng chứng và ngữ cảnh trước khi đưa ra quyết định.</p><button className={styles.primary} type="button" onClick={() => navigate('admin-reports')}>Mở hàng chờ <ArrowRight size={16} /></button></div><span className={styles.leadIcon}><ClipboardList size={42} strokeWidth={1.3} /></span></div><div className={styles.sideMetrics}><div><Users size={19} /><span><strong>{people.length}</strong><small>Tài khoản trong bộ mẫu</small></span><Badge tone="success">{active} hoạt động</Badge></div><div><Swords size={19} /><span><strong>{DEMO_MATCHES.length}</strong><small>Ván đấu để kiểm tra</small></span><Badge>{DEMO_MATCHES.filter((match) => match.status === 'Đang diễn ra').length} đang diễn ra</Badge></div></div></section>
    <div className={styles.overviewGrid}><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Hàng chờ xử lý</h2><p>Ưu tiên những trường hợp chưa có kết luận.</p></div><Badge>{pending.length} cần xem</Badge></div>{pending.length ? <div className={styles.queueList}>{pending.map((report) => <article className={styles.queueItem} key={report.id}><span className={styles.queueIcon}><Flag size={18} /></span><div><div className={styles.meta}>{report.type} · {report.time}</div><h3>{report.title}</h3><p>{report.about} <span>· {report.id}</span></p></div><button className={styles.iconButton} type="button" aria-label={`Xem báo cáo ${report.id}`} onClick={() => onResolve(report)}><ChevronRight size={18} /></button></article>)}</div> : <Empty title="Đã xem hết hàng chờ mẫu" text="Các báo cáo đã xử lý có thể xem lại trong mục Báo cáo." onReset={() => navigate('admin-reports')} />}</section>
    <aside className={styles.panel}><div className={styles.panelHeader}><div><h2>Việc vừa thực hiện</h2><p>Thao tác trong phiên demo hiện tại.</p></div><History size={18} /></div>{logs.length ? <ol className={styles.activity}>{logs.slice(0, 4).map((log) => <li key={log.id}><span className={styles.activityMark}><Check size={14} /></span><div><strong>{log.action}</strong><p>{log.target} · {log.time}</p></div></li>)}</ol> : <div className={styles.quietEmpty}><History size={24} /><strong>Chưa có thao tác mới</strong><p>Khóa tài khoản mẫu, xử lý báo cáo hoặc lưu phân quyền để thấy nhật ký tại đây.</p></div>}<button className={styles.panelLink} type="button" onClick={() => navigate('admin-audit')}>Xem toàn bộ nhật ký <ArrowRight size={15} /></button></aside></div>
    <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Trận đấu gần đây</h2><p>Mở bản xem lại mẫu để thử luồng kiểm duyệt.</p></div><button className={styles.secondary} type="button" onClick={() => navigate('admin-matches')}>Tất cả trận <ArrowRight size={15} /></button></div><div className={styles.matchPreview}>{DEMO_MATCHES.slice(0, 3).map((match) => <div className={styles.matchPreviewRow} key={match.id}><span className={styles.matchIcon}><Swords size={17} /></span><div><strong>{match.white}<span className={styles.vs}>với</span>{match.black}</strong><small>{match.id} · {match.mode} · {match.clock}</small></div><Status value={match.status} /><button className={styles.textButton} type="button" onClick={() => onReview(match)} aria-label={`Xem ván mẫu ${match.id}`}><Eye size={15} />Xem mẫu</button></div>)}</div></section>
  </>
}

function SortIcon({ field, sort }) { return sort.key !== field ? <ArrowUpDown size={13} /> : sort.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} /> }

function UsersPage({ lockedUsers, onLock }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Tất cả trạng thái')
  const [sort, setSort] = useState({ key: 'joined', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(6)
  const [detailId, setDetailId] = useState(null)
  const people = peopleWithStatus(lockedUsers)
  const filtered = people.filter((person) => fold(`${person.name} ${person.email} ${person.id}`).includes(fold(query)) && (status === 'Tất cả trạng thái' || person.status === status)).sort((a, b) => {
    const difference = sort.key === 'rating' ? a.rating - b.rating : String(a[sort.key]).localeCompare(String(b[sort.key]), 'vi')
    return sort.direction === 'asc' ? difference : -difference
  })
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize)
  const detail = people.find((person) => person.id === detailId)
  const reset = () => { setQuery(''); setStatus('Tất cả trạng thái'); setPage(1) }
  function sortBy(key) { setSort((previous) => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' })); setPage(1) }
  const sorting = (key) => sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'

  return <><Header eyebrow="QUẢN LÝ TÀI KHOẢN" title="Người dùng" description="Tìm đúng tài khoản, kiểm tra hồ sơ và xem trạng thái trước khi xử lý." /><div className={styles.inlineStats}><span><strong>{people.length}</strong> tài khoản mẫu</span><span><strong>{people.filter((person) => person.status === 'Đang xem xét').length}</strong> đang xem xét</span><span><strong>{people.filter((person) => person.locked).length}</strong> đã khóa</span></div>
    <section className={styles.panel}><div className={styles.toolbar}><SearchInput label="Tìm người dùng" placeholder="Tên, email hoặc mã tài khoản" value={query} onChange={(value) => { setQuery(value); setPage(1) }} /><SelectMenu label="Trạng thái tài khoản" value={status} onChange={(value) => { setStatus(value); setPage(1) }} options={['Tất cả trạng thái', 'Hoạt động', 'Đang xem xét', 'Đã khóa']} /><button className={styles.secondary} type="button" onClick={reset} disabled={!query && status === 'Tất cả trạng thái'}><Undo2 size={15} />Xóa lọc</button></div>
      <Table caption="Danh sách tài khoản mẫu, có thể sắp xếp theo tên, điểm hoặc ngày tham gia"><thead><tr><th scope="col" aria-sort={sorting('name')}><button type="button" onClick={() => sortBy('name')}>Người dùng <SortIcon sort={sort} field="name" /></button></th><th scope="col">Trạng thái</th><th scope="col" aria-sort={sorting('rating')}><button type="button" onClick={() => sortBy('rating')}>Blitz mẫu <SortIcon sort={sort} field="rating" /></button></th><th scope="col" aria-sort={sorting('joined')}><button type="button" onClick={() => sortBy('joined')}>Tham gia <SortIcon sort={sort} field="joined" /></button></th><th scope="col">Thao tác</th></tr></thead><tbody>{rows.map((person) => <tr key={person.id}><th scope="row"><div className={styles.person}><span className={styles.avatar}>{person.name[0].toUpperCase()}</span><span><button className={styles.personName} type="button" onClick={() => setDetailId(person.id)}>{person.name}</button><small>{person.email}</small><span className={styles.id}>{person.id}</span></span></div></th><td><Status value={person.status} /></td><td className={styles.numeric}>{number(person.rating)}</td><td>{date(person.joined)}</td><td><div className={styles.rowActions}><button className={styles.textButton} type="button" onClick={() => setDetailId(person.id)} aria-label={`Chi tiết ${person.name}`}><Eye size={15} />Chi tiết</button><button className={person.locked ? styles.textButton : styles.danger} type="button" onClick={() => onLock(person)} aria-label={`${person.locked ? 'Mở khóa' : 'Khóa'} ${person.name}`}><LockKeyhole size={14} />{person.locked ? 'Mở khóa' : 'Khóa'}</button></div></td></tr>)}</tbody></Table>{!rows.length && <Empty onReset={reset} />}<Pagination page={current} setPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(value) => { setPageSize(value); setPage(1) }} label="tài khoản mẫu" /></section>
    {detail && <Dialog title={detail.name} description="Hồ sơ từ bộ dữ liệu mô phỏng, không phải tài khoản trên máy chủ." onClose={() => setDetailId(null)}><div className={styles.detailIdentity}><span className={styles.detailAvatar}>{detail.name[0].toUpperCase()}</span><div><strong>{detail.name}</strong><p>{detail.role}</p><Status value={detail.status} /></div></div><dl className={styles.details}><dt>Mã tài khoản</dt><dd>{detail.id}</dd><dt>Email mẫu</dt><dd>{detail.email}</dd><dt>Điểm Blitz mẫu</dt><dd>{number(detail.rating)}</dd><dt>Ngày tham gia</dt><dd>{date(detail.joined)}</dd></dl><div className={styles.dialogActions}><button className={styles.secondary} type="button" onClick={() => setDetailId(null)}>Đóng</button><button className={detail.locked ? styles.secondary : styles.danger} type="button" onClick={() => { setDetailId(null); onLock(detail) }}><LockKeyhole size={15} />{detail.locked ? 'Mở khóa demo' : 'Khóa demo'}</button></div></Dialog>}
  </>
}

function MatchesPage({ onReview }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Tất cả trạng thái')
  const [mode, setMode] = useState('Mọi chế độ')
  const [page, setPage] = useState(1)
  const reset = () => { setQuery(''); setStatus('Tất cả trạng thái'); setMode('Mọi chế độ'); setPage(1) }
  const filtered = DEMO_MATCHES.filter((match) => fold(`${match.id} ${match.white} ${match.black}`).includes(fold(query)) && (status === 'Tất cả trạng thái' || match.status === status) && (mode === 'Mọi chế độ' || match.mode === mode))
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / 6)))
  return <><Header eyebrow="KIỂM TRA TRẬN ĐẤU" title="Trận đấu" description="Tra cứu theo người chơi, trạng thái hoặc chế độ. Bản xem lại hiện dùng ván mẫu." /><div className={styles.inlineStats}><span><strong>{DEMO_MATCHES.length}</strong> ván mẫu</span><span><strong>{DEMO_MATCHES.filter((match) => match.status === 'Đang diễn ra').length}</strong> đang diễn ra</span><span><strong>{DEMO_MATCHES.filter((match) => match.status === 'Đã báo cáo').length}</strong> có báo cáo</span></div><section className={styles.panel}><div className={styles.toolbar}><SearchInput label="Tìm trận đấu" placeholder="Mã trận hoặc người chơi" value={query} onChange={(value) => { setQuery(value); setPage(1) }} /><SelectMenu label="Trạng thái trận đấu" value={status} options={['Tất cả trạng thái', 'Đang diễn ra', 'Đã kết thúc', 'Đã báo cáo']} onChange={(value) => { setStatus(value); setPage(1) }} /><SelectMenu label="Chế độ trận đấu" value={mode} options={['Mọi chế độ', 'Bullet', 'Blitz', 'Rapid']} onChange={(value) => { setMode(value); setPage(1) }} /></div><Table caption="Các trận đấu trong dữ liệu mẫu"><thead><tr><th scope="col">Ván đấu</th><th scope="col">Người chơi</th><th scope="col">Trạng thái</th><th scope="col">Chế độ</th><th scope="col">Đã chơi</th><th scope="col">Thao tác</th></tr></thead><tbody>{filtered.slice((current - 1) * 6, current * 6).map((match) => <tr key={match.id}><th scope="row" className={styles.mono}>{match.id}</th><td><span className={styles.playerPair}><strong>{match.white}</strong><small>với {match.black}</small></span></td><td><Status value={match.status} /></td><td>{match.mode}<small className={styles.cellSmall}>{match.clock}</small></td><td className={styles.numeric}>{match.elapsed}</td><td><button className={styles.textButton} type="button" onClick={() => onReview(match)} aria-label={`Xem lại ván mẫu cho ${match.id}`}><Eye size={15} />Xem mẫu</button></td></tr>)}</tbody></Table>{!filtered.length && <Empty onReset={reset} />}<Pagination page={current} setPage={setPage} total={filtered.length} pageSize={6} label="ván mẫu" /></section></>
}

function ReportsPage({ resolvedReports, onResolve }) {
  const [filter, setFilter] = useState('Chờ xử lý')
  const [query, setQuery] = useState('')
  const reports = reportsWithStatus(resolvedReports)
  const filtered = reports.filter((report) => (filter === 'Tất cả' || report.status === filter) && fold(`${report.id} ${report.title} ${report.from} ${report.about}`).includes(fold(query)))
  return <><Header eyebrow="AN TOÀN CỘNG ĐỒNG" title="Báo cáo" description="Xem ngữ cảnh, kiểm tra bằng chứng và lưu lý do xử lý trong phiên demo." /><div className={styles.reportSummary}><ShieldCheck size={22} /><div><strong>{reports.filter((report) => report.status !== 'Đã xử lý').length} báo cáo chưa kết thúc</strong><p>Dấu hiệu nghi vấn là điểm bắt đầu kiểm tra, không phải kết luận vi phạm.</p></div></div><div className={styles.reportToolbar}><div className={styles.tabs} role="group" aria-label="Lọc báo cáo">{['Chờ xử lý', 'Đang xem xét', 'Đã xử lý', 'Tất cả'].map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}<span>{value === 'Tất cả' ? reports.length : reports.filter((report) => report.status === value).length}</span></button>)}</div><SearchInput label="Tìm báo cáo" placeholder="Tìm mã, nội dung hoặc người chơi" value={query} onChange={setQuery} /></div><section className={styles.reportList} aria-label="Danh sách báo cáo mẫu">{filtered.map((report) => <article className={styles.report} key={report.id}><div className={styles.reportMain}><div className={styles.meta}><span><Flag size={13} />{report.type}</span><span className={styles.mono}>{report.id}</span><span>{report.time}</span></div><h2>{report.title}</h2><p><strong>{report.from}</strong> gửi báo cáo về <strong>{report.about}</strong></p><details className={styles.evidence}><summary><FileText size={14} />Xem ngữ cảnh minh họa</summary><p>{report.type === 'Gian lận' ? 'Nhịp đi quân gần giống nhau ở một số lượt. Cần đối chiếu toàn bộ ván và lịch sử trước khi kết luận.' : report.type === 'Hành vi' ? 'Có phản ánh về nội dung chat. Cần đọc đầy đủ ngữ cảnh và đối chiếu quy tắc cộng đồng.' : 'Có phản ánh gián đoạn kết nối trong ván. Cần kiểm tra thời điểm và log kết nối thực tế.'} Đây là bằng chứng mẫu.</p></details></div><div className={styles.reportActions}><Status value={report.status} /><button className={styles.secondary} type="button" onClick={() => onResolve(report)}>{report.status === 'Đã xử lý' ? 'Mở lại báo cáo' : 'Cập nhật báo cáo'}<ChevronRight size={15} /></button></div></article>)}{!filtered.length && <div className={styles.panel}><Empty title="Không có báo cáo phù hợp" onReset={() => { setFilter('Tất cả'); setQuery('') }} /></div>}</section></>
}

function ContentPage({ onPublish, notices, navigate }) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(false)
  const titleId = useId()
  const textId = useId()
  function submit(event) {
    event.preventDefault()
    const next = {}
    if (title.trim().length < 4) next.title = 'Nhập tiêu đề từ 4 ký tự.'
    if (text.trim().length < 10) next.text = 'Nội dung cần ít nhất 10 ký tự để người chơi hiểu thông báo.'
    setErrors(next)
    if (Object.keys(next).length) { document.getElementById(next.title ? titleId : textId)?.focus(); return }
    onPublish({ title: title.trim(), text: text.trim() })
    setTitle(''); setText(''); setSaved(true)
  }
  return <><Header eyebrow="GIAO TIẾP VỚI NGƯỜI CHƠI" title="Nội dung" description="Soạn thông báo rõ ràng, xem trước và lưu vào phiên trải nghiệm." /><div className={styles.editorGrid}><form className={styles.editor} onSubmit={submit} noValidate><div className={styles.panelHeader}><div><h2>Soạn thông báo</h2><p>Thông báo chỉ xuất hiện trong phiên demo.</p></div><Bell size={19} /></div><div className={styles.editorBody}><label className={styles.field} htmlFor={titleId}><span>Tiêu đề</span><input id={titleId} value={title} maxLength={120} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? titleId + '-error' : undefined} placeholder="Ví dụ: Lịch bảo trì cuối tuần" onChange={(event) => { setTitle(event.target.value); setSaved(false); setErrors((previous) => ({ ...previous, title: '' })) }} /><small className={styles.counter}>{title.length}/120 ký tự</small>{errors.title && <small className={styles.fieldError} id={titleId + '-error'}>{errors.title}</small>}</label><label className={styles.field} htmlFor={textId}><span>Nội dung</span><textarea id={textId} rows={7} value={text} maxLength={2000} aria-invalid={Boolean(errors.text)} aria-describedby={errors.text ? textId + '-error' : undefined} placeholder="Nêu thời gian, phạm vi ảnh hưởng và bước người chơi cần làm." onChange={(event) => { setText(event.target.value); setSaved(false); setErrors((previous) => ({ ...previous, text: '' })) }} /><small className={styles.counter}>{text.length}/2.000 ký tự</small>{errors.text && <small className={styles.fieldError} id={textId + '-error'}>{errors.text}</small>}</label><div className={styles.formActions}><button className={styles.secondary} type="button" disabled={!title && !text} onClick={() => { setTitle(''); setText(''); setErrors({}); setSaved(false) }}><Undo2 size={15} />Làm lại</button><button className={styles.primary} type="submit"><Check size={15} />Lưu thông báo demo</button></div>{saved && <p className={styles.successNotice} role="status"><CheckCheck size={17} />Đã lưu thông báo vào phiên demo. Bạn có thể xem tại chuông thông báo.</p>}</div></form><aside className={styles.preview}><div className={styles.previewLabel}><Eye size={15} />XEM TRƯỚC</div><article><span className={styles.previewApp}><Bell size={18} />ChessArena <small>Thông báo demo</small></span><h2>{title.trim() || 'Tiêu đề thông báo của bạn'}</h2><p>{text.trim() || 'Nội dung sẽ hiển thị tại đây khi bạn nhập. Kiểm tra cách đọc trước khi lưu.'}</p></article><div className={styles.writingTip}><CircleHelp size={17} /><p>Một tiêu đề cụ thể, thời gian rõ ràng và một bước tiếp theo giúp người chơi dễ hiểu hơn.</p></div></aside></div><div className={styles.overviewGrid}><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Đã lưu trong phiên</h2><p>{notices.length} thông báo demo.</p></div><Bell size={17} /></div>{notices.length ? <div className={styles.noticeList}>{notices.map((notice) => <article key={notice.id}><Badge>Nội dung đã lưu</Badge><h3>{notice.title}</h3><p>{notice.text}</p><small className={styles.mono}>{notice.id}</small></article>)}</div> : <div className={styles.quietEmpty}><FileText size={23} /><strong>Chưa có thông báo trong phiên</strong><p>Thông báo vừa lưu sẽ hiển thị ở đây và trong chuông thông báo.</p></div>}</section><aside className={styles.panel}><div className={styles.panelHeader}><div><h2>Hướng dẫn người chơi</h2><p>Nội dung có sẵn trong bản trải nghiệm.</p></div><BookOpen size={17} /></div><div className={styles.editorBody}><p className={styles.description}>Luật cơ bản, điều khiển bàn cờ và cách xem lại nước đi.</p><button className={styles.secondary} type="button" onClick={() => navigate('help')}>Mở trang hướng dẫn<ArrowRight size={15} /></button></div></aside></div></>
}

function PermissionsPage({ onPermission, permissionState }) {
  const [role, setRole] = useState('Quản trị viên')
  const [draft, setDraft] = useState(() => copyPermissions(permissionState || DEFAULT_PERMISSIONS))
  const [saved, setSaved] = useState(() => copyPermissions(permissionState || DEFAULT_PERMISSIONS))
  const [notice, setNotice] = useState('')
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const enabled = PERMISSION_ROWS.filter(([key]) => draft[role]?.[key]).length
  function save() {
    onPermission('Lưu phân quyền demo', role, copyPermissions(draft))
    setSaved(copyPermissions(draft))
    setNotice(`Đã lưu cấu hình mẫu cho ${role.toLowerCase()}.`)
  }
  return <><Header eyebrow="QUẢN LÝ QUYỀN TRUY CẬP" title="Phân quyền" description="Xem phạm vi của từng vai trò và kiểm tra bản thay đổi trước khi lưu." /><div className={styles.permissionsGrid}><aside className={styles.rolePanel}><p className={styles.eyebrow}>VAI TRÒ</p>{['Quản trị viên', 'Kiểm duyệt viên'].map((value) => <button type="button" key={value} aria-pressed={role === value} onClick={() => { setRole(value); setNotice('') }}><Shield size={18} /><span><strong>{value}</strong><small>{value === 'Quản trị viên' ? 'Quản lý toàn bộ khu vực mẫu' : 'Tập trung an toàn cộng đồng'}</small></span><ChevronRight size={16} /></button>)}<div className={styles.roleHelp}><Info size={17} /><p>Thay đổi ở đây là mô phỏng, không cấp quyền tài khoản trên máy chủ.</p></div></aside><section className={styles.panel}><div className={styles.panelHeader}><div><h2>{role}</h2><p>{enabled}/{PERMISSION_ROWS.length} quyền trong bộ mẫu đang bật.</p></div><Badge tone={dirty ? 'warning' : 'neutral'}>{dirty ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ bản mẫu'}</Badge></div><div className={styles.permissionList}>{PERMISSION_ROWS.map(([key, label, description]) => <div className={styles.permissionRow} key={key}><span><strong>{label}</strong><small>{description}</small></span><button className={styles.switch} type="button" role="switch" aria-label={label} aria-checked={Boolean(draft[role]?.[key])} onClick={() => { setDraft((previous) => ({ ...previous, [role]: { ...previous[role], [key]: !previous[role]?.[key] } })); setNotice('') }}><span /></button></div>)}</div><div className={styles.saveBar}><span>{dirty ? 'Bản nháp được giữ khi chuyển giữa hai vai trò.' : 'Mọi thay đổi chỉ áp dụng trong phiên này.'}</span><div><button className={styles.secondary} type="button" disabled={!dirty} onClick={() => { setDraft(copyPermissions(saved)); setNotice('Đã hủy các thay đổi chưa lưu.') }}><Undo2 size={15} />Hủy thay đổi</button><button className={styles.primary} type="button" disabled={!dirty} onClick={save}><Check size={15} />Lưu phân quyền demo</button></div></div>{notice && <p className={styles.successNotice} role="status"><Check size={16} />{notice}</p>}</section></div></>
}

function AuditPage({ logs }) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('Tất cả sự kiện')
  const [page, setPage] = useState(1)
  const reset = () => { setQuery(''); setScope('Tất cả sự kiện'); setPage(1) }
  const entries = [...logs.map((log) => ({ ...log, current: true })), ...DEMO_AUDIT].filter((log) => (scope !== 'Trong phiên này' || log.current) && fold(`${log.actor} ${log.action} ${log.target} ${log.id}`).includes(fold(query)))
  const current = Math.min(page, Math.max(1, Math.ceil(entries.length / 6)))
  return <><Header eyebrow="THEO DÕI THAY ĐỔI" title="Nhật ký quản trị" description="Tra cứu người thực hiện, nội dung và đối tượng của từng thao tác mẫu." actions={<Badge><History size={14} />{logs.length} sự kiện trong phiên</Badge>} /><section className={styles.panel}><div className={styles.toolbar}><SearchInput label="Tìm nhật ký" placeholder="Người thực hiện, hành động hoặc mã" value={query} onChange={(value) => { setQuery(value); setPage(1) }} /><SelectMenu label="Nguồn nhật ký" value={scope} options={['Tất cả sự kiện', 'Trong phiên này']} onChange={(value) => { setScope(value); setPage(1) }} /><button className={styles.secondary} type="button" disabled={!query && scope === 'Tất cả sự kiện'} onClick={reset}><Undo2 size={15} />Xóa lọc</button></div><Table caption="Nhật ký thao tác quản trị mô phỏng"><thead><tr><th scope="col">Người thực hiện</th><th scope="col">Thao tác</th><th scope="col">Đối tượng</th><th scope="col">Thời điểm</th><th scope="col">Mã sự kiện</th></tr></thead><tbody>{entries.slice((current - 1) * 6, current * 6).map((log) => <tr key={log.id}><th scope="row"><span className={styles.person}><span className={styles.avatar}>{log.actor[0].toUpperCase()}</span><strong>{log.actor}</strong></span></th><td><span className={styles.auditAction}>{log.action}{log.current && <Badge tone="success">Trong phiên này</Badge>}</span></td><td className={styles.mono}>{log.target}</td><td>{log.time}</td><td className={styles.mono}>{log.id}</td></tr>)}</tbody></Table>{!entries.length && <Empty onReset={reset} />}<Pagination page={current} setPage={setPage} total={entries.length} pageSize={6} label="sự kiện mẫu" /></section><p className={styles.footnote}><Info size={15} />Nhật ký mẫu giúp thử luồng quản trị, không thay thế audit log bất biến trên máy chủ.</p></>
}

export default function AdminDemo({ page = 'overview', navigate = () => {}, onLock = () => {}, onResolve = () => {}, onPublish = () => {}, onReview = () => {}, onPermission = () => {}, lockedUsers = {}, resolvedReports = {}, notices = [], logs = [], permissionState }) {
  const pages = {
    overview: <Overview navigate={navigate} lockedUsers={lockedUsers} resolvedReports={resolvedReports} logs={logs} onResolve={onResolve} onReview={onReview} />,
    users: <UsersPage lockedUsers={lockedUsers} onLock={onLock} />,
    matches: <MatchesPage onReview={onReview} />,
    reports: <ReportsPage resolvedReports={resolvedReports} onResolve={onResolve} />,
    content: <ContentPage onPublish={onPublish} notices={notices} navigate={navigate} />,
    permissions: <PermissionsPage onPermission={onPermission} permissionState={permissionState} />,
    audit: <AuditPage logs={logs} />,
  }
  return <div className={styles.workspace}>{pages[page] || pages.overview}<p className={styles.demoFootnote}><Info size={15} /><span>Dữ liệu mô phỏng. Thay đổi nằm trong phiên trình duyệt hiện tại và mất khi tải lại.</span></p></div>
}
