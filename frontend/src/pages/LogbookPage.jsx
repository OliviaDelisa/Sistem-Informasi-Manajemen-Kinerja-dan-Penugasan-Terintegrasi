import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  fetchLogbooks, 
  saveLogbook, 
  submitLogbookRevision,
  fetchSubordinates,
  fetchSubordinateLogbooks,
  reviewSubordinateLogbook,
  fetchLogbookDetail
} from '../services/logbookApi';

export default function LogbookPage({ user }) {
  const currentUserId = user?.id ?? user?.id_pengguna;
  const roleSlug = (user?.roleKey || user?.jenisPengguna || '').toLowerCase();
  const isDosen = roleSlug === 'dosen';
  const isTendik = roleSlug === 'tendik';
  const isKasi = roleSlug === 'kasi';
  const isKepalaKantor = roleSlug === 'kepalakantor';
  const isDekan = roleSlug === 'dekan';
  const isSupervisorRole = isKasi || isKepalaKantor || isDekan;

  // Active Tab: 'saya' (Logbook Saya) atau 'bawahan' (Logbook Bawahan)
  const [activeTab, setActiveTab] = useState('saya');

  // ─── DATA STATE LOGBOOK SAYA ────────────────────────────────────────────────
  const [logbooks, setLogbooks] = useState([]);
  const [summary, setSummary] = useState({ total: 0, sah: 0, review: 0, revisi: 0 });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // ─── STATE TAB LOGBOOK BAWAHAN ───────────────────────────────────────────────
  const [subordinates, setSubordinates] = useState([]);
  const [selectedSubordinateId, setSelectedSubordinateId] = useState(null);
  const [subordinateLogbooks, setSubordinateLogbooks] = useState([]);
  const [subordinateProfile, setSubordinateProfile] = useState(null);
  const [subordinateSummary, setSubordinateSummary] = useState({ disahkan: 0, antrean: 0, revisi: 0, total: 0 });
  const [subordinateLoading, setSubordinateLoading] = useState(false);
  const [subordinateError, setSubordinateError] = useState(null);

  // Modal Review & Validasi Bawahan
  const [reviewingLogbook, setReviewingLogbook] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('validasi'); // 'validasi' | 'revisi' | 'tolak'
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // ─── STATE DETAIL LOGBOOK BAWAHAN (Tampilan Sesuai Gambar) ───────────────────
  const [selectedSubordinateLogbookId, setSelectedSubordinateLogbookId] = useState(null);
  const [subordinateDetailData, setSubordinateDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [detailEvaluationNote, setDetailEvaluationNote] = useState('');
  const [isSubmittingDetailReview, setIsSubmittingDetailReview] = useState(false);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState(null);

  // ─── FILTER STATE ───────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [selectedStatusTab, setSelectedStatusTab] = useState('Semua');
  const [periode, setPeriode] = useState('Semua Periode');
  const [showPeriodeDropdown, setShowPeriodeDropdown] = useState(false);

  // ─── PAGINATION STATE ────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Generate dynamic periode options
  const periodeOptions = useMemo(() => {
    const now = new Date();
    const monthsId = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const currentMonthYear = `${monthsId[now.getMonth()]} ${now.getFullYear()}`;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthYear = `${monthsId[prevMonthDate.getMonth()]} ${prevMonthDate.getFullYear()}`;

    return Array.from(new Set([
      'Semua Periode',
      currentMonthYear,
      prevMonthYear,
      'November 2024',
      'Oktober 2024'
    ]));
  }, []);

  // ─── MODAL STATE ────────────────────────────────────────────────────────────
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLogbookDetail, setSelectedLogbookDetail] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  // ─── FORM STATE (Tambah Logbook) ────────────────────────────────────────────
  const [formTanggal, setFormTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [formJamMulai, setFormJamMulai] = useState('08:00');
  const [formJamSelesai, setFormJamSelesai] = useState('11:00');
  const [formKategori, setFormKategori] = useState('Pengajaran');
  const [formJudul, setFormJudul] = useState('');
  const [formNomorSk, setFormNomorSk] = useState('');
  const [formUraian, setFormUraian] = useState('');
  const [formTarget, setFormTarget] = useState('');

  // ─── EVIDEN UPLOAD STATE ─────────────────────────────────────────────────────
  const [evidenFile, setEvidenFile] = useState(null);
  const [evidenTitle, setEvidenTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // ─── REVISI FORM STATE ───────────────────────────────────────────────────────
  const [revisionNoteInput, setRevisionNoteInput] = useState('');
  const [revisionFileInput, setRevisionFileInput] = useState('');

  // ─── HELPERS ─────────────────────────────────────────────────────────────────
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // ─── LOAD DATA DARI API ───────────────────────────────────────────────────────
  const loadLogbooks = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetchLogbooks(user.id, {
        periode: periode && periode !== 'Semua Periode' ? periode : undefined,
        kategori: selectedCategory !== 'Semua' ? selectedCategory : undefined,
        status: selectedStatusTab !== 'Semua' ? selectedStatusTab.toLowerCase() : undefined,
        search: searchTerm || undefined,
      });
      if (res.success) {
        setLogbooks(res.data || []);
        if (res.summary) setSummary(res.summary);
      } else {
        setApiError(res.message || 'Gagal memuat data logbook.');
      }
    } catch (err) {
      console.error('fetchLogbooks error:', err);
      setApiError('Tidak dapat terhubung ke server backend. Pastikan backend berjalan di port 5000.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, periode, selectedCategory, selectedStatusTab, searchTerm]);

  useEffect(() => {
    loadLogbooks();
  }, [loadLogbooks]);

  // ─── LOAD DATA BAWAHAN (Untuk Role Atasan) ──────────────────────────────────
  const loadSubordinates = useCallback(async () => {
    if (!currentUserId || !isSupervisorRole) return;
    try {
      const res = await fetchSubordinates(currentUserId);
      if (res.success && res.data) {
        setSubordinates(res.data);
        if (res.data.length > 0 && !selectedSubordinateId) {
          // Tetapkan satu bawahan langsung yang menjadi tanggung jawabnya
          setSelectedSubordinateId(res.data[0].id_pengguna);
        }
      }
    } catch (err) {
      console.error('fetchSubordinates error:', err);
    }
  }, [currentUserId, isSupervisorRole, selectedSubordinateId]);

  useEffect(() => {
    if (isSupervisorRole) {
      loadSubordinates();
    }
  }, [isSupervisorRole, loadSubordinates]);

  const loadSubordinateEntries = useCallback(async () => {
    if (!currentUserId || !selectedSubordinateId) return;
    setSubordinateLoading(true);
    setSubordinateError(null);
    try {
      const res = await fetchSubordinateLogbooks(currentUserId, selectedSubordinateId, {
        periode: periode && periode !== 'Semua Periode' ? periode : undefined,
      });
      if (res.success) {
        setSubordinateLogbooks(res.entries || []);
        setSubordinateProfile(res.subordinate || null);
        if (res.summary) setSubordinateSummary(res.summary);
      } else {
        setSubordinateError(res.message);
      }
    } catch (err) {
      console.error('loadSubordinateEntries error:', err);
      setSubordinateError(err.message || 'Gagal memuat logbook bawahan.');
    } finally {
      setSubordinateLoading(false);
    }
  }, [currentUserId, selectedSubordinateId, periode]);

  useEffect(() => {
    if (isSupervisorRole && selectedSubordinateId && activeTab === 'bawahan') {
      loadSubordinateEntries();
    }
  }, [isSupervisorRole, selectedSubordinateId, activeTab, loadSubordinateEntries]);

  // Handler eksekusi review oleh atasan
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewingLogbook) return;
    if (reviewDecision === 'revisi' && !reviewNotes.trim()) {
      alert('Mohon cantumkan catatan revisi untuk arahan perbaikan bawahan.');
      return;
    }
    setIsSubmittingReview(true);
    try {
      await reviewSubordinateLogbook(reviewingLogbook.id, {
        idSupervisor: currentUserId,
        action: reviewDecision,
        catatanRevisi: reviewNotes,
        komentar: reviewNotes || (reviewDecision === 'validasi' ? 'Logbook kegiatan telah divalidasi dan disahkan TTE.' : 'Perlu perbaikan berkas.')
      });

      const msg = reviewDecision === 'validasi'
        ? '✓ Logbook bawahan berhasil divalidasi dan disahkan TTE resmi!'
        : reviewDecision === 'revisi'
        ? '✓ Permintaan revisi telah dikirimkan ke bawahan!'
        : '✓ Logbook dikembalikan ke bawahan.';

      showToast(msg);
      setReviewingLogbook(null);
      setReviewNotes('');
      await loadSubordinateEntries();
      await loadSubordinates();
    } catch (err) {
      console.error('handleReviewSubmit error:', err);
      alert('Gagal memproses validasi: ' + err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // ─── HANDLER DETAIL LOGBOOK BAWAHAN (Tampilan Gambar 1) ──────────────────────
  const loadSubordinateLogbookDetail = useCallback(async (idLogbook) => {
    if (!idLogbook || !currentUserId) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetchLogbookDetail(idLogbook, currentUserId);
      if (res.success && res.data) {
        setSubordinateDetailData(res.data);
        setDetailEvaluationNote(res.data.catatanPimpinan || '');
      } else {
        setDetailError(res.message || 'Gagal memuat detail logbook.');
      }
    } catch (err) {
      console.error('fetchLogbookDetail error:', err);
      setDetailError(err.message || 'Gagal terhubung ke backend untuk mengambil data detail logbook.');
    } finally {
      setDetailLoading(false);
    }
  }, [currentUserId]);

  const openSubordinateDetail = (idLogbook) => {
    setSelectedSubordinateLogbookId(idLogbook);
    loadSubordinateLogbookDetail(idLogbook);
  };

  const handleBackToSubordinateList = () => {
    setSelectedSubordinateLogbookId(null);
    setSubordinateDetailData(null);
    setDetailError(null);
  };

  const handleDetailAction = async (action) => {
    if (!subordinateDetailData?.logbook?.id) return;
    if (action === 'revisi' && !detailEvaluationNote.trim()) {
      alert('Mohon cantumkan catatan evaluasi / revisi agar bawahan memahami bagian yang harus diperbaiki.');
      return;
    }
    setIsSubmittingDetailReview(true);
    try {
      await reviewSubordinateLogbook(subordinateDetailData.logbook.id, {
        idSupervisor: currentUserId,
        action,
        catatanRevisi: detailEvaluationNote,
        komentar: detailEvaluationNote || (action === 'validasi' ? 'Logbook kegiatan telah divalidasi dan disahkan TTE.' : 'Perlu perbaikan berkas.')
      });

      const msg = action === 'validasi'
        ? '✓ Logbook bawahan berhasil divalidasi dan disahkan TTE resmi!'
        : '✓ Permintaan revisi telah dikirimkan ke bawahan!';

      showToast(msg);
      await loadSubordinateLogbookDetail(subordinateDetailData.logbook.id);
      await loadSubordinateEntries();
      await loadSubordinates();
    } catch (err) {
      console.error('handleDetailAction error:', err);
      alert('Gagal memproses validasi: ' + err.message);
    } finally {
      setIsSubmittingDetailReview(false);
    }
  };

  // Parsing bullet items target (> item 1, > item 2)
  const targetBulletList = useMemo(() => {
    if (!subordinateDetailData?.logbook?.target) return [];
    const raw = subordinateDetailData.logbook.target;
    return raw
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => line.replace(/^[>\-\*•]\s*/, ''));
  }, [subordinateDetailData?.logbook?.target]);

  // Persentase realisasi dari hasil
  const realisasiPercent = useMemo(() => {
    if (!subordinateDetailData?.logbook?.hasil) return '100';
    const match = subordinateDetailData.logbook.hasil.match(/(\d{1,3})%/);
    return match ? match[1] : '100';
  }, [subordinateDetailData?.logbook?.hasil]);

  // ─── FILTER LOKAL (search + tab, sudah dikirim ke API, ini sebagai safety net) ─
  const filteredLogbooks = useMemo(() => {
    return logbooks.filter((item) => {
      const matchSearch =
        !searchTerm ||
        (item.judul || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.uraian || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.nomorSk || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.targetOutput || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory =
        selectedCategory === 'Semua' ||
        (item.kategori || '').toLowerCase() === selectedCategory.toLowerCase();

      const matchStatus =
        selectedStatusTab === 'Semua' ||
        (selectedStatusTab === 'Sah' && item.statusKey === 'sah') ||
        (selectedStatusTab === 'Review' && item.statusKey === 'review') ||
        (selectedStatusTab === 'Revisi' && item.statusKey === 'revisi');

      return matchSearch && matchCategory && matchStatus;
    });
  }, [logbooks, searchTerm, selectedCategory, selectedStatusTab]);

  // Reset pagination ke halaman 1 ketika pencarian atau filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedStatusTab, periode]);

  // Pagination calculation
  const totalFiltered = filteredLogbooks.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  const currentStartIndex = (currentPage - 1) * itemsPerPage;
  const displayedLogbooks = useMemo(() => {
    return filteredLogbooks.slice(currentStartIndex, currentStartIndex + itemsPerPage);
  }, [filteredLogbooks, currentStartIndex, itemsPerPage]);

  // ─── HITUNGAN KARTU — murni dari API summary (data real DB) ─────────────────
  const sahCount = summary.sah ?? logbooks.filter((l) => l.statusKey === 'sah').length;
  const reviewCount = summary.review ?? logbooks.filter((l) => l.statusKey === 'review').length;
  const revisiCount = summary.revisi ?? logbooks.filter((l) => l.statusKey === 'revisi').length;

  // ─── HANDLER: SIMPAN LOGBOOK BARU KE DB ──────────────────────────────────────
  const handleCreateLogbook = async (e) => {
    e.preventDefault();
    if (!formJudul.trim() || !formUraian.trim()) {
      alert('Judul butir tugas dan uraian kegiatan wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      const finalBerkasNama = evidenTitle
        ? (evidenTitle.endsWith('.pdf') || evidenTitle.endsWith('.docx') || evidenTitle.endsWith('.xlsx') || evidenTitle.endsWith('.jpg')
          ? evidenTitle
          : `${evidenTitle}.pdf`)
        : (evidenFile?.name || 'Eviden_Kegiatan.pdf');

      const payload = {
        idPengguna: user.id,
        tglKegiatan: formTanggal,
        waktu: `${formJamMulai} - ${formJamSelesai}`,
        kategori: formKategori,
        judul: formJudul,
        nomorSk: formNomorSk || 'Mandiri / Tupoksi',
        uraian: formUraian,
        target: formTarget || 'Terlaksana',
        berkasNama: finalBerkasNama,
        berkasUkuran: evidenFile?.size ? `${(evidenFile.size / (1024 * 1024)).toFixed(1)} MB` : '1.0 MB',
        keteranganEviden: evidenTitle || finalBerkasNama,
      };

      await saveLogbook(payload);

      setIsAddModalOpen(false);
      setFormJudul('');
      setFormNomorSk('');
      setFormUraian('');
      setFormTarget('');
      setEvidenFile(null);
      setEvidenTitle('');

      showToast('✓ Logbook kegiatan berhasil disimpan ke database dan masuk antrean review!');
      setPeriode('Semua Periode');
      setSelectedCategory('Semua');
      setSelectedStatusTab('Semua');
      setSearchTerm('');
      await loadLogbooks(); // Reload data dari DB
    } catch (err) {
      console.error('saveLogbook error:', err);
      alert('Gagal menyimpan logbook: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── HANDLER: KIRIM ULANG REVISI KE DB ───────────────────────────────────────
  const handleResubmitRevision = async (e) => {
    e.preventDefault();
    if (!selectedLogbookDetail) return;
    setIsSubmittingRevision(true);
    try {
      await submitLogbookRevision(selectedLogbookDetail.id, {
        idPengguna: user.id,
        revisionNote: revisionNoteInput || 'Eviden telah diperbarui sesuai arahan reviewer.',
        newFileName: revisionFileInput || selectedLogbookDetail.berkasNama,
      });

      setSelectedLogbookDetail(null);
      setRevisionNoteInput('');
      setRevisionFileInput('');

      showToast('✓ Revisi logbook berhasil dikirim ulang ke peninjau!');
      await loadLogbooks(); // Reload data dari DB
    } catch (err) {
      console.error('submitRevision error:', err);
      alert('Gagal mengirim revisi: ' + err.message);
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  const pageTitle = isDosen
    ? 'Logbook Kinerja & Aktivitas Dosen'
    : isTendik
      ? 'Logbook Kinerja & Aktivitas Tendik'
      : isKasi
        ? 'Logbook Kinerja & Aktivitas Kepala Seksi'
        : isKepalaKantor
          ? 'Logbook Kinerja & Aktivitas Kepala Kantor'
          : isDekan
            ? 'Logbook Kinerja & Aktivitas Pimpinan Dekanat'
            : 'Logbook Kinerja & Aktivitas Pegawai';

  const pageSubtitle = isDosen
    ? 'Pencatatan aktivitas Tridharma Perguruan Tinggi dan Kepanitiaan ad-hoc fakultas untuk pemenuhan BKD dan SKP.'
    : isTendik
      ? 'Pencatatan tugas pokok, fungsi harian, dan kepanitiaan operasional fakultas untuk pemenuhan Sasaran Kinerja Pegawai (SKP).'
      : 'Pencatatan tugas pokok operasional harian dan kepanitiaan untuk pemenuhan Sasaran Kinerja Pegawai (SKP).';

  const validatorText = isDosen
    ? 'Divalidasi oleh Dekan / Wadek (Sah)'
    : isTendik
      ? 'Divalidasi oleh Kasi / Kepala Kantor (Sah)'
      : 'Divalidasi oleh atasan langsung (Sah)';

  // Proteksi jika sesi login tidak valid
  if (!currentUserId) {
    return (
      <div className="flex-1 bg-[#F8FAFC] min-h-screen p-8 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center max-w-md shadow-sm">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-bold text-gray-800">Sesi Login Tidak Ditemukan</h2>
          <p className="text-xs text-gray-500 mt-2">
            Halaman Logbook hanya menampilkan data aktivitas milik pengguna yang sedang login. Silakan masuk ke akun Anda terlebih dahulu.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#F8FAFC] min-h-screen p-6 sm:p-8">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#0F5132] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-semibold animate-fade-in border border-emerald-400">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Tab Switcher: Tab 1. Logbook Saya | Tab 2. Logbook Bawahan (Khusus Kasi / Kepala Kantor / Dekan) */}
      {isSupervisorRole && (
        <div className="flex items-center gap-2 mb-6 bg-white p-1.5 rounded-2xl border border-gray-200 shadow-2xs w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('saya')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'saya'
                ? 'bg-[#0F5132] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className="text-base">📋</span>
            <span>1. Logbook Saya</span>
            {summary.revisi > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'saya' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'
              }`}>
                {summary.revisi} Revisi
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bawahan')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'bawahan'
                ? 'bg-[#0F5132] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className="text-base">🛡️</span>
            <span>2. Logbook Bawahan</span>
            {subordinateSummary.antrean > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'bawahan' ? 'bg-amber-400 text-gray-900' : 'bg-amber-100 text-amber-800'
              }`}>
                {subordinateSummary.antrean} Antrean
              </span>
            )}
          </button>
        </div>
      )}

      {/* API Error Banner */}
      {apiError && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{apiError}</span>
          <button
            onClick={loadLogbooks}
            className="ml-auto px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 font-semibold text-red-700 cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* ─── KONTEN TAB: REVIEW & VALIDASI LOGBOOK BAWAHAN ─── */}
      {isSupervisorRole && activeTab === 'bawahan' ? (
        selectedSubordinateLogbookId ? (
          /* JIKA MEMILIH SALAH SATU LOGBOOK BAWAHAN: TAMPILKAN HALAMAN DETAIL (SESUAI GAMBAR 1) */
          <div className="space-y-6">
            {/* Top Bar Navigasi Kembali */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBackToSubordinateList}
                  className="px-3.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <span>←</span>
                  <span>Kembali ke Antrean Logbook</span>
                </button>
                <div className="h-5 w-[1px] bg-gray-200 hidden sm:block" />
                <span className="text-xs font-bold text-[#0F5132] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                  Detail Logbook Bawahan (ID #{selectedSubordinateLogbookId})
                </span>
              </div>

              {subordinateDetailData?.logbook && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 font-medium">Status Pengesahan:</span>
                  <span className={`px-3 py-1 rounded-full font-bold text-xs ${
                    subordinateDetailData.logbook.statusKey === 'sah'
                      ? 'bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]'
                      : subordinateDetailData.logbook.statusKey === 'revisi'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]'
                  }`}>
                    {subordinateDetailData.logbook.statusLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Detail Body */}
            {detailLoading ? (
              <div className="bg-white rounded-3xl p-8 border border-gray-200 animate-pulse space-y-6">
                <div className="h-8 bg-gray-100 rounded-xl w-3/4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="h-44 bg-gray-50 rounded-2xl" />
                  <div className="h-44 bg-gray-50 rounded-2xl" />
                </div>
                <div className="h-28 bg-gray-50 rounded-2xl" />
              </div>
            ) : detailError ? (
              <div className="bg-white rounded-3xl p-8 border border-red-200 text-center space-y-3">
                <span className="text-4xl">⚠️</span>
                <h3 className="font-bold text-red-700 text-base">Gagal Memuat Detail Logbook</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto">{detailError}</p>
                <button
                  onClick={() => loadSubordinateLogbookDetail(selectedSubordinateLogbookId)}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 cursor-pointer"
                >
                  Coba Lagi
                </button>
              </div>
            ) : subordinateDetailData?.logbook ? (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-2xs space-y-6">
                {/* Strip Metadata Pegawai Bawahan */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-100">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-full bg-[#EBF3FE] text-[#1E3A8A] flex items-center justify-center font-black text-sm shrink-0 border border-blue-100">
                      {(subordinateDetailData.logbook.nama_pegawai || 'Bawahan')
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map(w => w[0].toUpperCase())
                        .join('')}
                    </div>
                    <div>
                      <div className="text-base sm:text-lg font-bold text-[#0B1C30] leading-tight">
                        {subordinateDetailData.logbook.nama_pegawai}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 font-medium flex items-center gap-2">
                        <span>{subordinateDetailData.logbook.nama_jabatan}</span>
                        <span>•</span>
                        <span>{subordinateDetailData.logbook.nama_unit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 font-medium">
                      📅 Tanggal: <strong className="text-gray-800">{subordinateDetailData.logbook.tanggalFormatted}</strong>
                    </div>
                    <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 font-medium">
                      ⏰ Waktu: <strong className="text-gray-800">{subordinateDetailData.logbook.waktu}</strong>
                    </div>
                    {subordinateDetailData.logbook.nomorSk && (
                      <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 font-medium">
                        📜 <span className="text-gray-800">{subordinateDetailData.logbook.nomorSk}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION: URAIAN TUGAS POKOK & INISIATIF (Persis Gambar 1) */}
                <div>
                  <div className="text-[11px] font-extrabold tracking-wider text-gray-400 uppercase">
                    URAIAN TUGAS POKOK &amp; INISIATIF
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-[#0B1C30] mt-1.5 leading-snug">
                    {subordinateDetailData.logbook.uraian || subordinateDetailData.logbook.judul}
                  </h2>
                </div>

                {/* SECTION: TWO SIDE-BY-SIDE BOXES (Target Kinerja vs Realisasi & Ketercapaian) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Box 1 (Kiri): TARGET KINERJA DISETUJUI */}
                  <div className="bg-[#EEF5FF] border border-[#D5E5FA] rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-black tracking-wider text-gray-700 uppercase mb-3">
                        <svg className="w-4 h-4 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          <line x1="4" y1="22" x2="4" y2="15" />
                        </svg>
                        <span>TARGET KINERJA DISETUJUI</span>
                      </div>
                      <div className="space-y-2.5">
                        {targetBulletList.length > 0 ? (
                          targetBulletList.map((line, idx) => (
                            <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-[13px] text-gray-800 leading-relaxed font-medium">
                              <span className="text-gray-400 font-bold shrink-0">&gt;</span>
                              <span>{line}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-start gap-2.5 text-xs sm:text-[13px] text-gray-800 leading-relaxed font-medium">
                            <span className="text-gray-400 font-bold shrink-0">&gt;</span>
                            <span>{subordinateDetailData.logbook.target || 'Terlaksana sesuai target indikator kinerja fakultas.'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Box 2 (Kanan): REALISASI & KETERCAPAIAN */}
                  <div className="bg-[#F2FAF4] border border-[#DCFCE7] rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-black tracking-wider text-gray-700 uppercase mb-3">
                        <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <span>REALISASI &amp; KETERCAPAIAN</span>
                      </div>
                      <div className="flex items-baseline gap-2.5 mb-2.5">
                        <span className="text-3xl sm:text-4xl font-extrabold text-[#15803D]">
                          {realisasiPercent}%
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-[#15803D]">
                          Selesai Tepat Waktu
                        </span>
                      </div>
                      <p className="text-xs sm:text-[13px] text-gray-700 leading-relaxed font-normal">
                        {subordinateDetailData.logbook.hasil || 'Seluruh butir target pekerjaan telah terealisasi sesuai standar mutu operasional FTI Universitas Andalas.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* SECTION: BERKAS PENDUKUNG / EVIDEN DIGITAL */}
                <div>
                  <div className="text-[11px] font-extrabold tracking-wider text-gray-400 uppercase mb-3">
                    BERKAS PENDUKUNG / EVIDEN DIGITAL
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {subordinateDetailData.bukti && subordinateDetailData.bukti.length > 0 ? (
                      subordinateDetailData.bukti.map((file) => {
                        const isPdf = (file.nama_berkas || '').toLowerCase().endsWith('.pdf');
                        return (
                          <div
                            key={file.id_bukti}
                            className="bg-[#F8FAFC] border border-gray-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs hover:border-gray-300 transition-all"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {isPdf ? (
                                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 border border-red-200 flex flex-col items-center justify-center font-black text-[10px] shrink-0 leading-none">
                                  <span>PDF</span>
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-base shrink-0">
                                  📊
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-bold text-gray-800 truncate" title={file.nama_berkas}>
                                  {file.nama_berkas}
                                </div>
                                <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                                  <span>{file.ukuran_berkas || '1.8 MB'}</span>
                                  <span>•</span>
                                  <span className="truncate">{file.keterangan || 'SHA-256 Verified'}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedPreviewFile(file)}
                              className="shrink-0 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95"
                            >
                              <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                              <span>Pratinjau</span>
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-xs text-gray-500 col-span-2">
                        Tidak ada berkas eviden digital yang dilampirkan.
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION: CATATAN & EVALUASI PIMPINAN */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">
                        💬
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-[#0B1C30]">
                        Catatan &amp; Evaluasi Pimpinan ({subordinateDetailData.logbook.jabatan_atasan || 'Dekan / Wadek'})
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-gray-400">
                      Terekam dalam Metadata Pengesahan
                    </span>
                  </div>

                  <div className="bg-[#F1F5F9] border border-gray-200 rounded-2xl p-4 text-xs sm:text-sm text-gray-700 leading-relaxed shadow-2xs">
                    {subordinateDetailData.logbook.statusKey === 'review' ? (
                      <div>
                        <textarea
                          rows={3}
                          value={detailEvaluationNote}
                          onChange={(e) => setDetailEvaluationNote(e.target.value)}
                          placeholder="Ketik catatan evaluasi pimpinan atau rekomendasi perbaikan sebelum validasi TTE..."
                          className="w-full bg-transparent border-0 focus:ring-0 text-xs sm:text-sm text-gray-800 placeholder-gray-400 resize-none outline-none leading-relaxed p-0"
                        />
                        <div className="text-[10px] text-gray-400 mt-2 flex justify-between items-center border-t border-gray-200/60 pt-2">
                          <span>Catatan ini otomatis disimpan ke dalam riwayat peninjauan dan sertifikat TTE digital.</span>
                          <span>{detailEvaluationNote.length} karakter</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs sm:text-sm text-gray-800 leading-relaxed font-normal">
                          {detailEvaluationNote || subordinateDetailData.catatanPimpinan || 'Belum ada catatan evaluasi dari pimpinan.'}
                        </p>
                        {subordinateDetailData.latestReview && (
                          <div className="text-[11px] text-gray-500 mt-2.5 font-medium border-t border-gray-200/60 pt-2 flex items-center justify-between">
                            <span>Terekam oleh: <strong>{subordinateDetailData.latestReview.peninjau_nama || subordinateDetailData.logbook.nama_atasan}</strong> ({subordinateDetailData.latestReview.peninjau_jabatan || subordinateDetailData.logbook.jabatan_atasan})</span>
                            <span>{subordinateDetailData.latestReview.waktu_review}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION: ACTION BUTTONS (Minta Perbaikan / Revisi & Validasi dengan TTE Digital) */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => handleDetailAction('revisi')}
                    disabled={isSubmittingDetailReview}
                    className="px-5 py-2.5 rounded-xl border border-indigo-200 bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#3730A3] font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span>Minta Perbaikan (Revisi)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDetailAction('validasi')}
                    disabled={isSubmittingDetailReview}
                    className="px-6 py-2.5 rounded-xl bg-[#0F5132] hover:bg-[#14532D] text-white font-bold text-xs sm:text-sm shadow-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <span>Validasi dengan TTE Digital</span>
                  </button>
                </div>

                {/* SECTION: RIWAYAT REVIEW & VALIDASI DARI DATABASE */}
                {(subordinateDetailData.riwayatReview?.length > 0 || subordinateDetailData.riwayatValidasi?.length > 0) && (
                  <div className="mt-6 pt-5 border-t border-gray-100">
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span>📜</span>
                      <span>Riwayat Audit Review &amp; Validasi Database</span>
                    </div>
                    <div className="space-y-2">
                      {subordinateDetailData.riwayatReview.map((rev) => (
                        <div key={`rev-${rev.id_review}`} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-gray-800">{rev.peninjau_nama}</span>
                            <span className="text-gray-500"> ({rev.peninjau_jabatan})</span>: <span className="text-gray-700 italic">"{rev.komentar || rev.catatan_revisi}"</span>
                          </div>
                          <span className="text-[11px] text-gray-400 shrink-0">{rev.waktu_review}</span>
                        </div>
                      ))}
                      {subordinateDetailData.riwayatValidasi.map((val) => (
                        <div key={`val-${val.id_validasi}`} className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-emerald-900">{val.validator_nama}</span>
                            <span className="text-emerald-700"> ({val.validator_jabatan})</span>: <span className="font-semibold text-emerald-800 uppercase">[{val.keputusan}]</span> {val.alasan_pengembalian && <span className="italic">"{val.alasan_pengembalian}"</span>}
                          </div>
                          <span className="text-[11px] text-emerald-600 shrink-0">{val.waktu_validasi}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          /* JIKA BELUM MEMILIH LOGBOOK: TAMPILKAN DAFTAR ANTREAN LOGBOOK BAWAHAN */
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="flex items-center gap-3.5 bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-[#E6F4EA] border border-[#C8E6C9] text-[#0F5132] flex items-center justify-center text-2xl shrink-0">
                🛡️
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0B1C30] tracking-tight">
                  Review &amp; Validasi Logbook Pejabat Struktural
                </h1>
                <p className="text-xs text-gray-500 mt-1 max-w-3xl">
                  Pemeriksaan, pemberian catatan revisi, dan pengesahan TTE resmi atas logbook kinerja bawahan yang berada di bawah tanggung jawab langsung Anda.
                </p>
              </div>
            </div>

            {/* Bar Antrean Otorisasi & Periode */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-[#0B1C30]">Antrean Otorisasi</h2>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E0E7FF] text-[#3730A3] border border-[#C7D2FE]">
                  {subordinateSummary.antrean || 0} Berkas
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-500">
                  Periode: <strong>{periode}</strong>
                </span>
              </div>
            </div>

            {/* Pemilih / Info Bawahan Tanggung Jawab Langsung (Terikat Relasi Database) */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#0F5132] flex items-center justify-center text-lg font-bold shrink-0 border border-emerald-100">
                  👤
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                    Bawahan Tanggung Jawab Langsung
                  </div>
                  <div className="text-sm font-bold text-gray-900 mt-0.5">
                    {subordinateProfile?.name || subordinates.find(s => s.id_pengguna === selectedSubordinateId)?.nama || 'Memuat data bawahan...'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {subordinateProfile?.position || subordinates.find(s => s.id_pengguna === selectedSubordinateId)?.nama_jabatan} • {subordinateProfile?.unit || 'FTI Universitas Andalas'}
                  </div>
                </div>
              </div>

              {subordinates.length > 1 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-gray-500 shrink-0">Pilih Bawahan:</label>
                  <select
                    value={selectedSubordinateId || ''}
                    onChange={(e) => setSelectedSubordinateId(Number(e.target.value))}
                    className="px-3 py-1.5 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs font-medium focus:border-[#0F5132] cursor-pointer"
                  >
                    {subordinates.map((sub) => (
                      <option key={sub.id_pengguna} value={sub.id_pengguna}>
                        {sub.nama} ({sub.nama_jabatan})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Daftar Kartu Logbook Bawahan (Sesuai Desain Gambar User) */}
            {subordinateLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200 animate-pulse h-36" />
                ))}
              </div>
            ) : subordinateError ? (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {subordinateError}
              </div>
            ) : subordinateLogbooks.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 border border-gray-200 text-center">
                <span className="text-3xl">📋</span>
                <p className="text-sm font-bold text-gray-700 mt-2">Tidak ada berkas logbook untuk bawahan ini</p>
                <p className="text-xs text-gray-400 mt-0.5">Bawahan belum mengajukan logbook atau tidak ada data yang cocok dengan periode.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {subordinateLogbooks.map((item) => {
                  const nameForInitials = subordinateProfile?.name || subordinates.find(s => s.id_pengguna === selectedSubordinateId)?.nama || 'Bawahan';
                  const initials = nameForInitials
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(w => w[0].toUpperCase())
                    .join('');

                  return (
                    <div
                      key={item.id}
                      onClick={() => openSubordinateDetail(item.id)}
                      className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-2xs border-l-4 border-l-[#0F5132] transition-all hover:shadow-md hover:border-gray-300 cursor-pointer group"
                    >
                      {/* Baris 1: Avatar, Nama, Jabatan, Badge Realisasi % */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-[#EBF3FE] text-[#1E3A8A] flex items-center justify-center font-black text-xs sm:text-sm shrink-0 border border-blue-100">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-[#0B1C30] text-sm sm:text-base leading-tight group-hover:text-[#0F5132] transition-colors">
                              {nameForInitials}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 font-medium">
                              {subordinateProfile?.position || subordinates.find(s => s.id_pengguna === selectedSubordinateId)?.nama_jabatan}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
                            {subordinateProfile?.realisasiPersen || 98}% Realisasi
                          </span>
                        </div>
                      </div>

                      {/* Baris 2: Beban Kerja / Judul & Uraian */}
                      <div className="my-2.5">
                        <div className="text-xs font-bold text-gray-800 leading-snug group-hover:text-[#0F5132] transition-colors">
                          {item.judul}
                        </div>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed line-clamp-2">
                          {item.uraian}
                        </p>
                        {item.targetOutput && (
                          <div className="text-[11px] font-semibold text-emerald-800 mt-1">
                            🎯 {item.targetOutput}
                          </div>
                        )}
                      </div>

                      {/* Baris 3: Horizontal Progress Bar Hijau */}
                      <div className="my-3">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 mb-1">
                          <span>Beban Kerja &amp; Kelengkapan Eviden</span>
                          <span className="text-[#0F5132] font-bold">Lengkap</span>
                        </div>
                        <div className="w-full h-2.5 bg-[#DCFCE7] rounded-full overflow-hidden">
                          <div className="h-full bg-[#0F5132] rounded-full w-full transition-all duration-500" />
                        </div>
                      </div>

                      {/* Baris 4: Footer Kartu (Diterima, Lampiran, Status, Tombol Aksi) */}
                      <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-3 text-gray-500">
                          <span>Diterima: <strong>{item.tanggal}</strong> {item.waktu ? `(${item.waktu})` : ''}</span>
                          {item.berkasNama && (
                            <span className="flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 text-[11px]">
                              <span>📄</span>
                              <span className="truncate max-w-[140px]">{item.berkasNama}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {item.statusKey === 'review' ? (
                            <>
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]">
                                <span>⏳</span>
                                <span>Menunggu Pengesahan</span>
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSubordinateDetail(item.id);
                                }}
                                className="px-4 py-1.5 rounded-xl bg-[#0F5132] hover:bg-[#14532D] text-white font-bold text-xs shadow-xs cursor-pointer transition-all active:scale-98"
                              >
                                Periksa &amp; Validasi
                              </button>
                            </>
                          ) : item.statusKey === 'sah' ? (
                            <>
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]">
                                <span>🛡️</span>
                                <span>Tervalidasi TTE ✓</span>
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSubordinateDetail(item.id);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
                              >
                                Lihat Detail
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                                <span>⚠️</span>
                                <span>Perlu Perbaikan Bawahan</span>
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSubordinateDetail(item.id);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
                              >
                                Lihat Detail
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Kotak INDEKS VALIDASI DEKANAT / STRUKTURAL (Sesuai Gambar) */}
            <div className="bg-white rounded-2xl p-5 border border-blue-100 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <span className="text-[11px] font-extrabold tracking-wider text-gray-500 uppercase">
                  INDEKS VALIDASI DEKANAT / STRUKTURAL
                </span>
                <span className="text-gray-400 text-sm">📊</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                <div className="sm:pr-4">
                  <div className="text-4xl font-black text-[#0F5132]">
                    {subordinateSummary.disahkan || 0}
                  </div>
                  <div className="text-xs font-semibold text-gray-600 mt-1">
                    Telah Disahkan (TTE)
                  </div>
                </div>

                <div className="pt-4 sm:pt-0 sm:pl-6">
                  <div className="text-4xl font-black text-amber-600">
                    {subordinateSummary.revisi || 0}
                  </div>
                  <div className="text-xs font-semibold text-gray-600 mt-1">
                    Permintaan Revisi
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        /* ─── KONTEN TAB: LOGBOOK SAYA (PRIBADI) ─── */
        <>
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  {user?.name} ({user?.position || user?.roleName || 'Pegawai'})
                </span>
              </div>
              <h1 className="text-2xl font-bold text-[#0B1C30] tracking-tight">
                {pageTitle}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-2xl">
                {pageSubtitle}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Periode Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowPeriodeDropdown(!showPeriodeDropdown)}
                  className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 flex items-center gap-2 hover:bg-gray-50 shadow-2xs cursor-pointer"
                >
                  <span className="text-emerald-700">📅</span>
                  <span>Periode: <strong>{periode}</strong></span>
                  <svg className="w-3 h-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {showPeriodeDropdown && (
                  <div className="absolute right-0 mt-1.5 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-20 text-xs">
                    {periodeOptions.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => { setPeriode(opt); setShowPeriodeDropdown(false); }}
                        className={`w-full text-left px-4 py-2 hover:bg-emerald-50 text-gray-700 cursor-pointer ${periode === opt ? 'font-bold text-[#0F5132] bg-emerald-50/50' : ''}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Button Catat Logbook */}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#0F5132] hover:bg-[#14532D] text-white text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer transition-all active:scale-98"
              >
                <span className="w-4 h-4 rounded-full border border-white flex items-center justify-center text-xs font-bold leading-none">+</span>
                <span>Catat Logbook</span>
              </button>
            </div>
          </div>

          {/* Summary Metric Cards (3 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

            {/* Card 1: TERVALIDASI TTE */}
            <div className="bg-[#ECFDF5] rounded-2xl p-5 border border-emerald-100 shadow-2xs flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold tracking-wider text-emerald-800 uppercase">TERVALIDASI TTE</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-base">🛡️</div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-[#064E3B]">
                  {loading ? (
                    <span className="inline-block w-12 h-7 bg-emerald-100 rounded animate-pulse" />
                  ) : sahCount}
                </div>
                <div className="text-sm font-semibold text-[#047857] mt-0.5">Logbook Disahkan</div>
                <div className="text-xs text-emerald-700 mt-2 font-medium flex items-center gap-1 border-t border-emerald-100 pt-2">
                  <span>✍️</span>
                  <span>
                    {user?.supervisorName
                      ? `Divalidasi oleh ${user.supervisorName}`
                      : validatorText}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: MENUNGGU REVIEW */}
            <div className="bg-[#FFFBEB] rounded-2xl p-5 border border-amber-100 shadow-2xs flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold tracking-wider text-amber-800 uppercase">MENUNGGU REVIEW</span>
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-base">⏳</div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-[#78350F]">
                  {loading ? (
                    <span className="inline-block w-12 h-7 bg-amber-100 rounded animate-pulse" />
                  ) : reviewCount}
                </div>
                <div className="text-sm font-semibold text-[#92400E] mt-0.5">Logbook Antrean</div>
                <div className="text-xs text-amber-700 mt-2 font-medium flex items-center gap-1 border-t border-amber-100 pt-2">
                  <span>⌛</span>
                  <span>Sedang ditinjau atasan</span>
                </div>
              </div>
            </div>

            {/* Card 3: PERLU PERBAIKAN */}
            <div className={`rounded-2xl p-5 border shadow-2xs flex flex-col justify-between transition-colors ${revisiCount > 0
              ? 'bg-red-50 border-red-200'
              : 'bg-[#EFF6FF] border-blue-100'
              }`}>
              <div className="flex items-start justify-between">
                <span className={`text-[10px] font-bold tracking-wider uppercase ${revisiCount > 0 ? 'text-red-700' : 'text-blue-800'}`}>
                  PERLU PERBAIKAN
                </span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${revisiCount > 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'
                  }`}>
                  🔄
                </div>
              </div>
              <div className="mt-3">
                <div className={`text-3xl font-black ${revisiCount > 0 ? 'text-red-700' : 'text-[#1E3A8A]'}`}>
                  {loading ? (
                    <span className="inline-block w-12 h-7 bg-blue-100 rounded animate-pulse" />
                  ) : revisiCount}
                </div>
                <div className={`text-sm font-semibold mt-0.5 ${revisiCount > 0 ? 'text-red-700' : 'text-[#1E40AF]'}`}>
                  Tugas Direvisi
                </div>
                <div className={`text-xs mt-2 font-medium flex items-center gap-1.5 border-t pt-2 ${revisiCount > 0 ? 'text-red-600 border-red-200' : 'text-emerald-600 border-blue-100'
                  }`}>
                  {revisiCount > 0 ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                      <span>Memerlukan respon Anda segera</span>
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      <span>Semua bersih</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Card: Filter & Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-gray-100">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#0B1C30]">Riwayat Logbook Aktivitas Saya</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Daftar seluruh aktivitas logbook pribadi Anda, dokumen eviden kinerja, dan status verifikasi dari atasan.
                </p>
              </div>

              <button
                onClick={() => setIsExportModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#F8FAFC] hover:bg-gray-100 text-gray-700 text-xs font-semibold flex items-center gap-2 border border-gray-200 cursor-pointer transition-colors self-start sm:self-auto"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>{isDosen ? 'Ekspor Rekap BKD (.PDF)' : 'Ekspor Rekap SKP (.PDF)'}</span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 text-xs">🔍</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari uraian, penugasan, atau nomor SK..."
                  className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#0F5132] focus:bg-white transition-colors"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Category Dropdown */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-700 font-medium focus:outline-none focus:border-[#0F5132] cursor-pointer"
                >
                  <option value="Semua">Semua Kategori Penugasan</option>
                  <option value="Pengajaran">Pengajaran</option>
                  <option value="Penelitian">Penelitian</option>
                  <option value="Pengabdian">Pengabdian</option>
                  <option value="Kepanitiaan SK">Kepanitiaan SK</option>
                  <option value="Administrasi">Administrasi</option>
                  <option value="Tugas Tambahan">Tugas Tambahan</option>
                </select>

                {/* Status Pills */}
                <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold">
                  {['Semua', 'Sah', 'Review', 'Revisi'].map((tab) => {
                    const isActive = selectedStatusTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => setSelectedStatusTab(tab)}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${isActive ? 'bg-[#0F5132] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        {tab}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Table View */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#EBF3FE] text-[#1E3A8A] text-[11px] font-bold tracking-wider uppercase rounded-xl">
                    <th className="py-3 px-4 rounded-l-xl">TANGGAL & WAKTU</th>
                    <th className="py-3 px-4">KATEGORI & BUTIR TUGAS</th>
                    <th className="py-3 px-4">URAIAN RINGKAS & OUTPUT</th>
                    <th className="py-3 px-4">BERKAS BUKTI</th>
                    <th className="py-3 px-4 rounded-r-xl">STATUS VALIDASI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {loading ? (
                    /* Loading skeleton */
                    [1, 2, 3].map((i) => (
                      <tr key={i}>
                        {[1, 2, 3, 4, 5].map((j) => (
                          <td key={j} className="py-4 px-4">
                            <div className="h-4 bg-gray-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredLogbooks.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-14 text-center">
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                          <span className="text-3xl">📋</span>
                          <p className="font-semibold text-sm text-gray-500">
                            {apiError ? 'Gagal memuat data' : 'Belum ada logbook yang tercatat'}
                          </p>
                          <p className="text-xs">
                            {apiError
                              ? 'Periksa koneksi ke backend server.'
                              : 'Klik "+ Catat Logbook" untuk menambahkan aktivitas pertama Anda.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedLogbooks.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                        onClick={() => setSelectedLogbookDetail(item)}
                      >
                        {/* Kolom 1: Tanggal & Waktu */}
                        <td className="py-4 px-4 align-top w-[18%]">
                          <div className="font-bold text-[#0B1C30] text-sm leading-snug">{item.tanggal}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">{item.waktu}</div>
                        </td>

                        {/* Kolom 2: Kategori & Butir Tugas */}
                        <td className="py-4 px-4 align-top w-[26%]">
                          <div>
                            {item.kategori === 'Pengajaran' && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#166534]">Pengajaran</span>
                            )}
                            {item.kategori === 'Kepanitiaan SK' && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1D4ED8] text-white">Kepanitiaan SK</span>
                            )}
                            {item.kategori === 'Penelitian' && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E0E7FF] text-[#3730A3]">Penelitian</span>
                            )}
                            {item.kategori === 'Pengabdian' && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800">Pengabdian</span>
                            )}
                            {item.kategori === 'Administrasi' && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">Administrasi</span>
                            )}
                            {item.kategori === 'Tugas Tambahan' && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">Tugas Tambahan</span>
                            )}
                            {!['Pengajaran', 'Kepanitiaan SK', 'Penelitian', 'Pengabdian', 'Administrasi', 'Tugas Tambahan'].includes(item.kategori) && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{item.kategori}</span>
                            )}
                          </div>
                          <div className="font-bold text-gray-900 mt-1.5 leading-snug text-xs sm:text-[13px]">{item.judul}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5 font-medium">{item.nomorSk}</div>
                        </td>

                        {/* Kolom 3: Uraian Ringkas & Output */}
                        <td className="py-4 px-4 align-top w-[28%]">
                          <p className="text-gray-700 leading-relaxed line-clamp-2">{item.uraian}</p>
                          <div className="mt-2 flex items-center gap-1.5 font-semibold text-[11px]">
                            {item.statusKey === 'revisi' ? (
                              <span className="text-[#1D4ED8] flex items-center gap-1">
                                <span>🚩</span><span>{item.targetOutput}</span>
                              </span>
                            ) : item.statusKey === 'sah' ? (
                              <span className="text-[#166534] flex items-center gap-1">
                                <span>✓</span><span>{item.targetOutput}</span>
                              </span>
                            ) : (
                              <span className="text-[#B45309] flex items-center gap-1">
                                <span>⏳</span><span>{item.targetOutput}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Kolom 4: Berkas Bukti */}
                        <td className="py-4 px-4 align-top w-[14%]">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedLogbookDetail(item); }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] border border-gray-200 text-blue-700 hover:text-blue-800 hover:border-blue-300 transition-colors text-[11px] font-semibold"
                          >
                            <span>📄</span>
                            <span className="truncate max-w-[110px]">{item.berkasNama || '—'}</span>
                          </button>
                        </td>

                        {/* Kolom 5: Status Validasi */}
                        <td className="py-4 px-4 align-top w-[14%]">
                          {item.statusKey === 'revisi' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]">
                              <span>🔄</span><span>Perlu Perbaikan</span>
                            </span>
                          )}
                          {item.statusKey === 'sah' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]">
                              <span>🛡️</span><span>Tervalidasi TTE ✓</span>
                            </span>
                          )}
                          {item.statusKey === 'review' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]">
                              <span>⏳</span><span>Menunggu Review</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer & Pagination */}
            <div className="pt-5 mt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
              <div>
                {loading ? (
                  'Memuat data...'
                ) : totalFiltered === 0 ? (
                  <span>Tidak ada data logbook yang ditampilkan</span>
                ) : (
                  <>
                    Menampilkan <strong>{currentStartIndex + 1}</strong> - <strong>{Math.min(currentStartIndex + itemsPerPage, totalFiltered)}</strong> dari <strong>{totalFiltered}</strong> aktivitas logbook Anda
                    {summary.total !== undefined && (
                      <span className="text-gray-400 ml-1.5 font-normal">(Total: {summary.total} entri tercatat)</span>
                    )}
                  </>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer transition-colors"
                  >
                    Sebelumnya
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center cursor-pointer transition-colors ${currentPage === pageNum
                        ? 'bg-[#0F5132] text-white shadow-xs'
                        : 'border border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer transition-colors"
                  >
                    Berikutnya
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 1: Tambah Logbook Kegiatan
      ═══════════════════════════════════════════════════════════════════════ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl sm:max-w-3xl shadow-2xl border border-gray-100 overflow-hidden animate-scale-up">
            <div className="px-6 py-4 bg-[#0F5132] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Catat Logbook Kegiatan Baru</h3>
                <p className="text-xs text-emerald-200 mt-0.5">Isi data kegiatan kinerja harian untuk verifikasi BKD dan TTE.</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-emerald-100 hover:text-white text-xl font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateLogbook} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Info Pengguna Login */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-emerald-900 font-semibold">Tercatat untuk Pengguna: <strong>{user?.name}</strong></span>
                </div>
                <span className="text-emerald-700 font-medium">{user?.position || user?.roleName || 'Pegawai'} ({user?.username})</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal Kegiatan</label>
                  <input type="date" required value={formTanggal} onChange={(e) => setFormTanggal(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Jam Mulai</label>
                  <input type="time" required value={formJamMulai} onChange={(e) => setFormJamMulai(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Jam Selesai</label>
                  <input type="time" required value={formJamSelesai} onChange={(e) => setFormJamSelesai(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Kategori Kegiatan</label>
                <select value={formKategori} onChange={(e) => setFormKategori(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs">
                  <option value="Pengajaran">Pengajaran (Perkuliahan/Praktikum/Bimbingan)</option>
                  <option value="Penelitian">Penelitian (Riset/Publikasi/Jurnal)</option>
                  <option value="Pengabdian">Pengabdian Kepada Masyarakat</option>
                  <option value="Kepanitiaan SK">Kepanitiaan SK Fakultas / Universitas</option>
                  <option value="Administrasi">Administrasi / Operasional Layanan</option>
                  <option value="Tugas Tambahan">Tugas Tambahan Struktural / Non-Struktural</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Judul Butir Tugas / Kegiatan</label>
                <input type="text" required placeholder="Misal: Perkuliahan IF3102 Sistem Terdistribusi Pertemuan 12" value={formJudul} onChange={(e) => setFormJudul(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Dasar Penugasan / Nomor SK (Opsional)</label>
                <input type="text" placeholder="Misal: SK Dekan No. 142/UN16.08/KP/2024 atau Jadwal Kuliah" value={formNomorSk} onChange={(e) => setFormNomorSk(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Uraian Kegiatan Rinci</label>
                <textarea required rows="3" placeholder="Tuliskan ringkasan substansi aktivitas yang dilaksanakan..." value={formUraian} onChange={(e) => setFormUraian(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Target / Output Capaian</label>
                <input type="text" placeholder="Misal: BAP & Presensi Mahasiswa, 1 Berita Acara, Draf Bab 4" value={formTarget} onChange={(e) => setFormTarget(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" />
              </div>

              {/* Unggah Bukti Pendukung Kinerja (Eviden) */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-2">
                  Unggah Bukti Pendukung Kinerja (Eviden) <span className="text-red-500">*</span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                  {/* Left Column: Dropzone Box */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files?.[0]) {
                        const file = e.dataTransfer.files[0];
                        setEvidenFile(file);
                        setEvidenTitle(file.name.replace(/\.[^/.]+$/, ''));
                      }
                    }}
                    onClick={() => document.getElementById('logbook-file-input').click()}
                    className={`md:col-span-7 bg-[#F4F8FC] rounded-2xl p-5 border transition-all flex flex-col items-center justify-center text-center cursor-pointer ${isDragging ? 'border-[#0F5132] bg-[#E8F4EC]' : 'border-dashed border-[#C5D7F2] hover:border-[#0F5132]/60'}`}
                  >
                    <input
                      id="logbook-file-input"
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          const file = e.target.files[0];
                          setEvidenFile(file);
                          setEvidenTitle(file.name.replace(/\.[^/.]+$/, ''));
                        }
                      }}
                    />
                    <div className="w-11 h-11 rounded-full bg-[#E6F4EA] text-[#0F5132] flex items-center justify-center mb-2.5 shadow-2xs">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div className="text-xs text-gray-700">
                      <span className="font-bold">Tarik & Jatuhkan Berkas di Sini atau </span>
                      <span className="text-[#0F5132] font-bold underline">Pilih File</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Mendukung format: PDF, DOCX, XLSX, JPG (Maks. 5 MB)</p>
                  </div>

                  {/* Right Column: File Details & Active File Card */}
                  <div className="md:col-span-5 bg-[#F4F8FC] rounded-2xl p-3.5 flex flex-col justify-between border border-[#E2ECF8]">
                    <div>
                      <label className="block text-xs font-semibold text-gray-800 mb-1.5">Keterangan / Judul Eviden</label>
                      <input
                        type="text"
                        value={evidenTitle}
                        onChange={(e) => setEvidenTitle(e.target.value)}
                        placeholder="Judul eviden..."
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#0F5132] shadow-2xs"
                      />
                    </div>

                    {/* Uploaded File Card */}
                    {evidenFile ? (
                      <div className="mt-3 bg-white rounded-xl p-2.5 border border-gray-100 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="text-[#0F5132] shrink-0">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-gray-800 truncate" title={evidenFile.name}>{evidenFile.name}</span>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {(evidenFile.size / (1024 * 1024)).toFixed(1)} MB • Unggahan Valid
                            </span>
                          </div>
                        </div>
                        <button type="button" onClick={() => { setEvidenFile(null); setEvidenTitle(''); }} className="text-gray-400 hover:text-red-500 p-1 rounded-md text-xs font-bold cursor-pointer transition-colors" title="Hapus berkas">✕</button>
                      </div>
                    ) : (
                      <div className="mt-3 py-3 px-3 bg-white/60 rounded-xl border border-dashed border-gray-200 text-center text-[11px] text-gray-400">
                        Belum ada berkas yang dipilih.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-[#0F5132] hover:bg-[#14532D] text-white text-xs font-semibold shadow-xs disabled:opacity-60 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                      Menyimpan...
                    </>
                  ) : 'Simpan & Ajukan Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 2: Detail Logbook & Penanganan Revisi
      ═══════════════════════════════════════════════════════════════════════ */}
      {selectedLogbookDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-gray-100 overflow-hidden animate-scale-up">
            <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold">Detail Entri Logbook</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold">ID #{selectedLogbookDetail.id}</span>
              </div>
              <button onClick={() => setSelectedLogbookDetail(null)} className="text-gray-300 hover:text-white text-xl font-bold p-1 cursor-pointer">✕</button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Alert jika butuh perbaikan */}
              {selectedLogbookDetail.statusKey === 'revisi' && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                  <div className="flex items-center gap-2 text-red-800 font-bold mb-1">
                    <span>⚠️</span>
                    <span>Catatan Review Peninjau (Perlu Perbaikan):</span>
                  </div>
                  <p className="text-red-700 leading-relaxed font-medium">{selectedLogbookDetail.catatanReviewer}</p>
                  <div className="mt-2 text-[11px] text-red-600">
                    Oleh: {selectedLogbookDetail.reviewerName} • {selectedLogbookDetail.tglReview}
                  </div>
                </div>
              )}

              {selectedLogbookDetail.statusKey === 'sah' && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold mb-1">
                    <span>🛡️</span>
                    <span>Tervalidasi TTE Resmi:</span>
                  </div>
                  <p className="text-emerald-700 leading-relaxed">{selectedLogbookDetail.catatanReviewer}</p>
                  <div className="mt-2 text-[11px] text-emerald-600">Diverifikasi: {selectedLogbookDetail.reviewerName}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Tanggal & Waktu</span>
                  <span className="font-bold text-gray-800 text-sm">{selectedLogbookDetail.tanggal}</span>
                  <span className="text-gray-500 block">{selectedLogbookDetail.waktu}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Kategori Penugasan</span>
                  <span className="font-bold text-gray-800 text-sm">{selectedLogbookDetail.kategori}</span>
                  <span className="text-gray-500 block">{selectedLogbookDetail.nomorSk}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Butir Kegiatan</span>
                <p className="font-bold text-gray-800 text-sm">{selectedLogbookDetail.judul}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Uraian Lengkap</span>
                <p className="text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">{selectedLogbookDetail.uraian}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Target / Output Capaian</span>
                  <span className="font-semibold text-gray-800">{selectedLogbookDetail.targetOutput}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Dokumen Eviden</span>
                  <div className="flex items-center gap-1.5 font-semibold text-blue-700">
                    <span>📄</span>
                    <span>{selectedLogbookDetail.berkasNama || '—'}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 block mt-0.5">Ukuran: {selectedLogbookDetail.berkasUkuran || '—'}</span>
                </div>
              </div>

              {/* Form Revisi Cepat jika status 'revisi' */}
              {selectedLogbookDetail.statusKey === 'revisi' && (
                <form onSubmit={handleResubmitRevision} className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-2">Ajukan Perbaikan Dokumen:</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">Unggah Berkas Baru / Revisi Eviden:</label>
                      <input
                        type="text"
                        placeholder="Misal: Notula_12Nov_Revisi_TTD.pdf"
                        value={revisionFileInput}
                        onChange={(e) => setRevisionFileInput(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">Catatan Tanggapan Dosen:</label>
                      <textarea
                        rows="2"
                        placeholder="Jelaskan perbaikan yang telah dilakukan..."
                        value={revisionNoteInput}
                        onChange={(e) => setRevisionNoteInput(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmittingRevision}
                      className="w-full py-2.5 rounded-lg bg-[#0F5132] hover:bg-[#14532D] text-white font-bold text-xs shadow-xs disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {isSubmittingRevision ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
                          Mengirim...
                        </>
                      ) : 'Kirim Ulang Revisi ke Peninjau'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button onClick={() => setSelectedLogbookDetail(null)} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold text-xs">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 3: Ekspor Rekap BKD / SKP
      ═══════════════════════════════════════════════════════════════════════ */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden animate-scale-up">
            <div className="px-6 py-4 bg-[#0F5132] text-white flex items-center justify-between">
              <h3 className="font-bold text-base">{isDosen ? 'Ekspor Rekap BKD (.PDF)' : 'Ekspor Rekap Kinerja SKP (.PDF)'}</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="text-white hover:text-emerald-200 font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-gray-600 leading-relaxed">
                {isDosen
                  ? 'Dokumen rekap memuat seluruh aktivitas logbook yang telah tervalidasi TTE oleh Dekanat untuk syarat pelaporan Beban Kerja Dosen (BKD) dan SKP.'
                  : 'Dokumen rekap memuat seluruh aktivitas logbook yang telah disahkan oleh pimpinan/atasan langsung untuk pemenuhan Sasaran Kinerja Pegawai (SKP).'}
              </p>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="font-semibold text-gray-800">Ringkasan Berkas:</div>
                <div className="text-gray-600 mt-1 space-y-0.5">
                  <div>• Pegawai: <strong>{user?.name || '—'}</strong></div>
                  <div>• Akun / NIP: <strong>{user?.username || '—'}</strong></div>
                  <div>• Jabatan: <strong>{user?.position || user?.roleName || 'Pegawai'}</strong></div>
                  <div>• Unit: <strong>{user?.unit || 'FTI Universitas Andalas'}</strong></div>
                  <div>• Periode: <strong>{periode}</strong></div>
                  <div>• Total Aktivitas Disahkan: <strong>{sahCount} Item</strong></div>
                </div>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button onClick={() => setIsExportModalOpen(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold">Batal</button>
                <button
                  onClick={() => { setIsExportModalOpen(false); showToast('Berkas Rekap Kinerja berhasil diunduh!'); }}
                  className="px-4 py-2 rounded-lg bg-[#0F5132] text-white font-semibold flex items-center gap-2 shadow-xs"
                >
                  <span>⬇️</span><span>Unduh PDF Resmi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 4: Review & Validasi Logbook Bawahan (Untuk Role Atasan)
      ═══════════════════════════════════════════════════════════════════════ */}
      {reviewingLogbook && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-100 overflow-hidden animate-scale-up">
            <div className="px-6 py-4 bg-[#0F5132] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Pemeriksaan & Validasi Logbook Bawahan</h3>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Pegawai: <strong>{subordinateProfile?.name}</strong> ({subordinateProfile?.position})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingLogbook(null)}
                className="text-emerald-100 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Detail Logbook Bawahan */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Tanggal & Waktu</span>
                  <span className="font-bold text-gray-800">{reviewingLogbook.tanggal}</span>
                  <span className="text-gray-500 block">{reviewingLogbook.waktu}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Kategori & Dasar SK</span>
                  <span className="font-bold text-gray-800">{reviewingLogbook.kategori}</span>
                  <span className="text-gray-500 block truncate">{reviewingLogbook.nomorSk || 'Mandiri / Tupoksi'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Butir Kegiatan</span>
                <p className="font-bold text-gray-900 text-sm">{reviewingLogbook.judul}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Uraian Substansi Aktivitas</span>
                <p className="text-gray-700 leading-relaxed bg-[#F8FAFC] p-3 rounded-xl border border-gray-200">
                  {reviewingLogbook.uraian}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Target / Output</span>
                  <span className="font-semibold text-gray-800">{reviewingLogbook.targetOutput}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Dokumen Eviden</span>
                  <div className="flex items-center gap-1.5 font-bold text-blue-700 truncate">
                    <span>📄</span>
                    <span className="truncate">{reviewingLogbook.berkasNama || 'Tidak ada berkas'}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 block mt-0.5">{reviewingLogbook.berkasUkuran}</span>
                </div>
              </div>

              {/* Form Keputusan Atasan */}
              <div className="pt-3 border-t border-gray-200 space-y-3">
                <label className="block text-xs font-bold text-gray-800">
                  Keputusan Atasan Langsung <span className="text-red-500">*</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                      reviewDecision === 'validasi'
                        ? 'border-[#0F5132] bg-[#ECFDF5] text-[#064E3B] font-bold shadow-2xs'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="validasi"
                      checked={reviewDecision === 'validasi'}
                      onChange={() => setReviewDecision('validasi')}
                      className="accent-[#0F5132]"
                    />
                    <div>
                      <div className="text-xs">🛡️ Sahkan & Terbitkan TTE</div>
                      <div className="text-[10px] text-gray-500 font-normal">Aktivitas disetujui sah</div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                      reviewDecision === 'revisi'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold shadow-2xs'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="revisi"
                      checked={reviewDecision === 'revisi'}
                      onChange={() => setReviewDecision('revisi')}
                      className="accent-amber-600"
                    />
                    <div>
                      <div className="text-xs">🔄 Minta Perbaikan Dokumen</div>
                      <div className="text-[10px] text-gray-500 font-normal">Kirim catatan revisi</div>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {reviewDecision === 'revisi'
                      ? 'Catatan Revisi untuk Bawahan * (Wajib Diisi)'
                      : 'Catatan Pengesahan / Feedback (Opsional)'}
                  </label>
                  <textarea
                    rows="3"
                    required={reviewDecision === 'revisi'}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={
                      reviewDecision === 'revisi'
                        ? 'Tuliskan secara spesifik hal yang perlu diperbaiki oleh bawahan...'
                        : 'Tuliskan catatan atau apresiasi pengesahan logbook (opsional)...'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:border-[#0F5132] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewingLogbook(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-xs flex items-center gap-2 disabled:opacity-60 cursor-pointer ${
                    reviewDecision === 'validasi'
                      ? 'bg-[#0F5132] hover:bg-[#14532D]'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {isSubmittingReview ? (
                    'Memproses...'
                  ) : reviewDecision === 'validasi' ? (
                    'Sahkan & Terbitkan TTE'
                  ) : (
                    'Kirim Permintaan Revisi'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 4: Review & Validasi Logbook Bawahan (Untuk Role Atasan)
      ═══════════════════════════════════════════════════════════════════════ */}
      {reviewingLogbook && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-100 overflow-hidden animate-scale-up">
            <div className="px-6 py-4 bg-[#0F5132] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Pemeriksaan & Validasi Logbook Bawahan</h3>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Pegawai: <strong>{subordinateProfile?.name}</strong> ({subordinateProfile?.position})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingLogbook(null)}
                className="text-emerald-100 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Detail Logbook Bawahan */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Tanggal & Waktu</span>
                  <span className="font-bold text-gray-800">{reviewingLogbook.tanggal}</span>
                  <span className="text-gray-500 block">{reviewingLogbook.waktu}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Kategori & Dasar SK</span>
                  <span className="font-bold text-gray-800">{reviewingLogbook.kategori}</span>
                  <span className="text-gray-500 block truncate">{reviewingLogbook.nomorSk || 'Mandiri / Tupoksi'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Butir Kegiatan</span>
                <p className="font-bold text-gray-900 text-sm">{reviewingLogbook.judul}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Uraian Substansi Aktivitas</span>
                <p className="text-gray-700 leading-relaxed bg-[#F8FAFC] p-3 rounded-xl border border-gray-200">
                  {reviewingLogbook.uraian}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Target / Output</span>
                  <span className="font-semibold text-gray-800">{reviewingLogbook.targetOutput}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Dokumen Eviden</span>
                  <div className="flex items-center gap-1.5 font-bold text-blue-700 truncate">
                    <span>📄</span>
                    <span className="truncate">{reviewingLogbook.berkasNama || 'Tidak ada berkas'}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 block mt-0.5">{reviewingLogbook.berkasUkuran}</span>
                </div>
              </div>

              {/* Form Keputusan Atasan */}
              <div className="pt-3 border-t border-gray-200 space-y-3">
                <label className="block text-xs font-bold text-gray-800">
                  Keputusan Atasan Langsung <span className="text-red-500">*</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${reviewDecision === 'validasi'
                      ? 'border-[#0F5132] bg-[#ECFDF5] text-[#064E3B] font-bold shadow-2xs'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="validasi"
                      checked={reviewDecision === 'validasi'}
                      onChange={() => setReviewDecision('validasi')}
                      className="accent-[#0F5132]"
                    />
                    <div>
                      <div className="text-xs">🛡️ Sahkan & Terbitkan TTE</div>
                      <div className="text-[10px] text-gray-500 font-normal">Aktivitas disetujui sah</div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${reviewDecision === 'revisi'
                      ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold shadow-2xs'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="revisi"
                      checked={reviewDecision === 'revisi'}
                      onChange={() => setReviewDecision('revisi')}
                      className="accent-amber-600"
                    />
                    <div>
                      <div className="text-xs">🔄 Minta Perbaikan Dokumen</div>
                      <div className="text-[10px] text-gray-500 font-normal">Kirim catatan revisi</div>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {reviewDecision === 'revisi'
                      ? 'Catatan Revisi untuk Bawahan * (Wajib Diisi)'
                      : 'Catatan Pengesahan / Feedback (Opsional)'}
                  </label>
                  <textarea
                    rows="3"
                    required={reviewDecision === 'revisi'}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={
                      reviewDecision === 'revisi'
                        ? 'Tuliskan secara spesifik hal yang perlu diperbaiki oleh bawahan...'
                        : 'Tuliskan catatan atau apresiasi pengesahan logbook (opsional)...'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:border-[#0F5132] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewingLogbook(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-xs flex items-center gap-2 disabled:opacity-60 cursor-pointer ${reviewDecision === 'validasi'
                    ? 'bg-[#0F5132] hover:bg-[#14532D]'
                    : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                >
                  {isSubmittingReview ? (
                    'Memproses...'
                  ) : reviewDecision === 'validasi' ? (
                    'Sahkan & Terbitkan TTE'
                  ) : (
                    'Kirim Permintaan Revisi'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pratinjau Eviden Digital */}
      {selectedPreviewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-gray-200 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">📄</span>
                <h3 className="font-bold text-gray-900 text-sm truncate max-w-xs">{selectedPreviewFile.nama_berkas}</h3>
              </div>
              <button
                onClick={() => setSelectedPreviewFile(null)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
            <div className="py-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center text-3xl mb-3">
                📑
              </div>
              <div className="font-bold text-gray-800 text-sm">{selectedPreviewFile.nama_berkas}</div>
              <div className="text-xs text-gray-500 mt-1">Ukuran: {selectedPreviewFile.ukuran_berkas} • {selectedPreviewFile.keterangan || 'SHA-256 Verified'}</div>
              <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 text-left space-y-1">
                <div>Status Verifikasi: <strong className="text-emerald-700">✓ SHA-256 Integritas Valid</strong></div>
                <div>Lokasi Arsip: <span className="font-mono text-[11px] text-gray-500">{selectedPreviewFile.lokasi_berkas}</span></div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => setSelectedPreviewFile(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  alert(`Mengunduh berkas eviden: ${selectedPreviewFile.nama_berkas}`);
                  setSelectedPreviewFile(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#0F5132] text-white text-xs font-bold hover:bg-[#14532D] shadow-xs cursor-pointer"
              >
                Unduh Berkas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
