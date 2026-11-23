import { useEffect, useState } from 'react'
import { adminApi } from '@/services/api/admin'
import { useAuthStore } from '@/stores/useAuthStore'

/**
 * Trạng thái quyền quản trị của phiên hiện tại: 'guest' | 'checking' | 'allowed' | 'denied'.
 * Chỉ máy chủ quyết định (/account/admin-access); không đọc role từ storage.
 */
export function useAdminAccess() {
  const session = useAuthStore((state) => state.session)
  const identity = session?.refreshToken || session?.accessToken || ''
  const [result, setResult] = useState({ identity: '', allowed: false })

  useEffect(() => {
    if (!identity) return undefined
    let active = true
    adminApi.access()
      .then((allowed) => { if (active) setResult({ identity, allowed: allowed === true }) })
      .catch(() => { if (active) setResult({ identity, allowed: false }) })
    return () => { active = false }
  }, [identity])

  if (!identity) return 'guest'
  if (result.identity !== identity) return 'checking'
  return result.allowed ? 'allowed' : 'denied'
}
