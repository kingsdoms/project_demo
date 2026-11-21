import { useState } from 'react'
import { ArrowRight, Check, CircleAlert, KeyRound, LoaderCircle, Save, ShieldCheck } from 'lucide-react'
import { accountApi } from '@/services/api/account'
import { authApi } from '@/services/api/auth'
import { getAuthSession } from '@/services/api/client'
import { useAuthStore } from '@/stores/useAuthStore'
import styles from './AccountSettings.module.css'

export default function AccountSettings({ account }) {
  const [name, setName] = useState(account.name || '')
  const [password, setPassword] = useState({ old: '', next: '', confirm: '', otp: '' })
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState(null)
  const setAccount = useAuthStore((state) => state.setAccount)
  const clear = useAuthStore((state) => state.clear)
  const showAuthNotice = useAuthStore((state) => state.setNotice)
  async function act(action, callback) {
    if (busy) return
    setBusy(action)
    setNotice(null)
    try { await callback() } catch (error) {
      if (!getAuthSession()) { showAuthNotice('Phiên đã hết. Hãy đăng nhập lại rồi thử thao tác.'); clear() }
      else setNotice({ error: true, text: error.message || 'Không thể hoàn tất. Vui lòng thử lại.' })
    }
    finally { setBusy('') }
  }
  function updatePassword(field, value) { setPassword((state) => ({ ...state, [field]: value })) }
  return <div className={styles.accountSettings}>
    <form className={styles.form} onSubmit={(event) => { event.preventDefault(); if (!name.trim()) return; act('profile', async () => { await accountApi.update({ name: name.trim() }); setAccount(await accountApi.me()); setNotice({ text: 'Đã cập nhật tên hiển thị từ API.' }) }) }}>
      <label className={styles.field}>Tên hiển thị<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={100} required disabled={Boolean(busy)} /></label>
      <button type="submit" className={styles.button} disabled={Boolean(busy) || !name.trim() || name.trim() === account.name}>{busy === 'profile' ? <LoaderCircle size={16} /> : <Save size={16} />} Lưu hồ sơ</button>
    </form>
    <details className={styles.passwordSection}><summary><KeyRound size={16} /> Đổi mật khẩu tài khoản</summary><p>Cần mật khẩu hiện tại và mã OTP cho mục đích đổi mật khẩu. Mã đăng nhập sẽ không dùng được ở đây.</p>
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); if (password.next !== password.confirm) { setNotice({ error: true, text: 'Xác nhận mật khẩu chưa trùng nhau.' }); return } act('password', async () => { await accountApi.changePassword({ value: password.next, old_value: password.old, code_tfa: password.otp.trim() }); setPassword({ old: '', next: '', confirm: '', otp: '' }); showAuthNotice('Đã đổi mật khẩu. Hãy đăng nhập lại bằng mật khẩu mới.'); clear() }) }}>
        <label className={styles.field}>Mật khẩu hiện tại<input type="password" value={password.old} autoComplete="current-password" onChange={(event) => updatePassword('old', event.target.value)} required disabled={Boolean(busy)} /></label>
        <label className={styles.field}>Mật khẩu mới<input type="password" value={password.next} autoComplete="new-password" minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}" title="Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số." onChange={(event) => updatePassword('next', event.target.value)} required disabled={Boolean(busy)} /><small>Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.</small></label>
        <label className={styles.field}>Nhập lại mật khẩu mới<input type="password" value={password.confirm} autoComplete="new-password" onChange={(event) => updatePassword('confirm', event.target.value)} required disabled={Boolean(busy)} /></label>
        <div className={styles.otpRow}><label className={styles.field}>Mã OTP<input value={password.otp} autoComplete="one-time-code" inputMode="numeric" onChange={(event) => updatePassword('otp', event.target.value)} required disabled={Boolean(busy)} /></label><button type="button" className={styles.button} disabled={Boolean(busy)} onClick={() => act('otp', async () => { const session = getAuthSession(); if (!session?.accessToken) throw new Error('Phiên đã hết. Hãy đăng nhập lại.'); await authApi.requestOtp(session.accessToken, 'CHANGE_PASSWORD'); setNotice({ text: 'Đã gửi OTP đổi mật khẩu tới email.' }) })}><ShieldCheck size={16} /> {busy === 'otp' ? 'Đang gửi…' : 'Gửi OTP'}</button></div>
        <button type="submit" className={styles.primaryButton} disabled={Boolean(busy)}>{busy === 'password' ? <LoaderCircle size={16} /> : <Check size={16} />} Xác nhận đổi mật khẩu <ArrowRight size={15} /></button>
      </form>
    </details>
    {notice && <p className={styles.notice} data-error={notice.error} role={notice.error ? 'alert' : 'status'}>{notice.error ? <CircleAlert size={16} /> : <Check size={16} />}{notice.text}</p>}
  </div>
}
