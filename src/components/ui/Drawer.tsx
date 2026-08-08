import { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Drawer({ open, title, description, children, footer, onClose }: { open: boolean; title: string; description?: string; children: ReactNode; footer?: ReactNode; onClose: () => void }) {
  if (!open) return null
  return <div className="drawer-layer"><button className="drawer-scrim" onClick={onClose} aria-label="Tutup panel" /><aside className="drawer-panel" role="dialog" aria-modal="true" aria-label={title}><header><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose}><X /></button></header><div className="drawer-body">{children}</div>{footer && <footer>{footer}</footer>}</aside></div>
}

