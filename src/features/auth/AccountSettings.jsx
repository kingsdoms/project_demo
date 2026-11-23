import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight, AtSign, Camera, Check, KeyRound, Link2, LoaderCircle, LogOut, Mail, Phone,
  Save, ShieldCheck, ShieldOff, Trash2, TriangleAlert, Unlink, UserRound,
} from 'lucide-react'
import { AVATAR_MAX_BYTES, OTP_PURPOSE, accountApi } from '@/services/api/account'
import { authApi } from '@/services/api/auth'
import { clearAuthSession, getAuthSession } from '@/services/api/client'
import { oauthApi } from '@/services/api/oauth'
import { useAuthStore } from '@/stores/useAuthStore'
import { toast } from '@/stores/useToastStore'
import GoogleButton from './GoogleButton'
import styles from './AccountSettings.module.css'

const TABS = [
  { key: 'profile', label: 'Hồ sơ', icon: UserRound },
  { key: 'security', label: 'Bảo mật', icon: ShieldCheck },
  { key: 'connections', label: 'Liên kết', icon: Link2 },
  { key: 'danger', label: 'Xóa tài khoản', icon: Trash2 },
]
const PROVIDER_LABEL = { GOOGLE: 'Google', GITHUB: 'GitHub', FACEBOOK: 'Facebook' }
const DELETE_PHRASE = 'XOA TAI KHOAN'
const validPassword = (value) => value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value)

/** Gom xử lý busy + lỗi + hết phiên cho mọi thao tác. */
function useAction() {
  const [busy, setBusy] = useState('')
  const clear = useAuthStore((state) => state.clear)
  const showAuthNotice = useAuthStore((state) => state.setNotice)
  const run = useCallback(async (key, callback) => {
    if (busy) return false
    setBusy(key)
    try {
      await callback()
      return true
    } catch (error) {
      if (!getAuthSession()) { showAuthNotice('Phiên đã hết. Hãy đăng nhập lại rồi thử thao tác.'); clear() }
      else toast.error(error?.message || 'Không thể hoàn tất. Vui lòng thử lại.')
      return false
    } finally { setBusy('') }
  }, [busy, clear, showAuthNotice])
  return [busy, run]
}

function OtpField({ purpose, value, onChange, disabled, label = 'Mã OTP từ email' }) {
  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])
  async function send() {
    setSending(true)
    try {
      await accountApi.requestOtp(purpose)
      setCooldown(60)
      toast.info('Đã gửi mã xác minh tới email của bạn.')
    } catch (error) { toast.error(error?.message || 'Không gửi được mã.') }
    finally { setSending(false) }
  }
  return (
    <div className={styles.otpRow}>
      <label className={styles.field}>{label}
        <input value={value} onChange={(event) => onChange(event.target.value.replace(/\s/g, ''))} autoComplete="one-time-code" inputMode="numeric" maxLength={12} placeholder="••••••" required disabled={disabled} />
      </label>
      <button type="button" className={styles.button} disabled={disabled || sending || cooldown > 0} onClick={send}>
        {sending ? <LoaderCircle className={styles.spin} size={16} /> : <Mail size={16} />}
        {cooldown > 0 ? `Gửi lại (${cooldown}s)` : 'Gửi mã'}
      </button>
    </div>
  )
}

function Section({ icon: Icon, title, description, children, tone }) {
  return (
    <section className={styles.section} data-tone={tone}>
      <header className={styles.sectionHead}>
        <span className={styles.sectionIcon}><Icon size={17} /></span>
        <div><h3>{title}</h3>{description && <p>{description}</p>}</div>
      </header>
      {children}
    </section>
  )
}

function ProfileTab({ account, refresh }) {
  const [busy, run] = useAction()
  const [form, setForm] = useState({
    name: account.name || '',
    birth_day: account.birth_day || '',
    gender: account.gender == null ? '' : String(account.gender),
  })
  const [preview, setPreview] = useState('')
  const fileRef = useRef(null)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const changed = form.name.trim() !== (account.name || '') || form.birth_day !== (account.birth_day || '') || form.gender !== (account.gender == null ? '' : String(account.gender))

  function save(event) {
    event.preventDefault()
    if (!form.name.trim()) return
    run('profile', async () => {
      await accountApi.update({
        name: form.name.trim(),
        birth_day: form.birth_day || undefined,
        gender: form.gender === '' ? undefined : form.gender === 'true',
      })
      await refresh()
      toast.success('Đã lưu hồ sơ.')
    })
  }

  function upload(file) {
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) { toast.error('Chỉ nhận ảnh PNG hoặc JPEG.'); return }
    if (file.size > AVATAR_MAX_BYTES) { toast.error('Ảnh tối đa 2 MB.'); return }
    run('avatar', async () => {
      await accountApi.uploadAvatar(file)
      setPreview(URL.createObjectURL(file))
      await refresh()
      toast.success('Đã tải ảnh lên. Ảnh sẽ hiển thị công khai sau khi được duyệt.')
    })
  }

  const initial = (account.name || '?').trim()[0]?.toUpperCase()
  return (
    <>
      <Section icon={Camera} title="Ảnh đại diện" description="PNG hoặc JPEG, tối đa 2 MB và 4096×4096 px.">
        <div className={styles.avatarRow}>
          <span className={styles.avatar}>{preview ? <img src={preview} alt="Ảnh đại diện mới" /> : initial}</span>
          <div className={styles.avatarMeta}>
            <strong>{account.storage_key ? (account.storage_verify ? 'Ảnh đã được duyệt' : 'Ảnh đang chờ duyệt') : 'Chưa có ảnh đại diện'}</strong>
            <small>Ảnh mới cần quản trị viên duyệt trước khi người khác nhìn thấy.</small>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={(event) => { upload(event.target.files?.[0]); event.target.value = '' }} />
          <button type="button" className={styles.button} disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}>
            {busy === 'avatar' ? <LoaderCircle className={styles.spin} size={16} /> : <Camera size={16} />} Đổi ảnh
          </button>
        </div>
      </Section>
      <Section icon={UserRound} title="Thông tin cá nhân" description="Tên hiển thị xuất hiện trên bàn cờ và bảng xếp hạng.">
        <form className={styles.grid} onSubmit={save}>
          <label className={`${styles.field} ${styles.span2}`}>Tên hiển thị<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" maxLength={100} required disabled={Boolean(busy)} /></label>
          <label className={styles.field}>Ngày sinh<input type="date" value={form.birth_day} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setForm({ ...form, birth_day: event.target.value })} disabled={Boolean(busy)} /></label>
          <label className={styles.field}>Giới tính
            <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} disabled={Boolean(busy)}>
              <option value="">Không nêu</option><option value="true">Nam</option><option value="false">Nữ</option>
            </select>
          </label>
          <dl className={`${styles.facts} ${styles.span2}`}>
            <div><dt>Email</dt><dd>{account.email || '—'}</dd></div>
            <div><dt>Số điện thoại</dt><dd>{account.phone || 'Chưa có'}</dd></div>
            <div><dt>Lần đăng nhập gần nhất</dt><dd>{account.last_login ? new Date(account.last_login * 1000).toLocaleString('vi-VN') : '—'}</dd></div>
          </dl>
          <div className={`${styles.actions} ${styles.span2}`}>
            <button type="submit" className={styles.primaryButton} disabled={Boolean(busy) || !changed || !form.name.trim()}>{busy === 'profile' ? <LoaderCircle className={styles.spin} size={16} /> : <Save size={16} />} Lưu thay đổi</button>
          </div>
        </form>
      </Section>
    </>
  )
}

function SecurityTab({ account, refresh }) {
  const [busy, run] = useAction()
  const clear = useAuthStore((state) => state.clear)
  const showAuthNotice = useAuthStore((state) => state.setNotice)
  const [open, setOpen] = useState(account.needs_credentials ? 'credentials' : '')
  const [password, setPassword] = useState({ old: '', next: '', confirm: '', otp: '' })
  const [tfaOtp, setTfaOtp] = useState('')
  const [email, setEmail] = useState({ value: '', otp: '' })
  const [phone, setPhone] = useState({ value: '', otp: '' })
  const [creds, setCreds] = useState({ username: '', password: '', confirm: '' })
  const toggle = (key) => setOpen((current) => current === key ? '' : key)

  const panel = (key, icon, title, detail, body) => {
    const Icon = icon
    return (
      <div className={styles.row} data-open={open === key}>
        <button type="button" className={styles.rowHead} aria-expanded={open === key} onClick={() => toggle(key)}>
          <span className={styles.rowIcon}><Icon size={17} /></span>
          <span className={styles.rowText}><strong>{title}</strong><small>{detail}</small></span>
          <ArrowRight size={16} className={styles.chevron} />
        </button>
        {open === key && <div className={styles.rowBody}>{body}</div>}
      </div>
    )
  }

  return (
    <Section icon={ShieldCheck} title="Đăng nhập và bảo mật" description="Mỗi thay đổi quan trọng cần mã OTP gửi tới email của bạn.">
      <div className={styles.rows}>
        {account.needs_credentials && panel('credentials', AtSign, 'Tạo tên đăng nhập và mật khẩu', 'Tài khoản tạo bằng Google chưa có mật khẩu. Chỉ đặt được một lần.',
          <form className={styles.grid} onSubmit={(event) => {
            event.preventDefault()
            if (!/^[A-Za-z0-9]{3,}$/.test(creds.username)) { toast.error('Tên đăng nhập cần ít nhất 3 chữ cái Latin hoặc chữ số.'); return }
            if (!validPassword(creds.password)) { toast.error('Mật khẩu cần ít nhất 8 ký tự, có chữ hoa, chữ thường và số.'); return }
            if (creds.password !== creds.confirm) { toast.error('Hai lần nhập mật khẩu chưa trùng nhau.'); return }
            run('creds', async () => { await accountApi.setCredentials({ username: creds.username, password: creds.password, re_password: creds.confirm }); await refresh(); setOpen(''); toast.success('Đã tạo thông tin đăng nhập.') })
          }}>
            <label className={`${styles.field} ${styles.span2}`}>Tên đăng nhập<input value={creds.username} onChange={(event) => setCreds({ ...creds, username: event.target.value.trim() })} autoComplete="username" required disabled={Boolean(busy)} /></label>
            <label className={styles.field}>Mật khẩu<input type="password" value={creds.password} onChange={(event) => setCreds({ ...creds, password: event.target.value })} autoComplete="new-password" required disabled={Boolean(busy)} /></label>
            <label className={styles.field}>Nhập lại<input type="password" value={creds.confirm} onChange={(event) => setCreds({ ...creds, confirm: event.target.value })} autoComplete="new-password" required disabled={Boolean(busy)} /></label>
            <div className={`${styles.actions} ${styles.span2}`}><button type="submit" className={styles.primaryButton} disabled={Boolean(busy)}>{busy === 'creds' ? <LoaderCircle className={styles.spin} size={16} /> : <Check size={16} />} Tạo thông tin đăng nhập</button></div>
          </form>)}

        {panel('tfa', account.enable_tfa ? ShieldCheck : ShieldOff, 'Xác minh hai bước (2FA)', account.enable_tfa ? 'Đang bật — đăng nhập từ thiết bị lạ sẽ cần mã email.' : 'Đang tắt — nên bật để bảo vệ tài khoản.',
          <form className={styles.stack} onSubmit={(event) => {
            event.preventDefault()
            run('tfa', async () => { await accountApi.changeTfa({ value: !account.enable_tfa, code_tfa: tfaOtp }); setTfaOtp(''); await refresh(); toast.success(account.enable_tfa ? 'Đã tắt xác minh hai bước.' : 'Đã bật xác minh hai bước.') })
          }}>
            <OtpField purpose={OTP_PURPOSE.CHANGE_TFA} value={tfaOtp} onChange={setTfaOtp} disabled={Boolean(busy)} />
            <div className={styles.actions}><button type="submit" className={account.enable_tfa ? styles.button : styles.primaryButton} disabled={Boolean(busy) || !tfaOtp}>{busy === 'tfa' ? <LoaderCircle className={styles.spin} size={16} /> : account.enable_tfa ? <ShieldOff size={16} /> : <ShieldCheck size={16} />} {account.enable_tfa ? 'Tắt 2FA' : 'Bật 2FA'}</button></div>
          </form>)}

        {!account.needs_credentials && panel('password', KeyRound, 'Đổi mật khẩu', 'Sau khi đổi, bạn sẽ cần đăng nhập lại.',
          <form className={styles.grid} onSubmit={(event) => {
            event.preventDefault()
            if (!validPassword(password.next)) { toast.error('Mật khẩu mới cần ít nhất 8 ký tự, có chữ hoa, chữ thường và số.'); return }
            if (password.next !== password.confirm) { toast.error('Xác nhận mật khẩu chưa trùng nhau.'); return }
            run('password', async () => { await accountApi.changePassword({ value: password.next, old_value: password.old, code_tfa: password.otp }); showAuthNotice('Đã đổi mật khẩu. Hãy đăng nhập lại bằng mật khẩu mới.'); clear() })
          }}>
            <label className={`${styles.field} ${styles.span2}`}>Mật khẩu hiện tại<input type="password" value={password.old} autoComplete="current-password" onChange={(event) => setPassword({ ...password, old: event.target.value })} required disabled={Boolean(busy)} /></label>
            <label className={styles.field}>Mật khẩu mới<input type="password" value={password.next} autoComplete="new-password" onChange={(event) => setPassword({ ...password, next: event.target.value })} required disabled={Boolean(busy)} /><small>Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.</small></label>
            <label className={styles.field}>Nhập lại mật khẩu mới<input type="password" value={password.confirm} autoComplete="new-password" onChange={(event) => setPassword({ ...password, confirm: event.target.value })} required disabled={Boolean(busy)} /></label>
            <div className={styles.span2}><OtpField purpose={OTP_PURPOSE.CHANGE_PASSWORD} value={password.otp} onChange={(otp) => setPassword({ ...password, otp })} disabled={Boolean(busy)} /></div>
            <div className={`${styles.actions} ${styles.span2}`}><button type="submit" className={styles.primaryButton} disabled={Boolean(busy)}>{busy === 'password' ? <LoaderCircle className={styles.spin} size={16} /> : <Check size={16} />} Đổi mật khẩu</button></div>
          </form>)}

        {panel('email', Mail, 'Đổi email', account.email || 'Chưa có email',
          <form className={styles.stack} onSubmit={(event) => {
            event.preventDefault()
            run('email', async () => { await accountApi.changeEmail({ value: email.value.trim(), code_tfa: email.otp }); setEmail({ value: '', otp: '' }); await refresh(); setOpen(''); toast.success('Đã đổi email.') })
          }}>
            <label className={styles.field}>Email mới<input type="email" value={email.value} onChange={(event) => setEmail({ ...email, value: event.target.value })} autoComplete="email" required disabled={Boolean(busy)} /></label>
            <OtpField purpose={OTP_PURPOSE.CHANGE_EMAIL} label="Mã OTP (gửi tới email hiện tại)" value={email.otp} onChange={(otp) => setEmail({ ...email, otp })} disabled={Boolean(busy)} />
            <div className={styles.actions}><button type="submit" className={styles.primaryButton} disabled={Boolean(busy)}>{busy === 'email' ? <LoaderCircle className={styles.spin} size={16} /> : <Check size={16} />} Cập nhật email</button></div>
          </form>)}

        {panel('phone', Phone, 'Số điện thoại', account.phone || 'Chưa thêm số điện thoại',
          <form className={styles.stack} onSubmit={(event) => {
            event.preventDefault()
            if (!/^\d{10,11}$/.test(phone.value)) { toast.error('Số điện thoại cần 10 hoặc 11 chữ số.'); return }
            run('phone', async () => { await accountApi.changePhone({ value: phone.value, code_tfa: phone.otp }); setPhone({ value: '', otp: '' }); await refresh(); setOpen(''); toast.success('Đã cập nhật số điện thoại.') })
          }}>
            <label className={styles.field}>Số điện thoại mới<input type="tel" inputMode="numeric" value={phone.value} onChange={(event) => setPhone({ ...phone, value: event.target.value.replace(/\D/g, '') })} maxLength={11} autoComplete="tel" required disabled={Boolean(busy)} /></label>
            <OtpField purpose={OTP_PURPOSE.CHANGE_PHONE} value={phone.otp} onChange={(otp) => setPhone({ ...phone, otp })} disabled={Boolean(busy)} />
            <div className={styles.actions}><button type="submit" className={styles.primaryButton} disabled={Boolean(busy)}>{busy === 'phone' ? <LoaderCircle className={styles.spin} size={16} /> : <Check size={16} />} Lưu số điện thoại</button></div>
          </form>)}

        {panel('sessions', LogOut, 'Đăng xuất mọi thiết bị', 'Thu hồi tất cả phiên đăng nhập, kể cả tab này.',
          <div className={styles.stack}>
            <p className={styles.muted}>Dùng khi bạn nghi ngờ có người khác đăng nhập vào tài khoản.</p>
            <div className={styles.actions}><button type="button" className={styles.dangerButton} disabled={Boolean(busy)} onClick={() => run('logout-all', async () => { await authApi.logout({ all: true }); clear(); toast.success('Đã đăng xuất khỏi mọi thiết bị.') })}>{busy === 'logout-all' ? <LoaderCircle className={styles.spin} size={16} /> : <LogOut size={16} />} Đăng xuất tất cả</button></div>
          </div>)}
      </div>
    </Section>
  )
}

function ConnectionsTab({ account, refresh }) {
  const [busy, run] = useAction()
  const [linked, setLinked] = useState(null)
  const [providers, setProviders] = useState([])
  const [loadError, setLoadError] = useState('')

  const [version, setVersion] = useState(0)
  const load = useCallback(() => { setLinked(null); setLoadError(''); setVersion((value) => value + 1) }, [])
  useEffect(() => {
    let active = true
    Promise.all([oauthApi.accounts(), oauthApi.providers().catch(() => [])])
      .then(([accounts, list]) => { if (active) { setLinked(accounts); setProviders(list) } })
      .catch((error) => { if (active) setLoadError(error?.message || 'Không tải được danh sách liên kết.') })
    return () => { active = false }
  }, [version])

  const rows = ['GOOGLE', 'GITHUB', 'FACEBOOK'].map((code) => ({
    code,
    provider: providers.find((item) => String(item.type_code).toUpperCase() === code),
    linked: Boolean(linked?.includes(code)),
  })).filter((row) => row.linked || row.provider?.enabled)

  function unlink(code) {
    const last = linked?.length === 1 && account.needs_credentials
    const warning = last
      ? `Đây là cách đăng nhập duy nhất. Hủy liên kết ${PROVIDER_LABEL[code]} sẽ đưa tài khoản vào trạng thái chờ xóa. Tiếp tục?`
      : `Hủy liên kết ${PROVIDER_LABEL[code] ?? code} khỏi tài khoản?`
    if (!window.confirm(warning)) return
    run(`unlink-${code}`, async () => { await oauthApi.unlink(code); await load(); await refresh(); toast.success(`Đã hủy liên kết ${PROVIDER_LABEL[code] ?? code}.`) })
  }

  return (
    <Section icon={Link2} title="Tài khoản liên kết" description="Đăng nhập nhanh bằng tài khoản mạng xã hội. Email phải trùng hoặc được xác minh.">
      {loadError && <p className={styles.errorBox}><TriangleAlert size={16} /> {loadError} <button type="button" className={styles.linkButton} onClick={load}>Thử lại</button></p>}
      {linked == null && !loadError && <p className={styles.muted}><LoaderCircle className={styles.spin} size={15} /> Đang tải…</p>}
      {linked != null && <div className={styles.providers}>
        {rows.map(({ code, linked: isLinked }) => (
          <div className={styles.provider} key={code} data-linked={isLinked}>
            <span className={styles.providerLogo} data-provider={code}>{code === 'GOOGLE' ? <GoogleLogo /> : (PROVIDER_LABEL[code] ?? code)[0]}</span>
            <span className={styles.rowText}><strong>{PROVIDER_LABEL[code] ?? code}</strong><small>{isLinked ? 'Đã liên kết' : 'Chưa liên kết'}</small></span>
            {isLinked
              ? <button type="button" className={styles.button} disabled={Boolean(busy)} onClick={() => unlink(code)}>{busy === `unlink-${code}` ? <LoaderCircle className={styles.spin} size={16} /> : <Unlink size={16} />} Hủy liên kết</button>
              : code === 'GOOGLE'
                ? <GoogleButton className={styles.googleSlot} text="continue_with" disabled={Boolean(busy)} onCredential={(credential) => run('link-GOOGLE', async () => { await oauthApi.link('google', credential); await load(); await refresh(); toast.success('Đã liên kết Google.') })} />
                : <small className={styles.muted}>Liên kết từ trang đăng nhập</small>}
          </div>
        ))}
        {!rows.length && <p className={styles.muted}>Máy chủ chưa bật nhà cung cấp nào.</p>}
      </div>}
    </Section>
  )
}

function DangerTab({ account }) {
  const [busy, run] = useAction()
  const clear = useAuthStore((state) => state.clear)
  const showAuthNotice = useAuthStore((state) => state.setNotice)
  const [otp, setOtp] = useState('')
  const [phrase, setPhrase] = useState('')
  const [understood, setUnderstood] = useState(false)
  const ready = otp && phrase.trim().toUpperCase() === DELETE_PHRASE && understood

  return (
    <Section icon={Trash2} tone="danger" title="Xóa tài khoản" description="Tài khoản sẽ chuyển sang trạng thái chờ xóa và mọi phiên đăng nhập bị thu hồi.">
      <ul className={styles.consequences}>
        <li>Bạn bị đăng xuất khỏi tất cả thiết bị ngay lập tức.</li>
        <li>Trong <strong>30 ngày</strong>, bạn có thể khôi phục bằng liên kết kích hoạt gửi qua email khi đăng nhập lại.</li>
        <li>Sau 30 ngày, hồ sơ, ảnh đại diện và liên kết {account.email ? <strong>{account.email}</strong> : 'email'} bị xóa vĩnh viễn.</li>
      </ul>
      <form className={styles.stack} onSubmit={(event) => {
        event.preventDefault()
        if (!ready) return
        run('delete', async () => {
          await accountApi.deleteAccount({ code_tfa: otp })
          clearAuthSession()
          clear()
          showAuthNotice('Tài khoản đã chuyển sang chờ xóa. Đăng nhập lại trong 30 ngày để khôi phục.')
          toast.info('Tài khoản đã được đánh dấu chờ xóa.')
        })
      }}>
        <OtpField purpose={OTP_PURPOSE.DELETE_ACCOUNT} value={otp} onChange={setOtp} disabled={Boolean(busy)} label="Mã OTP xác nhận xóa" />
        <label className={styles.field}>Nhập <code>{DELETE_PHRASE}</code> để xác nhận<input value={phrase} onChange={(event) => setPhrase(event.target.value)} autoComplete="off" spellCheck={false} disabled={Boolean(busy)} /></label>
        <label className={styles.check}><input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} disabled={Boolean(busy)} /> Tôi hiểu tài khoản sẽ bị xóa vĩnh viễn nếu không khôi phục trong 30 ngày.</label>
        <div className={styles.actions}><button type="submit" className={styles.dangerButton} disabled={Boolean(busy) || !ready}>{busy === 'delete' ? <LoaderCircle className={styles.spin} size={16} /> : <Trash2 size={16} />} Xóa tài khoản của tôi</button></div>
      </form>
    </Section>
  )
}

function GoogleLogo() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
}

export default function AccountSettings({ account }) {
  const [tab, setTab] = useState('profile')
  const setAccount = useAuthStore((state) => state.setAccount)
  const refresh = useCallback(async () => { setAccount(await accountApi.me()) }, [setAccount])

  return (
    <div className={styles.accountSettings}>
      <div className={styles.tabs} role="tablist" aria-label="Cài đặt tài khoản">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" role="tab" id={`account-tab-${key}`} aria-selected={tab === key} aria-controls={`account-panel-${key}`} data-danger={key === 'danger'} className={styles.tab} onClick={() => setTab(key)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      <div className={styles.panel} role="tabpanel" id={`account-panel-${tab}`} aria-labelledby={`account-tab-${tab}`}>
        {tab === 'profile' && <ProfileTab account={account} refresh={refresh} />}
        {tab === 'security' && <SecurityTab account={account} refresh={refresh} />}
        {tab === 'connections' && <ConnectionsTab account={account} refresh={refresh} />}
        {tab === 'danger' && <DangerTab account={account} />}
      </div>
    </div>
  )
}
