import { ReactNode, useState } from 'react'
import { Award, Bell, ChevronDown, ChevronRight, ClipboardCheck, FileText, LayoutDashboard, LogOut, Menu, Radio, Trophy, Users } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Avatar, Brand } from '../ui'
import { authRepository } from '../../repositories'

export function AdminShell({ children, title, subtitle, action, fluid = false }: { children: ReactNode; title: string; subtitle?: string; action?: ReactNode; fluid?: boolean }) {
  const [sidebar, setSidebar] = useState(false)
  const navigate = useNavigate()
  const currentAdmin = authRepository.session()?.profile || { id: 'admin', name: 'Admin', shortName: 'Admin', role: 'Administrator' }
  const logout = async () => { await authRepository.logout(); navigate('/admin/login', { replace: true }) }
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
        <div className="sidebar-user"><Avatar name={currentAdmin.name} /><div><strong>{currentAdmin.name}</strong><small>{currentAdmin.role}</small></div><button onClick={logout} aria-label="Keluar"><LogOut /></button></div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <button className="mobile-menu" onClick={() => setSidebar(true)}><Menu /></button>
          <div className="page-heading"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
          <div className="topbar-actions">{action}<button className="icon-button" aria-label="Notifikasi"><Bell /><span className="notification-dot" /></button><div className="topbar-profile"><Avatar name={currentAdmin.name} size="sm" /><span>{currentAdmin.shortName}</span><ChevronDown /></div></div>
        </header>
        <div className={`admin-content ${fluid ? 'wide' : ''}`}>{children}</div>
      </main>
    </div>
  )
}
