import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useToastStore } from '@/stores/useToastStore'

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info }

export default function Toaster() {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)
  return (
    <div className="toast-region" aria-live="polite" aria-relevant="additions">
      {toasts.map(({ id, kind, message }) => {
        const Icon = ICONS[kind] ?? Info
        return (
          <div key={id} className="toast" data-kind={kind} role={kind === 'error' ? 'alert' : 'status'}>
            <Icon size={18} />
            <span>{message}</span>
            <button type="button" onClick={() => dismiss(id)} aria-label="Đóng thông báo"><X size={15} /></button>
          </div>
        )
      })}
    </div>
  )
}
