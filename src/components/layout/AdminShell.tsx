import { ReactNode, useEffect, useRef, useState } from 'react'
import { Bell, Check, ChevronDown, ChevronRight, ClipboardCheck, FileText, LayoutDashboard, LogOut, Menu, Radio, Trophy, Users } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Avatar, Brand } from '../ui'
import { authRepository, examRepository } from '../../repositories'

type AdminNotification = {
  id: string
  title: string
  message: string
  to: string
  kind: 'live' | 'review'
}

const NOTIFICATION_STORAGE_KEY = 'ruanguji.admin.read-notifications'

export function AdminShell({ children, title, subtitle, action, fluid = false }: { children: ReactNode; title: string; subtitle?: string; action?: ReactNode; fluid?: boolean }) {
  const [sidebar, setSidebar] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) || '[]') as string[]) }
    catch { return new Set() }
  })
  const [loggingOut, setLoggingOut] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const currentAdmin = authRepository.session()?.profile || { id: 'admin', name: 'Admin', shortName: 'Admin', role: 'Administrator' }
  const logout = async () => {
    setLoggingOut(true)
    try {
      await authRepository.logout()
      navigate('/admin/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }
  useEffect(() => {
    examRepository.list().then((exams) => {
      const next: AdminNotification[] = []
      exams.forEach((exam) => {
        if ((exam.activeAttempts || 0) > 0) {
          next.push({
            id: `live-${exam.id}`,
            title: `${exam.title} sedang berlangsung`,
            message: `${exam.activeAttempts} peserta sedang mengerjakan ujian.`,
            to: '/admin/monitoring',
            kind: 'live',
          })
        }
        if (exam.mode === 'Koreksi admin' && (exam.completedAttempts || 0) > 0) {
          next.push({
            id: `review-${exam.id}-${exam.completedAttempts}`,
            title: `Jawaban ${exam.title} siap dikoreksi`,
            message: `${exam.completedAttempts} peserta telah menyelesaikan ujian.`,
            to: '/admin/reviews',
            kind: 'review',
          })
        }
      })
      setNotifications(next)
    }).catch(() => setNotifications([])).finally(() => setNotificationsLoading(false))
  }, [])
  useEffect(() => {
    if (!profileOpen && !notificationOpen) return
    const closeOutside = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false)
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false)
        setNotificationOpen(false)
      }
    }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [notificationOpen, profileOpen])
  const unreadCount = notifications.filter((item) => !readNotificationIds.has(item.id)).length
  const saveReadIds = (ids: Set<string>) => {
    setReadNotificationIds(ids)
    try { localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify([...ids])) }
    catch { /* state tetap berfungsi saat penyimpanan browser dibatasi */ }
  }
  const markRead = (id: string) => saveReadIds(new Set(readNotificationIds).add(id))
  const markAllRead = () => saveReadIds(new Set([...readNotificationIds, ...notifications.map((item) => item.id)]))
  const nav = [
    { to: '/admin', icon: LayoutDashboard, label: 'Ringkasan', end: true },
    { to: '/admin/students', icon: Users, label: 'Peserta' },
    { to: '/admin/exams', icon: FileText, label: 'Ujian' },
    { to: '/admin/monitoring', icon: Radio, label: 'Monitoring', pulse: true },
    { to: '/admin/reviews', icon: ClipboardCheck, label: 'Koreksi' },
    { to: '/admin/leaderboard', icon: Trophy, label: 'Leaderboard' },
  ]
  return (
    <div className="admin-layout">
      {sidebar && <button className="sidebar-scrim" onClick={() => setSidebar(false)} aria-label="Tutup menu" />}
      <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
        <div className="sidebar-brand"><Brand light /></div>
        <nav className="sidebar-nav">
          <p className="nav-label">MENU UTAMA</p>
          {nav.map(({ to, icon: Icon, label, pulse, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setSidebar(false)} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Icon /> <span>{label}</span>{pulse && <i className="live-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-help"><span className="help-icon">?</span><div><strong>Butuh bantuan?</strong><small>Baca panduan singkat</small></div><ChevronRight /></div>
        <div className="sidebar-user">
          <Avatar name={currentAdmin.name} />
          <div><strong>{currentAdmin.name}</strong><small>{currentAdmin.role}</small></div>
          <button
            className="sidebar-logout"
            type="button"
            disabled={loggingOut}
            title="Keluar dari akun"
            aria-label={loggingOut ? "Sedang keluar" : "Keluar dari akun"}
            onClick={() => void logout()}
          >
            <LogOut />
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <button className="mobile-menu" onClick={() => setSidebar(true)}><Menu /></button>
          <div className="page-heading"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
          <div className="topbar-actions">
            {action}
            <div className="notification-wrap" ref={notificationRef}>
              <button
                className={`icon-button ${notificationOpen ? 'active' : ''}`}
                type="button"
                aria-label={`Notifikasi${unreadCount ? `, ${unreadCount} belum dibaca` : ''}`}
                aria-haspopup="menu"
                aria-expanded={notificationOpen}
                onClick={() => { setNotificationOpen((open) => !open); setProfileOpen(false) }}
              >
                <Bell />
                {unreadCount > 0 && <span className="notification-dot" />}
              </button>
              {notificationOpen && (
                <div className="notification-menu" role="menu">
                  <div className="notification-menu-head">
                    <div><strong>Notifikasi</strong><small>{unreadCount ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}</small></div>
                    {unreadCount > 0 && <button type="button" onClick={markAllRead}><Check /> Tandai dibaca</button>}
                  </div>
                  <div className="notification-list">
                    {notificationsLoading && <p className="notification-empty">Memuat notifikasi...</p>}
                    {!notificationsLoading && !notifications.length && <p className="notification-empty">Belum ada notifikasi baru.</p>}
                    {!notificationsLoading && notifications.map((item) => {
                      const NotificationIcon = item.kind === 'live' ? Radio : ClipboardCheck
                      return (
                        <Link
                          key={item.id}
                          to={item.to}
                          role="menuitem"
                          className={!readNotificationIds.has(item.id) ? 'unread' : ''}
                          onClick={() => { markRead(item.id); setNotificationOpen(false) }}
                        >
                          <span className={`notification-kind ${item.kind}`}><NotificationIcon /></span>
                          <div><strong>{item.title}</strong><small>{item.message}</small></div>
                          {!readNotificationIds.has(item.id) && <i />}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="topbar-profile-wrap" ref={profileRef}>
              <button
                className={`topbar-profile ${profileOpen ? 'open' : ''}`}
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                onClick={() => { setProfileOpen((open) => !open); setNotificationOpen(false) }}
              >
                <Avatar name={currentAdmin.name} size="sm" />
                <span>{currentAdmin.shortName}</span>
                <ChevronDown />
              </button>
              {profileOpen && (
                <div className="topbar-profile-menu" role="menu">
                  <div className="profile-menu-account">
                    <Avatar name={currentAdmin.name} />
                    <div><strong>{currentAdmin.name}</strong><small>{currentAdmin.role}</small></div>
                  </div>
                  <button type="button" role="menuitem" disabled={loggingOut} onClick={() => void logout()}>
                    <LogOut /> {loggingOut ? 'Sedang keluar...' : 'Keluar dari akun'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className={`admin-content ${fluid ? 'wide' : ''}`}>{children}</div>
      </main>
    </div>
  )
}
