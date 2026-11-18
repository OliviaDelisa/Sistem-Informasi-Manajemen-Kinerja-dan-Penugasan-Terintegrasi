import React, { useState, useEffect, useCallback } from 'react';
import DelegateModal from '../components/DelegateModal';
import RejectAssignmentModal from '../components/RejectAssignmentModal';
import UpdateProgressModal from '../components/UpdateProgressModal';
import {
  fetchDaftarPenugasan,
  fetchBawahan,
  respondPenugasanApi,
  delegatePenugasanApi,
  updateProgresPenugasanApi
} from '../services/penugasanApi';

function PriorityPill({ priority }) {
  const styles = {
    Tinggi: 'bg-[#FFDAD6] text-[#93000A]',
    Sedang: 'bg-[#FFE088] text-[#574500]',
    Rendah: 'bg-[#DCE9FF] text-[#003F87]'
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${styles[priority] || styles.Sedang}`}>
      Prioritas {priority}
    </span>
  );
}

function StatusPill({ status }) {
  const styles = {
    Ditugaskan: 'bg-[#FFE088] text-[#574500]',
    Diterima: 'bg-[#DCE9FF] text-[#003F87]',
    Dikerjakan: 'bg-[#DCE9FF] text-[#003F87]',
    Selesai: 'bg-[#C0FFD2] text-[#0F5132]',
    Ditolak: 'bg-[#FFDAD6] text-[#93000A]',
    Dibatalkan: 'bg-gray-200 text-gray-600'
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${styles[status] || styles.Ditugaskan}`}>
      {status}
    </span>
  );
}

export default function PenugasanMasuk({ user, onOpenRiwayatDetail }) {
  const [tasks, setTasks] = useState([]);
  const [subordinates, setSubordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState('');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');

  // Modals
  const [delegateItem, setDelegateItem] = useState(null);
  const [rejectItem, setRejectItem] = useState(null);
  const [progressItem, setProgressItem] = useState(null);

  const canDelegate = user?.roleKey === 'kepalaKantor' || user?.roleKey === 'kasi' || user?.roleKey === 'dekan';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const uid = user?.id || 4;
      const [listData, bawahanData] = await Promise.all([
        fetchDaftarPenugasan(uid),
        canDelegate ? fetchBawahan(uid) : Promise.resolve([])
      ]);
      setTasks(listData.masuk || []);
      setSubordinates(bawahanData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, canDelegate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 3 Kartu Metrik Relevan sesuai PRD Bagian 5.3 (Tanpa kartu ke-4 TERVALIDASI TTE)
  const totalMasuk = tasks.length;
  const menungguKonfirmasi = tasks.filter((t) => t.status === 'Ditugaskan').length;
  const dalamPengerjaan = tasks.filter((t) => ['Diterima', 'Dikerjakan'].includes(t.status)).length;

  const filteredTasks = tasks.filter((t) => {
    const matchStatus = filterStatus === 'Semua' || t.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      String(t.id_penugasan).includes(q) ||
      (t.deskripsi || '').toLowerCase().includes(q) ||
      (t.nama_pemberi || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const handleAccept = async (task) => {
    try {
      const uid = user?.id || task.id_penerima;
      await respondPenugasanApi(task.id_penugasan, {
        id_penerima: uid,
        keputusan: 'Terima'
      });
      setBanner(`Penugasan #PN-${String(task.id_penugasan).padStart(3, '0')} berhasil diterima (Status: Diterima).`);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReject = async (idPenugasan, alasanPenolakan) => {
    const uid = user?.id;
    await respondPenugasanApi(idPenugasan, {
      id_penerima: uid,
      keputusan: 'Tolak',
      alasan_penolakan: alasanPenolakan
    });
    setBanner(`Penugasan #PN-${String(idPenugasan).padStart(3, '0')} telah ditolak beserta alasannya.`);
    await loadData();
  };

  const handleDelegate = async (idPenugasan, payload) => {
    const uid = user?.id;
    await delegatePenugasanApi(idPenugasan, {
      ...payload,
      id_pemberi_delegasi: uid
    });
    setBanner(`Penugasan #PN-${String(idPenugasan).padStart(3, '0')} berhasil didelegasikan ke bawahan.`);
    await loadData();
  };

  const handleUpdateProgress = async (idPenugasan, payload) => {
    const uid = user?.id;
    await updateProgresPenugasanApi(idPenugasan, {
      ...payload,
      id_pengguna: uid
    });
    setBanner(`Progres penugasan #PN-${String(idPenugasan).padStart(3, '0')} berhasil diperbarui (${payload.persen_progres}%).`);
    await loadData();
  };

  return (
    <main className="flex-1 p-6 md:p-8 flex flex-col gap-6 bg-[#F8FAFC] max-w-[1440px]">
      {/* Page Header (Tanpa tombol Cetak Disposisi & Ekspor Rekap XLSX sesuai PRD 5.3) */}
      <div>
        <span className="text-[11px] font-bold tracking-widest text-[#0F5132] uppercase">
          UC-06, UC-05 & UC-08 • PENUGASAN MASUK & PEMBARUAN PROGRES
        </span>
        <h1 className="text-2xl font-bold text-[#0B1C30] mt-0.5">
          Daftar Penugasan Masuk
        </h1>
        <p className="text-xs text-gray-600 mt-1">
          Kelola penerimaan/penolakan penugasan dari atasan, pendelegasian ke bawahan langsung, serta pembaruan persentase dan catatan progres pekerjaan.
        </p>
      </div>

      {banner && (
        <div className="p-3.5 rounded-xl bg-[#DCFCE7] border border-[#0F5132]/20 text-[#0F5132] text-xs font-medium flex items-center justify-between">
          <span>{banner}</span>
          <button onClick={() => setBanner('')} className="font-bold underline ml-4 cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {/* 3 Kartu Metrik Relevan: Total Tugas Masuk, Menunggu Konfirmasi, Dalam Pengerjaan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Total Tugas Masuk</span>
          <div className="text-3xl font-extrabold text-[#0B1C30] mt-1">{totalMasuk}</div>
          <span className="text-[11px] text-[#0F5132] font-medium">Ditujukan kepada {user?.name || 'Anda'}</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Menunggu Konfirmasi</span>
          <div className="text-3xl font-extrabold text-[#B28900] mt-1">{menungguKonfirmasi}</div>
          <span className="text-[11px] text-gray-500">Status: Ditugaskan (Perlu Respons)</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Dalam Pengerjaan</span>
          <div className="text-3xl font-extrabold text-[#0058B6] mt-1">{dalamPengerjaan}</div>
          <span className="text-[11px] text-gray-500">Status: Diterima / Dikerjakan</span>
        </div>
      </div>

      {/* Filter & Pencarian */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {['Semua', 'Ditugaskan', 'Diterima', 'Dikerjakan', 'Selesai', 'Ditolak'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterStatus === st
                  ? 'bg-[#0F5132] text-white'
                  : 'bg-[#F8FAFC] text-gray-700 hover:bg-gray-100'
              }`}
            >
              {st === 'Semua' ? 'Semua Tugas Masuk' : st}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari ID, deskripsi, atau pemberi tugas..."
          className="w-full sm:w-72 px-3.5 py-2 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs text-[#0B1C30] focus:outline-none focus:border-[#0F5132]"
        />
      </div>

      {/* Tabel Penugasan Masuk */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase">
                <th className="py-3.5 px-4 w-12">No</th>
                <th className="py-3.5 px-4">ID & Deskripsi Penugasan</th>
                <th className="py-3.5 px-4">Pemberi Tugas</th>
                <th className="py-3.5 px-4">Prioritas & Tenggat</th>
                <th className="py-3.5 px-4">Status & Capaian</th>
                <th className="py-3.5 px-4 text-right">Tindakan Operasional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    Memuat daftar penugasan masuk...
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    Tidak ada penugasan masuk yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t, idx) => (
                  <tr key={t.id_penugasan} className="hover:bg-[#F8FAFC] transition-colors align-top">
                    <td className="py-4 px-4 font-bold text-gray-500">{idx + 1}</td>

                    {/* ID & Deskripsi Penugasan (Tanpa lampiran file .pdf & tanpa badge BSrE) */}
                    <td className="py-4 px-4 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#0F5132]">
                          #PN-{String(t.id_penugasan).padStart(3, '0')}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          • Tgl Penugasan: {t.tgl_penugasan ? String(t.tgl_penugasan).slice(0, 10) : '-'}
                        </span>
                      </div>
                      <div className="font-bold text-[#0B1C30] mt-1 leading-relaxed">{t.deskripsi}</div>
                      {t.alasan_delegasi && (
                        <div className="mt-1.5 p-2 rounded bg-[#F0FDF4] border border-[#BBF7D0] text-[11px] text-[#0F5132]">
                          <strong>Instruksi Delegasi Atasan:</strong> {t.alasan_delegasi}
                        </div>
                      )}
                      {t.status === 'Ditolak' && t.alasan_penolakan && (
                        <div className="mt-1.5 p-2 rounded bg-[#FFDAD6]/50 text-[#93000A] text-[11px]">
                          <strong>Alasan Penolakan:</strong> {t.alasan_penolakan}
                        </div>
                      )}
                    </td>

                    {/* Pemberi Tugas */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-[#0B1C30]">{t.nama_pemberi}</div>
                      <div className="text-[11px] text-gray-500">
                        {t.jabatan_pemberi} • {t.unit_pemberi}
                      </div>
                    </td>

                    {/* Prioritas & Tenggat */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <PriorityPill priority={t.prioritas} />
                      <div className="text-xs font-semibold text-[#0B1C30] mt-1">
                        Tenggat: {t.tenggat ? String(t.tenggat).slice(0, 10) : '-'}
                      </div>
                    </td>

                    {/* Status & Capaian (Progress Bar persen_progres & catatan_progres) */}
                    <td className="py-4 px-4 w-56">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <StatusPill status={t.status} />
                        <span className="text-[11px] font-bold text-[#0B1C30]">{t.persen_progres || 0}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#0F5132]"
                          style={{ width: `${t.persen_progres || 0}%` }}
                        />
                      </div>
                      {t.catatan_progres && (
                        <div className="text-[11px] text-gray-600 mt-1.5 leading-snug">
                          <strong>Catatan:</strong> {t.catatan_progres}
                        </div>
                      )}
                    </td>

                    {/* Tindakan Operasional sesuai PRD 5.3 */}
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      {t.status === 'Ditugaskan' && (
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAccept(t)}
                            className="px-3 py-1.5 rounded-lg bg-[#0F5132] text-white text-[11px] font-bold hover:bg-[#14532D] cursor-pointer"
                          >
                            Terima
                          </button>
                          {canDelegate && (
                            <button
                              type="button"
                              onClick={() => setDelegateItem(t)}
                              className="px-3 py-1.5 rounded-lg border border-[#0F5132]/30 bg-[#F0FDF4] text-[#0F5132] text-[11px] font-bold hover:bg-[#DCFCE7] cursor-pointer"
                            >
                              Delegasikan
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setRejectItem(t)}
                            className="px-3 py-1.5 rounded-lg border border-[#BA1A1A]/30 bg-[#FFDAD6]/40 text-[#93000A] text-[11px] font-bold hover:bg-[#FFDAD6] cursor-pointer"
                          >
                            Tolak
                          </button>
                        </div>
                      )}

                      {(t.status === 'Diterima' || t.status === 'Dikerjakan') && (
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setProgressItem(t)}
                            className="px-3 py-1.5 rounded-lg bg-[#0F5132] text-white text-[11px] font-bold hover:bg-[#14532D] cursor-pointer"
                          >
                            Perbarui Progres
                          </button>
                          {canDelegate && (
                            <button
                              type="button"
                              onClick={() => setDelegateItem(t)}
                              className="px-2.5 py-1.5 rounded-lg border border-[#0F5132]/30 bg-[#F0FDF4] text-[#0F5132] text-[11px] font-semibold hover:bg-[#DCFCE7] cursor-pointer"
                            >
                              Delegasikan
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenRiwayatDetail && onOpenRiwayatDetail(t.id_penugasan)}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-[11px] font-semibold hover:bg-gray-50 cursor-pointer"
                          >
                            Lihat Rincian
                          </button>
                        </div>
                      )}

                      {['Selesai', 'Ditolak', 'Dibatalkan'].includes(t.status) && (
                        <button
                          type="button"
                          onClick={() => onOpenRiwayatDetail && onOpenRiwayatDetail(t.id_penugasan)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-[11px] font-semibold hover:bg-gray-50 cursor-pointer"
                        >
                          Lihat Rincian
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Delegasi Penugasan (UC-05) */}
      <DelegateModal
        isOpen={Boolean(delegateItem)}
        onClose={() => setDelegateItem(null)}
        assignment={delegateItem}
        subordinates={subordinates}
        onDelegate={handleDelegate}
      />

      {/* Modal Menolak Penugasan (UC-06) */}
      <RejectAssignmentModal
        isOpen={Boolean(rejectItem)}
        onClose={() => setRejectItem(null)}
        assignment={rejectItem}
        onReject={handleReject}
      />

      {/* Modal Perbarui Progres Pekerjaan (UC-08) */}
      <UpdateProgressModal
        isOpen={Boolean(progressItem)}
        onClose={() => setProgressItem(null)}
        assignment={progressItem}
        onUpdateProgress={handleUpdateProgress}
      />
    </main>
  );
}
