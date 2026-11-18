import React, { useState, useEffect } from 'react';

export default function DelegateModal({
  isOpen,
  onClose,
  assignment,
  subordinates = [],
  onDelegate
}) {
  const [idPenerimaDelegasi, setIdPenerimaDelegasi] = useState('');
  const [tenggat, setTenggat] = useState('2026-11-28');
  const [alasanDelegasi, setAlasanDelegasi] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setErrorMsg('');
    if (subordinates.length > 0) {
      setIdPenerimaDelegasi(String(subordinates[0].id_pengguna));
    } else {
      setIdPenerimaDelegasi('');
    }
    if (assignment?.tenggat) {
      setTenggat(String(assignment.tenggat).slice(0, 10));
    } else {
      setTenggat('2026-11-28');
    }
    setAlasanDelegasi('');
  }, [assignment, subordinates, isOpen]);

  if (!isOpen || !assignment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!idPenerimaDelegasi || !alasanDelegasi.trim() || !tenggat) {
      setErrorMsg('Penerima delegasi, tenggat selesai bawahan, dan alasan delegasi wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      await onDelegate(assignment.id_penugasan, {
        id_penerima_delegasi: Number(idPenerimaDelegasi),
        tenggat,
        alasan_delegasi: alasanDelegasi.trim()
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Gagal mendelegasikan penugasan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#0F5132] uppercase">
              UC-05 • DELEGASI PENUGASAN BERJENJANG
            </span>
            <h2 className="text-lg font-bold text-[#0B1C30]">
              Delegasikan Penugasan ke Bawahan
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

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-[#FFDAD6]/60 border border-[#BA1A1A]/30 text-[#93000A] text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Info Ringkas Tugas Asal */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-gray-200 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#0F5132]">
              <span>ID Penugasan Asal: #PN-{String(assignment.id_penugasan).padStart(3, '0')}</span>
              <span className="px-2 py-0.5 rounded bg-[#FFE088] text-[#574500] text-[10px]">
                Prioritas {assignment.prioritas}
              </span>
            </div>
            <div className="text-xs font-bold text-[#0B1C30] leading-relaxed">
              {assignment.deskripsi}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-600 mt-1">
              <span>
                <strong>Pemberi Asal:</strong> {assignment.nama_pemberi} ({assignment.jabatan_pemberi})
              </span>
              <span>
                <strong>Tenggat Asli:</strong> {assignment.tenggat ? String(assignment.tenggat).slice(0, 10) : '-'}
              </span>
            </div>
          </div>

          {/* Dropdown Pilih Bawahan Penerima Delegasi */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#0B1C30]">
              Pilih Bawahan Penerima Delegasi <span className="text-[#BA1A1A]">*</span>
            </label>
            <select
              value={idPenerimaDelegasi}
              onChange={(e) => setIdPenerimaDelegasi(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs font-medium text-[#0B1C30] focus:outline-none focus:border-[#0F5132]"
            >
              <option value="">-- Pilih Bawahan Langsung --</option>
              {subordinates.map((sub) => (
                <option key={sub.id_pengguna} value={sub.id_pengguna}>
                  {sub.nama} — {sub.nama_jabatan} ({sub.tugas_aktif} Tugas Aktif)
                </option>
              ))}
            </select>
          </div>

          {/* Input Tenggat Selesai Bawahan (DATE) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#0B1C30]">
              Tenggat Selesai Bawahan <span className="text-[#BA1A1A]">*</span>
            </label>
            <input
              type="date"
              required
              value={tenggat}
              onChange={(e) => setTenggat(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs font-medium text-[#0B1C30] focus:outline-none focus:border-[#0F5132]"
            />
          </div>

          {/* Textarea Wajib Alasan Delegasi / Instruksi */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#0B1C30]">
              Alasan Delegasi / Instruksi <span className="text-[#BA1A1A]">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={alasanDelegasi}
              onChange={(e) => setAlasanDelegasi(e.target.value)}
              placeholder="Tuliskan alasan pendelegasian atau instruksi kerja untuk bawahan..."
              className="w-full p-3 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs text-[#0B1C30] focus:outline-none focus:border-[#0F5132]"
            />
          </div>

          {/* Tombol Batal dan Kirim Delegasi */}
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
              {submitting ? 'Mengirim...' : 'Kirim Delegasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
