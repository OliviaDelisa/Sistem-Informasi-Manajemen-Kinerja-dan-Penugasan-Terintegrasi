import Icon from './Icon'

export default function Sidebar({ role, collapsed, setCollapsed, activeMenu, setActiveMenu, onLogout }) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <span className="brand-mark">K</span>
        <div className="brand-copy">
          <strong>Sistem Informasi Manajemen Kinerja dan Penugasan</strong>
          <small>Fakultas Teknologi Informasi</small>
        </div>
      </div>
      <nav className="sidebar-nav">
        <span className="nav-caption">MENU UTAMA</span>
        {role.menu.map(([label, icon]) => (
          <button key={label} className={`nav-item ${activeMenu === label ? 'active' : ''}`} onClick={() => setActiveMenu(label)} title={collapsed ? label : undefined}>
            <Icon name={icon} />
            <span>{label}</span>
            {label === 'Audit Trail' && <b className="nav-badge">3</b>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-item logout-item" onClick={onLogout}><Icon name="logout" /><span>Keluar</span></button>
        <button className="collapse-button" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Perbesar sidebar' : 'Perkecil sidebar'}>
          <Icon name="chevron" size={18} />
          <span>{collapsed ? 'Perbesar sidebar' : 'Perkecil sidebar'}</span>
        </button>
      </div>
    </aside>
  )
}
