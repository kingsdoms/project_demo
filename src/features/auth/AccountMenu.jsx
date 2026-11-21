import { useEffect, useRef, useState } from 'react'
import { CircleUserRound, LogOut, ShieldCheck, X } from 'lucide-react'
import { accountApi } from '@/services/api/account'
import { getAuthSession } from '@/services/api/client'
import { authApi, isSameAuthSession } from '@/services/api/auth'
import { useAuthStore } from '@/stores/useAuthStore'
import styles from './AccountMenu.module.css'

export default function AccountMenu({ onSignIn }) {
  const confirmRef = useRef(null)
  const session = useAuthStore((state) => state.session)
  const account = useAuthStore((state) => state.account)
  const setAccount = useAuthStore((state) => state.setAccount)
  const clear = useAuthStore((state) => state.clear)
  const notice = useAuthStore((state) => state.notice)
  const setNotice = useAuthStore((state) => state.setNotice)
  const clearNotice = useAuthStore((state) => state.clearNotice)
  const [busy, setBusy] = useState(false)
  const [profileAttempt, setProfileAttempt] = useState(0)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!session || account) return undefined
    let active = true
    accountApi.me()
      .then((value) => {
        if (active) setAccount(value)
      })
      .catch((error) => {
        if (!active) return
        if (!getAuthSession()) {
          clear()
          setNotice('Phiên đăng nhập đã hết. Hãy đăng nhập lại để xem hồ sơ.')
        } else setStatus(error.message || 'Không tải được hồ sơ.')
      })
    return () => {
      active = false
    }
  }, [account, clear, profileAttempt, session, setAccount, setNotice])

  async function signOut() {
    if (busy) return
    const logoutSession = getAuthSession()
    setBusy(true)
    setStatus('')
    let serverConfirmed = true
    try {
      await authApi.logout()
    } catch {
      serverConfirmed = false
    } finally {
      const currentSession = getAuthSession()
      const displayedSession = useAuthStore.getState().session
      if (
        (!currentSession || isSameAuthSession(currentSession, logoutSession)) &&
        (!displayedSession || isSameAuthSession(displayedSession, logoutSession))
      ) {
        clear()
        if (serverConfirmed) clearNotice()
        else setNotice('Phiên đã bị xóa khỏi tab này; máy chủ chưa xác nhận thu hồi phiên.')
      }
      setBusy(false)
    }
  }

  const noticeMessage = notice && (
    <div className={styles.noticeToast} role="status">
      <span>{notice}</span>
      <button type="button" onClick={clearNotice} aria-label="Đóng thông báo"><X size={17} /></button>
    </div>
  )
  const profileLoading = Boolean(session && !account && !status)

  if (!session) {
    return (
      <>
        <button type="button" className={styles.signInButton} onClick={onSignIn}>
          <CircleUserRound size={18} />
          <span>Đăng nhập</span>
        </button>
        {noticeMessage}
      </>
    )
  }

  return (
    <>
      <details className={styles.menu}>
        <summary className={styles.trigger}>
          <span className={styles.avatar}>{account?.name?.trim()?.[0]?.toUpperCase() || <CircleUserRound size={18} />}</span>
          <span className={styles.name}>{account?.name || 'Tài khoản'}</span>
        </summary>
        <div className={styles.popover}>
          <div className={styles.accountHead}>
            <span className={styles.largeAvatar}>{account?.name?.trim()?.[0]?.toUpperCase() || <CircleUserRound size={22} />}</span>
            <span className={styles.identity}>
              <strong>{account?.name || 'Đang tải hồ sơ…'}</strong>
              {account?.email && <span>{account.email}</span>}
            </span>
          </div>
          {account?.roles?.length > 0 && (
            <div className={styles.roles}>
              <ShieldCheck size={15} />
              {account.roles.map((role) => <span key={role}>{role}</span>)}
            </div>
          )}
          {profileLoading && <p className={styles.status} role="status">Đang tải hồ sơ…</p>}
          {status && (
            <div className={styles.profileError}>
              <p className={styles.status} role="status">{status}</p>
              <button
                type="button"
                className={styles.retryButton}
                onClick={() => {
                  setStatus('')
                  setProfileAttempt((attempt) => attempt + 1)
                }}
                disabled={profileLoading}
              >
                Thử lại
              </button>
            </div>
          )}
          <button type="button" className={styles.signOutButton} onClick={() => confirmRef.current?.showModal()} disabled={busy}>
            <LogOut size={16} /> {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </div>
      </details>
      <dialog ref={confirmRef} className={styles.confirmDialog} aria-labelledby="logout-title" onCancel={(event) => { if (busy) event.preventDefault() }}><h2 id="logout-title">Đăng xuất khỏi tab này?</h2><p>Bạn vẫn có thể luyện cờ với máy. Đăng nhập lại để xem hồ sơ tài khoản.</p><div className={styles.confirmActions}><button type="button" className={styles.retryButton} onClick={() => confirmRef.current?.close()} disabled={busy}>Ở lại</button><button type="button" className={styles.signOutButton} onClick={() => { confirmRef.current?.close(); signOut() }} disabled={busy}><LogOut size={16} /> Đăng xuất</button></div></dialog>
      {noticeMessage}
    </>
  )
}
