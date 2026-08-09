import { ReactNode, useEffect } from 'react'
import { Check, CheckCircle2, ChevronDown, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getSession } from '../../lib/session'
export { Drawer } from './Drawer'

export type Toast = { message: string; kind?: 'success' | 'info' }

export function Brand({ light = false, to }: { light?: boolean; to?: string }) {
  const session = getSession()
  const destination = to ?? (
    session?.role === 'student'
      ? '/student'
      : session?.role === 'admin' || session?.role === 'super_admin'
        ? '/admin'
        : '/'
  )
  return (
    <Link to={destination} className={`brand ${light ? 'brand-light' : ''}`} aria-label="Kembali ke dashboard RuangUji">
      <span className="brand-mark"><Check /></span>
      <span>ruang<span>uji</span></span>
    </Link>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map((part) => part[0]).slice(0, 2).join('')
  return <span className={`avatar ${size}`}>{initials}</span>
}

export function StatusPill({ children, tone }: { children: ReactNode; tone?: string }) {
  const normalized = tone || String(children).toLowerCase().replaceAll(' ', '-')
  return <span className={`status-pill ${normalized}`}><span className="status-dot" />{children}</span>
}

export function ToastMessage({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2600)
    return () => clearTimeout(timer)
  }, [toast, onClose])
  return <div className={`toast ${toast.kind || 'success'}`}><CheckCircle2 /> {toast.message}</div>
}

export function PageToolbar({ search, setSearch, children, placeholder = 'Cari...' }: { search: string; setSearch: (value: string) => void; children?: ReactNode; placeholder?: string }) {
  return (
    <div className="page-toolbar">
      <div className="search-box"><Search /><input placeholder={placeholder} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {children}
    </div>
  )
}

export function SelectButton({ children }: { children: ReactNode }) {
  return <button className="select-button">{children}<ChevronDown /></button>
}
