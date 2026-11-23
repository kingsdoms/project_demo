import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { toast } from '@/stores/useToastStore'

/** Tải dữ liệu theo `deps`; đổi deps hoặc `reload()` sẽ ẩn dữ liệu cũ ngay. */
export function useRemote(loader, deps) {
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [revision, setRevision] = useState(0)
  const key = JSON.stringify([...deps, revision])
  useEffect(() => {
    let active = true
    Promise.resolve().then(loader).then(
      (data) => { if (active) setState({ key, status: 'ready', data, error: null }) },
      (error) => { if (active) setState({ key, status: 'error', data: null, error }) },
    )
    return () => { active = false }
    // `key` gồm deps + revision; loader được tạo lại mỗi render nên cố ý bỏ khỏi deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const reload = useCallback(() => setRevision((value) => value + 1), [])
  const current = state.key === key ? state : { status: 'loading', data: null, error: null }
  return { ...current, reload }
}

export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success('Đã sao chép.')
  } catch {
    toast.error('Trình duyệt không cho phép sao chép. Hãy chọn và sao chép thủ công.')
  }
}

export const WriteContext = createContext(null)

/**
 * `run(fn, { success, quiet })` thực thi một thao tác ghi. Nếu máy chủ yêu cầu TOTP,
 * mở hộp xác minh rồi tự chạy lại thao tác. Luôn resolve `{ ok, value?, error?, cancelled? }`.
 */
export function useAdminWrite() {
  const context = useContext(WriteContext)
  if (!context) throw new Error('useAdminWrite phải nằm trong AdminWriteProvider')
  return context
}
