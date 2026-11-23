const GSI_SRC = 'https://accounts.google.com/gsi/client'
let loader = null

/** Tải Google Identity Services một lần cho cả trang. */
export function loadGoogleIdentity() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google chỉ chạy trong trình duyệt.'))
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GSI_SRC
      script.async = true
      script.defer = true
      script.onload = () => {
        if (window.google?.accounts?.id) resolve(window.google.accounts.id)
        else reject(new Error('Không khởi tạo được Google Identity Services.'))
      }
      script.onerror = () => {
        loader = null
        script.remove()
        reject(new Error('Không tải được thư viện đăng nhập Google. Hãy kiểm tra mạng hoặc trình chặn quảng cáo.'))
      }
      document.head.append(script)
    })
  }
  return loader
}

/**
 * Vẽ nút Google chính thức vào `element`. Mỗi lần người dùng chọn tài khoản,
 * `onCredential` nhận ID token để gửi lên server.
 */
export async function renderGoogleButton(element, { clientId, onCredential, text = 'continue_with', theme = 'outline', width }) {
  const gis = await loadGoogleIdentity()
  gis.initialize({
    client_id: clientId,
    callback: (response) => {
      if (response?.credential) onCredential(response.credential)
    },
    ux_mode: 'popup',
    auto_select: false,
    cancel_on_tap_outside: true,
  })
  if (!element?.isConnected) return
  element.replaceChildren()
  gis.renderButton(element, {
    type: 'standard',
    theme,
    size: 'large',
    text,
    shape: 'pill',
    logo_alignment: 'left',
    width: width ?? Math.min(Math.max(element.clientWidth || 320, 200), 400),
    locale: 'vi',
  })
}
