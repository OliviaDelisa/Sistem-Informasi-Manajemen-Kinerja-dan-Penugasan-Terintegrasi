import React, { useState, useEffect } from 'react';

export default function CreateAssignmentModal({
  isOpen,
  onClose,
  onSubmit,
  subordinates = [],
  editData = null
}) {
  const [idPenerima, setIdPenerima] = useState('');
  const [prioritas, setPrioritas] = useState('Tinggi');
  const [tenggat, setTenggat] = useState('2026-11-30');
  const [deskripsi, setDeskripsi] = useState('');
  const [showSpkPanel, setShowSpkPanel] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setErrorMsg('');
    if (editData) {
      setIdPenerima(String(editData.id_penerima || ''));
      setPrioritas(editData.prioritas || 'Sedang');
      setTenggat(editData.tenggat ? String(editData.tenggat).slice(0, 10) : '2026-11-30');
      setDeskripsi(editData.deskripsi || '');
    } else {
      setIdPenerima(subordinates[0] ? String(subordinates[0].id_pengguna) : '');
      setPrioritas('Tinggi');
      setTenggat('2026-11-30');
      setDeskripsi('');
    }
  }, [editData, subordinates, isOpen]);

  if (!isOpen) return null;

  const isEditMode = Boolean(editData);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!idPenerima || !deskripsi.trim() || !tenggat) {
      setErrorMsg('Penerima penugasan, prioritas, tenggat waktu, dan deskripsi wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        id_penerima: Number(idPenerima),
        prioritas,
        tenggat,
        deskripsi: deskripsi.trim()
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyimpan penugasan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#0F5132] uppercase">
              {isEditMode ? `UBAH PENUGASAN • #PN-${String(editData.id_penugasan).padStart(3, '0')}` : 'UC-04 • FORMULIR PENUGASAN'}
            </span>
            <h2 className="text-lg font-bold text-[#0B1C30]">
              {isEditMode ? 'Ubah Penugasan' : 'Buat Penugasan Baru'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-[#FFDAD6]/60 border border-[#BA1A1A]/30 text-[#93000A] text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Dropdown Penerima Penugasan + Pintasan Rekomendasi SPK (UC-19) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0B1C30]">
                Penerima Penugasan <span className="text-[#BA1A1A]">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowSpkPanel(!showSpkPanel)}
                className="text-[11px] font-bold text-[#0F5132] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>✨ {showSpkPanel ? 'Tutup Rekomendasi SPK' : 'Lihat Rekomendasi Penerima Tugas (SPK)'}</span>
              </button>
            </div>
            <select
              value={idPenerima}
              onChange={(e) => setIdPenerima(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs font-medium text-[#0B1C30] focus:outline-none focus:border-[#0F5132]"
            >
              <option value="">-- Pilih Bawahan Penerima Penugasan --</option>
              {subordinates.map((sub) => (
                <option key={sub.id_pengguna} value={sub.id_pengguna}>
                  {sub.nama} — {sub.nama_jabatan} ({sub.tugas_aktif} Tugas Aktif)
                </option>
              ))}
            </select>
          </div>

          {/* Panel Rekomendasi Penerima Tugas / SPK (UC-19) */}
          {showSpkPanel && (
            <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#0F5132]">
                  Rekomendasi Penerima Tugas (UC-19 • Berdasarkan Beban Kerja & Riwayat)
                </span>
                <span className="text-[10px] text-gray-500">Klik untuk memilih</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
                {subordinates.map((sub, idx) => (
                  <button
                    key={sub.id_pengguna}
                    type="button"
                    onClick={() => {
                      setIdPenerima(String(sub.id_pengguna));
                      setShowSpkPanel(false);
                    }}
                    className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                      String(idPenerima) === String(sub.id_pengguna)
                        ? 'bg-white border-[#0F5132]'
                        : 'bg-white/80 border-gray-200 hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-[#0B1C30]">
                        {idx === 0 ? '⭐ ' : ''}{sub.nama}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {sub.nama_jabatan} • {sub.tugas_aktif} Tugas Aktif • {sub.tugas_selesai} Selesai
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#14532D] text-[10px] font-bold">
                      Skor SPK: {sub.skor_spk}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Prioritas & Tenggat Waktu (DATE) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#0B1C30]">
                Prioritas <span className="text-[#BA1A1A]">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Tinggi', 'Sedang', 'Rendah'].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setPrioritas(level)}
                    className={`py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      prioritas === level
                        ? level === 'Tinggi'
                          ? 'bg-[#FFDAD6] border-[#BA1A1A] text-[#93000A]'
                          : level === 'Sedang'
                          ? 'bg-[#FFE088] border-[#B28900] text-[#574500]'
                          : 'bg-[#DCE9FF] border-[#0058B6] text-[#003F87]'
                        : 'bg-[#F8FAFC] border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#0B1C30]">
                Tenggat Waktu <span className="text-[#BA1A1A]">*</span>
              </label>
              <input
                type="date"
                required
                value={tenggat}
                onChange={(e) => setTenggat(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs font-medium text-[#0B1C30] focus:outline-none focus:border-[#0F5132]"
              />
            </div>
          </div>

          {/* Deskripsi / Uraian Penugasan */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#0B1C30]">
              Deskripsi / Uraian Penugasan <span className="text-[#BA1A1A]">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Tuliskan uraian penugasan secara jelas..."
              className="w-full p-3.5 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs text-[#0B1C30] focus:outline-none focus:border-[#0F5132]"
            />
          </div>

          {/* Tombol Batal & Tugaskan / Simpan Perubahan */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg bg-[#0F5132] text-white text-xs font-bold hover:bg-[#14532D] transition-colors shadow-xs cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Tugaskan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
