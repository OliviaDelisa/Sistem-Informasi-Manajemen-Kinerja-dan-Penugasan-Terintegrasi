import React, { useState, useEffect } from 'react';

export default function CancelAssignmentModal({
  isOpen,
  onClose,
  assignment,
  onCancel
}) {
  const [alasanPembatalan, setAlasanPembatalan] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAlasanPembatalan('');
    setErrorMsg('');
  }, [assignment, isOpen]);

  if (!isOpen || !assignment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!alasanPembatalan.trim()) {
      setErrorMsg('Alasan pembatalan wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      await onCancel(assignment.id_penugasan, alasanPembatalan.trim());
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Gagal membatalkan penugasan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#BA1A1A] uppercase">
              UC-04 • PEMBATALAN PENUGASAN
            </span>
            <h2 className="text-lg font-bold text-[#0B1C30]">
              Batalkan Penugasan
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

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-gray-200 flex flex-col gap-1">
            <div className="text-xs font-bold text-[#0F5132]">
              ID Penugasan: #PN-{String(assignment.id_penugasan).padStart(3, '0')}
            </div>
            <div className="text-xs font-bold text-[#0B1C30]">{assignment.deskripsi}</div>
            <div className="text-[11px] text-gray-600 mt-1">
              Penerima: <strong>{assignment.nama_penerima}</strong> ({assignment.jabatan_penerima})
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#0B1C30]">
              Alasan Pembatalan <span className="text-[#BA1A1A]">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={alasanPembatalan}
              onChange={(e) => setAlasanPembatalan(e.target.value)}
              placeholder="Tuliskan alasan pembatalan penugasan (tugas tidak dihapus dari basis data)..."
              className="w-full p-3.5 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs text-[#0B1C30] focus:outline-none focus:border-[#BA1A1A]"
            />
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg bg-[#BA1A1A] text-white text-xs font-bold hover:bg-[#93000A] transition-colors shadow-xs cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Memproses...' : 'Batalkan Penugasan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
