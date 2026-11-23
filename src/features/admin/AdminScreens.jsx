import { useMemo, useState } from 'react'
import {
  Ban, Bell, BellPlus, ChevronDown, ChevronRight, Database, Eraser, FileClock, Globe, KeyRound, LogOut,
  Mail, Plus, RefreshCw, Search, ShieldCheck, ShieldPlus, Terminal, Trash2, UserCog, Users,
} from 'lucide-react'
import { adminApi } from '@/services/api/admin'
import { Button, ConfirmDialog, Drawer, Field, Modal, Pager, Panel, StateView, Status } from './AdminKit'
import {
  ACCOUNT_STATUSES, codeOf, collection, dateLabel, isEmail, isIp, numberLabel, parseIdList, rolePermissions,
  statEntries, statLabel, statusName, text, toRfc3339,
} from './adminFormat'
import { useAdminWrite, useRemote } from './adminHooks'
import styles from './AdminConsole.module.css'

const PAGE_SIZE = 15
const PROTECTED_ROLES = new Set(['ANONYMOUS', 'USER', 'ADMIN'])
const NOTIFICATION_TYPES = [['INFO', 'Thông tin'], ['WARNING', 'Cảnh báo'], ['SYSTEM', 'Hệ thống'], ['EVENT', 'Sự kiện']]

const accountIdOf = (row) => row?.account_id ?? row?.id
const roleList = (value) => (Array.isArray(value) ? value : []).map(codeOf).filter(Boolean)

function countOf(value) {
  if (typeof value === 'number') return value
  for (const key of ['count', 'total', 'total_items', 'value']) if (typeof value?.[key] === 'number') return value[key]
  return null
}

function RefreshButton({ onClick, busy }) {
  return <Button size="sm" onClick={onClick} disabled={busy} aria-label="Làm mới"><RefreshCw size={15} className={busy ? styles.spin : undefined} /> Làm mới</Button>
}

function SearchBar({ placeholder, initial = '', onSearch, children }) {
  const [draft, setDraft] = useState(initial)
  return (
    <form className={styles.toolbar} role="search" onSubmit={(event) => { event.preventDefault(); onSearch(draft.trim()) }}>
      <label className={styles.search}>
        <Search size={16} />
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} aria-label={placeholder} maxLength={120} />
      </label>
      {children}
      <Button type="submit" variant="primary" size="sm">Tìm</Button>
    </form>
  )
}

// ================================================================ TỔNG QUAN

export function OverviewPage({ navigate }) {
  const counts = useRemote(async () => {
    const statuses = [null, ...ACCOUNT_STATUSES]
    const results = await Promise.allSettled(statuses.map((status) => adminApi.accountCount(status ? { status } : {})))
    return statuses.map((status, index) => ({
      status,
      value: results[index].status === 'fulfilled' ? countOf(results[index].value) : null,
    }))
  }, [])
  const stats = useRemote(async () => {
    const [notifications, tokens] = await Promise.allSettled([adminApi.notificationStats(), adminApi.tokenStats()])
    return {
      notifications: notifications.status === 'fulfilled' ? statEntries(notifications.value) : null,
      tokens: tokens.status === 'fulfilled' ? statEntries(tokens.value) : null,
    }
  }, [])
  const journals = useRemote(() => adminApi.journals({ page: 1, pageSize: 8 }), [])
  const journalRows = collection(journals.data)
  const total = counts.data?.[0]?.value

  return (
    <>
      <div className={styles.kpis}>
        <button type="button" className={styles.kpi} data-lead="true" onClick={() => navigate('admin-users')}>
          <span className={styles.kpiIcon}><Users size={18} /></span>
          <span className={styles.kpiLabel}>Tổng tài khoản</span>
          <strong>{counts.status === 'ready' ? numberLabel(total) : '…'}</strong>
        </button>
        {ACCOUNT_STATUSES.map((status, index) => (
          <div className={styles.kpi} key={status}>
            <span className={styles.kpiLabel}><Status value={status} /></span>
            <strong>{counts.status === 'ready' ? numberLabel(counts.data[index + 1]?.value) : '…'}</strong>
          </div>
        ))}
      </div>

      <div className={styles.grid2}>
        {[['notifications', 'Thông báo', Bell], ['tokens', 'Phiên & token', KeyRound]].map(([key, title, Icon]) => {
          const entries = stats.data?.[key]
          return (
            <Panel key={key} title={title} actions={<Icon size={18} className={styles.muted} />}>
              {stats.status !== 'ready' ? <StateView resource={stats} onRetry={stats.reload} />
                : !entries ? <p className={styles.muted}>Không đọc được thống kê (có thể thiếu quyền).</p>
                  : !entries.length ? <p className={styles.muted}>Chưa có số liệu.</p>
                    : <dl className={styles.statList}>{entries.map(([label, value]) => <div key={label}><dt>{statLabel(label)}</dt><dd>{numberLabel(value)}</dd></div>)}</dl>}
            </Panel>
          )
        })}
      </div>

      <Panel
        title="Hoạt động gần đây"
        description="8 mục mới nhất trong nhật ký hệ thống"
        actions={<Button size="sm" onClick={() => navigate('admin-journals')}>Xem tất cả <ChevronRight size={15} /></Button>}
        flush
      >
        {journals.status !== 'ready' || !journalRows.length
          ? <StateView resource={journals} empty={!journalRows.length} emptyTitle="Chưa có hoạt động" onRetry={journals.reload} />
          : <JournalTable rows={journalRows} />}
      </Panel>
    </>
  )
}

// ================================================================ NGƯỜI DÙNG

export function UsersPage() {
  const [query, setQuery] = useState({ search: '', status: '', page: 1 })
  const [openId, setOpenId] = useState(null)
  const list = useRemote(() => adminApi.accounts({ ...query, pageSize: PAGE_SIZE }), [query])
  const roles = useRemote(() => adminApi.roles().catch(() => []), [])
  const rows = collection(list.data)

  return (
    <>
      <Panel flush>
        <SearchBar placeholder="Tìm tên, username hoặc email" initial={query.search} onSearch={(search) => setQuery((q) => ({ ...q, search, page: 1 }))}>
          <select className={styles.select} aria-label="Lọc trạng thái" value={query.status} onChange={(event) => setQuery((q) => ({ ...q, status: event.target.value, page: 1 }))}>
            <option value="">Mọi trạng thái</option>
            {ACCOUNT_STATUSES.map((status) => <option key={status} value={status}>{statusName(status)}</option>)}
          </select>
          <RefreshButton onClick={list.reload} busy={list.status === 'loading'} />
        </SearchBar>
        {list.status !== 'ready' || !rows.length
          ? <StateView resource={list} empty={!rows.length} emptyTitle="Không có tài khoản phù hợp" emptyText="Thử từ khoá hoặc trạng thái khác." onRetry={list.reload} />
          : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>ID</th><th>Người dùng</th><th>Email</th><th>Trạng thái</th><th>Vai trò</th><th>Tạo lúc</th><th aria-label="Mở" /></tr></thead>
                <tbody>
                  {rows.map((row, index) => {
                    const id = accountIdOf(row)
                    const name = text(row.name, row.username)
                    return (
                      <tr key={text(id, index)} className={styles.clickRow} tabIndex={0} onClick={() => id && setOpenId(id)} onKeyDown={(event) => { if (event.key === 'Enter' && id) setOpenId(id) }}>
                        <td className={styles.mono}>{text(id)}</td>
                        <td><span className={styles.person}><span className={styles.avatar}>{name[0]?.toUpperCase()}</span><span><strong>{name}</strong><small>{row.username ? `@${row.username}` : 'Chưa có username'}</small></span></span></td>
                        <td>{text(row.email)}</td>
                        <td><Status value={row.status_code} /></td>
                        <td><span className={styles.chips}>{roleList(row.roles).slice(0, 3).map((role) => <span className={styles.chip} key={role}>{role}</span>)}</span></td>
                        <td className={styles.nowrap}>{dateLabel(row.created_at)}</td>
                        <td><ChevronRight size={16} className={styles.muted} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        {list.status === 'ready' && <Pager data={list.data} page={query.page} onPage={(page) => setQuery((q) => ({ ...q, page }))} />}
      </Panel>
      {openId && <UserDrawer id={openId} roles={roleList(roles.data)} onClose={() => setOpenId(null)} onChanged={list.reload} />}
    </>
  )
}

function UserDrawer({ id, roles: allRoles, onClose, onChanged }) {
  const { run } = useAdminWrite()
  const detail = useRemote(async () => {
    const [account, oauth] = await Promise.allSettled([adminApi.account(id), adminApi.accountOauth(id)])
    if (account.status === 'rejected') throw account.reason
    return { account: account.value ?? {}, oauth: oauth.status === 'fulfilled' ? roleList(oauth.value) : null }
  }, [id])
  const account = detail.data?.account
  const [overrides, setOverrides] = useState({})
  const [confirm, setConfirm] = useState(null)
  const current = account ? { ...account, ...overrides } : null
  const accountRoles = roleList(current?.roles)

  async function toggleRole(role) {
    const has = accountRoles.includes(role)
    const result = await run(() => (has ? adminApi.revokeRole(id, role) : adminApi.grantRole(id, role)), {
      success: has ? `Đã thu vai trò ${role}.` : `Đã cấp vai trò ${role}.`,
    })
    if (result.ok) {
      setOverrides((o) => ({ ...o, roles: Array.isArray(result.value) ? result.value : has ? accountRoles.filter((r) => r !== role) : [...accountRoles, role] }))
      onChanged()
    }
  }

  async function toggleAvatar() {
    const next = !current.storage_verify
    const result = await run(() => adminApi.verifyAvatar(id, next), { success: next ? 'Đã duyệt ảnh đại diện.' : 'Đã bỏ duyệt ảnh đại diện.' })
    if (result.ok) setOverrides((o) => ({ ...o, storage_verify: next }))
  }

  return (
    <Drawer title={current ? text(current.name, current.username, `Tài khoản #${id}`) : `Tài khoản #${id}`} subtitle={`ID ${id}`} onClose={onClose}>
      {detail.status !== 'ready' ? <StateView resource={detail} onRetry={detail.reload} /> : (
        <>
          <div className={styles.drawerSummary}>
            <span className={styles.avatarLg}>{text(current.name, current.username, '?')[0].toUpperCase()}</span>
            <div>
              <Status value={current.status_code} />
              <p className={styles.muted}>Tạo {dateLabel(current.created_at)} · Đăng nhập gần nhất {dateLabel(current.last_login)}</p>
            </div>
          </div>

          <AccountEditForm id={id} account={current} onSaved={(fields) => { setOverrides((o) => ({ ...o, ...fields })); onChanged() }} />

          <section className={styles.drawerSection}>
            <h3><ShieldCheck size={16} /> Vai trò</h3>
            <p className={styles.muted}>Bấm để cấp hoặc thu hồi. Cần quyền MANAGE_PERMISSIONS.</p>
            <div className={styles.chips}>
              {(allRoles.length ? allRoles : accountRoles).map((role) => (
                <button key={role} type="button" className={styles.chipToggle} aria-pressed={accountRoles.includes(role)} onClick={() => toggleRole(role)}>{role}</button>
              ))}
            </div>
          </section>

          <section className={styles.drawerSection}>
            <h3><Globe size={16} /> Liên kết đăng nhập</h3>
            {detail.data.oauth === null ? <p className={styles.muted}>Không đọc được liên kết OAuth.</p>
              : detail.data.oauth.length ? <div className={styles.chips}>{detail.data.oauth.map((provider) => <span key={provider} className={styles.chip}>{provider}</span>)}</div>
                : <p className={styles.muted}>Chưa liên kết Google, GitHub hay Facebook.</p>}
          </section>

          <section className={styles.drawerSection}>
            <h3><UserCog size={16} /> Ảnh đại diện</h3>
            <div className={styles.rowBetween}>
              <span className={styles.muted}>{current.storage_key ? `Tệp ${current.storage_key}` : 'Chưa tải ảnh'} · {current.storage_verify ? 'Đã duyệt' : 'Chưa duyệt'}</span>
              <Button size="sm" disabled={!current.storage_key} onClick={toggleAvatar}>{current.storage_verify ? 'Bỏ duyệt' : 'Duyệt ảnh'}</Button>
            </div>
          </section>

          <section className={styles.drawerSection} data-danger="true">
            <h3><LogOut size={16} /> Vùng nguy hiểm</h3>
            <div className={styles.dangerActions}>
              <Button variant="danger-ghost" onClick={() => setConfirm('sessions')}><LogOut size={15} /> Đăng xuất mọi thiết bị</Button>
              {String(current.status_code).toUpperCase() === 'BANNED'
                ? <Button onClick={() => setConfirm('unban')}>Mở khoá tài khoản</Button>
                : <Button variant="danger" onClick={() => setConfirm('ban')}><Ban size={15} /> Khoá tài khoản</Button>}
            </div>
          </section>
        </>
      )}
      {confirm === 'sessions' && (
        <ConfirmDialog
          title="Đăng xuất mọi thiết bị?"
          description="Tất cả refresh token của tài khoản sẽ bị thu hồi. Người dùng phải đăng nhập lại."
          confirmLabel="Đăng xuất tất cả"
          onClose={() => setConfirm(null)}
          onConfirm={async () => { const r = await run(() => adminApi.revokeSessions(id), { success: 'Đã thu hồi mọi phiên.' }); if (r.ok) setConfirm(null) }}
        />
      )}
      {(confirm === 'ban' || confirm === 'unban') && (
        <ConfirmDialog
          title={confirm === 'ban' ? 'Khoá tài khoản này?' : 'Mở khoá tài khoản?'}
          description={confirm === 'ban' ? 'Trạng thái chuyển sang BANNED. Nên thu hồi phiên sau khi khoá.' : 'Trạng thái chuyển về ACTIVE.'}
          confirmLabel={confirm === 'ban' ? 'Khoá' : 'Mở khoá'}
          tone={confirm === 'ban' ? 'danger' : 'primary'}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const status_code = confirm === 'ban' ? 'BANNED' : 'ACTIVE'
            const r = await run(() => adminApi.updateAccount(id, { status_code }), { success: confirm === 'ban' ? 'Đã khoá tài khoản.' : 'Đã mở khoá tài khoản.' })
            if (r.ok) { setOverrides((o) => ({ ...o, status_code })); onChanged(); setConfirm(null) }
          }}
        />
      )}
    </Drawer>
  )
}

const EDITABLE = [['name', 'Tên hiển thị'], ['username', 'Username'], ['email', 'Email'], ['phone', 'Số điện thoại']]

function AccountEditForm({ id, account, onSaved }) {
  const { run } = useAdminWrite()
  const initial = useMemo(() => ({
    name: account.name ?? '', username: account.username ?? '', email: account.email ?? '', phone: account.phone ?? '',
    status_code: String(account.status_code ?? '').toUpperCase(),
  }), [account])
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const changed = Object.fromEntries(Object.entries(form).filter(([key, value]) => value.trim() !== initial[key] && value.trim() !== ''))
  const invalid = (changed.email && !isEmail(changed.email)) || (changed.phone && !/^\d{10,11}$/.test(changed.phone)) || (changed.username && !/^[A-Za-z0-9]{3,}$/.test(changed.username))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    const fields = Object.fromEntries(Object.entries(changed).map(([key, value]) => [key, value.trim()]))
    const result = await run(() => adminApi.updateAccount(id, fields), { success: 'Đã lưu hồ sơ.' })
    setBusy(false)
    if (result.ok) onSaved(fields)
  }

  return (
    <form className={styles.drawerSection} onSubmit={submit}>
      <h3><UserCog size={16} /> Hồ sơ</h3>
      <div className={styles.formGrid}>
        {EDITABLE.map(([key, label]) => (
          <Field key={key} label={label}>
            <input value={form[key]} onChange={(event) => setForm((f) => ({ ...f, [key]: event.target.value }))} autoComplete="off" />
          </Field>
        ))}
        <Field label="Trạng thái">
          <select className={styles.select} value={form.status_code} onChange={(event) => setForm((f) => ({ ...f, status_code: event.target.value }))}>
            {!ACCOUNT_STATUSES.includes(form.status_code) && <option value={form.status_code}>{statusName(form.status_code)}</option>}
            {ACCOUNT_STATUSES.map((status) => <option key={status} value={status}>{statusName(status)}</option>)}
          </select>
        </Field>
      </div>
      {invalid && <p className={styles.formError}>Kiểm tra lại: email hợp lệ, số điện thoại 10–11 chữ số, username ≥ 3 ký tự chữ/số.</p>}
      <div className={styles.formActions}>
        <Button onClick={() => setForm(initial)} disabled={!Object.keys(changed).length}>Hoàn tác</Button>
        <Button type="submit" variant="primary" disabled={!Object.keys(changed).length || invalid || busy}>Lưu thay đổi</Button>
      </div>
    </form>
  )
}

// ================================================================ VAI TRÒ & QUYỀN

export function RolesPage() {
  const { run } = useAdminWrite()
  const data = useRemote(async () => {
    const [roles, permissions] = await Promise.all([adminApi.roles(), adminApi.permissions()])
    return { roles: collection(roles), permissions: collection(permissions) }
  }, [])
  const [grants, setGrants] = useState({})
  const [editor, setEditor] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [busyCell, setBusyCell] = useState('')

  const roles = data.data?.roles ?? []
  const permissions = data.data?.permissions ?? []

  function has(role, perm) {
    const key = `${codeOf(role)}|${perm}`
    return key in grants ? grants[key] : rolePermissions(role).has(perm)
  }

  async function toggle(role, perm) {
    const roleCode = codeOf(role)
    const key = `${roleCode}|${perm}`
    const next = !has(role, perm)
    setBusyCell(key)
    const result = await run(() => (next ? adminApi.grantPermission(roleCode, perm) : adminApi.revokePermission(roleCode, perm)), {
      success: `${next ? 'Đã cấp' : 'Đã thu'} ${perm} ${next ? 'cho' : 'khỏi'} ${roleCode}.`,
    })
    setBusyCell('')
    if (result.ok) setGrants((g) => ({ ...g, [key]: next }))
  }

  const matrixKnown = roles.some((role) => Array.isArray(role?.permissions) || Array.isArray(role?.permission_codes))

  return (
    <>
      <Panel
        title="Vai trò"
        description="Vai trò quyết định ai được vào trang quản trị và dùng lệnh nào."
        actions={<><RefreshButton onClick={() => { setGrants({}); data.reload() }} busy={data.status === 'loading'} /><Button size="sm" variant="primary" onClick={() => setEditor({})}><Plus size={15} /> Vai trò mới</Button></>}
        flush
      >
        {data.status !== 'ready' || !roles.length ? <StateView resource={data} empty={!roles.length} emptyTitle="Chưa có vai trò" onRetry={data.reload} /> : (
          <div className={styles.roleCards}>
            {roles.map((role) => {
              const roleCode = codeOf(role)
              return (
                <article className={styles.roleCard} key={roleCode}>
                  <div>
                    <strong>{roleCode}</strong>
                    <p>{text(role.description, 'Chưa có mô tả')}</p>
                    <span className={styles.badge} data-tone={role.admin_portal_access ? 'success' : 'neutral'}>{role.admin_portal_access ? 'Vào được quản trị' : 'Khu người chơi'}</span>
                  </div>
                  <div className={styles.roleActions}>
                    <Button size="sm" onClick={() => setEditor(role)}>Sửa</Button>
                    {!PROTECTED_ROLES.has(roleCode.toUpperCase()) && <Button size="sm" variant="icon" aria-label={`Xoá vai trò ${roleCode}`} onClick={() => setRemoving(roleCode)}><Trash2 size={15} /></Button>}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </Panel>

      {data.status === 'ready' && permissions.length > 0 && roles.length > 0 && (
        <Panel title="Ma trận quyền" description={matrixKnown ? 'Tick để cấp quyền cho vai trò, bỏ tick để thu hồi.' : 'Máy chủ không trả danh sách quyền theo vai trò; ô hiển thị thay đổi trong phiên này.'} flush>
          <div className={styles.tableWrap}>
            <table className={styles.table} data-matrix="true">
              <thead><tr><th>Quyền</th>{roles.map((role) => <th key={codeOf(role)} className={styles.center}>{codeOf(role)}</th>)}</tr></thead>
              <tbody>
                {permissions.map((permission) => {
                  const perm = codeOf(permission)
                  return (
                    <tr key={perm}>
                      <th scope="row"><strong className={styles.mono}>{perm}</strong>{permission?.description && <small className={styles.cellSub}>{permission.description}</small>}</th>
                      {roles.map((role) => {
                        const key = `${codeOf(role)}|${perm}`
                        return (
                          <td key={key} className={styles.center}>
                            <input type="checkbox" className={styles.matrixCheck} checked={has(role, perm)} disabled={busyCell === key} aria-label={`${perm} cho ${codeOf(role)}`} onChange={() => toggle(role, perm)} />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {editor && <RoleEditor role={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); data.reload() }} />}
      {removing && (
        <ConfirmDialog
          title={`Xoá vai trò ${removing}?`}
          description="Tài khoản đang có vai trò này sẽ mất các quyền đi kèm."
          confirmLabel="Xoá vai trò"
          onClose={() => setRemoving(null)}
          onConfirm={async () => { const r = await run(() => adminApi.deleteRole(removing), { success: `Đã xoá ${removing}.` }); if (r.ok) { setRemoving(null); data.reload() } }}
        />
      )}
    </>
  )
}

function RoleEditor({ role, onClose, onSaved }) {
  const { run } = useAdminWrite()
  const existing = Boolean(codeOf(role))
  const [code, setCode] = useState(codeOf(role))
  const [description, setDescription] = useState(role.description ?? '')
  const [portal, setPortal] = useState(Boolean(role.admin_portal_access))
  const valid = /^[A-Z0-9_]{2,}$/.test(code)
  return (
    <Modal title={existing ? `Sửa ${code}` : 'Tạo vai trò'} onClose={onClose}>
      <form onSubmit={async (event) => {
        event.preventDefault()
        const r = await run(() => adminApi.saveRole(code, { description: description.trim(), admin_portal_access: portal }), { success: 'Đã lưu vai trò.' })
        if (r.ok) onSaved()
      }}>
        <Field label="Mã vai trò" hint="Chữ in hoa, số và dấu gạch dưới, ví dụ MODERATOR.">
          <input value={code} disabled={existing} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} autoFocus={!existing} />
        </Field>
        <Field label="Mô tả"><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} /></Field>
        <label className={styles.check}><input type="checkbox" checked={portal} onChange={(event) => setPortal(event.target.checked)} /> Cho phép vào trang quản trị</label>
        <div className={styles.modalActions}><Button onClick={onClose}>Huỷ</Button><Button type="submit" variant="primary" disabled={!valid}>Lưu</Button></div>
      </form>
    </Modal>
  )
}

// ================================================================ THÔNG BÁO

export function NotificationsPage() {
  const { run } = useAdminWrite()
  const [page, setPage] = useState(1)
  const list = useRemote(() => adminApi.notifications({ page, pageSize: PAGE_SIZE }), [page])
  const stats = useRemote(() => adminApi.notificationStats().then(statEntries).catch(() => null), [])
  const [removing, setRemoving] = useState(null)
  const rows = collection(list.data)
  const reloadAll = () => { list.reload(); stats.reload() }

  return (
    <>
      {stats.status === 'ready' && stats.data?.length > 0 && (
        <div className={styles.kpis}>{stats.data.slice(0, 5).map(([label, value]) => <div className={styles.kpi} key={label}><span className={styles.kpiLabel}>{statLabel(label)}</span><strong>{numberLabel(value)}</strong></div>)}</div>
      )}
      <div className={styles.split}>
        <NotificationComposer onSent={() => { setPage(1); reloadAll() }} />
        <Panel title="Đã gửi" actions={<RefreshButton onClick={reloadAll} busy={list.status === 'loading'} />} flush>
          {list.status !== 'ready' || !rows.length ? <StateView resource={list} empty={!rows.length} emptyTitle="Chưa có thông báo" emptyText="Thông báo bạn gửi sẽ hiện ở đây." onRetry={list.reload} /> : (
            <ul className={styles.feed}>
              {rows.map((row, index) => {
                const id = row.notification_id ?? row.id
                return (
                  <li key={text(id, index)}>
                    <span className={styles.feedIcon} data-type={String(row.type_code ?? 'INFO').toUpperCase()}><Bell size={15} /></span>
                    <div>
                      <strong>{text(row.title)}</strong>
                      {row.description && <p>{row.description}</p>}
                      <small>{text(row.type_code, 'INFO')} · ưu tiên {numberLabel(Number(row.display_priority) || 0)} · {row.account_id ? `gửi #${row.account_id}` : 'mọi người'} · {dateLabel(row.created_at)}</small>
                    </div>
                    {id != null && <Button size="sm" variant="icon" aria-label="Xoá thông báo" onClick={() => setRemoving(id)}><Trash2 size={15} /></Button>}
                  </li>
                )
              })}
            </ul>
          )}
          {list.status === 'ready' && <Pager data={list.data} page={page} onPage={setPage} />}
        </Panel>
      </div>
      {removing != null && (
        <ConfirmDialog
          title="Xoá thông báo?"
          description="Người dùng sẽ không còn thấy thông báo này."
          confirmLabel="Xoá"
          onClose={() => setRemoving(null)}
          onConfirm={async () => { const r = await run(() => adminApi.deleteNotification(removing), { success: 'Đã xoá thông báo.' }); if (r.ok) { setRemoving(null); reloadAll() } }}
        />
      )}
    </>
  )
}

const EMPTY_NOTICE = { type_code: 'INFO', title: '', description: '', content: '', account_ids: '', display_priority: '0', expires_at: '' }

function NotificationComposer({ onSent }) {
  const { run } = useAdminWrite()
  const [form, setForm] = useState(EMPTY_NOTICE)
  const [busy, setBusy] = useState(false)
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }))
  const ids = parseIdList(form.account_ids)
  const priority = Number(form.display_priority)
  const errors = [
    !form.title.trim() && 'Cần tiêu đề.',
    ids === null && 'Danh sách ID chỉ gồm số nguyên dương, cách nhau bởi dấu phẩy.',
    !Number.isInteger(priority) && 'Mức ưu tiên phải là số nguyên.',
    form.expires_at && !toRfc3339(form.expires_at) && 'Thời hạn không hợp lệ.',
  ].filter(Boolean)

  async function submit(event) {
    event.preventDefault()
    if (errors.length) return
    const body = {
      type_code: form.type_code,
      title: form.title.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      ...(form.content.trim() ? { content: form.content.trim() } : {}),
      ...(ids?.length ? { account_ids: ids } : {}),
      display_priority: priority,
      ...(form.expires_at ? { expires_at: toRfc3339(form.expires_at) } : {}),
    }
    setBusy(true)
    const r = await run(() => adminApi.createNotification(body), { success: ids?.length ? `Đã gửi tới ${ids.length} tài khoản.` : 'Đã gửi tới mọi người.' })
    setBusy(false)
    if (r.ok) { setForm(EMPTY_NOTICE); onSent() }
  }

  return (
    <Panel title="Soạn thông báo" actions={<BellPlus size={18} className={styles.muted} />}>
      <form onSubmit={submit} className={styles.stack}>
        <div className={styles.formGrid}>
          <Field label="Loại">
            <select className={styles.select} value={form.type_code} onChange={set('type_code')}>{NOTIFICATION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </Field>
          <Field label="Mức ưu tiên" hint="Số lớn hiển thị trước."><input type="number" step="1" value={form.display_priority} onChange={set('display_priority')} /></Field>
        </div>
        <Field label="Tiêu đề"><input value={form.title} onChange={set('title')} maxLength={200} required /></Field>
        <Field label="Mô tả ngắn"><input value={form.description} onChange={set('description')} maxLength={500} /></Field>
        <Field label="Nội dung chi tiết" hint="Hiện khi người dùng mở thông báo."><textarea rows={4} value={form.content} onChange={set('content')} /></Field>
        <div className={styles.formGrid}>
          <Field label="Gửi tới ID tài khoản" hint="Để trống để gửi mọi người."><input value={form.account_ids} onChange={set('account_ids')} placeholder="vd. 12, 48" /></Field>
          <Field label="Hết hạn"><input type="datetime-local" value={form.expires_at} onChange={set('expires_at')} /></Field>
        </div>
        {form.title.trim() && (
          <div className={styles.preview} data-type={form.type_code}>
            <small>Xem trước</small>
            <strong>{form.title.trim()}</strong>
            {form.description.trim() && <p>{form.description.trim()}</p>}
          </div>
        )}
        {errors.length > 0 && form.title && <p className={styles.formError}>{errors.join(' ')}</p>}
        <div className={styles.formActions}>
          <Button onClick={() => setForm(EMPTY_NOTICE)}>Xoá nháp</Button>
          <Button type="submit" variant="primary" disabled={busy || errors.length > 0}><Mail size={15} /> Gửi thông báo</Button>
        </div>
      </form>
    </Panel>
  )
}

// ================================================================ DANH SÁCH CHẶN

export function BlacklistPage() {
  const { run } = useAdminWrite()
  const [page, setPage] = useState(1)
  const list = useRemote(() => adminApi.blacklist({ page, pageSize: PAGE_SIZE }), [page])
  const [form, setForm] = useState({ email: '', ip_address: '', reason: '', expires_at: '' })
  const [removing, setRemoving] = useState(null)
  const rows = collection(list.data)
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }))
  const email = form.email.trim()
  const ip = form.ip_address.trim()
  const valid = (email || ip) && (!email || isEmail(email)) && (!ip || isIp(ip)) && form.reason.trim().length >= 3 && (!form.expires_at || toRfc3339(form.expires_at))

  async function submit(event) {
    event.preventDefault()
    const body = {
      ...(email ? { email } : {}), ...(ip ? { ip_address: ip } : {}), reason: form.reason.trim(),
      ...(form.expires_at ? { expires_at: toRfc3339(form.expires_at) } : {}),
    }
    const r = await run(() => adminApi.addBlacklist(body), { success: 'Đã thêm vào danh sách chặn.' })
    if (r.ok) { setForm({ email: '', ip_address: '', reason: '', expires_at: '' }); list.reload() }
  }

  return (
    <>
      <Panel title="Chặn email hoặc IP" description="Cần ít nhất email hoặc địa chỉ IP. Tài khoản đã BANNED không tự mở lại khi gỡ chặn.">
        <form onSubmit={submit} className={styles.inlineForm}>
          <Field label="Email"><input type="email" value={form.email} onChange={set('email')} placeholder="spam@example.com" /></Field>
          <Field label="Địa chỉ IP"><input value={form.ip_address} onChange={set('ip_address')} placeholder="203.0.113.7" /></Field>
          <Field label="Lý do"><input value={form.reason} onChange={set('reason')} maxLength={300} /></Field>
          <Field label="Hết hạn (tuỳ chọn)"><input type="datetime-local" value={form.expires_at} onChange={set('expires_at')} /></Field>
          <Button type="submit" variant="danger" disabled={!valid}><Ban size={15} /> Chặn</Button>
        </form>
      </Panel>
      <Panel title="Đang bị chặn" actions={<RefreshButton onClick={list.reload} busy={list.status === 'loading'} />} flush>
        {list.status !== 'ready' || !rows.length ? <StateView resource={list} empty={!rows.length} emptyTitle="Danh sách chặn trống" onRetry={list.reload} /> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Đối tượng</th><th>Lý do</th><th>Tạo lúc</th><th>Hết hạn</th><th aria-label="Thao tác" /></tr></thead>
              <tbody>
                {rows.map((row, index) => {
                  const id = row.black_id ?? row.blacklist_id ?? row.id
                  return (
                    <tr key={text(id, index)}>
                      <td><strong>{text(row.email, row.ip_address)}</strong>{row.email && row.ip_address && <small className={styles.cellSub}>{row.ip_address}</small>}</td>
                      <td>{text(row.reason)}</td>
                      <td className={styles.nowrap}>{dateLabel(row.created_at)}</td>
                      <td className={styles.nowrap}>{row.expires_at ? dateLabel(row.expires_at) : 'Vĩnh viễn'}</td>
                      <td>{id != null && <Button size="sm" onClick={() => setRemoving(id)}>Gỡ chặn</Button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {list.status === 'ready' && <Pager data={list.data} page={page} onPage={setPage} />}
      </Panel>
      {removing != null && (
        <ConfirmDialog
          title="Gỡ chặn?"
          description="Email/IP này sẽ có thể đăng ký và đăng nhập lại."
          confirmLabel="Gỡ chặn"
          tone="primary"
          onClose={() => setRemoving(null)}
          onConfirm={async () => { const r = await run(() => adminApi.removeBlacklist(removing), { success: 'Đã gỡ chặn.' }); if (r.ok) { setRemoving(null); list.reload() } }}
        />
      )}
    </>
  )
}

// ================================================================ NHẬT KÝ

function JournalTable({ rows }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>Thời điểm</th><th>Hoạt động</th><th>Tài khoản</th><th>IP</th><th>Kết quả</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={text(row.journal_id, row.id, index)}>
              <td className={styles.nowrap}>{dateLabel(row.created_at ?? row.timestamp)}</td>
              <td><strong>{text(row.action, row.action_code, row.command_code, row.command, row.type_code)}</strong>{row.description && <small className={styles.cellSub}>{text(row.description)}</small>}</td>
              <td>{text(row.username, row.account_name, row.name, row.account_id)}</td>
              <td className={styles.mono}>{text(row.ip_address, row.ip)}</td>
              <td>{row.status_code ? <Status value={row.status_code} /> : typeof row.success === 'boolean' ? <span className={styles.badge} data-tone={row.success ? 'success' : 'error'}>{row.success ? 'Thành công' : 'Lỗi'}</span> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function JournalsPage() {
  const [query, setQuery] = useState({ search: '', page: 1 })
  const list = useRemote(() => adminApi.journals({ ...query, pageSize: PAGE_SIZE }), [query])
  const rows = collection(list.data)
  return (
    <Panel flush>
      <SearchBar placeholder="Tìm tài khoản, hành động hoặc IP" initial={query.search} onSearch={(search) => setQuery({ search, page: 1 })}>
        <RefreshButton onClick={list.reload} busy={list.status === 'loading'} />
      </SearchBar>
      {list.status !== 'ready' || !rows.length ? <StateView resource={list} empty={!rows.length} emptyTitle="Không có hoạt động phù hợp" onRetry={list.reload} /> : <JournalTable rows={rows} />}
      {list.status === 'ready' && <Pager data={list.data} page={query.page} onPage={(page) => setQuery((q) => ({ ...q, page }))} />}
    </Panel>
  )
}

// ================================================================ LỆNH

export function CommandsPage() {
  const { run } = useAdminWrite()
  const [query, setQuery] = useState({ search: '', page: 1 })
  const list = useRemote(() => adminApi.commandList({ ...query, pageSize: PAGE_SIZE }), [query])
  const roles = useRemote(() => adminApi.roles().catch(() => []), [])
  const [open, setOpen] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [roleOverrides, setRoleOverrides] = useState({})
  const rows = collection(list.data)
  const allRoles = roleList(roles.data)

  async function toggleRole(command, role, has) {
    const r = await run(() => (has ? adminApi.revokeCommandRole(command, role) : adminApi.grantCommandRole(command, role)), {
      success: `${has ? 'Đã thu' : 'Đã cấp'} ${command} ${has ? 'khỏi' : 'cho'} ${role}.`,
    })
    if (r.ok) setRoleOverrides((o) => ({ ...o, [`${command}|${role}`]: !has }))
  }

  return (
    <>
      <Panel flush>
        <SearchBar placeholder="Tìm mã hoặc tên lệnh" initial={query.search} onSearch={(search) => setQuery({ search, page: 1 })}>
          <RefreshButton onClick={() => { setRoleOverrides({}); list.reload() }} busy={list.status === 'loading'} />
        </SearchBar>
        {list.status !== 'ready' || !rows.length ? <StateView resource={list} empty={!rows.length} emptyTitle="Không có lệnh phù hợp" onRetry={list.reload} /> : (
          <ul className={styles.commandList}>
            {rows.map((row, index) => {
              const command = text(row.command_code, row.code, row.name, `#${index + 1}`)
              const expanded = open === command
              const params = collection(row.parameters)
              const commandRoles = new Set(roleList(row.roles))
              const hasRole = (role) => roleOverrides[`${command}|${role}`] ?? commandRoles.has(role)
              return (
                <li key={command} data-open={expanded || undefined}>
                  <button type="button" className={styles.commandHead} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : command)}>
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span className={styles.mono}>{command}</span>
                    <span className={styles.commandName}>{text(row.name, row.description, '')}</span>
                    <span className={styles.chip}>{text(row.method_type, row.type_code)}</span>
                    {row.status_code && <Status value={row.status_code} />}
                  </button>
                  {expanded && (
                    <div className={styles.commandBody}>
                      {row.description && <p className={styles.muted}>{row.description}</p>}
                      {row.script && <pre className={styles.code}>{String(row.script)}</pre>}
                      <h4>Tham số</h4>
                      {params.length ? (
                        <table className={styles.table} data-compact="true">
                          <thead><tr><th>Tên</th><th>Kiểu</th><th>Bắt buộc</th><th>Gợi ý</th></tr></thead>
                          <tbody>{params.map((param, i) => <tr key={text(param.parameter_code, param.name, i)}><td className={styles.mono}>{text(param.name, param.parameter_code)}</td><td>{text(param.type_code)}</td><td>{param.required ? 'Có' : 'Không'}</td><td>{text(param.suggest, param.description)}</td></tr>)}</tbody>
                        </table>
                      ) : <p className={styles.muted}>Không có tham số.</p>}
                      <h4>Vai trò được dùng</h4>
                      <div className={styles.chips}>
                        {(allRoles.length ? allRoles : [...commandRoles]).map((role) => (
                          <button key={role} type="button" className={styles.chipToggle} aria-pressed={hasRole(role)} onClick={() => toggleRole(command, role, hasRole(role))}>{role}</button>
                        ))}
                      </div>
                      <div className={styles.formActions}><Button variant="danger-ghost" size="sm" onClick={() => setRemoving(command)}><Trash2 size={15} /> Xoá lệnh</Button></div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {list.status === 'ready' && <Pager data={list.data} page={query.page} onPage={(page) => setQuery((q) => ({ ...q, page }))} />}
      </Panel>
      {removing && (
        <ConfirmDialog
          title={`Xoá lệnh ${removing}?`}
          description="Lệnh và tham số sẽ bị xoá; người dùng không còn gọi được."
          confirmLabel="Xoá lệnh"
          onClose={() => setRemoving(null)}
          onConfirm={async () => { const r = await run(() => adminApi.deleteCommand(removing), { success: 'Đã xoá lệnh.' }); if (r.ok) { setRemoving(null); setOpen(null); list.reload() } }}
        />
      )}
    </>
  )
}

// ================================================================ HỆ THỐNG

export function SystemPage() {
  const { run } = useAdminWrite()
  const [confirm, setConfirm] = useState(null)
  const deleted = useRemote(() => adminApi.accountCount({ status: 'DELETE' }).then(countOf).catch(() => null), [])
  return (
    <>
      <div className={styles.grid2}>
        <Panel title="Dọn dẹp cơ sở dữ liệu" actions={<Eraser size={18} className={styles.muted} />}>
          <p className={styles.muted}>Xoá token hết hạn, OTP cũ và bản ghi tạm. Thường chạy định kỳ; dùng khi cần giải phóng ngay.</p>
          <div className={styles.formActions}><Button variant="primary" onClick={() => setConfirm('clean')}><Database size={15} /> Chạy dọn dẹp</Button></div>
        </Panel>
        <Panel title="Xoá hẳn tài khoản chờ xoá" actions={<Trash2 size={18} className={styles.muted} />}>
          <p className={styles.muted}>Hiện có <strong>{deleted.status === 'ready' ? numberLabel(deleted.data) : '…'}</strong> tài khoản ở trạng thái chờ xoá. Thao tác này <strong>không hoàn tác được</strong>.</p>
          <div className={styles.formActions}><Button variant="danger" onClick={() => setConfirm('purge')}><Trash2 size={15} /> Xoá vĩnh viễn</Button></div>
        </Panel>
      </div>
      <Panel title="Ghi chú vận hành" actions={<FileClock size={18} className={styles.muted} />}>
        <ul className={styles.notes}>
          <li><ShieldPlus size={15} /> Mọi thao tác ghi cần mã TOTP đã xác minh trong 10 phút gần nhất, gắn với access token hiện tại.</li>
          <li><Terminal size={15} /> Thay đổi lệnh/vai trò xoá cache lệnh ngay, người dùng thấy ở lần gọi kế tiếp.</li>
          <li><KeyRound size={15} /> Khởi động lại máy chủ làm mất cửa sổ TOTP và mọi access token.</li>
        </ul>
      </Panel>
      {confirm === 'clean' && (
        <ConfirmDialog title="Chạy dọn dẹp ngay?" description="Có thể mất vài giây." confirmLabel="Chạy" tone="primary" onClose={() => setConfirm(null)}
          onConfirm={async () => { const r = await run(() => adminApi.clean(), { success: 'Đã dọn dẹp cơ sở dữ liệu.' }); if (r.ok) setConfirm(null) }} />
      )}
      {confirm === 'purge' && (
        <ConfirmDialog title="Xoá vĩnh viễn tài khoản chờ xoá?" description="Dữ liệu sẽ mất hẳn và không thể khôi phục." confirmLabel="Xoá vĩnh viễn" phrase="XOA" onClose={() => setConfirm(null)}
          onConfirm={async () => { const r = await run(() => adminApi.purgeDeleted(), { success: 'Đã xoá các tài khoản chờ xoá.' }); if (r.ok) { setConfirm(null); deleted.reload() } }} />
      )}
    </>
  )
}
