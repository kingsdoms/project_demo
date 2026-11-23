import { useEffect, useRef, useState } from 'react'
import { oauthApi } from '@/services/api/oauth'
import { renderGoogleButton } from '@/services/google'

/**
 * Nút Google chính thức (Google Identity Services). Lấy client_id từ /oauth/providers.
 * `onCredential(idToken)` được gọi khi người dùng chọn tài khoản.
 */
export default function GoogleButton({ onCredential, text = 'continue_with', disabled = false, className }) {
  const ref = useRef(null)
  const callbackRef = useRef(onCredential)
  const [state, setState] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => { callbackRef.current = onCredential }, [onCredential])

  useEffect(() => {
    let active = true
    oauthApi.provider('GOOGLE')
      .then((provider) => {
        if (!active) return null
        if (!provider?.enabled || !provider.client_id) throw new Error('Máy chủ chưa bật đăng nhập Google.')
        const theme = document.documentElement.dataset.theme === 'light' ? 'outline' : 'filled_black'
        return renderGoogleButton(ref.current, {
          clientId: provider.client_id,
          text,
          theme,
          onCredential: (credential) => callbackRef.current?.(credential),
        })
      })
      .then(() => { if (active) setState('ready') })
      .catch((error) => {
        if (!active) return
        setState('error')
        setMessage(error.message || 'Không tải được nút Google.')
      })
    return () => { active = false }
  }, [text])

  return (
    <div className={className} data-google-state={state} aria-disabled={disabled || undefined} style={disabled ? { pointerEvents: 'none', opacity: 0.55 } : undefined}>
      <div ref={ref} style={{ minHeight: state === 'error' ? 0 : 44, display: 'flex', justifyContent: 'center' }} />
      {state === 'loading' && <small style={{ display: 'block', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Đang tải Google…</small>}
      {state === 'error' && <small role="status" style={{ display: 'block', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>{message}</small>}
    </div>
  )
}
