import React, { useState, useEffect } from 'react';

export default function UpdateProgressModal({
  isOpen,
  onClose,
  assignment,
  onUpdateProgress
}) {
  const [persenProgres, setPersenProgres] = useState(50);
  const [status, setStatus] = useState('Dikerjakan');
  const [catatanProgres, setCatatanProgres] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (assignment) {
      setPersenProgres(Number(assignment.persen_progres || 0));
      setStatus(assignment.status === 'Selesai' ? 'Selesai' : 'Dikerjakan');
      setCatatanProgres(assignment.catatan_progres || '');
      setErrorMsg('');
    }
  }, [assignment, isOpen]);

  if (!isOpen || !assignment) return null;

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    if (newStatus === 'Selesai') {
      setPersenProgres(100);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      await onUpdateProgress(assignment.id_penugasan, {
        persen_progres: status === 'Selesai' ? 100 : Number(persenProgres),
        catatan_progres: catatanProgres.trim(),
        status
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Gagal memperbarui progres.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#0F5132] uppercase">
              UC-08 • PEMBARUAN PROGRES PEKERJAAN
            </span>
            <h2 className="text-lg font-bold text-[#0B1C30]">
              Perbarui Status & Progres Penugasan
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

          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-gray-200">
            <div className="text-[11px] font-bold text-[#0F5132]">
              #PN-{String(assignment.id_penugasan).padStart(3, '0')} • Pemberi: {assignment.nama_pemberi}
            </div>
            <div className="text-xs font-bold text-[#0B1C30] mt-0.5">{assignment.deskripsi}</div>
          </div>

          {/* Pilihan Status (Dikerjakan / Selesai) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#0B1C30]">Status Pelaksanaan</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleStatusChange('Dikerjakan')}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  status === 'Dikerjakan'
                    ? 'bg-[#DCE9FF] border-[#0058B6] text-[#003F87]'
                    : 'bg-[#F8FAFC] border-gray-200 text-gray-600'
                }`}
              >
                Dalam Pengerjaan (Dikerjakan)
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('Selesai')}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  status === 'Selesai'
                    ? 'bg-[#C0FFD2] border-[#0F5132] text-[#0F5132]'
                    : 'bg-[#F8FAFC] border-gray-200 text-gray-600'
                }`}
              >
                Tandai Selesai (100%)
              </button>
            </div>
          </div>

          {/* Input Persentase Progres (0-100%) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#0B1C30]">
              <span>Persentase Progres (`persen_progres`)</span>
              <span className="text-sm font-extrabold text-[#0F5132]">
                {status === 'Selesai' ? 100 : persenProgres}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              disabled={status === 'Selesai'}
              value={status === 'Selesai' ? 100 : persenProgres}
              onChange={(e) => setPersenProgres(Number(e.target.value))}
              className="w-full accent-[#0F5132] cursor-pointer"
            />
          </div>

          {/* Catatan Progres */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#0B1C30]">
              Catatan Progres Pekerjaan <span className="text-[#BA1A1A]">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={catatanProgres}
              onChange={(e) => setCatatanProgres(e.target.value)}
              placeholder="Tuliskan perkembangan pelaksanaan pekerjaan..."
              className="w-full p-3.5 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs text-[#0B1C30] focus:outline-none focus:border-[#0F5132]"
            />
          </div>

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
              {submitting ? 'Menyimpan...' : 'Simpan Progres'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
