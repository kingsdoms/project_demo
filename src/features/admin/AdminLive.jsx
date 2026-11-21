import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bell, CircleAlert, Clock3, Database, Eye, FileClock, Info, KeyRound, LoaderCircle, RefreshCw, Search, ShieldCheck, ShieldX, Swords, Users, X } from 'lucide-react'
import SelectMenu from '@/components/ui/SelectMenu'
import { adminApi } from '@/services/api/admin'
import { useAuthStore } from '@/stores/useAuthStore'
import styles from './AdminLive.module.css'

const PAGE_SIZE = 10
const PAGE_META = {
  overview: ['VẬN HÀNH HỆ THỐNG', 'Tổng quan quản trị', 'Theo dõi tài khoản, thông báo và phiên đang được máy chủ ghi nhận.'],
  users: ['QUẢN LÝ TÀI KHOẢN', 'Người dùng', 'Tìm hồ sơ, kiểm tra trạng thái và đối chiếu quyền truy cập.'],
  permissions: ['QUYỀN TRUY CẬP', 'Vai trò và quyền', 'Đối chiếu cấu hình quyền đang được máy chủ áp dụng.'],
  audit: ['LỊCH SỬ VẬN HÀNH', 'Nhật ký quản trị', 'Tra cứu các hoạt động đã được hệ thống ghi lại.'],
  content: ['THÔNG TIN CỘNG ĐỒNG', 'Thông báo', 'Xem các thông báo đang được lưu trên hệ thống.'],
}

function text(...values) {
  const value = values.find((item) => (typeof item === 'string' && item.trim()) || typeof item === 'number')
  return value === undefined ? 'Chưa có' : String(value)
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [đã ẩn]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\b/g, '[token đã ẩn]')
}

function dateLabel(value) {
  if (value === undefined || value === null || value === '') return 'Chưa có'
  const date = new Date(typeof value === 'number' && value < 100_000_000_000 ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? 'Chưa có' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function countValue(value, keys = []) {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString('vi-VN')
  for (const key of keys) {
    if (typeof value?.[key] === 'number' && Number.isFinite(value[key])) return value[key].toLocaleString('vi-VN')
  }
  return null
}

function collection(value) {
  return (Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : []).filter((item) => item !== null && item !== undefined)
}

// A changed account, query, page or refresh revision hides the previous resource immediately.
function useRemote(loader, identity, revision = 0) {
  const [state, setState] = useState(null)
  useEffect(() => {
    let active = true
    Promise.resolve().then(loader).then(
      (data) => { if (active) setState({ loader, identity, revision, status: 'ready', data, updatedAt: new Date(), error: null }) },
      (error) => { if (active) setState({ loader, identity, revision, status: 'error', data: null, updatedAt: null, error }) },
    )
    return () => { active = false }
  }, [loader, identity, revision])
  return state?.loader === loader && state.identity === identity && state.revision === revision
    ? state : { status: 'loading', data: null, error: null, updatedAt: null }
}

function Button({ children, primary = false, className = '', ...props }) {
  return <button type="button" className={`${primary ? styles.primary : styles.button} ${className}`} {...props}>{children}</button>
}

function Gate({ kind, title, description, onSignIn, onDemo, onRetry }) {
  const Icon = kind === 'loading' ? LoaderCircle : kind === 'denied' ? ShieldX : ShieldCheck
  return <section className={styles.gate} aria-busy={kind === 'loading'}>
    <span className={styles.gateIcon}><Icon size={28} className={kind === 'loading' ? styles.spinner : undefined} /></span>
    <span className={styles.eyebrow}>QUẢN TRỊ TRỰC TUYẾN</span>
    <h1>{title}</h1><p role={kind === 'loading' ? 'status' : undefined}>{description}</p>
    <div className={styles.actions}>
      {onSignIn && <Button primary onClick={onSignIn}><KeyRound size={16} /> Đăng nhập tài khoản quản trị</Button>}
      {onRetry && <Button onClick={onRetry}><RefreshCw size={16} /> Kiểm tra lại quyền</Button>}
      {onDemo && <Button onClick={onDemo}><Eye size={16} /> Xem dữ liệu mẫu</Button>}
    </div>
  </section>
}

function PanelState({ resource, onRetry, empty = false, emptyTitle = 'Chưa có dữ liệu', emptyDescription = 'Các bản ghi mới sẽ xuất hiện tại đây.' }) {
  if (resource.status === 'loading') return <div className={styles.state} role="status"><LoaderCircle size={22} className={styles.spinner} /><strong>Đang tải dữ liệu</strong><p>Vui lòng đợi máy chủ phản hồi.</p></div>
  if (resource.status === 'error') return <div className={styles.state} role="alert"><CircleAlert size={23} /><strong>{resource.error?.status === 403 ? 'Bạn chưa có quyền xem mục này' : 'Không tải được dữ liệu'}</strong><p>{text(resource.error?.message, 'Vui lòng thử lại sau.')}</p><Button onClick={onRetry}><RefreshCw size={16} /> Thử lại</Button></div>
  if (empty) return <div className={styles.state}><Database size={24} /><strong>{emptyTitle}</strong><p>{emptyDescription}</p></div>
  return null
}

function Header({ page, resource, onRefresh }) {
  const [eyebrow, title, description] = PAGE_META[page]
  return <header className={styles.heading}>
    <div><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
    <div className={styles.headingActions}><span className={styles.readOnly}><Eye size={14} /> Chỉ xem</span><Button onClick={onRefresh} disabled={resource.status === 'loading'}><RefreshCw size={16} className={resource.status === 'loading' ? styles.spinner : undefined} /> Làm mới</Button></div>
  </header>
}

function Updated({ resource }) {
  return <p className={styles.updated} role="status"><Clock3 size={14} />{resource.status === 'loading' ? 'Đang cập nhật' : resource.updatedAt ? `Cập nhật lúc ${resource.updatedAt.toLocaleTimeString('vi-VN')}` : 'Chưa có bản cập nhật thành công'}</p>
}

function Pager({ data, page, onPage, busy }) {
  const items = collection(data)
  const total = data?.totalItems
  const totalPages = data?.totalPages
  const canNext = typeof totalPages === 'number' ? page < totalPages : items.length === PAGE_SIZE
  return <div className={styles.pager}>
    <span>{items.length} bản ghi trong trang{typeof total === 'number' ? `, tổng ${total.toLocaleString('vi-VN')}` : ''}</span>
    <div><Button aria-label="Trang trước" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}><ArrowLeft size={16} /></Button><span>Trang {page}{typeof totalPages === 'number' && totalPages > 0 ? ` / ${totalPages}` : ''}</span><Button aria-label="Trang tiếp" disabled={busy || !canNext} onClick={() => onPage(page + 1)}><ArrowRight size={16} /></Button></div>
  </div>
}

function Status({ value }) {
  const labels = { ACTIVE: 'Hoạt động', BANNED: 'Đã khóa', DELETE: 'Chờ xóa', INACTIVE: 'Chưa kích hoạt', PENDING: 'Chờ xử lý' }
  return <span className={styles.status} data-kind={value === 'ACTIVE' ? 'success' : value === 'BANNED' ? 'danger' : 'neutral'}>{labels[value] || text(value)}</span>
}

function MetricPanel({ label, result, icon: Icon, primary = false, keys }) {
  const count = result?.status === 'fulfilled' ? countValue(result.value, keys) : null
  return <section className={primary ? styles.mainMetric : styles.metric}>
    <span className={styles.metricLabel}><Icon size={18} /> {label}</span>
    {count !== null ? <strong>{count}</strong> : <strong className={styles.noMetric}>{result?.status === 'rejected' ? 'Không tải được' : 'Chưa có thống kê'}</strong>}
    <small>{result?.status === 'rejected' ? text(result.reason?.message, 'Chưa đủ quyền truy cập.') : 'Số liệu do máy chủ cung cấp'}</small>
  </section>
}

function Overview({ identity, navigate }) {
  const [revision, refresh] = useState(0)
  const loader = useCallback(async () => {
    const [accounts, notifications, tokens, journals] = await Promise.allSettled([
      adminApi.accountCount(), adminApi.notificationStats(), adminApi.tokenStats(), adminApi.journals({ page: 1, pageSize: 5 }),
    ])
    return { accounts, notifications, tokens, journals }
  }, [])
  const resource = useRemote(loader, identity, revision)
  const doRefresh = () => refresh((value) => value + 1)
  const result = resource.data
  const journals = result?.journals.status === 'fulfilled' ? collection(result.journals.value) : []
  return <><Header page="overview" resource={resource} onRefresh={doRefresh} />
    {resource.status !== 'ready' ? <PanelState resource={resource} onRetry={doRefresh} /> : <>
      <div className={styles.metrics}><MetricPanel primary label="Tổng tài khoản" icon={Users} result={result.accounts} keys={['count', 'total', 'total_accounts']} /><div className={styles.secondaryMetrics}><MetricPanel label="Thông báo" icon={Bell} result={result.notifications} keys={['total', 'total_count', 'total_notifications', 'count']} /><MetricPanel label="Phiên và token" icon={KeyRound} result={result.tokens} keys={['total', 'total_count', 'total_tokens', 'count']} /></div></div>
      <div className={styles.overviewGrid}><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Hoạt động gần đây</h2><p>Các bản ghi mới nhất từ nhật ký.</p></div><FileClock size={19} /></div>
        {result.journals.status === 'rejected' ? <PanelState resource={{ status: 'error', error: result.journals.reason }} onRetry={doRefresh} /> : journals.length ? <ul className={styles.feed}>{journals.map((row, index) => <li key={text(row.journal_id, row.id, index)}><span className={styles.feedIcon}><FileClock size={16} /></span><span><strong>{text(row.action, row.action_code, row.command_code, row.type_code)}</strong><small>{dateLabel(row.created_at ?? row.timestamp)}</small></span></li>)}</ul> : <PanelState resource={resource} empty emptyTitle="Chưa có hoạt động được ghi lại" />}
        <Button onClick={() => navigate('admin-audit')}>Mở nhật ký <ArrowRight size={16} /></Button>
      </section><aside className={styles.panel}><div className={styles.panelHeader}><div><h2>Không gian quản trị</h2><p>Kiểm tra dữ liệu trước khi xử lý.</p></div><ShieldCheck size={19} /></div><p className={styles.muted}>Bạn đang xem dữ liệu trực tuyến. Các thay đổi trạng thái và quyền chưa được thực hiện từ không gian này.</p><div className={styles.quickLinks}><Button onClick={() => navigate('admin-users')}><Users size={16} /> Tra cứu tài khoản <ArrowRight size={16} /></Button><Button onClick={() => navigate('admin-permissions')}><ShieldCheck size={16} /> Đối chiếu phân quyền <ArrowRight size={16} /></Button></div></aside></div>
    </>}
    <Updated resource={resource} />
  </>
}

function AccountDetail({ id, identity, onClose }) {
  const dialog = useRef(null)
  const titleId = useId()
  const [revision, refresh] = useState(0)
  const loader = useCallback(() => adminApi.account(id), [id])
  const resource = useRemote(loader, identity, revision)
  useEffect(() => {
    const modal = dialog.current
    modal?.showModal()
    return () => { if (modal?.open) modal.close() }
  }, [])
  const account = resource.data
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={onClose}>
    <div className={styles.dialogHeading}><span><p className={styles.eyebrow}>HỒ SƠ TÀI KHOẢN</p><h2 id={titleId}>{resource.status === 'ready' ? text(account?.name, account?.username, 'Chi tiết tài khoản') : 'Chi tiết tài khoản'}</h2></span><Button onClick={onClose} aria-label="Đóng chi tiết tài khoản"><X size={18} /></Button></div>
    {resource.status !== 'ready' ? <PanelState resource={resource} onRetry={() => refresh((value) => value + 1)} /> : account && typeof account === 'object' ? <dl className={styles.details}>
      <dt>Mã tài khoản</dt><dd>{text(account.account_id, account.id, id)}</dd><dt>Tên đăng nhập</dt><dd>{text(account.username)}</dd><dt>Email</dt><dd>{text(account.email)}</dd><dt>Trạng thái</dt><dd><Status value={account.status_code} /></dd><dt>Vai trò</dt><dd>{Array.isArray(account.roles) ? account.roles.filter((role) => typeof role === 'string').join(', ') || 'Chưa có' : 'Chưa có'}</dd><dt>Ngày tạo</dt><dd>{dateLabel(account.created_at)}</dd>
    </dl> : <PanelState resource={resource} empty emptyTitle="Không tìm thấy hồ sơ" />}
    <p className={styles.readOnlyNote}><Eye size={15} /> Chi tiết này chỉ để xem và đối chiếu.</p>
    <Button onClick={onClose}>Đóng</Button>
  </dialog>
}

function UsersPage({ identity }) {
  const [draft, setDraft] = useState({ search: '', status: '' })
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [page, setPage] = useState(1)
  const [revision, refresh] = useState(0)
  const [selected, setSelected] = useState(null)
  const loader = useCallback(() => adminApi.accounts({ ...filters, page, pageSize: PAGE_SIZE }), [filters, page])
  const resource = useRemote(loader, identity, revision)
  const rows = collection(resource.data)
  const submit = (event) => { event.preventDefault(); setFilters({ search: draft.search.trim(), status: draft.status }); setPage(1) }
  const reset = () => { setDraft({ search: '', status: '' }); setFilters({ search: '', status: '' }); setPage(1) }
  return <><Header page="users" resource={resource} onRefresh={() => refresh((value) => value + 1)} />
    <section className={styles.panel}><form className={styles.filters} onSubmit={submit} role="search" aria-label="Tra cứu tài khoản trực tuyến"><label className={styles.search}><Search size={17} /><input aria-label="Tìm tài khoản trên máy chủ" placeholder="Tên, email hoặc mã tài khoản" value={draft.search} maxLength={120} onChange={(event) => setDraft((value) => ({ ...value, search: event.target.value }))} /></label><SelectMenu label="Trạng thái tài khoản trực tuyến" value={draft.status} onChange={(status) => setDraft((value) => ({ ...value, status }))} options={[{ value: '', label: 'Mọi trạng thái' }, { value: 'ACTIVE', label: 'Hoạt động' }, { value: 'BANNED', label: 'Đã khóa' }, { value: 'INACTIVE', label: 'Chưa kích hoạt' }, { value: 'DELETE', label: 'Chờ xóa' }]} /><button type="submit" className={styles.primary} disabled={resource.status === 'loading'}><Search size={16} /> Tìm kiếm</button><Button onClick={reset} disabled={!draft.search && !draft.status && !filters.search && !filters.status}>Xóa lọc</Button></form>
      {resource.status !== 'ready' || !rows.length ? <PanelState resource={resource} onRetry={() => refresh((value) => value + 1)} empty={!rows.length} emptyTitle="Không tìm thấy tài khoản" emptyDescription="Thử tên khác hoặc xóa bộ lọc để xem lại." /> : <div className={styles.tableScroll} role="region" aria-label="Danh sách tài khoản" tabIndex={0}><table className={styles.table}><caption className={styles.srOnly}>Tài khoản từ máy chủ, trang {page}</caption><thead><tr><th scope="col">Người dùng</th><th scope="col">Trạng thái</th><th scope="col">Vai trò</th><th scope="col">Hồ sơ</th></tr></thead><tbody>{rows.map((row, index) => {
        const id = row.account_id ?? row.id
        return <tr key={text(id, row.username, index)}><th scope="row"><span className={styles.person}><span className={styles.avatar}>{text(row.name, row.username)[0]}</span><span><strong>{text(row.name, row.username)}</strong><small>{text(row.email, row.username)}</small><small className={styles.mono}>{text(id)}</small></span></span></th><td><Status value={row.status_code} /></td><td>{Array.isArray(row.roles) ? row.roles.filter((role) => typeof role === 'string').join(', ') || 'Chưa có' : 'Chưa có'}</td><td>{typeof id === 'number' || typeof id === 'string' ? <Button onClick={() => setSelected(id)} aria-label={`Xem hồ sơ ${text(row.name, row.username, id)}`}><Eye size={15} /> Chi tiết</Button> : <span className={styles.muted}>Chưa có mã hồ sơ</span>}</td></tr>
      })}</tbody></table></div>}
      {resource.status === 'ready' && <Pager data={resource.data} page={page} onPage={setPage} busy={false} />}
    </section><Updated resource={resource} />
    {selected !== null && <AccountDetail key={String(selected)} id={selected} identity={identity} onClose={() => setSelected(null)} />}
  </>
}

function PermissionsPage({ identity }) {
  const [revision, refresh] = useState(0)
  const loader = useCallback(async () => {
    const [roles, permissions] = await Promise.allSettled([adminApi.roles(), adminApi.permissions()])
    return { roles, permissions }
  }, [])
  const resource = useRemote(loader, identity, revision)
  const doRefresh = () => refresh((value) => value + 1)
  return <><Header page="permissions" resource={resource} onRefresh={doRefresh} />
    {resource.status !== 'ready' ? <PanelState resource={resource} onRetry={doRefresh} /> : <div className={styles.permissionGrid}>{[['roles', 'Vai trò', 'Vai trò và khả năng truy cập khu quản trị'], ['permissions', 'Danh mục quyền', 'Các quyền đang có trong hệ thống']].map(([key, title, description]) => {
      const result = resource.data[key]
      const rows = result.status === 'fulfilled' ? collection(result.value) : []
      return <section className={styles.panel} key={key}><div className={styles.panelHeader}><div><h2>{title}</h2><p>{description}</p></div><ShieldCheck size={19} /></div>{result.status === 'rejected' ? <PanelState resource={{ status: 'error', error: result.reason }} onRetry={doRefresh} /> : rows.length ? <ul className={styles.permissionList}>{rows.map((row, index) => <li key={text(row.role_code, row.permission_code, row.code, row.name, index)}><span><strong>{text(row.name, row.role_code, row.permission_code, row.code)}</strong><small>{text(row.description)}</small></span>{key === 'roles' && typeof row.admin_portal_access === 'boolean' && <span className={styles.status} data-kind={row.admin_portal_access ? 'success' : 'neutral'}>{row.admin_portal_access ? 'Có quyền quản trị' : 'Khu người chơi'}</span>}</li>)}</ul> : <PanelState resource={resource} empty emptyTitle="Chưa có bản ghi" />}</section>
    })}</div>}
    <p className={styles.readOnlyNote}><Info size={16} /> Cấu hình đang hiển thị chỉ để đối chiếu; chưa có thay đổi quyền nào được gửi.</p><Updated resource={resource} />
  </>
}

function AuditPage({ identity }) {
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [revision, refresh] = useState(0)
  const loader = useCallback(() => adminApi.journals({ search: query, page, pageSize: PAGE_SIZE }), [query, page])
  const resource = useRemote(loader, identity, revision)
  const rows = collection(resource.data)
  return <><Header page="audit" resource={resource} onRefresh={() => refresh((value) => value + 1)} /><section className={styles.panel}>
    <form className={styles.filters} role="search" aria-label="Tra cứu nhật ký" onSubmit={(event) => { event.preventDefault(); setQuery(draft.trim()); setPage(1); refresh((value) => value + 1) }}><label className={styles.search}><Search size={17} /><input aria-label="Tìm hoạt động trong nhật ký" placeholder="Tìm tài khoản hoặc hoạt động" value={draft} maxLength={120} onChange={(event) => setDraft(event.target.value)} /></label><button type="submit" className={styles.primary} disabled={resource.status === 'loading'}>Tìm nhật ký</button><Button disabled={!draft && !query} onClick={() => { setDraft(''); setQuery(''); setPage(1) }}>Xóa lọc</Button></form>
    {resource.status !== 'ready' || !rows.length ? <PanelState resource={resource} onRetry={() => refresh((value) => value + 1)} empty={!rows.length} emptyTitle="Chưa có hoạt động phù hợp" emptyDescription="Thử từ khóa khác hoặc quay lại sau khi có hoạt động mới." /> : <div className={styles.tableScroll} role="region" aria-label="Nhật ký hệ thống" tabIndex={0}><table className={styles.table}><caption className={styles.srOnly}>Nhật ký từ máy chủ, trang {page}</caption><thead><tr><th scope="col">Thời điểm</th><th scope="col">Hoạt động</th><th scope="col">Tài khoản</th><th scope="col">Trạng thái</th></tr></thead><tbody>{rows.map((row, index) => <tr key={text(row.journal_id, row.id, index)}><td className={styles.nowrap}>{dateLabel(row.created_at ?? row.timestamp)}</td><th scope="row">{text(row.action, row.action_code, row.command_code, row.type_code)}</th><td className={styles.mono}>{text(row.username, row.account_id)}</td><td><Status value={row.status_code} /></td></tr>)}</tbody></table></div>}
    {resource.status === 'ready' && <Pager data={resource.data} page={page} onPage={setPage} busy={false} />}</section><Updated resource={resource} />
  </>
}

function NotificationsPage({ identity }) {
  const [page, setPage] = useState(1)
  const [revision, refresh] = useState(0)
  const loader = useCallback(() => adminApi.notifications({ page, pageSize: PAGE_SIZE }), [page])
  const resource = useRemote(loader, identity, revision)
  const rows = collection(resource.data)
  return <><Header page="content" resource={resource} onRefresh={() => refresh((value) => value + 1)} /><section className={styles.panel}>
    {resource.status !== 'ready' || !rows.length ? <PanelState resource={resource} onRetry={() => refresh((value) => value + 1)} empty={!rows.length} emptyTitle="Chưa có thông báo" emptyDescription="Các thông báo đã được lưu sẽ xuất hiện tại đây." /> : <div className={styles.tableScroll} role="region" aria-label="Thông báo hệ thống" tabIndex={0}><table className={styles.table}><caption className={styles.srOnly}>Thông báo từ máy chủ, trang {page}</caption><thead><tr><th scope="col">Thông báo</th><th scope="col">Loại</th><th scope="col">Ngày tạo</th><th scope="col">Trạng thái</th></tr></thead><tbody>{rows.map((row, index) => <tr key={text(row.notification_id, row.id, index)}><th scope="row"><strong>{text(row.title)}</strong><small className={styles.cellDescription}>{text(row.description)}</small></th><td>{text(row.type_code)}</td><td className={styles.nowrap}>{dateLabel(row.created_at)}</td><td><Status value={row.status_code} /></td></tr>)}</tbody></table></div>}
    {resource.status === 'ready' && <Pager data={resource.data} page={page} onPage={setPage} busy={false} />}</section><Updated resource={resource} />
  </>
}

function LiveWorkspace({ page, identity, navigate, onDemo }) {
  if (page === 'overview') return <Overview identity={identity} navigate={navigate} />
  if (page === 'users') return <UsersPage identity={identity} />
  if (page === 'permissions') return <PermissionsPage identity={identity} />
  if (page === 'audit') return <AuditPage identity={identity} />
  if (page === 'content') return <NotificationsPage identity={identity} />
  return <section className={styles.gate}><span className={styles.gateIcon}><Swords size={27} /></span><span className={styles.eyebrow}>DỮ LIỆU TRỰC TUYẾN</span><h1>{page === 'matches' ? 'Trận đấu chưa được đồng bộ' : page === 'reports' ? 'Báo cáo chưa được đồng bộ' : 'Chưa có mục quản trị này'}</h1><p>{page === 'matches' ? 'Các ván cờ hiện chạy trong trình duyệt. Lịch sử trận trên máy chủ sẽ xuất hiện khi dịch vụ thi đấu sẵn sàng.' : page === 'reports' ? 'Chưa có nguồn báo cáo cộng đồng trực tuyến. Bạn có thể thử luồng kiểm duyệt bằng dữ liệu mẫu.' : 'Chọn một mục khác trong điều hướng quản trị.'}</p><div className={styles.actions}><Button onClick={() => navigate('admin-overview')}>Về tổng quan</Button><Button primary onClick={onDemo}><Eye size={16} /> Xem dữ liệu mẫu</Button></div></section>
}

function AuthorizedAdmin({ identity, page, navigate, onSignIn, onDemo }) {
  const [revision, refresh] = useState(0)
  const loader = useCallback(() => adminApi.access(), [])
  const resource = useRemote(loader, identity, revision)
  if (resource.status === 'loading') return <Gate kind="loading" title="Đang kiểm tra quyền quản trị" description="Quyền truy cập được xác nhận với máy chủ trước khi tải dữ liệu." onDemo={onDemo} />
  if (resource.status === 'error') return <Gate kind="denied" title={resource.error?.status === 401 ? 'Phiên đăng nhập cần được xác nhận lại' : 'Chưa thể mở khu quản trị'} description={text(resource.error?.message, 'Hãy thử lại khi kết nối ổn định.')} onRetry={() => refresh((value) => value + 1)} onDemo={onDemo} onSignIn={resource.error?.status === 401 ? onSignIn : undefined} />
  if (resource.data !== true) return <Gate kind="denied" title="Tài khoản chưa được cấp quyền quản trị" description="Bạn vẫn có thể dùng khu người chơi. Để xem dữ liệu vận hành, hãy đăng nhập tài khoản đã được cấp quyền hoặc liên hệ người quản trị hệ thống." onSignIn={onSignIn} onRetry={() => refresh((value) => value + 1)} onDemo={onDemo} />
  return <LiveWorkspace key={page} page={page} identity={identity} navigate={navigate} onDemo={onDemo} />
}

export default function AdminLive({ page = 'overview', navigate, onSignIn, onDemo }) {
  const session = useAuthStore((state) => state.session)
  const identity = session?.refreshToken || session?.accessToken
  return <div className={styles.live}>
    {!identity ? <Gate kind="login" title="Đăng nhập để mở khu quản trị" description="Dùng tài khoản đã được cấp quyền để tra cứu dữ liệu vận hành trên máy chủ." onSignIn={onSignIn} onDemo={onDemo} /> : <AuthorizedAdmin key={identity} identity={identity} page={page} navigate={navigate} onSignIn={onSignIn} onDemo={onDemo} />}
  </div>
}
