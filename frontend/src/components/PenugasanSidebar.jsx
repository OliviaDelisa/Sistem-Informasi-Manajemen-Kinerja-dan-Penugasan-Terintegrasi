import React from 'react';

const MENU_BY_ROLE = {
  dekan: [
    { id: 'dashboard', label: 'Dashboard Kinerja', icon: 'grid' },
    { id: 'penugasan', label: 'Manajemen Penugasan', icon: 'clipboard' },
    { id: 'riwayat', label: 'Riwayat Penugasan', icon: 'history' },
    { id: 'logbook', label: 'Review & Validasi Logbook', icon: 'book', badge: '1 Antrean', badgeStyle: 'bg-amber-100 text-amber-800' },
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
    { id: 'logbook', label: 'Review dan Validasi Logbook', icon: 'book' },
    { id: 'rekap', label: 'Rekap Kinerja & Presensi', icon: 'bar-chart' },
    { id: 'spk', label: 'Rekomendasi Penerima (SPK)', icon: 'users' },
    { id: 'laporan', label: 'Laporan', icon: 'file-text' }
  ],
  kasi: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { id: 'penugasan-masuk', label: 'Penugasan Masuk', icon: 'inbox' },
    { id: 'penugasan', label: 'Penugasan ke Tendik', icon: 'send' },
    { id: 'riwayat', label: 'Riwayat Penugasan', icon: 'history' },
    { id: 'logbook', label: 'Review dan Validasi Logbook', icon: 'book' },
    { id: 'rekap', label: 'Rekap Kinerja', icon: 'bar-chart' },
    { id: 'spk', label: 'Rekomendasi Penerima (SPK)', icon: 'users' },
    { id: 'laporan', label: 'Laporan', icon: 'file-text' }
  ],
  tendik: [
    { id: 'dashboard', label: 'Dashboard Kinerja', icon: 'grid' },
    { id: 'penugasan-masuk', label: 'Penugasan Masuk & Progres', icon: 'inbox' },
    { id: 'riwayat', label: 'Riwayat Penugasan', icon: 'history' },
    { id: 'logbook', label: 'Logbook Kegiatan', icon: 'book' },
    { id: 'rekap', label: 'Rekap Kinerja & Presensi', icon: 'bar-chart' }
  ],
  dosen: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { id: 'kepanitiaan', label: 'Kepanitiaan', icon: 'users', badge: '1 Baru', badgeStyle: 'bg-[#9A3412] text-white' },
    { id: 'logbook', label: 'Logbook', icon: 'book' },
    { id: 'riwayat', label: 'Riwayat Penugasan', icon: 'history' },
    { id: 'laporan', label: 'Laporan Saya', icon: 'file-text' }
  ]
};

function MenuIcon({ type }) {
  if (type === 'grid') {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (type === 'users') {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (type === 'book' || type === 'check-badge') {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="m9 10 2 2 4-4" />
      </svg>
    );
  }
  if (type === 'history') {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l4 2" />
      </svg>
    );
  }
  if (type === 'file-text' || type === 'bar-chart') {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#14532D] text-[10px] font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
              <span>{roleKey === 'dosen' ? 'DOSEN FTI' : userPosition}</span>
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
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      isActive && item.badgeStyle?.includes('bg-[#FEF3C7]')
                        ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]'
                        : item.badgeStyle || (isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700')
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
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
