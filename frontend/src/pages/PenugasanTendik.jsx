import React, { useState } from 'react';
import CreateTendikAssignmentModal from '../components/CreateTendikAssignmentModal';

const INITIAL_TENDIK_TASKS = [
  {
    id: 'TGS-SEKSI-241',
    title: 'Verifikasi Kelengkapan Bukti Pengeluaran Riil Perjalanan Dinas Dosen',
    parentId: 'MND-2025-0082',
    parentLabel: 'MND-2025-0082 • Verifikasi Dokumen SPJ Perjalanan Dinas Luar Kota',
    assigneeName: 'Rina Marlina, A.Md.',
    assigneeRole: 'Pengelola Keuangan',
    assigneeNip: '199104122019032008',
    category: 'Verifikasi Dokumen Keuangan & SPJ',
    priority: 'Tinggi',
    deadline: '14 Mar 2025',
    outputTarget: 'Checklist Bukti Riil & Berkas SPJ Terverifikasi',
    progress: 65,
    status: 'Sedang Dikerjakan'
  },
  {
    id: 'TGS-SEKSI-239',
    title: 'Rekapitulasi Realisasi Belanja Barang & Operasional Bulan Februari 2025',
    parentId: 'MND-2025-0089',
    parentLabel: 'MND-2025-0089 • Penyusunan Laporan Realisasi Anggaran Triwulan I 2025',
    assigneeName: 'Budi Hartono, S.Ak.',
    assigneeRole: 'Verifikator Anggaran & SPJ',
    assigneeNip: '198907212018031004',
    category: 'Delegasi Berjenjang Penugasan Atasan',
    priority: 'Tinggi',
    deadline: '12 Mar 2025',
    outputTarget: 'Kertas Kerja LRA Seksi Keuangan (XLSX)',
    progress: 80,
    status: 'Menunggu Review Kasi'
  },
  {
    id: 'TGS-SEKSI-235',
    title: 'Pengecekan Fisik & Pelabelan Barcode Inventaris Laboratorium Komputer',
    parentId: 'MND-2025-0086',
    parentLabel: 'MND-2025-0086 • Rekonsiliasi Data Aset Laboratorium & Inventaris BMN',
    assigneeName: 'Dedi Kurniawan, A.Md.',
    assigneeRole: 'Pengelola Barang Milik Negara (BMN)',
    assigneeNip: '199311052020121003',
    category: 'Inventarisasi Aset & BMN',
    priority: 'Normal',
    deadline: '19 Mar 2025',
    outputTarget: 'Berita Acara Cek Fisik BMN Lab',
    progress: 40,
    status: 'Sedang Dikerjakan'
  },
  {
    id: 'TGS-SEKSI-228',
    title: 'Kompilasi Bukti Potong PPh 21 & PPh 23 Honorarium Narasumber Kuliah Tamu',
    parentId: 'MND-2025-0077',
    parentLabel: 'MND-2025-0077 • Pemutakhiran Arsip Bukti Potong Pajak Honorarium',
    assigneeName: 'Siti Rahmawati, S.E.',
    assigneeRole: 'Staf Administrasi Keuangan & Pajak',
    assigneeNip: '199002182019032011',
    category: 'Tupoksi Harian / Operasional Seksi',
    priority: 'Normal',
    deadline: '04 Mar 2025',
    outputTarget: 'Bundel Arsip Bukti Potong Pajak Digital (PDF)',
    progress: 100,
    status: 'Selesai Tervalidasi'
  }
];

function StatusPill({ status }) {
  const styles = {
    'Baru Diberikan': 'bg-[#FFE088] text-[#574500]',
    'Sedang Dikerjakan': 'bg-[#DCE9FF] text-[#003F87]',
    'Menunggu Review Kasi': 'bg-[#FFDBC8] text-[#723600]',
    'Selesai Tervalidasi': 'bg-[#C0FFD2] text-[#004F28]'
  };
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${styles[status] || styles['Sedang Dikerjakan']}`}>
      {status}
    </span>
  );
}

export default function PenugasanTendik() {
  const [tasks, setTasks] = useState(INITIAL_TENDIK_TASKS);
  const [search, setSearch] = useState('');
  const [filterStaff, setFilterStaff] = useState('Semua');
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [bannerMsg, setBannerMsg] = useState('');

  const filteredTasks = tasks.filter((t) => {
    const matchStaff = filterStaff === 'Semua' || t.assigneeName.includes(filterStaff);
    const matchSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.assigneeName.toLowerCase().includes(search.toLowerCase());
    return matchStaff && matchSearch;
  });

  const handleCreated = (newItem) => {
    setTasks([newItem, ...tasks]);
    setBannerMsg(`Penugasan "${newItem.title}" berhasil dikirimkan ke ${newItem.assigneeName}.`);
  };

  const handleValidateTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, progress: 100, status: 'Selesai Tervalidasi' } : t))
    );
    setBannerMsg(`Penugasan ${id} telah divalidasi selesai oleh Kasi Keuangan & Aset.`);
  };

  return (
    <main className="flex-1 p-6 md:p-8 flex flex-col gap-6 max-w-[1440px]">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold tracking-widest text-[#004F28] uppercase">
            KASI KEUANGAN & ASET • SEKSI KEUANGAN & ASET
          </span>
          <h1 className="text-2xl font-bold text-[#0B1C30] mt-1">
            Manajemen Penugasan ke Tendik Seksi
          </h1>
          <p className="text-xs text-[#3D4A40] mt-1 max-w-2xl">
            Kelola distribusi penugasan operasional harian maupun delegasi berjenjang dari penugasan pimpinan kepada staf Tenaga Kependidikan (Tendik) di Seksi Keuangan & Aset.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-lg bg-[#004F28] text-white text-xs font-bold hover:bg-[#035c30] transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <span>+ Buat Penugasan ke Tendik</span>
          </button>
          <button
            type="button"
            onClick={() => setBannerMsg('Rekap penugasan Tendik Seksi Keuangan & Aset berhasil diekspor (XLSX).')}
            className="px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-[#0B1C30] hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            <span>⬇ Ekspor Rekap Penugasan</span>
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div className="p-3.5 rounded-xl bg-[#C0FFD2]/60 border border-[#046A38]/30 text-[#004F28] text-xs font-medium flex items-center justify-between">
          <span>{bannerMsg}</span>
          <button onClick={() => setBannerMsg('')} className="font-bold underline ml-4 cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Total Penugasan Tendik</span>
          <div className="text-2xl font-extrabold text-[#0B1C30] mt-1">{tasks.length}</div>
          <span className="text-[11px] text-[#004F28] font-medium">4 Staf Tendik Aktif</span>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Sedang Dikerjakan</span>
          <div className="text-2xl font-extrabold text-[#0058B6] mt-1">
            {tasks.filter((t) => t.status === 'Sedang Dikerjakan' || t.status === 'Baru Diberikan').length}
          </div>
          <span className="text-[11px] text-gray-500">Progres terpantau via Logbook</span>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Menunggu Review Kasi</span>
          <div className="text-2xl font-extrabold text-[#904500] mt-1">
            {tasks.filter((t) => t.status === 'Menunggu Review Kasi').length}
          </div>
          <span className="text-[11px] text-[#904500] font-medium">Perlu verifikasi luaran kerja</span>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Selesai Tervalidasi</span>
          <div className="text-2xl font-extrabold text-[#004F28] mt-1">
            {tasks.filter((t) => t.status === 'Selesai Tervalidasi').length}
          </div>
          <span className="text-[11px] text-[#004F28] font-medium">Memenuhi standar SLA seksi</span>
        </div>
      </div>

      {/* Filter & Table Card */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {['Semua', 'Rina Marlina', 'Budi Hartono', 'Dedi Kurniawan', 'Siti Rahmawati'].map((staff) => (
              <button
                key={staff}
                onClick={() => setFilterStaff(staff)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  filterStaff === staff
                    ? 'bg-[#004F28] text-white'
                    : 'bg-[#F8F9FF] text-[#3D4A40] hover:bg-gray-100'
                }`}
              >
                {staff === 'Semua' ? 'Semua Staf Tendik' : staff}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul penugasan atau nama tendik..."
            className="w-full md:w-72 px-3 py-1.5 rounded-lg bg-[#F8F9FF] border border-gray-200 text-xs text-[#0B1C30] focus:outline-none focus:border-[#004F28]"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#EFF4FF]/60 border-b border-gray-100 text-[10px] font-bold tracking-wider text-[#3D4A40] uppercase">
                <th className="py-3.5 px-4">ID & Judul Penugasan Tendik</th>
                <th className="py-3.5 px-4">Terkait Penugasan Atasan</th>
                <th className="py-3.5 px-4">Penerima Tugas (Tendik)</th>
                <th className="py-3.5 px-4">Tenggat & Prioritas</th>
                <th className="py-3.5 px-4">Progres</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredTasks.map((t) => (
                <tr key={t.id} className="hover:bg-[#F8F9FF] transition-colors">
                  <td className="py-3.5 px-4 max-w-xs">
                    <span className="font-bold text-[#004F28] text-[11px]">{t.id}</span>
                    <div className="font-bold text-[#0B1C30] mt-0.5 leading-4">{t.title}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Luaran: {t.outputTarget}</div>
                  </td>
                  <td className="py-3.5 px-4 max-w-[220px]">
                    {t.parentId ? (
                      <span className="inline-block px-2 py-1 rounded bg-[#EFF4FF] text-[#003F87] text-[10px] font-semibold leading-tight">
                        {t.parentLabel}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400 italic">Penugasan Internal Seksi</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[#0B1C30]">{t.assigneeName}</div>
                    <div className="text-[11px] text-gray-500">{t.assigneeRole}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-[#0B1C30]">{t.deadline}</div>
                    <span
                      className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.priority === 'Tinggi' ? 'bg-[#FFDAD6] text-[#93000A]' : 'bg-[#EFF4FF] text-[#003F87]'
                      }`}
                    >
                      Prioritas {t.priority}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 w-32">
                    <div className="flex justify-between text-[11px] font-bold mb-1">
                      <span>{t.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full bg-[#046A38]" style={{ width: `${t.progress}%` }} />
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusPill status={t.status} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {t.status !== 'Selesai Tervalidasi' ? (
                      <button
                        type="button"
                        onClick={() => handleValidateTask(t.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#004F28] text-white text-[11px] font-semibold hover:bg-[#035c30] cursor-pointer"
                      >
                        Validasi Selesai
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-[#004F28]">✓ Terverifikasi</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Formulir Buat Penugasan Baru Tendik Seksi */}
      <CreateTendikAssignmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleCreated}
      />
    </main>
  );
}
