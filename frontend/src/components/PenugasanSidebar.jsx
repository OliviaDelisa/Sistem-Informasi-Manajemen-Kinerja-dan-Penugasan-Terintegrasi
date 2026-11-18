import React from 'react';

const MENU_BY_ROLE = {
  dekan: [
    { id: 'dashboard', label: 'Dashboard Kinerja', icon: 'grid' },
    { id: 'penugasan', label: 'Manajemen Penugasan', icon: 'clipboard' },
    { id: 'riwayat', label: 'Riwayat Penugasan', icon: 'history' },
    { id: 'logbook', label: 'Review & Validasi Logbook', icon: 'check-badge' },
    { id: 'kepanitiaan', label: 'Pantau Kepanitiaan', icon: 'users' },
    { id: 'rekap', label: 'Rekap Kinerja & Presensi', icon: 'bar-chart' },
    { id: 'spk', label: 'Rekomendasi Tugas (SPK)', icon: 'search-user' },
    { id: 'laporan', label: 'Laporan', icon: 'file-text' }
  ],
  kepalaKantor: [
    { id: 'dashboard', label: 'Dashboard Kinerja', icon: 'grid' },
    { id: 'penugasan-masuk', label: 'Penugasan Masuk', icon: 'inbox' },
    { id: 'penugasan', label: 'Kelola Penugasan Bawahan', icon: 'clipboard' },
    { id: 'riwayat', label: 'Riwayat Penugasan', icon: 'history' },
    { id: 'logbook', label: 'Review & Validasi Logbook', icon: 'check-badge' },
    { id: 'rekap', label: 'Rekap Kinerja & Presensi', icon: 'bar-chart' },
    { id: 'spk', label: 'Rekomendasi Penerima (SPK)', icon: 'users' },
    { id: 'laporan', label: 'Laporan', icon: 'file-text' }
  ],
  kasi: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { id: 'penugasan-masuk', label: 'Penugasan Masuk', icon: 'inbox' },
    { id: 'penugasan', label: 'Penugasan ke Tendik', icon: 'send' },
    { id: 'riwayat', label: 'Riwayat Penugasan', icon: 'history' },
    { id: 'logbook', label: 'Review Logbook Tendik', icon: 'check-badge' },
    { id: 'rekap', label: 'Rekap Kinerja', icon: 'bar-chart' },
    { id: 'spk', label: 'Rekomendasi Penerima (SPK)', icon: 'users' },
    { id: 'laporan', label: 'Laporan', icon: 'file-text' }
  ],
  tendik: [
    { id: 'dashboard', label: 'Dashboard Kinerja', icon: 'grid' },
    { id: 'penugasan-masuk', label: 'Penugasan Masuk & Progres', icon: 'inbox' },
    { id: 'riwayat', label: 'Riwayat Penugasan', icon: 'history' },
    { id: 'logbook', label: 'Logbook Kegiatan', icon: 'check-badge' },
    { id: 'rekap', label: 'Rekap Kinerja & Presensi', icon: 'bar-chart' }
  ],
  dosen: [
    { id: 'dashboard', label: 'Dashboard Kinerja', icon: 'grid' },
    { id: 'riwayat', label: 'Riwayat Penugasan', icon: 'history' },
    { id: 'kepanitiaan', label: 'Kepanitiaan Saya', icon: 'users' },
    { id: 'logbook', label: 'Logbook Kegiatan', icon: 'check-badge' }
  ]
};

function MenuIcon({ type }) {
  if (type === 'grid') {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 15 15" fill="none">
        <path d="M8.33 5V0H15V5H8.33ZM0 8.33V0H6.67V8.33H0ZM8.33 15V6.67H15V15H8.33ZM0 15V10H6.67V15H0Z" fill="currentColor" />
      </svg>
    );
  }
  if (type === 'inbox' || type === 'clipboard') {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 15 15" fill="none">
        <path d="M1.67 15C1.21 15 0.82 14.84 0.49 14.51C0.16 14.18 0 13.79 0 13.33V1.67C0 1.21 0.16 0.82 0.49 0.49C0.82 0.16 1.21 0 1.67 0H13.33C13.79 0 14.18 0.16 14.51 0.49C14.84 0.82 15 1.21 15 1.67V13.33C15 13.79 14.84 14.18 14.51 14.51C14.18 14.84 13.79 15 13.33 15H1.67ZM7.5 10.83C8.03 10.83 8.51 10.68 8.94 10.38C9.37 10.07 9.67 9.67 9.83 9.17H13.33V1.67H1.67V9.17H5.17C5.33 9.67 5.63 10.07 6.06 10.38C6.49 10.68 6.97 10.83 7.5 10.83Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function PenugasanSidebar({
  roleKey = 'dekan',
  userPosition = 'Dekan',
  activeMenu = 'penugasan',
  onSelectMenu = () => {},
  onLogout = () => {}
}) {
  const menuList = MENU_BY_ROLE[roleKey] || MENU_BY_ROLE.dekan;

  return (
    <aside className="w-68 min-w-[272px] min-h-screen bg-white border-r border-gray-200 flex flex-col justify-between shrink-0">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-gray-100 flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0F5132] text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-sm">
              UA
            </div>
            <div className="flex flex-col">
              <span className="text-[#0F5132] font-bold text-sm leading-5 tracking-tight">SIM-KP FTI UNAND</span>
              <span className="text-gray-500 font-semibold text-[11px] tracking-wide">Fakultas Teknologi Informasi</span>
            </div>
          </div>

          <div>
            <span className="inline-block px-2 py-0.5 rounded bg-[#DCFCE7] text-[#14532D] text-[10px] font-bold tracking-wider uppercase">
              {userPosition}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 flex flex-col gap-1">
          <span className="px-3 pb-1.5 text-[10px] font-bold tracking-widest text-gray-400 uppercase">
            MENU UTAMA
          </span>
          {menuList.map((item) => {
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectMenu(item.id)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#0F5132] text-white shadow-xs font-semibold'
                    : 'text-gray-700 hover:bg-[#0F5132]/10 hover:text-[#0F5132]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MenuIcon type={item.icon} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer & Logout */}
      <div className="p-4 border-t border-gray-100 flex flex-col gap-3">
        <button
          onClick={onLogout}
          className="w-full py-2.5 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors flex items-center justify-center gap-2 border border-red-200 cursor-pointer"
        >
          <span>Keluar / Ganti Akun</span>
        </button>
      </div>
    </aside>
  );
}
