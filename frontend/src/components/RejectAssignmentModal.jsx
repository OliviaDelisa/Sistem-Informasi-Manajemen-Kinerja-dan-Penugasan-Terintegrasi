import React, { useState, useEffect } from 'react';

export default function RejectAssignmentModal({
  isOpen,
  onClose,
  assignment,
  onReject
}) {
  const [alasanPenolakan, setAlasanPenolakan] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAlasanPenolakan('');
    setErrorMsg('');
  }, [assignment, isOpen]);

  if (!isOpen || !assignment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!alasanPenolakan.trim()) {
      setErrorMsg('Alasan penolakan wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      await onReject(assignment.id_penugasan, alasanPenolakan.trim());
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menolak penugasan.');
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
              UC-06 • KONFIRMASI PENOLAKAN TUGAS
            </span>
            <h2 className="text-lg font-bold text-[#0B1C30]">
              Tolak Penugasan
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

          {/* Informasi Tugas yang Akan Ditolak */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-gray-200 flex flex-col gap-1.5">
            <div className="text-xs font-bold text-[#BA1A1A]">
              ID Penugasan: #PN-{String(assignment.id_penugasan).padStart(3, '0')}
            </div>
            <div className="text-xs font-bold text-[#0B1C30] leading-relaxed">
              {assignment.deskripsi}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-600 mt-1">
              <span>
                <strong>Pemberi Tugas:</strong> {assignment.nama_pemberi} ({assignment.jabatan_pemberi})
              </span>
              <span>
                <strong>Tenggat:</strong> {assignment.tenggat ? String(assignment.tenggat).slice(0, 10) : '-'}
              </span>
            </div>
          </div>

          {/* Textarea Wajib Alasan Penolakan */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#0B1C30]">
              Alasan Penolakan <span className="text-[#BA1A1A]">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={alasanPenolakan}
              onChange={(e) => setAlasanPenolakan(e.target.value)}
              placeholder="Jelaskan alasan objektif penolakan penugasan ini (misal: beban kerja berlebih atau di luar tupoksi)..."
              className="w-full p-3.5 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs text-[#0B1C30] focus:outline-none focus:border-[#BA1A1A]"
            />
          </div>

          {/* Tombol Batal dan Kirim Alasan Penolakan */}
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
              className="px-5 py-2.5 rounded-lg bg-[#BA1A1A] text-white text-xs font-bold hover:bg-[#93000A] transition-colors shadow-xs cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Mengirim...' : 'Kirim Alasan Penolakan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
