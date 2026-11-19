import React from 'react';

export default function PenugasanHeader({
  roleKey = 'dekan',
  activeMenu = 'penugasan',
  userName = 'Prof. Dr. Ir. Ahmad Hidayat, M.T.',
  userRole = 'DEKAN FTI UNAND',
  notificationCount = 4,
  onLogout = () => {}
}) {
  const isKasiMode = roleKey === 'kasi' || activeMenu === 'penugasan-masuk' || activeMenu === 'penugasan-tendik';
  const initials = (userName || 'U')
    .split(' ')
    .filter((w) => !w.includes('.'))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'FT';

  if (isKasiMode) {
    return (
      <header className="h-16 px-6 flex justify-between items-center bg-white sticky top-0 z-10 border-b border-gray-200 shadow-2xs">
        {/* Left Breadcrumb & Semester Pill */}
        <div className="flex items-center gap-3 text-[13px]">
          <div className="flex items-center gap-1.5">
            <span className="text-[#004F28] font-medium">SIM-KP FTI</span>
            <span className="text-gray-400">›</span>
            <span className="text-[#3F4940]">Seksi Keuangan & Aset</span>
          </div>
          <div className="w-px h-4 bg-gray-300" />
          <div className="px-2.5 py-1 rounded bg-[#DCE9FF] text-[#0B1C30] text-[11px] font-semibold flex items-center gap-1.5">
            <span>📅</span>
            <span>Semester Ganjil 2024/2025</span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-4">
          {/* SPBE Sync Status */}
          <div className="hidden md:flex px-2.5 py-1 rounded bg-[#EFF4FF] items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#046A38]" />
            <span className="text-[11px] font-semibold text-[#3F4940]">
              SPBE & SIKOLA Sync: Terhubung
            </span>
          </div>

          {/* Notification Bell */}
          <button
            title="Pemberitahuan"
            className="relative p-2 rounded-lg text-[#3F4940] hover:bg-[#EFF4FF] cursor-pointer"
          >
            <span>🔔</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#904D00]" />
          </button>

          <div className="w-px h-6 bg-gray-200" />

          {/* Kasi Profile & Logout Icon */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#004F28] text-white text-xs font-bold flex items-center justify-center">
              {initials}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold text-[#0B1C30]">{userName}</span>
              <span className="text-[11px] font-semibold text-[#3F4940]">{userRole}</span>
            </div>
            <button
              onClick={onLogout}
              title="Keluar"
              className="p-1.5 rounded-lg text-[#3F4940] hover:bg-[#FFDAD6] hover:text-[#93000A] transition-colors cursor-pointer ml-1"
            >
              <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none">
                <path d="M1.67 15C1.21 15 0.82 14.84 0.49 14.51C0.16 14.18 0 13.79 0 13.33V1.67C0 1.21 0.16 0.82 0.49 0.49C0.82 0.16 1.21 0 1.67 0H7.5V1.67H1.67V13.33H7.5V15H1.67ZM10.83 11.67L9.69 10.46L11.81 8.33H5V6.67H11.81L9.69 4.54L10.83 3.33L15 7.5L10.83 11.67Z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="h-16 px-8 flex justify-between items-center bg-white sticky top-0 z-10 border-b border-gray-200 shadow-xs">
      {/* Breadcrumb Context */}
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-gray-500 font-medium">
          {roleKey === 'dosen' ? 'Portal Akademik Dosen' : 'Portal SIM-KP FTI'}
        </span>
        <span className="text-gray-300">/</span>
        <span className="text-[#046A38] font-semibold">
          {activeMenu === 'logbook'
            ? 'Logbook Kinerja & Aktivitas'
            : activeMenu === 'riwayat'
            ? 'Riwayat Penugasan'
            : activeMenu === 'kepanitiaan'
            ? 'Kepanitiaan Fakultas'
            : 'Manajemen & Delegasi Penugasan'}
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div className="relative">
          <button
            title="Pemberitahuan"
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200"
          >
            🔔
          </button>
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#BA1A1A] text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
              {notificationCount}
            </span>
          )}
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 pl-2">
          <div className="w-9 h-9 rounded-full bg-[#004F28] text-white text-xs font-bold flex items-center justify-center shadow-xs shrink-0">
            {initials}
          </div>
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-[#0B1C30] text-[13px] font-bold">{userName}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {userRole}
              </span>
            </div>
            <span className="text-gray-400 text-[11px] font-medium">
              NIP. 198204122008121003
            </span>
          </div>
          <button
            onClick={onLogout}
            title="Keluar"
            className="p-1.5 rounded-lg text-gray-500 hover:bg-[#FFDAD6] hover:text-[#93000A] transition-colors cursor-pointer ml-1"
          >
            <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none">
              <path d="M1.67 15C1.21 15 0.82 14.84 0.49 14.51C0.16 14.18 0 13.79 0 13.33V1.67C0 1.21 0.16 0.82 0.49 0.49C0.82 0.16 1.21 0 1.67 0H7.5V1.67H1.67V13.33H7.5V15H1.67ZM10.83 11.67L9.69 10.46L11.81 8.33H5V6.67H11.81L9.69 4.54L10.83 3.33L15 7.5L10.83 11.67Z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
