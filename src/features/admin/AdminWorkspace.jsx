import { ArrowRight, Database, FlaskConical, LockKeyhole, ShieldCheck } from 'lucide-react'
import AdminDemo from './AdminDemo'
import AdminLive from './AdminLive'
import styles from './AdminWorkspace.module.css'

export default function AdminWorkspace({ mode = 'demo', onModeChange = () => {}, navigation = [], onSignIn, ...props }) {
  const live = mode === 'api'
  const knownPage = navigation.some((item) => item.key === props.page)
  return (
    <div className={styles.workspace}>
      <div className={styles.topline}>
        <span className={styles.identity}><ShieldCheck size={17} /> CHESSARENA ADMIN</span>
        <div className={styles.sourcePicker} role="group" aria-label="Nguồn dữ liệu quản trị">
          <button type="button" aria-pressed={!live} onClick={() => onModeChange('demo')}><FlaskConical size={15} /> Dữ liệu mẫu</button>
          <button type="button" aria-pressed={live} onClick={() => onModeChange('api')}><Database size={15} /> Máy chủ</button>
        </div>
      </div>
      <nav className={styles.mobilePages} aria-label="Các trang quản trị">
        {navigation.map(({ key, label, icon: Icon }) => <button key={key} type="button" aria-current={props.page === key ? 'page' : undefined} onClick={() => props.navigate(`admin-${key}`)}><Icon size={15} />{label}</button>)}
      </nav>
      {knownPage || !navigation.length ? live
        ? <AdminLive key={props.page} page={props.page} navigate={props.navigate} onSignIn={onSignIn} onDemo={() => onModeChange('demo')} />
        : <AdminDemo {...props} />
        : <section className={styles.entry}><ShieldCheck size={28} /><h1>Trang quản trị chưa tồn tại</h1><p>Chọn một mục trong điều hướng để tiếp tục.</p><button type="button" className={styles.primary} onClick={() => props.navigate('admin-overview')}>Về tổng quan <ArrowRight size={16} /></button></section>}
    </div>
  )
}

export function AdminEntry({ onEnter, account, onSignIn }) {
  return (
    <section className={styles.entry}>
      <span className={styles.entryIcon}><ShieldCheck size={30} /></span>
      <p className={styles.eyebrow}>KHÔNG GIAN VẬN HÀNH</p>
      <h1>Quản trị rõ ràng.<br />Xử lý nhanh hơn.</h1>
      <p>Theo dõi tài khoản, xem quyền truy cập và kiểm tra lịch sử thao tác tại một nơi.</p>
      <div className={styles.entryChoices}>
        <article>
          <Database size={22} />
          <h2>Kết nối máy chủ</h2>
          <p>{account ? `Tiếp tục với tài khoản ${account.name || 'đang đăng nhập'}. Quyền truy cập được kiểm tra khi mở.` : 'Đăng nhập tài khoản được cấp quyền để xem dữ liệu quản trị.'}</p>
          <button type="button" className={styles.primary} onClick={() => onEnter('api')}>Mở quản trị <ArrowRight size={16} /></button>
          {!account && <button type="button" className={styles.textButton} onClick={onSignIn}>Đăng nhập tài khoản</button>}
        </article>
        <article>
          <FlaskConical size={22} />
          <h2>Khám phá giao diện</h2>
          <p>Thử tìm kiếm, xử lý báo cáo và phân quyền trên dữ liệu mẫu trong phiên này.</p>
          <button type="button" className={styles.secondary} onClick={() => onEnter('demo')}>Vào quản trị demo <ArrowRight size={16} /></button>
        </article>
      </div>
      <span className={styles.entryNote}><LockKeyhole size={15} /> Dữ liệu máy chủ chỉ hiển thị sau khi quyền được xác nhận.</span>
    </section>
  )
}
