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
import PenugasanPimpinan from './pages/PenugasanPimpinan'
import PenugasanMasuk from './pages/PenugasanMasuk'
import RiwayatPenugasan from './pages/RiwayatPenugasan'
import PenugasanSidebar from './components/PenugasanSidebar'
import PenugasanHeader from './components/PenugasanHeader'
import LogbookPage from './pages/LogbookPage'

function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [activeMenu, setActiveMenu] = useState('Dashboard')
  const [selectedRiwayatId, setSelectedRiwayatId] = useState(null)
  const [loginError, setLoginError] = useState('')

  const role = {
    ...(roleConfig[user?.roleKey] || roleConfig.superadmin),
    name: user?.name,
    position: user?.roleKey === 'superadmin' ? 'SDM' : user?.position
  }

  async function handleLogin(credentials) {
    setLoginError('')
    try {
      const loggedInUser = await loginRequest(credentials)
      setUser(loggedInUser)
      setSelectedRiwayatId(null)

      // Arahkan langsung sesuai RBAC PRD Bagian 2
      if (loggedInUser.roleKey === 'dekan') {
        setActiveMenu('penugasan')
      } else if (
        loggedInUser.roleKey === 'kepalaKantor' ||
        loggedInUser.roleKey === 'kasi' ||
        loggedInUser.roleKey === 'tendik'
      ) {
        setActiveMenu('penugasan-masuk')
      } else if (loggedInUser.roleKey === 'dosen') {
        setActiveMenu('riwayat')
      } else {
        setActiveMenu('Dashboard')
      }

      setLoggedIn(true)
    } catch (error) {
      setLoginError(error.message)
    }
  }

  function handleLogout() {
    setUser(null)
    setLoggedIn(false)
    setSelectedRiwayatId(null)
  }

  function handleOpenRiwayatDetail(idPenugasan) {
    setSelectedRiwayatId(idPenugasan)
    setActiveMenu('riwayat')
  }

  if (!loggedIn) {
    return <LoginPage onLogin={handleLogin} error={loginError} />
  }

  if (user?.wajibGantiPassword) {
    return <ChangePasswordPage user={user} onChanged={() => setUser({ ...user, wajibGantiPassword: false })} />
  }

  // Layout Modul Penugasan & Pendelegasian untuk Dekan, Kepala Kantor, Kasi, Tendik, dan Dosen
  if (['dekan', 'kepalaKantor', 'kasi', 'tendik', 'dosen'].includes(user?.roleKey)) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFC]">
        <PenugasanSidebar
          roleKey={user.roleKey}
          userPosition={user.position || role.label}
          activeMenu={activeMenu}
          onSelectMenu={(menuId) => {
            setSelectedRiwayatId(null)
            setActiveMenu(menuId)
          }}
          onLogout={handleLogout}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <PenugasanHeader
            roleKey={user.roleKey}
            activeMenu={activeMenu}
            userName={user.name}
            userRole={user.position || role.label}
            notificationCount={2}
            onLogout={handleLogout}
          />
          {activeMenu === 'penugasan' && (
            <PenugasanPimpinan user={user} onOpenRiwayatDetail={handleOpenRiwayatDetail} />
          )}
          {activeMenu === 'penugasan-masuk' && (
            <PenugasanMasuk user={user} onOpenRiwayatDetail={handleOpenRiwayatDetail} />
          )}
          {activeMenu === 'riwayat' && (
            <RiwayatPenugasan
              user={user}
              initialSelectedId={selectedRiwayatId}
              onClearSelectedId={() => setSelectedRiwayatId(null)}
            />
          )}
          {activeMenu === 'logbook' && (
            <LogbookPage user={user} />
          )}
          {activeMenu !== 'penugasan' && activeMenu !== 'penugasan-masuk' && activeMenu !== 'riwayat' && activeMenu !== 'logbook' && (
            <div className="p-12 flex flex-col items-center justify-center min-h-[400px] text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#DCFCE7] text-[#0F5132] flex items-center justify-center text-2xl mb-4 shadow-xs">
                📁
              </div>
              <h2 className="text-xl font-bold text-[#0B1C30]">
                Modul {activeMenu.charAt(0).toUpperCase() + activeMenu.slice(1)}
              </h2>
              <p className="text-sm text-gray-500 mt-1 max-w-sm">
                Silakan pilih menu <strong>Penugasan</strong> atau <strong>Riwayat Penugasan</strong> pada sidebar kiri.
              </p>
              <button
                onClick={() =>
                  setActiveMenu(
                    user.roleKey === 'dekan'
                      ? 'penugasan'
                      : user.roleKey === 'dosen'
                      ? 'riwayat'
                      : 'penugasan-masuk'
                  )
                }
                className="mt-4 px-4 py-2 rounded-lg bg-[#0F5132] text-white text-xs font-semibold hover:bg-[#14532D] shadow-xs cursor-pointer"
              >
                Buka Modul Penugasan
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  let page
  if (activeMenu === 'Manajemen Akun & Hak Akses') page = <AccountManagementPage />
  if (activeMenu === 'Jabatan, Unit Kerja & Tupoksi') page = <PositionManagementPage />
  if (activeMenu === 'Impor Presensi') page = <ImporPresensiPage />
  if (activeMenu === 'Penugasan' || activeMenu === 'Penugasan Saya') page = <PenugasanPimpinan user={user} />
  if (activeMenu === 'Penugasan Masuk') page = <PenugasanMasuk user={user} />
  if (activeMenu === 'Riwayat Penugasan') page = <RiwayatPenugasan user={user} />
  if (activeMenu === 'Logbook' || activeMenu === 'Logbook Kegiatan' || activeMenu === 'logbook') page = <LogbookPage user={user} />

  return (
    <DashboardPage
      role={role}
      activeMenu={activeMenu}
      setActiveMenu={setActiveMenu}
      onLogout={handleLogout}
      customContent={page}
    />
  )
}

export default App
