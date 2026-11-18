import React, { useState } from 'react';

const TENDIK_LIST = [
  { id: 'TND-01', name: 'Rina Marlina, A.Md.', nip: '199104122019032008', role: 'Pengelola Keuangan', load: '2 Tugas Aktif (45%)' },
  { id: 'TND-02', name: 'Budi Hartono, S.Ak.', nip: '198907212018031004', role: 'Verifikator Anggaran & SPJ', load: '1 Tugas Aktif (25%)' },
  { id: 'TND-03', name: 'Dedi Kurniawan, A.Md.', nip: '199311052020121003', role: 'Pengelola Barang Milik Negara (BMN)', load: '1 Tugas Aktif (30%)' },
  { id: 'TND-04', name: 'Siti Rahmawati, S.E.', nip: '199002182019032011', role: 'Staf Administrasi Keuangan & Pajak', load: '3 Tugas Aktif (75%)' }
];

const PARENT_PENUGASAN_OPTIONS = [
  { id: '', label: '-- Penugasan Mandiri Seksi (Tanpa Penugasan Atasan) --' },
  { id: 'MND-2025-0089', label: 'MND-2025-0089 • Penyusunan Laporan Realisasi Anggaran Triwulan I 2025' },
  { id: 'MND-2025-0086', label: 'MND-2025-0086 • Rekonsiliasi Data Aset Laboratorium & Inventaris BMN' },
  { id: 'MND-2025-0082', label: 'MND-2025-0082 • Verifikasi Dokumen SPJ Perjalanan Dinas Luar Kota' },
  { id: 'MND-2025-0077', label: 'MND-2025-0077 • Pemutakhiran Arsip Bukti Potong Pajak Honorarium' }
];

export default function CreateTendikAssignmentModal({ isOpen, onClose, onCreated }) {
  const [title, setTitle] = useState('Verifikasi Kelengkapan Bukti Pengeluaran Riil Perjalanan Dinas Dosen');
  const [parentId, setParentId] = useState('MND-2025-0082');
  const [assigneeId, setAssigneeId] = useState('TND-01');
  const [category, setCategory] = useState('Tupoksi Harian / Operasional Seksi');
  const [priority, setPriority] = useState('Tinggi');
  const [deadline, setDeadline] = useState('2025-03-14');
  const [outputTarget, setOutputTarget] = useState('Rekapitulasi Checklist Bukti Riil & Berkas SPJ Terverifikasi (PDF/XLSX)');
  const [instruction, setInstruction] = useState(
    'Lakukan pengecekan kesesuaian kuitansi riil, tiket perjalanan, boarding pass, dan surat tugas dosen sesuai standar SBM PMK terbaru sebelum diajukan ke Bendahara Pengeluaran.'
  );
  const [fileName, setFileName] = useState('Format_Checklist_Verifikasi_SPJ_2025.xlsx');

  if (!isOpen) return null;

  const selectedTendik = TENDIK_LIST.find((t) => t.id === assigneeId) || TENDIK_LIST[0];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newItem = {
      id: `TGS-SEKSI-${Math.floor(250 + Math.random() * 700)}`,
      title: title.trim(),
      parentId: parentId || null,
      parentLabel: PARENT_PENUGASAN_OPTIONS.find((p) => p.id === parentId)?.label || 'Penugasan Internal Seksi',
      assigneeName: selectedTendik.name,
      assigneeRole: selectedTendik.role,
      assigneeNip: selectedTendik.nip,
      category,
      priority,
      deadline,
      outputTarget,
      instruction,
      fileName,
      progress: 0,
      status: 'Baru Diberikan'
    };

    if (onCreated) onCreated(newItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#C0FFD2] text-[#004F28] flex items-center justify-center shrink-0 shadow-2xs">
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                <path
                  d="M6 2H14C15.1 2 16 2.9 16 4V16C16 17.1 15.1 18 14 18H6C4.9 18 4 17.1 4 16V4C4 2.9 4.9 2 6 2Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path d="M7.5 7H12.5M7.5 10.5H12.5M10 13V16M8.5 14.5H11.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0B1C30] leading-6">
                Formulir Buat Penugasan Baru Tendik Seksi
              </h2>
              <p className="text-xs text-[#3D4A40] mt-0.5">
                Seksi Keuangan & Aset • FTI Universitas Andalas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {/* Judul Penugasan */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0B1C30]">
                Judul Penugasan <span className="text-[#BA1A1A]">*</span>
              </label>
              <span className="text-[11px] text-gray-400 font-medium">Maks. 120 Karakter</span>
            </div>
            <input
              type="text"
              maxLength={120}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masukkan judul penugasan untuk staf tendik seksi..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#F8F9FF] border border-[#DCE3E8] text-xs font-medium text-[#0B1C30] focus:outline-none focus:border-[#004F28] focus:bg-white transition-colors"
            />
          </div>

          {/* Row 2: Terkait Penugasan Atasan & Penerima Tugas (Tendik Seksi) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#0B1C30]">
                Terkait Penugasan Atasan (Opsional)
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#F8F9FF] border border-[#DCE3E8] text-xs font-medium text-[#0B1C30] focus:outline-none focus:border-[#004F28] focus:bg-white"
              >
                {PARENT_PENUGASAN_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-gray-500">
                Hubungkan jika tugas ini merupakan turunan dari penugasan Dekanat / Kepala Kantor.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#0B1C30]">
                  Penerima Tugas (Tendik Seksi) <span className="text-[#BA1A1A]">*</span>
                </label>
                <span className="px-2 py-0.5 rounded bg-[#C0FFD2] text-[#004F28] text-[10px] font-bold">
                  Staf Internal
                </span>
              </div>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#F8F9FF] border border-[#DCE3E8] text-xs font-medium text-[#0B1C30] focus:outline-none focus:border-[#004F28] focus:bg-white"
              >
                {TENDIK_LIST.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.role}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-[#004F28] font-medium">
                NIP: {selectedTendik.nip} • Beban Kerja: {selectedTendik.load}
              </span>
            </div>
          </div>

          {/* Row 3: Kategori, Prioritas, Tenggat Waktu */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#0B1C30]">Kategori Penugasan</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#F8F9FF] border border-[#DCE3E8] text-xs text-[#0B1C30] focus:outline-none focus:border-[#004F28]"
              >
                <option>Tupoksi Harian / Operasional Seksi</option>
                <option>Delegasi Berjenjang Penugasan Atasan</option>
                <option>Verifikasi Dokumen Keuangan & SPJ</option>
                <option>Inventarisasi Aset & BMN</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#0B1C30]">Tingkat Prioritas</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#F8F9FF] border border-[#DCE3E8] text-xs text-[#0B1C30] focus:outline-none focus:border-[#004F28]"
              >
                <option value="Tinggi">Tinggi (Mendesak / SLA Ketat)</option>
                <option value="Normal">Normal (Rutin Terjadwal)</option>
                <option value="Rendah">Rendah (Pendukung)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#0B1C30]">
                Tenggat Waktu (Deadline) <span className="text-[#BA1A1A]">*</span>
              </label>
              <input
                type="date"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#F8F9FF] border border-[#DCE3E8] text-xs text-[#0B1C30] focus:outline-none focus:border-[#004F28]"
              />
            </div>
          </div>

          {/* Target Luaran / Output */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#0B1C30]">
              Target Output / Bukti Luaran Kerja <span className="text-[#BA1A1A]">*</span>
            </label>
            <input
              type="text"
              required
              value={outputTarget}
              onChange={(e) => setOutputTarget(e.target.value)}
              placeholder="Contoh: Berkas SPJ Terverifikasi / Rekap Excel Aset..."
              className="w-full px-3.5 py-2 rounded-lg bg-[#F8F9FF] border border-[#DCE3E8] text-xs text-[#0B1C30] focus:outline-none focus:border-[#004F28]"
            />
          </div>

          {/* Instruksi Kerja Teknis */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#0B1C30]">
              Instruksi Kerja & Rincian Penugasan <span className="text-[#BA1A1A]">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Tuliskan rincian teknis pelaksanaan tugas untuk staf Tendik..."
              className="w-full p-3 rounded-lg bg-[#F8F9FF] border border-[#DCE3E8] text-xs text-[#0B1C30] focus:outline-none focus:border-[#004F28]"
            />
          </div>

          {/* Lampiran */}
          <div className="p-3 rounded-xl bg-[#F8F9FF] border border-dashed border-[#BDCABA] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2 py-1 rounded bg-[#E5F3E8] text-[#004F28] text-[10px] font-bold">
                LAMPIRAN
              </span>
              <span className="text-xs text-[#0B1C30] font-medium truncate">
                {fileName || 'Belum ada dokumen acuan dipilih'}
              </span>
            </div>
            <label className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[11px] font-semibold text-[#004F28] hover:bg-gray-50 cursor-pointer shrink-0">
              Ganti Berkas
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setFileName(e.target.files[0].name);
                }}
              />
            </label>
          </div>

          {/* Footer Actions */}
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
              className="px-5 py-2.5 rounded-lg bg-[#004F28] text-white text-xs font-bold hover:bg-[#035c30] shadow-sm transition-colors cursor-pointer"
            >
              Kirim Penugasan ke Tendik
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
