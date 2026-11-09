import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import MetricCard from '../components/MetricCard'
import { getDashboardSummary } from '../services/managementApi'

const emptySummary = { totalUsers: 0, totalUnits: 0, totalRoles: 0, totalPositions: 0, usersByRole: [] }

export default function DashboardPage({ role, activeMenu, setActiveMenu, onLogout, page }) {
  const [collapsed, setCollapsed] = useState(false)
  const [summary, setSummary] = useState(emptySummary)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('30 hari')

  useEffect(() => {
    getDashboardSummary()
      .then(({ summary: loadedSummary }) => setSummary(loadedSummary))
      .catch((requestError) => setError(requestError.message))
  }, [])

  const roleUsers = summary.usersByRole.find((item) => item.roleName === role.label)?.total || 0
  const metrics = [
    { label: 'Pengguna terdaftar', value: role.roleKey === 'superadmin' ? summary.totalUsers : roleUsers, note: 'Data dari database', icon: 'users' },
    { label: 'Unit kerja', value: summary.totalUnits, note: 'Unit aktif', icon: 'briefcase' },
    { label: 'Jabatan', value: summary.totalPositions, note: 'Jabatan terdaftar', icon: 'activity' },
    { label: 'Role sistem', value: summary.totalRoles, note: 'Role tersedia', icon: 'shield' },
  ]

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar role={role} collapsed={collapsed} setCollapsed={setCollapsed} activeMenu={activeMenu} setActiveMenu={setActiveMenu} onLogout={onLogout} />
      <div className="main-area">
        <Topbar role={role} setCollapsed={setCollapsed} activeMenu={activeMenu} />
        <main className="dashboard-content">
          {page || (
            <section className="page-section">
              <div className="page-heading">
                <div>
                  <h1>Dashboard</h1>
                  <p>Ringkasan data sistem dan pengguna yang tersimpan.</p>
                </div>
                <div className="toolbar-inline">
                  <label className="field-inline">
                    <span>Filter</span>
                    <select value={period} onChange={(event) => setPeriod(event.target.value)}>
                      <option value="7 hari">7 hari</option>
                      <option value="30 hari">30 hari</option>
                      <option value="90 hari">90 hari</option>
                    </select>
                  </label>
                </div>
              </div>

              {error && <div className="page-message error-message">{error}</div>}

              <div className="metric-grid">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>

              <div className="panel-grid">
                <div className="data-panel">
                  <div className="panel-header">
                    <h3>Performa sistem</h3>
                    <span>7 hari terakhir</span>
                  </div>
                  <div className="chart-placeholder">
                    <div className="chart-bars">
                      <span style={{ height: '42%' }} />
                      <span style={{ height: '58%' }} />
                      <span style={{ height: '51%' }} />
                      <span style={{ height: '68%' }} />
                      <span style={{ height: '80%' }} />
                      <span style={{ height: '74%' }} />
                      <span style={{ height: '92%' }} />
                    </div>
                  </div>
                </div>

                <div className="data-panel">
                  <div className="panel-header">
                    <h3>Distribusi role</h3>
                    <span>Aktif</span>
                  </div>
                  <ul className="role-list">
                    {summary.usersByRole.length ? summary.usersByRole.map((item) => (
                      <li key={item.roleName}>
                        <span>{item.roleName}</span>
                        <strong>{item.total}</strong>
                      </li>
                    )) : (
                      <li><span>Belum ada data</span><strong>0</strong></li>
                    )}
                  </ul>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
