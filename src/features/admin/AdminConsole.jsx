import { useCallback } from 'react'
import { LockKeyhole, LogIn, RefreshCw, ShieldX } from 'lucide-react'
import { adminApi } from '@/services/api/admin'
import { useAuthStore } from '@/stores/useAuthStore'
import { AdminWriteProvider, Button, StateView, TotpBadge } from './AdminKit'
import { useRemote } from './adminHooks'
import { ADMIN_PAGES } from './adminPages'
import {
  BlacklistPage, CommandsPage, JournalsPage, NotificationsPage, OverviewPage, RolesPage, SystemPage, UsersPage,
} from './AdminScreens'
import styles from './AdminConsole.module.css'

const PAGE_INFO = {
  overview: ['Tổng quan quản trị', 'Số liệu tài khoản, thông báo, phiên đăng nhập và hoạt động mới nhất.'],
  users: ['Người dùng', 'Tìm kiếm, chỉnh sửa hồ sơ, cấp vai trò và xử lý tài khoản.'],
  roles: ['Vai trò & quyền', 'Quản lý vai trò và cấp, thu hồi quyền theo ma trận.'],
  notifications: ['Thông báo', 'Gửi thông báo tới toàn bộ người chơi hoặc từng tài khoản.'],
  blacklist: ['Danh sách chặn', 'Chặn email hoặc địa chỉ IP lạm dụng hệ thống.'],
  journals: ['Nhật ký hệ thống', 'Tra cứu hoạt động được máy chủ ghi lại.'],
  commands: ['Lệnh', 'Danh mục lệnh, tham số và vai trò được phép sử dụng.'],
  system: ['Hệ thống', 'Tác vụ bảo trì cơ sở dữ liệu.'],
}

const PAGES = {
  overview: OverviewPage,
  users: UsersPage,
  roles: RolesPage,
  notifications: NotificationsPage,
  blacklist: BlacklistPage,
  journals: JournalsPage,
  commands: CommandsPage,
  system: SystemPage,
}

function Gate({ icon: Icon, title, children, actions, tone }) {
  return (
    <section className={styles.gate} data-tone={tone}>
      <span className={styles.gateIcon}><Icon size={22} /></span>
      <h2>{title}</h2>
      <p>{children}</p>
      {actions && <div className={styles.formActions}>{actions}</div>}
    </section>
  )
}

export default function AdminConsole({ page, navigate, onSignIn }) {
  const session = useAuthStore((state) => state.session)
  const identity = session?.refreshToken || session?.accessToken || ''
  const key = PAGES[page] ? page : 'overview'
  const [title, description] = PAGE_INFO[key]
  const Page = PAGES[key]
  const access = useRemote(() => (identity ? adminApi.access() : Promise.resolve(null)), [identity])
  const allowed = Boolean(identity) && access.status === 'ready' && access.data === true
  const go = useCallback((route) => navigate?.(route), [navigate])

  let body
  if (!identity) {
    body = (
      <Gate icon={LockKeyhole} title="Đăng nhập để vào trang quản trị" actions={<Button variant="primary" onClick={onSignIn}><LogIn size={16} /> Đăng nhập</Button>}>
        Trang quản trị chỉ dành cho tài khoản có vai trò được cấp quyền. Máy chủ sẽ kiểm tra quyền sau khi bạn đăng nhập.
      </Gate>
    )
  } else if (access.status !== 'ready') {
    body = <StateView resource={access} onRetry={access.reload} />
  } else if (!allowed) {
    body = (
      <Gate icon={ShieldX} tone="error" title="Tài khoản chưa có quyền quản trị" actions={<><Button onClick={access.reload}><RefreshCw size={15} /> Kiểm tra lại</Button><Button onClick={() => go('home')}>Về khu người chơi</Button></>}>
        Máy chủ từ chối truy cập cho tài khoản này. Hãy liên hệ quản trị viên để được cấp vai trò phù hợp, hoặc đăng nhập bằng tài khoản khác.
      </Gate>
    )
  } else {
    body = <Page key={identity} navigate={go} />
  }

  return (
    <AdminWriteProvider>
      <div className={styles.console}>
        <header className={styles.head}>
          <div>
            <p className={styles.eyebrow}>QUẢN TRỊ HỆ THỐNG</p>
            <h1>{title}</h1>
            <p className={styles.lede}>{description}</p>
          </div>
          {allowed && <TotpBadge />}
        </header>
        <nav className={styles.tabsNav} aria-label="Trang quản trị">
          {ADMIN_PAGES.map(({ key: itemKey, label, icon: Icon }) => (
            <button key={itemKey} type="button" data-active={itemKey === key} aria-current={itemKey === key ? 'page' : undefined} onClick={() => go(`admin-${itemKey}`)}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>
        {body}
      </div>
    </AdminWriteProvider>
  )
}
