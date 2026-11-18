import React, { useState, useEffect, useCallback } from 'react';
import { fetchRiwayatPenugasan, fetchDetailRiwayatPenugasan } from '../services/penugasanApi';

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

export default function RiwayatPenugasan({ user, initialSelectedId = null, onClearSelectedId }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');

  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
    }
  }, [initialSelectedId]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRiwayatPenugasan(user?.id || 2);
      setList(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetailData(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    fetchDetailRiwayatPenugasan(selectedId)
      .then((res) => {
        if (active) setDetailData(res);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const filteredList = list.filter((item) => {
    const matchStatus = filterStatus === 'Semua' || item.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      String(item.id_penugasan).includes(q) ||
      (item.deskripsi || '').toLowerCase().includes(q) ||
      (item.nama_penerima || '').toLowerCase().includes(q) ||
      (item.nama_pemberi || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // Tampilan Detail Riwayat Penugasan (Ref: Gambar 3.69 - Tanpa Kartu BSrE & Tanpa Item Timeline PDF/TTE)
  if (selectedId) {
    const task = detailData?.penugasan;
    const riwayat = detailData?.riwayat || [];
    const delegasi = detailData?.delegasi || [];
    const respons = detailData?.respons || [];

    return (
      <main className="flex-1 p-6 md:p-8 flex flex-col gap-6 bg-[#F8FAFC] max-w-[1440px]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                if (onClearSelectedId) onClearSelectedId();
              }}
              className="text-xs font-bold text-[#0F5132] hover:underline flex items-center gap-1.5 mb-1 cursor-pointer"
            >
              ← Kembali ke Daftar Riwayat Penugasan
            </button>
            <h1 className="text-2xl font-bold text-[#0B1C30]">
              Detail Riwayat & Lini Masa Penugasan
            </h1>
          </div>
        </div>

        {detailLoading || !task ? (
          <div className="bg-white rounded-xl p-8 border border-gray-100 text-center text-xs text-gray-500">
            Memuat lini masa penugasan...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ringkasan Informasi Penugasan */}
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-2xs flex flex-col gap-4 self-start">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-[#0F5132]">
                  #PN-{String(task.id_penugasan).padStart(3, '0')}
                </span>
                <StatusBadge status={task.status} />
              </div>

              <div>
                <span className="text-[11px] font-bold text-gray-400 uppercase">Deskripsi Penugasan</span>
                <p className="text-sm font-bold text-[#0B1C30] mt-1 leading-relaxed">
                  {task.deskripsi}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Pemberi Tugas</span>
                  <div className="font-bold text-[#0B1C30] mt-0.5">{task.nama_pemberi}</div>
                  <div className="text-[11px] text-gray-500">{task.jabatan_pemberi}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Penerima Tugas</span>
                  <div className="font-bold text-[#0B1C30] mt-0.5">{task.nama_penerima}</div>
                  <div className="text-[11px] text-gray-500">{task.jabatan_penerima}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Tanggal Penugasan</span>
                  <div className="font-semibold text-[#0B1C30] mt-0.5">
                    {task.tgl_penugasan ? String(task.tgl_penugasan).slice(0, 10) : '-'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Tenggat Waktu</span>
                  <div className="font-semibold text-[#0B1C30] mt-0.5">
                    {task.tenggat ? String(task.tenggat).slice(0, 10) : '-'}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>Progres Terkini</span>
                  <span className="text-[#0F5132]">{task.persen_progres || 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0F5132]"
                    style={{ width: `${task.persen_progres || 0}%` }}
                  />
                </div>
                {task.catatan_progres && (
                  <p className="text-xs text-gray-600 mt-2 bg-[#F8FAFC] p-2.5 rounded-lg border border-gray-100">
                    <strong>Catatan Progres:</strong> {task.catatan_progres}
                  </p>
                )}
              </div>

              {delegasi.length > 0 && (
                <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    Rantai Pendelegasian ({delegasi.length} Tingkat)
                  </span>
                  {delegasi.map((d) => (
                    <div key={d.id_delegasi} className="p-2.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-xs">
                      <div className="font-bold text-[#0F5132]">
                        {d.nama_pemberi_delegasi} → {d.nama_penerima_delegasi}
                      </div>
                      <div className="text-[11px] text-gray-600 mt-0.5">
                        Instruksi: {d.alasan_delegasi}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        Waktu: {d.waktu ? String(d.waktu).replace('T', ' ').slice(0, 19) : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {respons.length > 0 && (
                <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    Riwayat Respons Penerima
                  </span>
                  {respons.map((rsp) => (
                    <div key={rsp.id_respons} className="p-2.5 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs">
                      <div className="font-bold text-[#0B1C30]">
                        {rsp.nama_penerima}: <span className={rsp.keputusan === 'Terima' ? 'text-[#0F5132]' : 'text-[#BA1A1A]'}>{rsp.keputusan}</span>
                      </div>
                      {rsp.alasan_penolakan && (
                        <div className="text-[11px] text-[#93000A] mt-0.5">
                          Alasan Penolakan: {rsp.alasan_penolakan}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        Waktu Respons: {rsp.tgl_respons ? String(rsp.tgl_respons).replace('T', ' ').slice(0, 19) : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Timeline Vertikal (Rantai Penugasan & Riwayat Progres dari RIWAYAT_PENUGASAN) */}
            <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-100 shadow-2xs">
              <h2 className="text-base font-bold text-[#0B1C30] mb-4">
                Timeline Vertikal (Rantai Penugasan & Riwayat Progres)
              </h2>

              <div className="relative pl-6 border-l-2 border-[#0F5132]/30 flex flex-col gap-5">
                {riwayat.map((node, index) => (
                  <div key={node.id_riwayat || index} className="relative">
                    <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-[#0F5132] border-4 border-[#DCFCE7]" />
                    <div className="p-4 rounded-xl bg-[#F8FAFC] border border-gray-200 flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#0B1C30]">
                          {node.nama_pengguna} <span className="text-gray-500 font-normal">({node.nama_jabatan})</span>
                        </span>
                        <span className="text-[11px] font-semibold text-gray-500">
                          {node.waktu_perubahan ? String(node.waktu_perubahan).replace('T', ' ').slice(0, 19) : '-'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-white border border-gray-200 font-semibold text-gray-700">
                          {node.status_lama ? `${node.status_lama} → ${node.status_baru}` : `Status Awal: ${node.status_baru}`}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#0F5132] font-bold">
                          Progres: {node.progres ?? 0}%
                        </span>
                      </div>

                      {node.catatan && (
                        <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                          {node.catatan}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // Tampilan Daftar Kartu Riwayat Penugasan (Ref: Gambar 3.68 - Tanpa tombol Ekspor Log Audit)
  return (
    <main className="flex-1 p-6 md:p-8 flex flex-col gap-6 bg-[#F8FAFC] max-w-[1440px]">
      <div>
        <span className="text-[11px] font-bold tracking-widest text-[#0F5132] uppercase">
          UC-09 • PELACAKAN KRONOLOGIS PENUGASAN & DELEGASI
        </span>
        <h1 className="text-2xl font-bold text-[#0B1C30] mt-0.5">
          Riwayat Penugasan
        </h1>
        <p className="text-xs text-gray-600 mt-1">
          Lacak riwayat perjalanan penugasan, rantai pendelegasian berjenjang, respons penerimaan/penolakan, serta perkembangan progres dari waktu ke waktu.
        </p>
      </div>

      {/* Filter & Pencarian */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {['Semua', 'Ditugaskan', 'Diterima', 'Dikerjakan', 'Selesai', 'Ditolak', 'Dibatalkan'].map((st) => (
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
              {st}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari ID atau deskripsi penugasan..."
          className="w-full sm:w-72 px-3.5 py-2 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs text-[#0B1C30] focus:outline-none focus:border-[#0F5132]"
        />
      </div>

      {/* Daftar Kartu Penugasan */}
      {loading ? (
        <div className="bg-white rounded-xl p-8 text-center text-xs text-gray-400 border border-gray-100">
          Memuat daftar riwayat penugasan...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-xs text-gray-400 border border-gray-100">
          Tidak ada riwayat penugasan yang ditemukan.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((item) => (
            <div
              key={item.id_penugasan}
              className="bg-white rounded-xl p-5 border border-gray-100 shadow-2xs hover:border-[#0F5132]/40 transition-all flex flex-col justify-between gap-4"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#0F5132]">
                    #PN-{String(item.id_penugasan).padStart(3, '0')}
                  </span>
                  <StatusBadge status={item.status} />
                </div>

                <h3 className="text-sm font-bold text-[#0B1C30] leading-snug">
                  {item.deskripsi}
                </h3>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 mt-1">
                  <div>
                    <strong>Pemberi:</strong> {item.nama_pemberi}
                  </div>
                  <div>
                    <strong>Penerima:</strong> {item.nama_penerima}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-3 text-gray-500">
                  <span className="px-2 py-0.5 rounded bg-[#F0FDF4] text-[#0F5132] font-bold">
                    {Number(item.jumlah_delegasi || 0)} Tingkat Delegasi
                  </span>
                  <span>
                    Perubahan Terakhir:{' '}
                    {item.waktu_perubahan_terakhir
                      ? String(item.waktu_perubahan_terakhir).slice(0, 10)
                      : item.tgl_penugasan
                      ? String(item.tgl_penugasan).slice(0, 10)
                      : '-'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedId(item.id_penugasan)}
                  className="px-3 py-1.5 rounded-lg bg-[#0F5132] text-white text-xs font-bold hover:bg-[#14532D] cursor-pointer"
                >
                  Lihat Timeline →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
