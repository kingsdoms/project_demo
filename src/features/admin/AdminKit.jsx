import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, CircleAlert, Copy, Inbox, KeyRound, LoaderCircle, RefreshCw, ShieldCheck, X,
} from 'lucide-react'
import { adminApi, isTotpRequiredError } from '@/services/api/admin'
import { toast } from '@/stores/useToastStore'
import { mmss, numberLabel, statusInfo } from './adminFormat'
import { copyText, useAdminWrite, WriteContext } from './adminHooks'
import styles from './AdminConsole.module.css'

// ---------------------------------------------------------------- khối giao diện

export function Button({ variant = 'ghost', size, className = '', children, ...props }) {
  return (
    <button type="button" className={`${styles.btn} ${className}`} data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  )
}

export function Panel({ title, description, actions, children, className = '', flush = false }) {
  return (
    <section className={`${styles.panel} ${className}`} data-flush={flush || undefined}>
      {(title || actions) && (
        <header className={styles.panelHead}>
          <div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>
          {actions && <div className={styles.panelActions}>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function StateView({ resource, empty, emptyTitle = 'Chưa có dữ liệu', emptyText, onRetry }) {
  if (resource.status === 'loading') {
    return <div className={styles.state} role="status"><LoaderCircle className={styles.spin} size={22} /><span>Đang tải dữ liệu…</span></div>
  }
  if (resource.status === 'error') {
    return (
      <div className={styles.state} role="alert">
        <CircleAlert size={22} data-tone="error" />
        <strong>Không tải được dữ liệu</strong>
        <p>{resource.error?.message || 'Đã có lỗi xảy ra.'}</p>
        {onRetry && <Button onClick={onRetry}><RefreshCw size={15} /> Thử lại</Button>}
      </div>
    )
  }
  if (empty) {
    return <div className={styles.state}><Inbox size={22} /><strong>{emptyTitle}</strong>{emptyText && <p>{emptyText}</p>}</div>
  }
  return null
}

export function Pager({ data, page, onPage }) {
  const totalPages = data?.totalPages || 1
  const totalItems = data?.totalItems
  if (!data) return null
  return (
    <nav className={styles.pager} aria-label="Phân trang">
      <span>{typeof totalItems === 'number' ? `${numberLabel(totalItems)} mục · ` : ''}Trang {page} / {Math.max(totalPages, 1)}</span>
      <div>
        <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước"><ArrowLeft size={15} /></Button>
        <Button size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Trang sau"><ArrowRight size={15} /></Button>
      </div>
    </nav>
  )
}

export function Status({ value }) {
  const [label, tone] = statusInfo(value)
  return <span className={styles.badge} data-tone={tone}>{label}</span>
}

export function Field({ label, hint, children, wide = false }) {
  return (
    <label className={styles.field} data-wide={wide || undefined}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function Modal({ title, description, onClose, children, size }) {
  const ref = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open && typeof dialog.showModal === 'function') dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])
  return (
    <dialog
      ref={ref}
      className={styles.modal}
      data-size={size}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose() }}
    >
      <header className={styles.modalHead}>
        <div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>
        <Button variant="icon" onClick={onClose} aria-label="Đóng"><X size={17} /></Button>
      </header>
      <div className={styles.modalBody}>{children}</div>
    </dialog>
  )
}

/** Hộp xác nhận; `phrase` buộc gõ đúng chuỗi trước khi cho phép. */
export function ConfirmDialog({ title, description, confirmLabel = 'Xác nhận', tone = 'danger', phrase, onConfirm, onClose }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = !phrase || typed.trim() === phrase
  return (
    <Modal title={title} description={description} onClose={onClose}>
      {phrase && (
        <Field label={`Gõ ${phrase} để xác nhận`}>
          <input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" autoFocus />
        </Field>
      )}
      <div className={styles.modalActions}>
        <Button onClick={onClose}>Huỷ</Button>
        <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
          disabled={!ready || busy}
          onClick={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false) } }}
        >
          {busy && <LoaderCircle className={styles.spin} size={15} />} {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export function Drawer({ title, subtitle, onClose, children }) {
  const titleId = useId()
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={styles.drawerLayer}>
      <button type="button" className={styles.drawerScrim} aria-label="Đóng" onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.drawerHead}>
          <div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <Button variant="icon" onClick={onClose} aria-label="Đóng"><X size={18} /></Button>
        </header>
        <div className={styles.drawerBody}>{children}</div>
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------- ghi dữ liệu + TOTP

export function AdminWriteProvider({ children }) {
  const [pending, setPending] = useState(null)
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    const tick = () => setRemaining(adminApi.totpRemaining())
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  const execute = useCallback(async (fn, success) => {
    const value = await fn()
    if (success) toast.success(success)
    setRemaining(adminApi.totpRemaining())
    return { ok: true, value }
  }, [])

  const run = useCallback(async (fn, { success, quiet = false } = {}) => {
    try {
      return await execute(fn, success)
    } catch (error) {
      if (isTotpRequiredError(error)) {
        return new Promise((resolve) => setPending({ fn, success, resolve, quiet }))
      }
      if (!quiet) toast.error(error?.message || 'Thao tác không thành công.')
      return { ok: false, error }
    }
  }, [execute])

  const openVerify = useCallback(() => setPending({ fn: null, resolve: () => {} }), [])

  async function onVerified() {
    const job = pending
    setPending(null)
    setRemaining(adminApi.totpRemaining())
    if (!job?.fn) { toast.success('Đã xác minh TOTP. Bạn có 10 phút để thực hiện thao tác ghi.'); return }
    try {
      job.resolve(await execute(job.fn, job.success))
    } catch (error) {
      toast.error(error?.message || 'Thao tác không thành công.')
      job.resolve({ ok: false, error })
    }
  }

  function onCancel() {
    pending?.resolve({ ok: false, cancelled: true })
    setPending(null)
  }

  const value = useMemo(() => ({ run, remaining, openVerify }), [run, remaining, openVerify])
  return (
    <WriteContext.Provider value={value}>
      {children}
      {pending && <TotpDialog retrying={Boolean(pending.fn)} onVerified={onVerified} onClose={onCancel} />}
    </WriteContext.Provider>
  )
}

export function TotpBadge() {
  const { remaining, openVerify } = useAdminWrite()
  return remaining > 0
    ? <span className={styles.totpBadge} data-active="true" title="Cửa sổ thao tác ghi"><ShieldCheck size={14} /> TOTP còn {mmss(remaining)}</span>
    : <button type="button" className={styles.totpBadge} onClick={openVerify}><KeyRound size={14} /> Xác minh TOTP</button>
}

function TotpDialog({ retrying, onVerified, onClose }) {
  const [tab, setTab] = useState('verify')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [setup, setSetup] = useState(null)
  const [renew, setRenew] = useState(false)
  const [recoveryInput, setRecoveryInput] = useState('')
  const [recovery, setRecovery] = useState('')

  const cleanCode = code.replace(/\D/g, '').slice(0, 6)

  async function attempt(fn) {
    setBusy(true)
    setError('')
    try { return await fn() } catch (err) {
      setError(err?.status === 429 ? 'Sai quá nhiều lần. Hãy đợi 5 phút rồi thử lại.' : err?.message || 'Không thành công.')
      return null
    } finally { setBusy(false) }
  }

  async function verify(event) {
    event.preventDefault()
    const result = await attempt(() => adminApi.totpVerify(cleanCode))
    if (!result) return
    if (result.valid) onVerified()
    else { setError('Mã không đúng hoặc đã được dùng. Hãy đợi mã mới.'); setCode('') }
  }

  async function startSetup() {
    const result = await attempt(() => adminApi.totpSetup({ renew }))
    if (result) { setSetup(result); setCode('') }
  }

  async function confirm(event) {
    event.preventDefault()
    const result = await attempt(() => adminApi.totpConfirm({ code: cleanCode, recovery_code: setup?.renew ? recoveryInput.trim() : undefined }))
    if (result !== null) setRecovery(typeof result === 'string' ? result : String(result?.recovery_code ?? ''))
  }

  return (
    <Modal
      title="Xác minh hai lớp cho quản trị"
      description={retrying ? 'Thao tác này cần mã TOTP. Sau khi xác minh, thao tác sẽ được thực hiện tiếp.' : 'Mỗi lần xác minh mở cửa sổ 10 phút cho thao tác ghi.'}
      onClose={onClose}
    >
      {recovery ? (
        <div className={styles.totpDone}>
          <ShieldCheck size={28} />
          <strong>Đã bật TOTP</strong>
          <p>Lưu mã khôi phục dưới đây ở nơi an toàn. Mã chỉ hiển thị một lần và cần khi bạn đổi thiết bị.</p>
          <code className={styles.secret}>{recovery || 'Máy chủ không trả mã khôi phục'}</code>
          <div className={styles.modalActions}>
            {recovery && <Button onClick={() => copyText(recovery)}><Copy size={15} /> Sao chép</Button>}
            <Button variant="primary" onClick={onVerified}>Tôi đã lưu, tiếp tục</Button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.tabs} role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'verify'} onClick={() => { setTab('verify'); setError('') }}>Xác minh</button>
            <button type="button" role="tab" aria-selected={tab === 'setup'} onClick={() => { setTab('setup'); setError('') }}>Thiết lập</button>
          </div>
          {tab === 'verify' ? (
            <form onSubmit={verify} className={styles.totpForm}>
              <Field label="Mã 6 số trong ứng dụng Authenticator">
                <input className={styles.otpInput} inputMode="numeric" autoComplete="one-time-code" value={cleanCode} onChange={(event) => setCode(event.target.value)} autoFocus placeholder="••••••" />
              </Field>
              {error && <p className={styles.formError} role="alert">{error}</p>}
              <p className={styles.hint}>Chưa thiết lập TOTP? Chuyển sang tab <b>Thiết lập</b>.</p>
              <div className={styles.modalActions}>
                <Button onClick={onClose}>Huỷ</Button>
                <Button type="submit" variant="primary" disabled={cleanCode.length !== 6 || busy}>{busy && <LoaderCircle className={styles.spin} size={15} />} Xác minh</Button>
              </div>
            </form>
          ) : !setup ? (
            <div className={styles.totpForm}>
              <p className={styles.hint}>Tạo khoá bí mật mới rồi thêm vào Google Authenticator, Authy hoặc 1Password. Khoá chỉ giữ 10 phút cho đến khi xác nhận.</p>
              <label className={styles.check}><input type="checkbox" checked={renew} onChange={(event) => setRenew(event.target.checked)} /> Thay TOTP hiện có (cần mã khôi phục)</label>
              {error && <p className={styles.formError} role="alert">{error}{/409|đã có|exist/i.test(error) ? ' Hãy chọn "Thay TOTP hiện có".' : ''}</p>}
              <div className={styles.modalActions}>
                <Button onClick={onClose}>Huỷ</Button>
                <Button variant="primary" disabled={busy} onClick={startSetup}>{busy && <LoaderCircle className={styles.spin} size={15} />} Tạo khoá</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={confirm} className={styles.totpForm}>
              <p className={styles.hint}>Trong ứng dụng Authenticator, chọn <b>Nhập khoá thủ công</b> và dán khoá bên dưới (tài khoản {setup.account || 'của bạn'}, nhà phát hành {setup.issuer || 'Core'}). Trên điện thoại có thể mở trực tiếp liên kết otpauth.</p>
              <div className={styles.secretRow}>
                <code className={styles.secret}>{setup.secret}</code>
                <Button size="sm" onClick={() => copyText(setup.secret)} aria-label="Sao chép khoá"><Copy size={15} /></Button>
              </div>
              {setup.otpauth_uri && (
                <div className={styles.secretRow}>
                  <a className={styles.otpLink} href={setup.otpauth_uri}>Mở trong ứng dụng Authenticator</a>
                  <Button size="sm" onClick={() => copyText(setup.otpauth_uri)}>Sao chép URI</Button>
                </div>
              )}
              <Field label="Mã 6 số hiện trong ứng dụng">
                <input className={styles.otpInput} inputMode="numeric" autoComplete="one-time-code" value={cleanCode} onChange={(event) => setCode(event.target.value)} placeholder="••••••" />
              </Field>
              {setup.renew && (
                <Field label="Mã khôi phục cũ">
                  <input value={recoveryInput} onChange={(event) => setRecoveryInput(event.target.value)} autoComplete="off" />
                </Field>
              )}
              {error && <p className={styles.formError} role="alert">{error}</p>}
              <div className={styles.modalActions}>
                <Button onClick={() => setSetup(null)}>Quay lại</Button>
                <Button type="submit" variant="primary" disabled={cleanCode.length !== 6 || busy || (setup.renew && !recoveryInput.trim())}>{busy && <LoaderCircle className={styles.spin} size={15} />} Xác nhận</Button>
              </div>
            </form>
          )}
        </>
      )}
    </Modal>
  )
}
