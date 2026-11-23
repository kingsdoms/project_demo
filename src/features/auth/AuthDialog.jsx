import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CircleAlert, Crown, Eye, EyeOff, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { ApiError } from '@/services/api/client'
import { authApi } from '@/services/api/auth'
import { oauthApi } from '@/services/api/oauth'
import { useAuthStore } from '@/stores/useAuthStore'
import { toast } from '@/stores/useToastStore'
import GoogleButton from './GoogleButton'
import styles from './AuthDialog.module.css'

const INITIAL_FORM = { identifier: '', name: '', username: '', email: '', password: '', re_password: '', token: '' }
const validPassword = (value) => value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value)
const friendlyError = (error) => error instanceof ApiError || error instanceof Error ? error.message : 'Đã có lỗi. Hãy thử lại.'

function resetTokenFromUrl() {
  try {
    const match = window.location.pathname.match(/^\/forgot\/([^/]+)\/?$/)
    return match ? decodeURIComponent(match[1]) : ''
  } catch { return '' }
}

export default function AuthDialog({ initialMode = 'login', onClose }) {
  const dialogRef = useRef(null)
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM, token: initialMode === 'reset' ? resetTokenFromUrl() : '' }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [remember, setRemember] = useState(true)
  const [cooldown, setCooldown] = useState(0)
  const [temporaryToken, setTemporaryToken] = useState('')
  const [oauthTicket, setOauthTicket] = useState('')
  const setSession = useAuthStore((state) => state.setSession)
  const clearSession = useAuthStore((state) => state.clear)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  function update(field) {
    return (event) => {
      setForm((previous) => ({ ...previous, [field]: event.target.value }))
      setErrors((previous) => ({ ...previous, [field]: '' }))
      setError('')
    }
  }

  function switchMode(next) {
    setMode(next)
    setForm((previous) => ({
      ...INITIAL_FORM,
      identifier: previous.identifier || previous.email,
      email: previous.email || (previous.identifier.includes('@') ? previous.identifier : ''),
    }))
    setErrors({})
    setError('')
    setMessage('')
    setTemporaryToken('')
    setOauthTicket('')
    setConsent(false)
    setCooldown(0)
  }

  function validate() {
    const invalid = {}
    if (mode === 'login' || mode === 'forgot') {
      if (!form.identifier.trim()) invalid.identifier = 'Nhập tên đăng nhập hoặc email.'
    }
    if (mode === 'register') {
      if (!form.name.trim()) invalid.name = 'Nhập tên hiển thị của bạn.'
      if (!/^[A-Za-z0-9]{3,32}$/.test(form.username.trim())) invalid.username = 'Dùng 3 đến 32 chữ cái Latin hoặc chữ số.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) invalid.email = 'Nhập địa chỉ email hợp lệ.'
      if (!consent) invalid.consent = 'Vui lòng đọc và đồng ý điều khoản trải nghiệm.'
    }
    if (['register', 'reset'].includes(mode)) {
      if (!validPassword(form.password)) invalid.password = 'Cần ít nhất 8 ký tự, có chữ hoa, chữ thường và số.'
      if (form.password !== form.re_password || !form.re_password) invalid.re_password = 'Hai lần nhập mật khẩu phải trùng nhau.'
    } else if (mode === 'login' && !form.password) invalid.password = 'Nhập mật khẩu của bạn.'
    if (['otp', 'oauth-link', 'reset'].includes(mode) && !form.token.trim()) invalid.token = mode === 'reset' ? 'Nhập token từ liên kết đặt lại mật khẩu.' : 'Nhập mã xác minh trong email.'
    setErrors(invalid)
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() => document.getElementById('auth-' + Object.keys(invalid)[0])?.focus())
      return false
    }
    return true
  }

  async function sendOtp() {
    if (mode === 'oauth-link') await oauthApi.requestLinkCode(temporaryToken)
    else await authApi.requestOtp(temporaryToken)
    setCooldown(60)
    setMessage('Mã mới đã được gửi. Hãy kiểm tra cả thư mục spam.')
  }

  /** Xử lý kết quả đăng nhập chung cho mật khẩu và OAuth. */
  async function finishLogin(response, { oauth = false } = {}) {
    if (response?.need_otp || response?.need_active) {
      if (!response.access_token) throw new Error('Máy chủ chưa cấp phiên xác minh. Hãy đăng nhập lại.')
      setTemporaryToken(response.access_token)
      setForm((previous) => ({ ...previous, token: '' }))
      if (response.need_otp && oauth) {
        if (!response.oauth_ticket) throw new Error('Máy chủ chưa cấp phiếu liên kết. Hãy thử lại.')
        setOauthTicket(response.oauth_ticket)
        setMode('oauth-link')
        await oauthApi.requestLinkCode(response.access_token)
        setCooldown(60)
        setMessage('Email này đã có tài khoản. Chúng tôi vừa gửi mã liên kết tới email để xác nhận bạn là chủ tài khoản.')
      } else if (response.need_otp) {
        setMode('otp')
        await authApi.requestOtp(response.access_token)
        setCooldown(60)
        setMessage('Mã đăng nhập đã được gửi tới email của bạn.')
      } else {
        setMode('activate')
        setMessage('Tài khoản cần được xác nhận qua email trước khi sử dụng.')
      }
      return
    }
    if (!response?.access_token || !response?.refresh_token) throw new Error('Máy chủ chưa cấp đủ thông tin đăng nhập.')
    setSession(response, remember)
    toast.success(oauth ? 'Đăng nhập bằng Google thành công.' : 'Đăng nhập thành công. Chúc bạn chơi vui!')
    onClose()
  }

  async function loginWithGoogle(credential) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await finishLogin(await oauthApi.login('google', { credential }), { oauth: true })
    } catch (cause) {
      setError(friendlyError(cause))
    } finally { setBusy(false) }
  }

  async function submit(event) {
    event.preventDefault()
    if (busy || !validate()) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'register') {
        await authApi.register({ name: form.name.trim(), username: form.username.trim(), email: form.email.trim(), password: form.password, re_password: form.re_password })
        setForm({ ...INITIAL_FORM, identifier: form.email.trim() })
        setMode('login')
        setMessage('Đăng ký thành công. Kiểm tra email để kích hoạt tài khoản rồi đăng nhập.')
      } else if (mode === 'forgot') {
        await authApi.requestPasswordReset(form.identifier.trim())
        setMessage('Yêu cầu đã được gửi. Nếu tài khoản đủ điều kiện, hãy mở liên kết đặt lại mật khẩu trong email.')
      } else if (mode === 'reset') {
        await authApi.resetPassword({ token: form.token.trim(), password: form.password, re_password: form.re_password })
        clearSession()
        switchMode('login')
        setMessage('Đặt mật khẩu thành công. Các phiên cũ đã được yêu cầu thu hồi. Hãy đăng nhập lại.')
      } else if (mode === 'activate') {
        await authApi.requestActivation(temporaryToken)
        setCooldown(60)
        setMessage('Email kích hoạt đã được gửi. Xác nhận trong email, sau đó quay lại đăng nhập.')
      } else if (mode === 'oauth-link') {
        await finishLogin(await oauthApi.login('google', { ticket: oauthTicket, link_code: form.token.trim() }), { oauth: true })
      } else {
        const response = await authApi.login({ identifier: form.identifier.trim(), password: form.password, token: mode === 'otp' ? form.token.trim() : undefined })
        await finishLogin(response)
      }
    } catch (cause) {
      setError(friendlyError(cause))
    } finally { setBusy(false) }
  }

  const heading = { login: 'Chào mừng trở lại.', register: 'Bắt đầu hành trình cờ.', otp: 'Xác minh đăng nhập', 'oauth-link': 'Liên kết với Google', activate: 'Xác nhận email của bạn', forgot: 'Quên mật khẩu?', reset: 'Đặt mật khẩu mới' }[mode]
  const subtitle = { login: 'Đăng nhập tài khoản ChessArena để xem hồ sơ của bạn.', register: 'Tạo tài khoản. Mỗi nước đi là một khởi đầu mới.', otp: 'Nhập mã một lần trong email. Giữ cửa sổ này để hoàn tất.', 'oauth-link': 'Nhập mã liên kết trong email để gắn Google vào tài khoản hiện có. Mã có hiệu lực 1 giờ.', activate: 'Mở liên kết kích hoạt trong email rồi quay lại đăng nhập.', forgot: 'Nhập email hoặc tên đăng nhập để nhận liên kết khôi phục.', reset: 'Dùng token từ email. Liên kết có thể chỉ dùng một lần.' }[mode]
  const codeMode = mode === 'otp' || mode === 'oauth-link'
  const field = (name, title, input, hint) => <div className={styles.field}><label htmlFor={'auth-' + name}>{title}</label>{input}{hint && <small id={'auth-' + name + '-hint'} className={styles.fieldHint}>{hint}</small>}{errors[name] && <small id={'auth-' + name + '-error'} className={styles.fieldError}>{errors[name]}</small>}</div>
  const attrs = (name) => ({ id: 'auth-' + name, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? 'auth-' + name + '-error' : name === 'password' && ['register', 'reset'].includes(mode) ? 'auth-password-hint' : undefined, disabled: busy, value: form[name], onChange: update(name), required: true })

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="auth-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <div className={styles.topLine}><span className={styles.brandMark}><Crown size={23} /></span><span className={styles.brandName}>ChessArena <small>TÀI KHOẢN</small></span><button type="button" className={styles.closeButton} disabled={busy} onClick={onClose} aria-label="Đóng cửa sổ"><X size={19} /></button></div>
    <h2 id="auth-title">{heading}</h2><p className={styles.subtitle}>{subtitle}</p>
    {['login', 'register'].includes(mode) && <div className={styles.socialBlock}>
      <GoogleButton onCredential={loginWithGoogle} disabled={busy} text={mode === 'register' ? 'signup_with' : 'continue_with'} />
      <span className={styles.divider}><span>hoặc dùng {mode === 'register' ? 'email' : 'mật khẩu'}</span></span>
    </div>}
    <form className={styles.form} onSubmit={submit} noValidate aria-busy={busy}>
      {mode === 'register' && <>
        {field('name', 'Tên hiển thị', <input {...attrs('name')} autoComplete="name" maxLength={100} />)}
        {field('username', 'Tên đăng nhập', <input {...attrs('username')} autoComplete="username" maxLength={32} />)}
        {field('email', 'Email', <input {...attrs('email')} type="email" autoComplete="email" />)}
      </>}
      {['login', 'forgot'].includes(mode) && field('identifier', 'Email hoặc tên đăng nhập', <input {...attrs('identifier')} autoComplete="username" />)}
      {['otp', 'oauth-link', 'reset'].includes(mode) && field('token', mode === 'otp' ? 'Mã xác minh' : mode === 'oauth-link' ? 'Mã liên kết' : 'Token từ email', <input {...attrs('token')} autoComplete={codeMode ? 'one-time-code' : 'off'} inputMode={codeMode ? 'numeric' : 'text'} />)}
      {['login', 'register', 'reset'].includes(mode) && field('password', mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu', <PasswordInput {...attrs('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />, mode !== 'login' ? 'Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.' : null)}
      {['register', 'reset'].includes(mode) && field('re_password', 'Xác nhận mật khẩu', <PasswordInput {...attrs('re_password')} autoComplete="new-password" />)}
      {mode === 'login' && <div className={styles.loginOptions}><label className={styles.checkbox}><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} disabled={busy} /> Giữ phiên trong tab này</label><button type="button" className={styles.linkButton} disabled={busy} onClick={() => switchMode('forgot')}>Quên mật khẩu?</button></div>}
      {mode === 'register' && <><label className={styles.checkbox}><input id="auth-consent" type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setErrors((previous) => ({ ...previous, consent: '' })) }} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? 'auth-consent-error' : undefined} /> Tôi đồng ý điều khoản bản trải nghiệm.</label>{errors.consent && <small id="auth-consent-error" className={styles.fieldError}>{errors.consent}</small>}<details className={styles.terms}><summary>Đọc điều khoản và quyền riêng tư</summary><p>Thông tin đăng ký được gửi đến API tài khoản của dự án. Các ván cờ, xếp hạng và quản trị trong prototype là dữ liệu mô phỏng. Mật khẩu không lưu trong trình duyệt.</p></details></>}
      {error && <p className={styles.error} role="alert"><CircleAlert size={17} /><span>{error}{mode === 'reset' && <button type="button" className={styles.linkButton} onClick={() => switchMode('forgot')}>Liên kết hết hạn? Gửi yêu cầu mới</button>}</span></p>}
      {message && <p className={styles.notice} role="status"><ShieldCheck size={17} /><span>{message}</span></p>}
      <button type="submit" className={styles.submitButton} disabled={busy || (mode === 'activate' && cooldown > 0)}>{busy ? <LoaderCircle className={styles.spinner} size={18} /> : <ArrowRight size={18} />}{busy ? 'Đang xử lý…' : mode === 'register' ? 'Tạo tài khoản' : mode === 'otp' ? 'Xác minh và đăng nhập' : mode === 'oauth-link' ? 'Liên kết và đăng nhập' : mode === 'forgot' ? 'Gửi liên kết khôi phục' : mode === 'reset' ? 'Lưu mật khẩu mới' : mode === 'activate' ? cooldown > 0 ? 'Gửi lại sau ' + cooldown + 's' : 'Gửi email kích hoạt' : 'Đăng nhập'}</button>
      {codeMode && <button type="button" className={styles.backLink} disabled={busy || cooldown > 0} onClick={async () => { setBusy(true); setError(''); try { await sendOtp() } catch (cause) { setError(friendlyError(cause)) } finally { setBusy(false) } }}>{cooldown > 0 ? 'Gửi lại mã sau ' + cooldown + 's' : 'Gửi lại mã'}</button>}
      {['login', 'register'].includes(mode) ? <p className={styles.switchMode}>{mode === 'register' ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} <button type="button" disabled={busy} onClick={() => switchMode(mode === 'register' ? 'login' : 'register')}>{mode === 'register' ? 'Đăng nhập' : 'Đăng ký'}</button></p> : <button type="button" className={styles.backLink} disabled={busy} onClick={() => switchMode('login')}><ArrowLeft size={15} /> Về đăng nhập</button>}
      {mode === 'forgot' && <button type="button" className={styles.backLink} onClick={() => switchMode('reset')}>Tôi đã có token từ email</button>}
    </form>
    <p className={styles.privacyNote}><ShieldCheck size={13} /> Kết nối API thật · Không lưu mật khẩu</p>
  </dialog>
}

function PasswordInput(props) {
  const [visible, setVisible] = useState(false)
  return <span className={styles.passwordInput}><input {...props} type={visible ? 'text' : 'password'} /><button type="button" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={visible} onClick={() => setVisible((value) => !value)} disabled={props.disabled}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
}
