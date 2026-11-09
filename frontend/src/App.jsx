import { useState } from 'react'
import './App.css'
import './dashboard.css'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import { roleConfig } from './components/roleConfig'
import { loginRequest } from './services/authApi'
import AccountManagementPage from './pages/AccountManagementPage'
import PositionManagementPage from './pages/PositionManagementPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import ImporPresensiPage from './pages/ImporPresensiPage'

function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [activeMenu, setActiveMenu] = useState('Dashboard')
  const [loginError, setLoginError] = useState('')
  const role = { ...(roleConfig[user?.roleKey] || roleConfig.superadmin), name: user?.name, position: user?.roleKey === 'superadmin' ? 'SDM' : user?.position }

  async function handleLogin(credentials) {
    setLoginError('')
    try {
      const loggedInUser = await loginRequest(credentials)
      setUser(loggedInUser)
      setActiveMenu('Dashboard')
      setLoggedIn(true)
    } catch (error) {
      setLoginError(error.message)
    }
  }

  function handleLogout() {
    setUser(null)
    setLoggedIn(false)
  }

  if (!loggedIn) {
    return <LoginPage onLogin={handleLogin} error={loginError} />
  }

  if (user?.wajibGantiPassword) {
    return <ChangePasswordPage user={user} onChanged={() => setUser({ ...user, wajibGantiPassword: false })} />
  }

  let page
  if (activeMenu === 'Manajemen Akun & Hak Akses') page = <AccountManagementPage />
  if (activeMenu === 'Jabatan, Unit Kerja & Tupoksi') page = <PositionManagementPage />
  if (activeMenu === 'Impor Presensi') page = <ImporPresensiPage />

  return (
    <DashboardPage
      role={role}
      activeMenu={activeMenu}
      setActiveMenu={setActiveMenu}
      onLogout={handleLogout}
      page={page}
    />
  )
}

export default App
