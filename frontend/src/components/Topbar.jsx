import Icon from './Icon'

export default function Topbar({ role, setCollapsed, activeMenu }) {
  const pageTitle = activeMenu || role.title

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>SIM-KP</span>
        <b>/</b>
        <strong>{pageTitle}</strong>
      </div>
      <div className="topbar-actions">
        <div className="topbar-user">
          <div className={`avatar avatar-${role.color}`}>{role.initials}</div>
          <div>
            <strong>{role.name || role.label}</strong>
            <span>{role.position || role.department}</span>
          </div>
        </div>
        <button className="mobile-menu" onClick={() => setCollapsed(false)}><Icon name="menu" /></button>
      </div>
    </header>
  )
}
