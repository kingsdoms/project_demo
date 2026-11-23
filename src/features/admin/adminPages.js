import { Activity, Ban, Bell, ChartNoAxesCombined, ServerCog, ShieldCheck, Terminal, Users } from 'lucide-react'

/** Danh sách trang quản trị; route tương ứng là `admin-${key}`. */
export const ADMIN_PAGES = [
  { key: 'overview', label: 'Tổng quan', icon: ChartNoAxesCombined },
  { key: 'users', label: 'Người dùng', icon: Users },
  { key: 'roles', label: 'Vai trò & quyền', icon: ShieldCheck },
  { key: 'notifications', label: 'Thông báo', icon: Bell },
  { key: 'blacklist', label: 'Danh sách chặn', icon: Ban },
  { key: 'journals', label: 'Nhật ký', icon: Activity },
  { key: 'commands', label: 'Lệnh', icon: Terminal },
  { key: 'system', label: 'Hệ thống', icon: ServerCog },
]
