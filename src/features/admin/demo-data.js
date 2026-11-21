export const DEMO_USERS = [
  { id: 'usr_20144', name: 'Minh Anh', email: 'minh.anh@example.test', status: 'Hoạt động', rating: 1842, joined: '2025-04-12', role: 'Người chơi' },
  { id: 'usr_20112', name: 'rook_88', email: 'rook88@example.test', status: 'Hoạt động', rating: 1706, joined: '2025-02-03', role: 'Người chơi' },
  { id: 'usr_20098', name: 'fastbishop', email: 'fast@example.test', status: 'Đang xem xét', rating: 2106, joined: '2025-01-22', role: 'Người chơi' },
  { id: 'usr_19807', name: 'mai.an', email: 'mai.an@example.test', status: 'Đã khóa', rating: 1581, joined: '2024-11-19', role: 'Người chơi' },
  { id: 'usr_19772', name: 'linh.mod', email: 'linh.mod@example.test', status: 'Hoạt động', rating: 1924, joined: '2024-10-28', role: 'Kiểm duyệt viên' },
  { id: 'usr_19551', name: 'nightrook', email: 'nightrook@example.test', status: 'Hoạt động', rating: 1765, joined: '2024-09-11', role: 'Người chơi' },
  { id: 'usr_19485', name: 'blitz_fox', email: 'blitz.fox@example.test', status: 'Đang xem xét', rating: 1684, joined: '2024-08-16', role: 'Người chơi' },
  { id: 'usr_19220', name: 'tranle', email: 'tran.le@example.test', status: 'Hoạt động', rating: 1612, joined: '2024-07-02', role: 'Người chơi' },
  { id: 'usr_19164', name: 'quietrook', email: 'quietrook@example.test', status: 'Hoạt động', rating: 1526, joined: '2024-06-18', role: 'Người chơi' },
  { id: 'usr_19002', name: 'hoang.knight', email: 'hoang.knight@example.test', status: 'Hoạt động', rating: 1478, joined: '2024-05-23', role: 'Người chơi' },
  { id: 'usr_18756', name: 'rook_99', email: 'rook99@example.test', status: 'Đã khóa', rating: 1638, joined: '2024-04-09', role: 'Người chơi' },
  { id: 'usr_18541', name: 'admin_mai', email: 'admin.mai@example.test', status: 'Hoạt động', rating: 2018, joined: '2024-03-01', role: 'Quản trị viên' },
]

export const DEMO_MATCHES = [
  { id: 'm_104892', white: 'blitz_fox', black: 'Minh Anh', status: 'Đang diễn ra', mode: 'Blitz', clock: '5 + 0', elapsed: '4:12' },
  { id: 'm_104891', white: 'tranle', black: 'nightrook', status: 'Đã kết thúc', mode: 'Rapid', clock: '10 + 5', elapsed: '11:38' },
  { id: 'm_104890', white: 'rook_88', black: 'mai.an', status: 'Đang diễn ra', mode: 'Blitz', clock: '3 + 2', elapsed: '2:46' },
  { id: 'm_104889', white: 'quietrook', black: 'fastbishop', status: 'Đã báo cáo', mode: 'Bullet', clock: '1 + 0', elapsed: '0:31' },
  { id: 'm_104888', white: 'hoang.knight', black: 'rook_99', status: 'Đã kết thúc', mode: 'Rapid', clock: '10 + 0', elapsed: '9:12' },
  { id: 'm_104887', white: 'Minh Anh', black: 'nightrook', status: 'Đã kết thúc', mode: 'Blitz', clock: '5 + 0', elapsed: '7:30' },
  { id: 'm_104886', white: 'linh.mod', black: 'tranle', status: 'Đang diễn ra', mode: 'Rapid', clock: '15 + 10', elapsed: '6:04' },
  { id: 'm_104885', white: 'rook_88', black: 'quietrook', status: 'Đã báo cáo', mode: 'Blitz', clock: '3 + 0', elapsed: '3:42' },
]

export const DEMO_REPORTS = [
  { id: 'rp_0782', title: 'Nghi ngờ sử dụng engine', from: 'Minh Anh', about: 'fastbishop', time: '4 phút trước', type: 'Gian lận', status: 'Chờ xử lý' },
  { id: 'rp_0781', title: 'Tin nhắn không phù hợp', from: 'rook_88', about: 'blitz_fox', time: '18 phút trước', type: 'Hành vi', status: 'Chờ xử lý' },
  { id: 'rp_0780', title: 'Mất kết nối bất thường', from: 'mai.an', about: 'quietrook', time: '1 giờ trước', type: 'Trận đấu', status: 'Đang xem xét' },
  { id: 'rp_0774', title: 'Spam trong chat', from: 'tranle', about: 'rook_99', time: 'Hôm qua', type: 'Hành vi', status: 'Đã xử lý' },
]

export const DEMO_AUDIT = [
  { id: 'adm_0084', actor: 'linh.mod', action: 'Đánh dấu báo cáo đang xem xét', target: 'rp_0782', time: 'Hôm nay, 10:42', group: 'Báo cáo' },
  { id: 'adm_0083', actor: 'admin_mai', action: 'Mở hồ sơ người dùng', target: 'usr_20098', time: 'Hôm nay, 10:18', group: 'Tài khoản' },
  { id: 'adm_0082', actor: 'linh.mod', action: 'Xem lại ván đấu', target: 'm_104889', time: 'Hôm nay, 09:56', group: 'Trận đấu' },
  { id: 'adm_0081', actor: 'admin_mai', action: 'Xuất bản thông báo demo', target: 'cnt_0028', time: 'Hôm qua, 22:14', group: 'Nội dung' },
]

export const PERMISSION_ROWS = [
  ['accounts', 'Xem người dùng', 'Tra cứu hồ sơ và tìm kiếm tài khoản.'],
  ['reports', 'Xử lý báo cáo', 'Xem bằng chứng và cập nhật trạng thái.'],
  ['matches', 'Xem trận đấu', 'Tìm trận và xem lại diễn biến.'],
  ['content', 'Quản lý nội dung', 'Soạn thông báo và hướng dẫn.'],
  ['roles', 'Quản lý phân quyền', 'Điều chỉnh phạm vi của từng vai trò.'],
  ['audit', 'Xem nhật ký', 'Tra cứu lịch sử thao tác quản trị.'],
]

export const DEFAULT_PERMISSIONS = {
  'Kiểm duyệt viên': { accounts: true, reports: true, matches: true, content: false, roles: false, audit: true },
  'Quản trị viên': { accounts: true, reports: true, matches: true, content: true, roles: true, audit: true },
}
