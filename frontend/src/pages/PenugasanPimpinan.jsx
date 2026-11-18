import React, { useState, useEffect, useCallback } from 'react';
import CreateAssignmentModal from '../components/CreateAssignmentModal';
import DelegateModal from '../components/DelegateModal';
import CancelAssignmentModal from '../components/CancelAssignmentModal';
import {
  fetchBawahan,
  fetchDaftarPenugasan,
  createPenugasanApi,
  updatePenugasanApi,
  cancelPenugasanApi,
  delegatePenugasanApi
} from '../services/penugasanApi';

function PriorityBadge({ priority }) {
  const styles = {
    Tinggi: 'bg-[#FFDAD6] text-[#93000A]',
    Sedang: 'bg-[#FFE088] text-[#574500]',
    Rendah: 'bg-[#DCE9FF] text-[#003F87]'
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${styles[priority] || styles.Sedang}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }) {
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

export default function PenugasanPimpinan({ user, onOpenRiwayatDetail }) {
  const [tasks, setTasks] = useState([]);
  const [subordinates, setSubordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState('');

  // Filter states
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [filterUnit, setFilterUnit] = useState('Semua');
  const [filterPriority, setFilterPriority] = useState('Semua');

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delegateItem, setDelegateItem] = useState(null);
  const [cancelItem, setCancelItem] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const uid = user?.id || 2;
      const [listData, bawahanData] = await Promise.all([
        fetchDaftarPenugasan(uid),
        fetchBawahan(uid)
      ]);
      setTasks(listData.dikelola || []);
      setSubordinates(bawahanData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 4 Kartu Ringkasan Metrik sesuai PRD Bagian 5.1
  const totalAktif = tasks.filter((t) => !['Dibatalkan', 'Ditolak'].includes(t.status)).length;
  const menungguKonfirmasi = tasks.filter((t) => t.status === 'Ditugaskan').length;
  const dalamPengerjaan = tasks.filter((t) => ['Diterima', 'Dikerjakan'].includes(t.status)).length;
  const mendekatiDeadline = tasks.filter((t) => {
    if (['Selesai', 'Dibatalkan', 'Ditolak'].includes(t.status) || !t.tenggat) return false;
    const diffDays = (new Date(t.tenggat) - new Date()) / (1000 * 60 * 60 * 24);
    return diffDays <= 14;
  }).length;

  const uniqueRecipients = Array.from(new Set(tasks.map((t) => t.nama_penerima).filter(Boolean)));

  const filteredTasks = tasks.filter((t) => {
    const matchStatus = filterStatus === 'Semua' || t.status === filterStatus;
    const matchUnit = filterUnit === 'Semua' || t.nama_penerima === filterUnit || t.unit_penerima === filterUnit;
    const matchPriority = filterPriority === 'Semua' || t.prioritas === filterPriority;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      String(t.id_penugasan).includes(q) ||
      (t.deskripsi || '').toLowerCase().includes(q) ||
      (t.nama_penerima || '').toLowerCase().includes(q) ||
      (t.jabatan_penerima || '').toLowerCase().includes(q);
    return matchStatus && matchUnit && matchPriority && matchSearch;
  });

  const handleSaveAssignment = async (payload) => {
    const uid = user?.id || 2;
    if (editItem) {
      await updatePenugasanApi(editItem.id_penugasan, { ...payload, id_pengguna: uid });
      setBanner(`Penugasan #PN-${String(editItem.id_penugasan).padStart(3, '0')} berhasil diperbarui.`);
    } else {
      await createPenugasanApi({ ...payload, id_pemberi: uid });
      setBanner('Penugasan baru berhasil dibuat dan dicatat ke Riwayat Penugasan.');
    }
    await loadData();
  };

  const handleDelegate = async (idPenugasan, payload) => {
    const uid = user?.id || 2;
    await delegatePenugasanApi(idPenugasan, { ...payload, id_pemberi_delegasi: uid });
    setBanner(`Penugasan #PN-${String(idPenugasan).padStart(3, '0')} berhasil didelegasikan.`);
    await loadData();
  };

  const handleCancel = async (idPenugasan, alasanPembatalan) => {
    const uid = user?.id || 2;
    await cancelPenugasanApi(idPenugasan, {
      id_pengguna: uid,
      alasan_pembatalan: alasanPembatalan
    });
    setBanner(`Penugasan #PN-${String(idPenugasan).padStart(3, '0')} telah dibatalkan.`);
    await loadData();
  };

  return (
    <main className="flex-1 p-6 md:p-8 flex flex-col gap-6 bg-[#F8FAFC] max-w-[1440px]">
      {/* Header Manajemen Penugasan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold tracking-widest text-[#0F5132] uppercase">
            UC-04 & UC-05 • MODUL PENUGASAN DAN PENDELEGASIAN
          </span>
          <h1 className="text-2xl font-bold text-[#0B1C30] mt-0.5">
            Manajemen Penugasan
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Kelola pembuatan, perubahan, pendelegasian berjenjang, dan pembatalan penugasan sesuai struktur organisasi FTI Unand.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditItem(null);
            setIsCreateOpen(true);
          }}
          className="px-4 py-2.5 rounded-lg bg-[#0F5132] text-white text-xs font-bold hover:bg-[#14532D] transition-colors shadow-xs flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <span>+ Buat Penugasan Baru</span>
        </button>
      </div>

      {banner && (
        <div className="p-3.5 rounded-xl bg-[#DCFCE7] border border-[#0F5132]/20 text-[#0F5132] text-xs font-medium flex items-center justify-between">
          <span>{banner}</span>
          <button onClick={() => setBanner('')} className="font-bold underline ml-4 cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {/* 4 Kartu Ringkasan Metrik di Bagian Atas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Total Penugasan Aktif</span>
          <div className="text-3xl font-extrabold text-[#0B1C30] mt-1">{totalAktif}</div>
          <span className="text-[11px] text-[#0F5132] font-medium">Penugasan struktural & insidentil</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Menunggu Konfirmasi</span>
          <div className="text-3xl font-extrabold text-[#B28900] mt-1">{menungguKonfirmasi}</div>
          <span className="text-[11px] text-gray-500">Status: Ditugaskan</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Dalam Pengerjaan</span>
          <div className="text-3xl font-extrabold text-[#0058B6] mt-1">{dalamPengerjaan}</div>
          <span className="text-[11px] text-gray-500">Status: Diterima / Dikerjakan</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Mendekati Deadline</span>
          <div className="text-3xl font-extrabold text-[#BA1A1A] mt-1">{mendekatiDeadline}</div>
          <span className="text-[11px] text-[#BA1A1A] font-medium">Perlu pemantauan penyelesaian</span>
        </div>
      </div>

      {/* Bar Pencarian & Filter (Status, Penerima/Unit, Prioritas) */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari ID penugasan, deskripsi, atau nama penerima..."
          className="flex-1 px-3.5 py-2 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs text-[#0B1C30] focus:outline-none focus:border-[#0F5132]"
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs font-medium text-[#0B1C30]"
          >
            <option value="Semua">Semua Status</option>
            <option value="Ditugaskan">Ditugaskan</option>
            <option value="Diterima">Diterima</option>
            <option value="Dikerjakan">Dikerjakan</option>
            <option value="Selesai">Selesai</option>
            <option value="Ditolak">Ditolak</option>
            <option value="Dibatalkan">Dibatalkan</option>
          </select>

          <select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs font-medium text-[#0B1C30]"
          >
            <option value="Semua">Semua Penerima / Unit</option>
            {uniqueRecipients.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs font-medium text-[#0B1C30]"
          >
            <option value="Semua">Semua Prioritas</option>
            <option value="Tinggi">Prioritas Tinggi</option>
            <option value="Sedang">Prioritas Sedang</option>
            <option value="Rendah">Prioritas Rendah</option>
          </select>
        </div>
      </div>

      {/* Tabel Daftar Penugasan */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase">
                <th className="py-3.5 px-4">ID Penugasan</th>
                <th className="py-3.5 px-4">Penerima & Jabatan</th>
                <th className="py-3.5 px-4">Deskripsi Penugasan</th>
                <th className="py-3.5 px-4">Prioritas</th>
                <th className="py-3.5 px-4">Tenggat Waktu</th>
                <th className="py-3.5 px-4">Status & Progres</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Memuat data penugasan...
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Tidak ada data penugasan yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const isClosed = ['Selesai', 'Dibatalkan'].includes(t.status);
                  return (
                    <tr key={t.id_penugasan} className="hover:bg-[#F8FAFC] transition-colors align-top">
                      {/* ID Penugasan & Tanggal Penugasan (Tanpa label SK Rektorat / Ad-Hoc SK) */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenRiwayatDetail && onOpenRiwayatDetail(t.id_penugasan)}
                          className="font-bold text-[#0F5132] hover:underline cursor-pointer"
                        >
                          #PN-{String(t.id_penugasan).padStart(3, '0')}
                        </button>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Tgl: {t.tgl_penugasan ? String(t.tgl_penugasan).slice(0, 10) : '-'}
                        </div>
                      </td>

                      {/* Penerima & Jabatan */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-[#0B1C30]">{t.nama_penerima}</div>
                        <div className="text-[11px] text-gray-500">
                          {t.jabatan_penerima} • {t.unit_penerima}
                        </div>
                        {t.didelegasikan_ke_nama && (
                          <div className="mt-1 inline-block px-2 py-0.5 rounded bg-[#F0FDF4] text-[#0F5132] text-[10px] font-semibold">
                            ↳ Didelegasikan ke: {t.didelegasikan_ke_nama}
                          </div>
                        )}
                      </td>

                      {/* Deskripsi Penugasan */}
                      <td className="py-4 px-4 max-w-md">
                        <div className="font-semibold text-[#0B1C30] leading-relaxed">{t.deskripsi}</div>
                        {t.status === 'Ditolak' && t.alasan_penolakan && (
                          <div className="mt-1.5 p-2 rounded bg-[#FFDAD6]/40 text-[#93000A] text-[11px]">
                            <strong>Alasan Penolakan:</strong> {t.alasan_penolakan}
                          </div>
                        )}
                        {t.status === 'Dibatalkan' && t.alasan_pembatalan && (
                          <div className="mt-1.5 p-2 rounded bg-gray-100 text-gray-600 text-[11px]">
                            <strong>Alasan Pembatalan:</strong> {t.alasan_pembatalan}
                          </div>
                        )}
                      </td>

                      {/* Prioritas */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <PriorityBadge priority={t.prioritas} />
                      </td>

                      {/* Tenggat Waktu */}
                      <td className="py-4 px-4 whitespace-nowrap font-semibold text-[#0B1C30]">
                        {t.tenggat ? String(t.tenggat).slice(0, 10) : '-'}
                      </td>

                      {/* Status & Progres */}
                      <td className="py-4 px-4 w-44">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <StatusBadge status={t.status} />
                          <span className="text-[11px] font-bold text-[#0B1C30]">{t.persen_progres || 0}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#0F5132]"
                            style={{ width: `${t.persen_progres || 0}%` }}
                          />
                        </div>
                        {t.catatan_progres && (
                          <div className="text-[10px] text-gray-500 mt-1 line-clamp-2">{t.catatan_progres}</div>
                        )}
                      </td>

                      {/* Kolom Aksi: Edit/Ubah, Delegasikan, Batalkan/Silang (Tanpa tombol Arsip SK) */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        {!isClosed ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              title="Ubah Penugasan (UC-04)"
                              onClick={() => {
                                setEditItem(t);
                                setIsCreateOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-[11px] font-semibold cursor-pointer"
                            >
                              ✎ Ubah
                            </button>
                            <button
                              type="button"
                              title="Delegasikan Penugasan (UC-05)"
                              onClick={() => setDelegateItem(t)}
                              className="px-2.5 py-1.5 rounded-lg border border-[#0F5132]/30 bg-[#F0FDF4] text-[#0F5132] hover:bg-[#DCFCE7] text-[11px] font-semibold cursor-pointer"
                            >
                              ↱ Delegasikan
                            </button>
                            <button
                              type="button"
                              title="Batalkan Penugasan (UC-04)"
                              onClick={() => setCancelItem(t)}
                              className="px-2.5 py-1.5 rounded-lg border border-[#BA1A1A]/30 bg-[#FFDAD6]/40 text-[#93000A] hover:bg-[#FFDAD6] text-[11px] font-bold cursor-pointer"
                            >
                              ✕ Batalkan
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenRiwayatDetail && onOpenRiwayatDetail(t.id_penugasan)}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-[11px] font-semibold cursor-pointer"
                          >
                            Lihat Riwayat
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buat / Ubah Penugasan (UC-04) */}
      <CreateAssignmentModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setEditItem(null);
        }}
        subordinates={subordinates}
        editData={editItem}
        onSubmit={handleSaveAssignment}
      />

      {/* Modal Delegasi Penugasan (UC-05) */}
      <DelegateModal
        isOpen={Boolean(delegateItem)}
        onClose={() => setDelegateItem(null)}
        assignment={delegateItem}
        subordinates={subordinates}
        onDelegate={handleDelegate}
      />

      {/* Modal Batalkan Penugasan (UC-04) */}
      <CancelAssignmentModal
        isOpen={Boolean(cancelItem)}
        onClose={() => setCancelItem(null)}
        assignment={cancelItem}
        onCancel={handleCancel}
      />
    </main>
  );
}
