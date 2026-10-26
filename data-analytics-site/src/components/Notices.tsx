import { CheckCircle2, AlertCircle, X } from 'lucide-react'

export interface Notice {
  id: string
  kind: 'success' | 'error'
  message: string
}

interface NoticesProps {
  notices: Notice[]
  onDismiss: (id: string) => void
}

const styles = {
  success: { box: 'bg-green-50 text-green-800', button: 'hover:bg-green-100', Icon: CheckCircle2 },
  error: { box: 'bg-red-50 text-red-700', button: 'hover:bg-red-100', Icon: AlertCircle },
}

export function Notices({ notices, onDismiss }: NoticesProps) {
  if (notices.length === 0) return null

  return (
    <ul className="mb-6 space-y-2">
      {notices.map(({ id, kind, message }) => {
        const { box, button, Icon } = styles[kind]
        return (
          <li
            key={id}
            role={kind === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-2 rounded-lg px-4 py-2 text-sm ${box}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{message}</span>
            <button
              onClick={() => onDismiss(id)}
              aria-label="Dismiss"
              className={`-mr-2 rounded p-0.5 ${button}`}
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
