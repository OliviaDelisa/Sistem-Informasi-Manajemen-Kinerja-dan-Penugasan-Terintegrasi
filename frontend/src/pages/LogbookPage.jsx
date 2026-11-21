import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../services/apiConfig';
import { 
  fetchLogbooks, 
  saveLogbook, 
  submitLogbookRevision,
  saveLogbookRevisionDraft,
  fetchSubordinates,
  fetchDekanAssignedLogbooks,
  fetchSubordinateLogbooks,
  reviewSubordinateLogbook,
  fetchLogbookDetail
} from '../services/logbookApi';

const revisionAspectLabels = {
  eviden: 'Kelengkapan eviden atau dokumen pendukung',
  kesesuaian: 'Kesesuaian uraian dengan tugas/kegiatan',
  target: 'Target, output, atau realisasi kegiatan',
  deskripsi: 'Kejelasan deskripsi dan hasil logbook',
};

function readRevisionAspects(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRevisionDeadlineDefault() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return getLocalDateString(date);
}

function getEvidencePreviewType(file) {
  const name = (file?.nama_berkas || '').toLowerCase();
  const mimeType = (file?.jenis_berkas || '').toLowerCase();
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (['image/jpeg', 'image/png'].includes(mimeType) || /\.(png|jpe?g)$/.test(name)) return 'image';
  return 'other';
}

function getEvidenceMimeType(file) {
  const extension = (file?.name || '').split('.').pop()?.toLowerCase();
  const byExtension = extension === 'png' ? 'image/png'
    : ['jpg', 'jpeg'].includes(extension) ? 'image/jpeg'
      : extension === 'pdf' ? 'application/pdf' : '';
  if (!byExtension) return '';
  return file.type && file.type !== byExtension ? '' : byExtension;
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return window.btoa(binary);
}

function exportLogbooksXlsx(rows, isDosen, customScope = '', reportUser = null, reportPeriod = 'Semua Periode', viewerId = null) {
  const xmlEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[char]);
  const columnName = (index) => {
    let name = '';
    for (let value = index + 1; value; value = Math.floor((value - 1) / 26)) {
      name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
    }
    return name;
  };
  const statusLabel = (item) => item.statusKey === 'sah' ? 'Tervalidasi'
    : item.statusKey === 'revisi' ? 'Revisi' : 'Menunggu Validasi';
  const evidenceUnit = (item) => item.berkasJenis === 'application/pdf' || /\.pdf$/i.test(item.berkasNama || '')
    ? 'PDF'
    : ['image/jpeg', 'image/png'].includes(item.berkasJenis) || /\.(jpe?g|png)$/i.test(item.berkasNama || '')
      ? 'Gambar' : '—';
  const subordinateReport = customScope === 'Logbook_Bawahan_Tervalidasi';
  const headers = subordinateReport
    ? ['No', 'Pemilik Logbook', 'Hari / Tanggal', 'Waktu Mulai', 'Waktu Selesai', 'Uraian Kegiatan / Pekerjaan', 'Hasil / Output', 'Kuantitas', 'Satuan', 'Keterangan / Link Bukti']
    : ['No', 'Hari / Tanggal', 'Waktu Mulai', 'Waktu Selesai', 'Uraian Kegiatan / Pekerjaan', 'Hasil / Output', 'Kuantitas', 'Satuan', 'Keterangan / Link Bukti'];
  const detailedReport = !customScope;
  const exportRows = rows.filter((item) => item.statusKey === 'sah');
  const hyperlinks = [];
  const values = exportRows.map((item, index) => {
    const times = String(item.waktu || '').match(/(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/);
    const activity = [item.judul, item.uraian, item.nomorSk].filter(Boolean).join('\n');
    const outputValue = subordinateReport ? (item.outputShort || item.hasil || item.targetOutput) : (item.outputShort || item.hasil || item.targetOutput);
    const output = subordinateReport ? (outputValue || '—') : [outputValue, `Status: ${statusLabel(item)}`].filter(Boolean).join('\n');
    if (item.id && item.berkasId && viewerId) {
      const href = new URL(`${API_BASE_URL}/logbook/${encodeURIComponent(item.id)}/bukti/${encodeURIComponent(item.berkasId)}?viewerId=${encodeURIComponent(viewerId)}`, window.location.origin).href;
      hyperlinks.push({ ref: `${subordinateReport ? 'J' : 'I'}${(detailedReport ? 9 : subordinateReport ? 5 : 2) + index}`, href });
    }
    const row = [index + 1, item.tanggal || '—', times?.[1] || '—', times?.[2] || '—', activity, output, item.kuantitas || '—', item.satuan || evidenceUnit(item), item.berkasNama || item.keteranganEviden || 'Tidak ada bukti'];
    return subordinateReport ? [index + 1, item.namaBawahan || 'Bawahan', ...row.slice(1, 8), row[8]] : row;
  });
  const tableHeaderRow = detailedReport ? 8 : subordinateReport ? 4 : 1;
  const reportRows = detailedReport ? [
    { values: ['LOG BOOK / CATATAN KERJA HARIAN'], kind: 'title', height: 30 },
    { values: ['PEGAWAI NEGERI SIPIL (PNS)'], kind: 'subtitle', height: 22 },
    { values: [], kind: 'blank', height: 10 },
    { values: ['Nama', reportUser?.name || reportUser?.nama || '—', '', '', '', 'Unit Kerja', reportUser?.unit || reportUser?.nama_unit || '—'], kind: 'identity', height: 22 },
    { values: ['NIP', reportUser?.nip || reportUser?.username || '—', '', '', '', 'Jabatan', reportUser?.position || reportUser?.nama_jabatan || reportUser?.roleName || '—'], kind: 'identity', height: 22 },
    { values: ['Bulan / Tahun', reportPeriod || 'Semua Periode'], kind: 'period', height: 22 },
    { values: [], kind: 'blank', height: 12 },
    { values: headers, kind: 'header', height: 32 },
    ...values.map((row) => ({ values: row, kind: 'data', height: Math.min(90, Math.max(30, Math.ceil(Math.max(...row.map((value) => String(value).length)) / 48) * 15)) })),
  ] : subordinateReport ? [
    { values: ['LOG BOOK / CATATAN KERJA HARIAN'], kind: 'title', height: 32 },
    { values: ['LOGBOOK BAWAHAN - SUDAH DIVALIDASI'], kind: 'subtitle', height: 22 },
    { values: [], kind: 'blank', height: 12 },
    { values: headers, kind: 'header', height: 34 },
    ...values.map((row) => ({ values: row, kind: 'data', height: Math.min(90, Math.max(30, Math.ceil(Math.max(...row.map((value) => String(value).length)) / 48) * 15)) })),
  ] : [
    { values: headers, kind: 'header', height: 32 },
    ...values.map((row) => ({ values: row, kind: 'data', height: Math.min(90, Math.max(30, Math.ceil(Math.max(...row.map((value) => String(value).length)) / 48) * 15)) })),
  ];
  const mergeRefs = detailedReport ? ['A1:I1', 'A2:I2', 'B4:E4', 'G4:I4', 'B5:E5', 'G5:I5', 'B6:I6']
    : subordinateReport ? ['A1:J1', 'A2:J2'] : [];
  const rowXml = reportRows.map(({ values: row, kind, height }, rowIndex) => `<row r="${rowIndex + 1}" ht="${height}" customHeight="1">${row.map((value, colIndex) => {
    const ref = `${columnName(colIndex)}${rowIndex + 1}`;
    const styleIndex = kind === 'title' ? 2 : kind === 'subtitle' ? 3 : kind === 'header' ? 1
      : kind === 'identity' ? ([0, 5].includes(colIndex) ? 4 : 5)
        : kind === 'period' ? (colIndex === 0 ? 4 : 5)
          : kind === 'data' ? ((subordinateReport ? [0, 2, 3, 4, 7, 8] : [0, 2, 3, 6, 7]).includes(colIndex) ? 7 : 6) : 0;
    const style = ` s="${styleIndex}"`;
    if (typeof value === 'number') return `<c r="${ref}"${style}><v>${value}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const mergeXml = mergeRefs.length ? `<mergeCells count="${mergeRefs.length}">${mergeRefs.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>` : '';
  const hyperlinkXml = hyperlinks.length ? `<hyperlinks>${hyperlinks.map((link, index) => `<hyperlink ref="${link.ref}" r:id="rId${index + 1}"/>`).join('')}</hyperlinks>` : '';
  const worksheetRels = hyperlinks.length
    ? `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hyperlinks.map((link, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(link.href)}" TargetMode="External"/>`).join('')}</Relationships>`
    : '';
  const lastRow = tableHeaderRow + values.length;
  const lastColumn = subordinateReport ? 'J' : 'I';
  const columnDefs = subordinateReport
    ? '<col min="1" max="1" width="7" customWidth="1"/><col min="2" max="2" width="28" customWidth="1"/><col min="3" max="3" width="19" customWidth="1"/><col min="4" max="5" width="14" customWidth="1"/><col min="6" max="6" width="44" customWidth="1"/><col min="7" max="7" width="32" customWidth="1"/><col min="8" max="9" width="13" customWidth="1"/><col min="10" max="10" width="38" customWidth="1"/>'
    : '<col min="1" max="1" width="7" customWidth="1"/><col min="2" max="2" width="19" customWidth="1"/><col min="3" max="4" width="14" customWidth="1"/><col min="5" max="5" width="44" customWidth="1"/><col min="6" max="6" width="32" customWidth="1"/><col min="7" max="8" width="13" customWidth="1"/><col min="9" max="9" width="38" customWidth="1"/>';
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${tableHeaderRow}" topLeftCell="A${tableHeaderRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columnDefs}</cols><sheetData>${rowXml}</sheetData>${mergeXml}${hyperlinkXml}<autoFilter ref="A${tableHeaderRow}:${lastColumn}${lastRow}"/></worksheet>`;
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Riwayat Logbook" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FF006B68"/><sz val="16"/><name val="Calibri"/></font><font><i/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF006B68"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    'xl/worksheets/sheet1.xml': worksheet,
  };
  files['xl/styles.xml'] = files['xl/styles.xml']
    .replace('<fonts count="4">', '<fonts count="5">')
    .replace('<font><i/><sz val="11"/><name val="Calibri"/></font></fonts>', '<font><i/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>')
    .replace('<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf>', '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment vertical="center"/></xf>');
  if (worksheetRels) files['xl/worksheets/_rels/sheet1.xml.rels'] = worksheetRels;
  const encoder = new TextEncoder();
  const crc32 = (bytes) => {
    let crc = -1;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ -1) >>> 0;
  };
  const chunks = [];
  const directory = [];
  let offset = 0;
  const push16 = (view, position, value) => view.setUint16(position, value, true);
  const push32 = (view, position, value) => view.setUint32(position, value, true);
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);
    push32(localView, 0, 0x04034b50); push16(localView, 4, 20); push16(localView, 6, 0x0800); push16(localView, 8, 0);
    push32(localView, 14, checksum); push32(localView, 18, data.length); push32(localView, 22, data.length); push16(localView, 26, nameBytes.length);
    local.set(nameBytes, 30); local.set(data, 30 + nameBytes.length); chunks.push(local);
    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    push32(centralView, 0, 0x02014b50); push16(centralView, 4, 20); push16(centralView, 6, 20); push16(centralView, 8, 0x0800); push16(centralView, 10, 0);
    push32(centralView, 16, checksum); push32(centralView, 20, data.length); push32(centralView, 24, data.length); push16(centralView, 28, nameBytes.length); push32(centralView, 42, offset);
    central.set(nameBytes, 46); directory.push(central); offset += local.length;
  }
  const directorySize = directory.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  push32(endView, 0, 0x06054b50); push16(endView, 8, directory.length); push16(endView, 10, directory.length); push32(endView, 12, directorySize); push32(endView, 16, offset);
  const blob = new Blob([...chunks, ...directory, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const scope = customScope || (isDosen ? 'BKD' : 'SKP');
  const safeName = String(reportUser?.name || reportUser?.nama || 'Pegawai').trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'Pegawai';
  const safePeriod = String(reportPeriod || 'Semua_Periode').trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'Semua_Periode';
  const exportYear = /\d{4}/.exec(reportPeriod || '')?.[0] || new Date().getFullYear();
  link.href = url;
  link.download = customScope
    ? customScope === 'Logbook_Bawahan_Tervalidasi'
      ? `Rekap_Logbook_Bawahan_${exportYear}.xlsx`
      : `Rekap_${scope}_Logbook_${getLocalDateString()}.xlsx`
    : `Rekap_SKP_${safeName}_${safePeriod}.xlsx`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getLogbookEvidenceUrl(idLogbook, evidenceId, viewerId) {
  const params = new URLSearchParams({ viewerId: String(viewerId) });
  return `${API_BASE_URL}/logbook/${encodeURIComponent(idLogbook)}/bukti/${encodeURIComponent(evidenceId)}?${params.toString()}`;
}

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
  const [activeTab, setActiveTab] = useState(isDekan ? 'bawahan' : 'saya');

  // ─── DATA STATE LOGBOOK SAYA ────────────────────────────────────────────────
  const [logbooks, setLogbooks] = useState([]);
  const [summary, setSummary] = useState({ total: 0, sah: 0, review: 0, revisi: 0 });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [isExportingPersonalLogbooks, setIsExportingPersonalLogbooks] = useState(false);

  // ─── STATE TAB LOGBOOK BAWAHAN ───────────────────────────────────────────────
  const [subordinates, setSubordinates] = useState([]);
  const [selectedSubordinateId, setSelectedSubordinateId] = useState(null);
  const [subordinateLogbooks, setSubordinateLogbooks] = useState([]);
  const [subordinateProfile, setSubordinateProfile] = useState(null);
  const [subordinateSummary, setSubordinateSummary] = useState({ disahkan: 0, antrean: 0, revisi: 0, total: 0 });
  const [subordinateLoading, setSubordinateLoading] = useState(false);
  const [subordinateError, setSubordinateError] = useState(null);
  const [subordinateStatusTab, setSubordinateStatusTab] = useState('Menunggu Verifikasi');
  const [subordinateValidatedPeriod, setSubordinateValidatedPeriod] = useState('');
  const [dekanLogbooks, setDekanLogbooks] = useState([]);
  const [dekanLogbookLoading, setDekanLogbookLoading] = useState(false);
  const [dekanLogbookError, setDekanLogbookError] = useState(null);
  const [dekanSearch, setDekanSearch] = useState('');
  const [dekanStatusFilter, setDekanStatusFilter] = useState('Semua');
  const [dekanDivisionFilter, setDekanDivisionFilter] = useState('Semua');
  const [dekanDateFilter, setDekanDateFilter] = useState('');
  const [dekanPeriodFilter, setDekanPeriodFilter] = useState('');
  const [dekanOwnerFilter, setDekanOwnerFilter] = useState('Semua');

  // Modal Review & Validasi Bawahan
  const [reviewingLogbook, setReviewingLogbook] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('validasi'); // 'validasi' | 'revisi' | 'tolak'
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isRevisionRequestOpen, setIsRevisionRequestOpen] = useState(false);
  const [revisionAspects, setRevisionAspects] = useState([]);
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionDeadline, setRevisionDeadline] = useState(getRevisionDeadlineDefault);
  const [revisionAttachmentName, setRevisionAttachmentName] = useState('');

  // ─── STATE DETAIL LOGBOOK BAWAHAN (Tampilan Sesuai Gambar) ───────────────────
  const [selectedSubordinateLogbookId, setSelectedSubordinateLogbookId] = useState(null);
  const [subordinateDetailData, setSubordinateDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [detailEvaluationNote, setDetailEvaluationNote] = useState('');
  const [isSubmittingDetailReview, setIsSubmittingDetailReview] = useState(false);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState(null);
  const [previewLoadError, setPreviewLoadError] = useState(false);

  useEffect(() => {
    setPreviewLoadError(false);
  }, [selectedPreviewFile]);

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
  const isRevisionDetail = selectedLogbookDetail?.statusKey === 'revisi';
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
  const [isSavingRevisionDraft, setIsSavingRevisionDraft] = useState(false);

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
  const [evidenPreviewUrl, setEvidenPreviewUrl] = useState('');
  const [unavailableEvidenceIds, setUnavailableEvidenceIds] = useState({});

  useEffect(() => {
    if (!evidenFile) {
      setEvidenPreviewUrl('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(evidenFile);
    setEvidenPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [evidenFile]);

  // ─── REVISI FORM STATE ───────────────────────────────────────────────────────
  const [revisionDraft, setRevisionDraft] = useState(null);
  const [revisionEvidenceFile, setRevisionEvidenceFile] = useState(null);
  const [revisionEvidenceAction, setRevisionEvidenceAction] = useState('keep');
  const [revisionEvidencePreviewUrl, setRevisionEvidencePreviewUrl] = useState('');
  const [revisionStoredEvidence, setRevisionStoredEvidence] = useState([]);
  const [revisionStoredEvidencePreviews, setRevisionStoredEvidencePreviews] = useState({});
  const [revisionStoredEvidenceErrors, setRevisionStoredEvidenceErrors] = useState({});
  const [revisionStoredEvidenceLoading, setRevisionStoredEvidenceLoading] = useState(false);
  const [revisionStoredEvidenceError, setRevisionStoredEvidenceError] = useState('');
  const [largeRevisionPreviewId, setLargeRevisionPreviewId] = useState(null);

  useEffect(() => {
    if (!revisionEvidenceFile) {
      setRevisionEvidencePreviewUrl('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(revisionEvidenceFile);
    setRevisionEvidencePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [revisionEvidenceFile]);

  useEffect(() => {
    if (selectedLogbookDetail?.statusKey !== 'revisi' || !currentUserId) return undefined;
    let active = true;
    const objectUrls = [];
    setRevisionStoredEvidenceLoading(true);
    setRevisionStoredEvidenceError('');
    setRevisionStoredEvidence([]);
    setRevisionStoredEvidencePreviews({});
    setRevisionStoredEvidenceErrors({});

    const loadOriginalEvidence = async () => {
      try {
        const detailResponse = await fetchLogbookDetail(selectedLogbookDetail.id, currentUserId);
        const evidence = Array.isArray(detailResponse.data?.bukti) ? detailResponse.data.bukti : [];
        if (!active) return;
        setRevisionStoredEvidence(evidence);

        const previews = await Promise.all(evidence.map(async (file) => {
          try {
            const response = await fetch(getLogbookEvidenceUrl(selectedLogbookDetail.id, file.id_bukti, currentUserId));
            const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
            if (!response.ok || contentType === 'application/json') {
              let message = 'File bukti kegiatan belum tersedia di penyimpanan. Silakan unggah kembali file ini.';
              try {
                const errorData = await response.json();
                if (errorData.message?.toLowerCase().includes('belum tersedia')) message = 'File lama tidak tersedia secara fisik. Silakan unggah kembali file ini.';
              } catch { /* Respons bukan JSON; gunakan pesan standar. */ }
              throw new Error(message);
            }
            if (!contentType.startsWith('image/') && contentType !== 'application/pdf') {
              throw new Error('Format file lama tidak didukung untuk pratinjau. Silakan unggah kembali sebagai JPG, PNG, atau PDF.');
            }
            const objectUrl = URL.createObjectURL(await response.blob());
            if (!active) {
              URL.revokeObjectURL(objectUrl);
              return null;
            }
            objectUrls.push(objectUrl);
            return { id: file.id_bukti, url: objectUrl, contentType };
          } catch (error) {
            return { id: file.id_bukti, error: error.message };
          }
        }));

        if (!active) return;
        const successfulPreviews = {};
        const failedPreviews = {};
        previews.filter(Boolean).forEach((preview) => {
          if (preview.error) failedPreviews[preview.id] = preview.error;
          else successfulPreviews[preview.id] = preview;
        });
        setRevisionStoredEvidencePreviews(successfulPreviews);
        setRevisionStoredEvidenceErrors(failedPreviews);
      } catch (error) {
        if (active) setRevisionStoredEvidenceError(error.message || 'Gagal mengambil bukti logbook.');
      } finally {
        if (active) setRevisionStoredEvidenceLoading(false);
      }
    };

    loadOriginalEvidence();
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedLogbookDetail?.id, selectedLogbookDetail?.statusKey, currentUserId]);

  useEffect(() => {
    if (selectedLogbookDetail?.statusKey === 'revisi') {
      setRevisionDraft({
        tglKegiatan: selectedLogbookDetail.tglRaw || new Date().toISOString().slice(0, 10),
        waktuMulai: String(selectedLogbookDetail.waktu || '').match(/(\d{1,2}:\d{2})/)?.[1] || '08:00',
        waktuSelesai: String(selectedLogbookDetail.waktu || '').match(/\d{1,2}:\d{2}\D+(\d{1,2}:\d{2})/)?.[1] || '11:00',
        kategori: selectedLogbookDetail.kategori || 'Pengajaran',
        judul: selectedLogbookDetail.judul || '',
        nomorSk: selectedLogbookDetail.nomorSk || '',
        uraian: selectedLogbookDetail.uraian || '',
        target: selectedLogbookDetail.targetOutput || '',
        hasil: selectedLogbookDetail.outputShort || '',
        kuantitas: selectedLogbookDetail.kuantitas || '',
        satuan: selectedLogbookDetail.satuan || '',
        keterangan: selectedLogbookDetail.keteranganEviden || '',
      });
      setRevisionEvidenceFile(null);
      setRevisionEvidenceAction('keep');
    } else {
      setRevisionDraft(null);
    }
  }, [selectedLogbookDetail]);

  // ─── HELPERS ─────────────────────────────────────────────────────────────────
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // ─── LOAD DATA DARI API ───────────────────────────────────────────────────────
  const loadLogbooks = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetchLogbooks(currentUserId, {
        periode: periode && periode !== 'Semua Periode' ? periode : undefined,
        kategori: selectedCategory !== 'Semua' ? selectedCategory : undefined,
        status: selectedStatusTab !== 'Semua' ? selectedStatusTab.toLowerCase() : undefined,
        search: searchTerm || undefined,
      });
      if (res.success) {
        setLogbooks(res.data || []);
        if (res.summary) setSummary(res.summary);
        return res.data || [];
      } else {
        setApiError(res.message || 'Gagal memuat data logbook.');
        return [];
      }
    } catch (err) {
      console.error('fetchLogbooks error:', err);
      setApiError('Tidak dapat terhubung ke server backend. Pastikan backend berjalan di port 5000.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [currentUserId, periode, selectedCategory, selectedStatusTab, searchTerm]);

  const handleExportPersonalLogbooks = useCallback(async () => {
    if (!currentUserId || isExportingPersonalLogbooks) return;
    setIsExportingPersonalLogbooks(true);
    try {
      // Ekspor selalu meminta ulang data tervalidasi milik akun aktif dari database,
      // tanpa terpengaruh tab status yang sedang dipilih pada daftar.
      const res = await fetchLogbooks(currentUserId, {
        periode: periode && periode !== 'Semua Periode' ? periode : undefined,
        kategori: selectedCategory !== 'Semua' ? selectedCategory : undefined,
        status: 'sah',
        search: searchTerm || undefined,
      });
      if (!res.success) throw new Error(res.message || 'Gagal mengambil data logbook tervalidasi.');
      exportLogbooksXlsx(res.data || [], isDosen, '', user, periode, currentUserId);
      showToast('Data logbook tervalidasi berhasil diunduh dalam format Excel.');
    } catch (error) {
      console.error('export validated logbooks error:', error);
      showToast(error.message || 'Data logbook gagal diekspor.');
    } finally {
      setIsExportingPersonalLogbooks(false);
    }
  }, [currentUserId, isExportingPersonalLogbooks, periode, selectedCategory, searchTerm, isDosen, user]);

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
        if (!res.data.some((item) => Number(item.id_pengguna) === Number(selectedSubordinateId))) {
          // Utamakan bawahan yang sedang memiliki logbook menunggu pemeriksaan.
          setSelectedSubordinateId(res.data[0]?.id_pengguna || null);
        }
      }
    } catch (err) {
      console.error('fetchSubordinates error:', err);
    }
  }, [currentUserId, isSupervisorRole, selectedSubordinateId]);

  const loadDekanLogbooks = useCallback(async () => {
    if (!currentUserId || !isDekan) return;
    setDekanLogbookLoading(true);
    setDekanLogbookError(null);
    try {
      const res = await fetchDekanAssignedLogbooks(currentUserId);
      setDekanLogbooks(res.data || []);
    } catch (err) {
      setDekanLogbookError(err.message || 'Gagal memuat logbook dalam kewenangan Dekanat.');
    } finally {
      setDekanLogbookLoading(false);
    }
  }, [currentUserId, isDekan]);

  useEffect(() => {
    if (isDekan) setActiveTab('bawahan');
  }, [isDekan]);

  useEffect(() => {
    if (isSupervisorRole && !isDekan) {
      loadSubordinates();
    }
  }, [isSupervisorRole, isDekan, loadSubordinates]);

  useEffect(() => {
    if (isDekan && activeTab === 'bawahan') loadDekanLogbooks();
  }, [isDekan, activeTab, loadDekanLogbooks]);

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
    if (isSupervisorRole && !isDekan && selectedSubordinateId && activeTab === 'bawahan') {
      loadSubordinateEntries();
    }
  }, [isSupervisorRole, isDekan, selectedSubordinateId, activeTab, loadSubordinateEntries]);

  // Refresh antrean selama tab Bawahan terbuka agar pengiriman ulang dari
  // pegawai segera muncul tanpa atasan perlu memuat ulang halaman.
  useEffect(() => {
    if (activeTab !== 'bawahan') return undefined;

    const refreshReviewQueue = () => {
      if (isDekan) {
        loadDekanLogbooks();
        return;
      }
      if (isSupervisorRole) {
        loadSubordinates();
        if (selectedSubordinateId) loadSubordinateEntries();
      }
    };

    const intervalId = window.setInterval(refreshReviewQueue, 15000);
    window.addEventListener('focus', refreshReviewQueue);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshReviewQueue);
    };
  }, [activeTab, isDekan, isSupervisorRole, selectedSubordinateId,
    loadDekanLogbooks, loadSubordinates, loadSubordinateEntries]);

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
      const result = await reviewSubordinateLogbook(reviewingLogbook.id, {
        idSupervisor: currentUserId,
        action: reviewDecision,
        catatanRevisi: reviewNotes,
        komentar: reviewNotes || (reviewDecision === 'validasi' ? 'Logbook kegiatan telah divalidasi dan disahkan TTE.' : 'Perlu perbaikan berkas.')
      });

      const msg = reviewDecision === 'validasi'
        ? result.message
        : reviewDecision === 'revisi'
        ? '✓ Permintaan revisi telah dikirimkan ke bawahan!'
        : '✓ Logbook dikembalikan ke bawahan.';

      showToast(msg);
      setReviewingLogbook(null);
      setReviewNotes('');
      if (isDekan) await loadDekanLogbooks();
      else {
        await loadSubordinateEntries();
        await loadSubordinates();
      }
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
    setSelectedPreviewFile(null);
    setSelectedSubordinateLogbookId(idLogbook);
    loadSubordinateLogbookDetail(idLogbook);
  };

  const handleBackToSubordinateList = () => {
    setSelectedPreviewFile(null);
    setSelectedSubordinateLogbookId(null);
    setSubordinateDetailData(null);
    setDetailError(null);
  };

  const handleDetailAction = async (action) => {
    if (!subordinateDetailData?.logbook?.id) return;
    if (action === 'revisi') {
      setRevisionReason('');
      setRevisionAspects([]);
      setRevisionDeadline(getRevisionDeadlineDefault());
      setRevisionAttachmentName('');
      setIsRevisionRequestOpen(true);
      return;
    }
    if (action === 'simpan_catatan' && !detailEvaluationNote.trim()) {
      alert('Silakan tuliskan catatan dan evaluasi pimpinan terlebih dahulu sebelum menyimpan.');
      return;
    }
    setIsSubmittingDetailReview(true);
    try {
      const result = await reviewSubordinateLogbook(subordinateDetailData.logbook.id, {
        idSupervisor: currentUserId,
        action,
        catatanRevisi: detailEvaluationNote.trim() || undefined,
        komentar: detailEvaluationNote.trim() || undefined
      });

      const msg = action === 'validasi'
        ? result.message
        : action === 'simpan_catatan'
        ? '✓ Catatan dan evaluasi pimpinan berhasil disimpan ke database!'
        : '✓ Permintaan perbaikan (revisi) telah dikirimkan ke bawahan!';

      showToast(msg);
      await loadSubordinateLogbookDetail(subordinateDetailData.logbook.id);
      if (isDekan) await loadDekanLogbooks();
      else {
        await loadSubordinateEntries();
        await loadSubordinates();
      }
    } catch (err) {
      console.error('handleDetailAction error:', err);
      alert('Gagal memproses: ' + err.message);
    } finally {
      setIsSubmittingDetailReview(false);
    }
  };

  const handleRevisionRequestSubmit = async (event) => {
    event.preventDefault();
    if (!revisionAspects.length) {
      alert('Pilih minimal satu aspek yang perlu diperbaiki.');
      return;
    }
    if (revisionReason.trim().length < 20 || revisionReason.trim().length > 1000) {
      alert('Uraian catatan revisi wajib diisi antara 20 dan 1000 karakter.');
      return;
    }
    if (!revisionDeadline || revisionDeadline < getLocalDateString()) {
      alert('Batas waktu revisi harus hari ini atau setelahnya.');
      return;
    }

    setIsSubmittingDetailReview(true);
    try {
      const result = await reviewSubordinateLogbook(subordinateDetailData.logbook.id, {
        idSupervisor: currentUserId,
        action: 'revisi',
        catatanRevisi: revisionReason.trim(),
        komentar: revisionReason.trim(),
        aspekRevisi: revisionAspects,
        tenggatRevisi: revisionDeadline,
        namaBerkasRevisi: revisionAttachmentName.trim() || undefined,
      });
      setIsRevisionRequestOpen(false);
      showToast(result.message || 'Permintaan revisi berhasil dikirim kepada pemilik logbook.');
      await loadSubordinateLogbookDetail(subordinateDetailData.logbook.id);
      if (isDekan) await loadDekanLogbooks();
      else await loadSubordinates();
    } catch (err) {
      alert('Gagal mengirim permintaan revisi: ' + err.message);
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

  const dekanDivisions = useMemo(() => [...new Map(
    dekanLogbooks.map((item) => [String(item.idDivisi), { id: item.idDivisi, name: item.divisi }]),
  ).values()], [dekanLogbooks]);
  const dekanOwners = useMemo(() => [...new Map(
    dekanLogbooks.map((item) => [String(item.idPemilik), { id: item.idPemilik, name: item.namaBawahan }]),
  ).values()], [dekanLogbooks]);
  const filteredDekanLogbooks = useMemo(() => {
    const search = dekanSearch.trim().toLocaleLowerCase('id');
    return dekanLogbooks.filter((item) => {
      const matchesSearch = !search ||
        `${item.namaBawahan} ${item.judul} ${item.uraian || ''}`.toLocaleLowerCase('id').includes(search);
      const matchesStatus = dekanStatusFilter === 'Semua' ||
        (dekanStatusFilter === 'Menunggu Validasi' && item.statusKey === 'review') ||
        (dekanStatusFilter === 'Revisi' && item.statusKey === 'revisi') ||
        (dekanStatusFilter === 'Tervalidasi' && item.statusKey === 'sah');
      const matchesDivision = dekanDivisionFilter === 'Semua' || String(item.idDivisi) === dekanDivisionFilter;
      const matchesOwner = dekanOwnerFilter === 'Semua' || String(item.idPemilik) === dekanOwnerFilter;
      const matchesDate = !dekanDateFilter || item.tglRaw === dekanDateFilter;
      const matchesPeriod = !dekanPeriodFilter || (item.tglRaw || '').slice(0, 7) === dekanPeriodFilter;
      return matchesSearch && matchesStatus && matchesDivision && matchesOwner && matchesDate && matchesPeriod;
    });
  }, [dekanLogbooks, dekanSearch, dekanStatusFilter, dekanDivisionFilter, dekanOwnerFilter, dekanDateFilter, dekanPeriodFilter]);
  const subordinateEntriesForStatus = isDekan ? filteredDekanLogbooks : subordinateLogbooks;
  const subordinatePendingCount = subordinateEntriesForStatus.filter((item) => item.statusKey === 'review' || item.statusKey === 'revisi').length;
  const subordinateValidatedCount = subordinateEntriesForStatus.filter((item) => item.statusKey === 'sah').length;
  const displayedSubordinateLogbooks = subordinateEntriesForStatus.filter((item) => {
    const matchesStatus = subordinateStatusTab === 'Menunggu Verifikasi'
      ? item.statusKey === 'review' || item.statusKey === 'revisi'
      : item.statusKey === 'sah';
    const matchesValidatedPeriod = subordinateStatusTab !== 'Sudah Divalidasi' || !subordinateValidatedPeriod ||
      (item.tglRaw || '').slice(0, 7) === subordinateValidatedPeriod;
    return matchesStatus && matchesValidatedPeriod;
  });

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

  const handleSelectEvidenceFile = (file) => {
    if (!file) return;
    const evidenceMime = getEvidenceMimeType(file);
    if (!evidenceMime) {
      setEvidenFile(null);
      setEvidenTitle('');
      alert('Bukti kegiatan harus berupa JPG, JPEG, PNG, atau PDF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setEvidenFile(null);
      setEvidenTitle('');
      alert('Ukuran berkas maksimal 5 MB.');
      return;
    }
    setEvidenFile(file);
    setEvidenTitle(file.name.replace(/\.[^/.]+$/, ''));
  };

  // ─── HANDLER: SIMPAN LOGBOOK BARU KE DB ──────────────────────────────────────
  const handleCreateLogbook = async (e) => {
    e.preventDefault();
    if (!formJudul.trim() || !formUraian.trim()) {
      alert('Judul butir tugas dan uraian kegiatan wajib diisi.');
      return;
    }
    if (!evidenFile) {
      alert('Unggah bukti kegiatan berupa JPG, JPEG, PNG, atau PDF sebelum menyimpan logbook.');
      return;
    }
    setIsSaving(true);
    try {
      const imageMime = getEvidenceMimeType(evidenFile);
      const berkasDataBase64 = await fileToBase64(evidenFile);

      const payload = {
        idPengguna: user.id,
        tglKegiatan: formTanggal,
        waktu: `${formJamMulai} - ${formJamSelesai}`,
        kategori: formKategori,
        judul: formJudul,
        nomorSk: formNomorSk || 'Mandiri / Tupoksi',
        uraian: formUraian,
        target: formTarget || 'Terlaksana',
        berkasNama: evidenFile.name,
        berkasUkuran: `${(evidenFile.size / (1024 * 1024)).toFixed(2)} MB`,
        jenisBerkas: imageMime,
        berkasDataBase64,
        keteranganEviden: evidenTitle || evidenFile.name,
      };

      const result = await saveLogbook(payload);

      setIsAddModalOpen(false);
      setFormJudul('');
      setFormNomorSk('');
      setFormUraian('');
      setFormTarget('');
      setEvidenFile(null);
      setEvidenTitle('');
      setEvidenPreviewUrl('');

      showToast(result.message || 'Logbook berhasil dikirim untuk pemeriksaan berjenjang.');
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
  const buildRevisionPayload = async () => ({
    idPengguna: currentUserId,
    evidenceAction: revisionEvidenceAction,
    berkasNama: revisionEvidenceFile?.name,
    jenisBerkas: revisionEvidenceFile ? getEvidenceMimeType(revisionEvidenceFile) : undefined,
    berkasDataBase64: revisionEvidenceFile ? await fileToBase64(revisionEvidenceFile) : undefined,
    ...revisionDraft,
    waktu: `${revisionDraft?.waktuMulai || '08:00'} - ${revisionDraft?.waktuSelesai || '11:00'}`,
  });

  const handleSaveRevisionDraft = async () => {
    if (!selectedLogbookDetail) return;
    if (['add', 'replace'].includes(revisionEvidenceAction) && !revisionEvidenceFile) {
      alert('Pilih berkas bukti JPG, JPEG, PNG, atau PDF terlebih dahulu.');
      return;
    }
    setIsSavingRevisionDraft(true);
    try {
      await saveLogbookRevisionDraft(selectedLogbookDetail.id, await buildRevisionPayload());
      const refreshed = await fetchLogbooks(currentUserId);
      const updatedRows = refreshed.data || [];
      const updatedEntry = updatedRows.find((row) => Number(row.id) === Number(selectedLogbookDetail.id));
      if (updatedEntry) setSelectedLogbookDetail(updatedEntry);
      setRevisionEvidenceFile(null);
      setRevisionEvidenceAction('keep');
      await loadLogbooks();
      showToast('Perubahan berhasil disimpan. Status logbook tetap Revisi.');
    } catch (err) {
      console.error('saveRevisionDraft error:', err);
      alert('Gagal menyimpan perubahan: ' + err.message);
    } finally {
      setIsSavingRevisionDraft(false);
    }
  };

  const handleResubmitRevision = async (e) => {
    e.preventDefault();
    if (!selectedLogbookDetail) return;
    if (revisionStoredEvidenceLoading) {
      alert('Tunggu sampai pemeriksaan bukti lama selesai.');
      return;
    }
    if (!revisionEvidenceFile && !Object.keys(revisionStoredEvidencePreviews).length) {
      alert('Bukti lama tidak tersedia. Unggah kembali bukti JPG, JPEG, PNG, atau PDF sebelum mengirim revisi.');
      return;
    }
    if (['add', 'replace'].includes(revisionEvidenceAction) && !revisionEvidenceFile) {
      alert('Pilih berkas bukti JPG, JPEG, PNG, atau PDF terlebih dahulu.');
      return;
    }
    setIsSubmittingRevision(true);
    try {
      await submitLogbookRevision(selectedLogbookDetail.id, await buildRevisionPayload());

      setSelectedStatusTab('Semua');
      setSelectedLogbookDetail(null);
      setRevisionDraft(null);
      setRevisionEvidenceFile(null);
      setRevisionEvidenceAction('keep');

      showToast('✓ Revisi logbook berhasil dikirim ulang ke peninjau!');
      await loadLogbooks(); // Reload data dari DB
    } catch (err) {
      console.error('submitRevision error:', err);
      alert('Gagal mengirim revisi: ' + err.message);
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  const closeRevisionModal = () => {
    setSelectedLogbookDetail(null);
    setRevisionDraft(null);
    setRevisionEvidenceFile(null);
    setRevisionEvidenceAction('keep');
    setLargeRevisionPreviewId(null);
  };

  const handleSelectRevisionEvidenceFile = (file) => {
    if (!file) return;
    if (!getEvidenceMimeType(file)) {
      alert('Berkas bukti harus berupa JPG, JPEG, PNG, atau PDF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran berkas maksimal 5 MB.');
      return;
    }
    setRevisionEvidenceFile(file);
    setRevisionEvidenceAction('replace');
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

  const validatorText = isDosen || isTendik
    ? 'Divalidasi oleh Kasi'
    : isKasi
      ? 'Divalidasi oleh Kepala Kantor'
      : isKepalaKantor
        ? 'Divalidasi oleh Dekan / Wakil Dekan'
        : 'Divalidasi oleh atasan yang berwenang';

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
          {!isDekan && <button
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
          </button>}

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
            <span>{isDekan ? 'Logbook Bawahan' : '2. Logbook Bawahan'}</span>
            {(isDekan ? dekanLogbooks.filter((item) => item.statusKey === 'review').length : subordinateSummary.antrean) > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'bawahan' ? 'bg-amber-400 text-gray-900' : 'bg-amber-100 text-amber-800'
              }`}>
                {isDekan ? dekanLogbooks.filter((item) => item.statusKey === 'review').length : subordinateSummary.antrean} Antrean
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
                  {subordinateDetailData.logbook.statusKey === 'sah' && (
                    <span className="px-3 py-1 border-2 border-emerald-700 rounded-md text-emerald-800 font-black tracking-[0.15em] rotate-[-2deg]">TERVALIDASI</span>
                  )}
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
                      <div className="text-[11px] text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {subordinateDetailData.logbook.email_pegawai && <span>{subordinateDetailData.logbook.email_pegawai}</span>}
                        {subordinateDetailData.logbook.nidn && <span>NIDN: {subordinateDetailData.logbook.nidn}</span>}
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
                    <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 font-medium">
                      Kategori: <strong className="text-gray-800">{subordinateDetailData.logbook.kategori || '—'}</strong>
                    </div>
                    {subordinateDetailData.logbook.periode && (
                      <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 font-medium">
                        Periode: <strong className="text-gray-800">{subordinateDetailData.logbook.periode}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rincian kegiatan logbook */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="text-[11px] font-extrabold tracking-wider text-gray-400 uppercase">INFORMASI KEGIATAN</div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#0B1C30] mt-1.5 leading-snug">
                    {subordinateDetailData.logbook.judul || 'Kegiatan Logbook'}
                  </h2>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-[11px] font-bold tracking-wider text-gray-400 uppercase mb-1">Deskripsi Tugas</div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {subordinateDetailData.logbook.uraian || 'Tidak ada deskripsi tugas.'}
                    </p>
                  </div>
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
                      {(subordinateDetailData.logbook.kuantitas || subordinateDetailData.logbook.satuan) && (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {subordinateDetailData.logbook.kuantitas && <span className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-gray-700">Kuantitas: <strong>{subordinateDetailData.logbook.kuantitas}</strong></span>}
                          {subordinateDetailData.logbook.satuan && <span className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-gray-700">Satuan: <strong>{subordinateDetailData.logbook.satuan}</strong></span>}
                        </div>
                      )}
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
                        const previewType = getEvidencePreviewType(file);
                        const isImage = previewType === 'image';
                        const isPdf = previewType === 'pdf';
                        const evidenceUrl = getLogbookEvidenceUrl(subordinateDetailData.logbook.id, file.id_bukti, currentUserId);
                        const isUnavailable = Boolean(unavailableEvidenceIds[file.id_bukti]) || (!isImage && !isPdf);
                        return (
                          <div
                            key={file.id_bukti}
                            className="bg-[#F8FAFC] border border-gray-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs hover:border-gray-300 transition-all"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {isImage && !unavailableEvidenceIds[file.id_bukti] ? (
                                <img src={evidenceUrl} alt={`Bukti kegiatan ${file.nama_berkas}`} onError={() => setUnavailableEvidenceIds((current) => ({ ...current, [file.id_bukti]: true }))} className="w-20 h-16 object-cover rounded-lg border border-gray-200 bg-white shrink-0" />
                              ) : (
                                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${isUnavailable ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                  {isUnavailable ? '!' : isPdf ? 'PDF' : 'IMG'}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-bold text-gray-800 truncate" title={file.nama_berkas}>
                                  {file.nama_berkas}
                                </div>
                                <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                                  <span>{file.ukuran_berkas || 'Ukuran tidak tersedia'}</span>
                                  <span>•</span>
                                  <span className="truncate">{isUnavailable ? 'Bukti kegiatan belum tersedia.' : (file.keterangan || (isPdf ? 'Dokumen PDF tersimpan' : 'Bukti gambar tersimpan'))}</span>
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
                              <span>Pratinjau Bukti</span>
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

                {selectedPreviewFile && (() => {
                  const previewType = getEvidencePreviewType(selectedPreviewFile);
                  const previewUrl = getLogbookEvidenceUrl(subordinateDetailData.logbook.id, selectedPreviewFile.id_bukti, currentUserId);
                  return (
                    <section className="rounded-2xl border border-blue-200 bg-blue-50/60 overflow-hidden" aria-label="Pratinjau bukti kegiatan">
                      <div className="px-4 sm:px-5 py-3 bg-white border-b border-blue-100 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900">Pratinjau Bukti Kegiatan</h3>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{selectedPreviewFile.nama_berkas}</p>
                        </div>
                        <button type="button" onClick={() => setSelectedPreviewFile(null)} className="shrink-0 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50">Tutup Pratinjau</button>
                      </div>
                      <div className="min-h-64 p-3 sm:p-5 flex items-center justify-center bg-slate-100">
                        {previewType === 'image' && !previewLoadError ? (
                          <img
                            src={previewUrl}
                            alt={`Bukti kegiatan ${selectedPreviewFile.nama_berkas}`}
                            onError={() => { setPreviewLoadError(true); setUnavailableEvidenceIds((current) => ({ ...current, [selectedPreviewFile.id_bukti]: true })); }}
                            className="block max-w-full max-h-[75vh] object-contain rounded-xl bg-white shadow-md"
                          />
                        ) : previewType === 'pdf' && !previewLoadError ? (
                          <iframe src={previewUrl} title={`Pratinjau ${selectedPreviewFile.nama_berkas}`} onError={() => { setPreviewLoadError(true); setUnavailableEvidenceIds((current) => ({ ...current, [selectedPreviewFile.id_bukti]: true })); }} className="w-full h-[75vh] min-h-[600px] bg-white rounded-xl border border-gray-200" />
                        ) : previewLoadError ? (
                          <div className="max-w-md text-center bg-white rounded-xl border border-amber-200 p-6">
                            <p className="font-semibold text-gray-800">Bukti kegiatan belum tersedia di penyimpanan backend.</p>
                            <p className="text-xs text-gray-500 mt-2">Pemilik logbook perlu mengunggah ulang gambar JPG, JPEG, PNG, atau PDF.</p>
                          </div>
                        ) : (
                          <div className="max-w-md text-center bg-white rounded-xl border border-gray-200 p-6">
                            <p className="font-semibold text-gray-800">Pratinjau langsung tidak tersedia untuk format ini.</p>
                            {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex mt-3 text-xs font-bold text-blue-700 underline">Buka berkas di tab baru</a>}
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })()}

                {/* SECTION: ACTION BUTTONS (Minta Perbaikan / Revisi & Validasi dengan TTE Digital) */}
                {!subordinateDetailData.logbook.canReview && subordinateDetailData.logbook.status === 'perlu_revisi' && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    Permintaan revisi telah dikirim. Logbook menunggu perbaikan dari pemiliknya.
                  </p>
                )}
                {!subordinateDetailData.logbook.canReview && subordinateDetailData.logbook.status !== 'perlu_revisi' && subordinateDetailData.logbook.nama_peninjau_aktif && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    Logbook sedang menunggu pemeriksaan dari {subordinateDetailData.logbook.nama_peninjau_aktif}.
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => handleDetailAction('revisi')}
                    disabled={isSubmittingDetailReview || !subordinateDetailData.logbook.canReview}
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
                    disabled={isSubmittingDetailReview || !subordinateDetailData.logbook.canReview}
                    className="px-6 py-2.5 rounded-xl bg-[#0F5132] hover:bg-[#14532D] text-white font-bold text-xs sm:text-sm shadow-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <span>{isDekan ? 'Sahkan Logbook' : 'Validasi Logbook'}</span>
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
                <h2 className="text-base font-bold text-[#0B1C30]">{subordinateStatusTab === 'Sudah Divalidasi' ? 'Logbook Tervalidasi' : isDekan ? 'Logbook dalam Kewenangan Validasi' : 'Antrean Otorisasi'}</h2>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E0E7FF] text-[#3730A3] border border-[#C7D2FE]">
                  {displayedSubordinateLogbooks.length} Berkas
                </span>
              </div>

              {!isDekan && <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-500">Periode: <strong>{periode}</strong></span>
              </div>}
            </div>

            {isDekan && (
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <input
                  type="search"
                  value={dekanSearch}
                  onChange={(event) => setDekanSearch(event.target.value)}
                  placeholder="Cari nama bawahan atau nama tugas/kegiatan"
                  aria-label="Cari logbook berdasarkan nama bawahan atau tugas"
                  className="sm:col-span-2 xl:col-span-3 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#0F5132]"
                />
                <select value={dekanStatusFilter} onChange={(event) => setDekanStatusFilter(event.target.value)} aria-label="Filter status logbook" className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-white">
                  {['Semua', 'Menunggu Validasi', 'Revisi', 'Tervalidasi'].map((status) => <option key={status}>{status}</option>)}
                </select>
                <select value={dekanDivisionFilter} onChange={(event) => setDekanDivisionFilter(event.target.value)} aria-label="Filter divisi" className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-white">
                  <option value="Semua">Semua Divisi</option>
                  {dekanDivisions.map((division) => <option key={division.id} value={String(division.id)}>{division.name}</option>)}
                </select>
                <select value={dekanOwnerFilter} onChange={(event) => setDekanOwnerFilter(event.target.value)} aria-label="Filter nama bawahan" className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-white">
                  <option value="Semua">Semua Nama Bawahan</option>
                  {dekanOwners.map((owner) => <option key={owner.id} value={String(owner.id)}>{owner.name}</option>)}
                </select>
                <label className="flex items-center gap-2 text-[11px] text-gray-500">
                  Tanggal
                  <input type="date" value={dekanDateFilter} onChange={(event) => setDekanDateFilter(event.target.value)} className="min-w-0 flex-1 px-2.5 py-2 border border-gray-200 rounded-xl text-xs text-gray-700" />
                </label>
                <label className="flex items-center gap-2 text-[11px] text-gray-500">
                  Periode
                  <input type="month" value={dekanPeriodFilter} onChange={(event) => setDekanPeriodFilter(event.target.value)} className="min-w-0 flex-1 px-2.5 py-2 border border-gray-200 rounded-xl text-xs text-gray-700" />
                </label>
                <button type="button" onClick={() => { setDekanSearch(''); setDekanStatusFilter('Semua'); setDekanDivisionFilter('Semua'); setDekanOwnerFilter('Semua'); setDekanDateFilter(''); setDekanPeriodFilter(''); }} className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200">
                  Hapus Filter
                </button>
              </div>
            )}

            {/* Pemilih / Info Bawahan Tanggung Jawab Langsung (Terikat Relasi Database) */}
            {!isDekan && (
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

              {!isDekan && subordinates.length > 1 && (
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
            )}

            {/* Filter status validasi logbook bawahan */}
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-2xs" role="tablist" aria-label="Filter status validasi logbook bawahan">
              {[
                { label: 'Menunggu Verifikasi', count: subordinatePendingCount },
                { label: 'Sudah Divalidasi', count: subordinateValidatedCount },
              ].map(({ label, count }) => {
                const active = subordinateStatusTab === label;
                return (
                  <button key={label} type="button" role="tab" aria-selected={active} onClick={() => setSubordinateStatusTab(label)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors ${active ? 'bg-[#0F5132] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <span>{label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Daftar Kartu Logbook Bawahan (Sesuai Desain Gambar User) */}
            {(isDekan ? dekanLogbookLoading : subordinateLoading) ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200 animate-pulse h-36" />
                ))}
              </div>
            ) : (isDekan ? dekanLogbookError : subordinateError) ? (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {isDekan ? dekanLogbookError : subordinateError}
              </div>
            ) : displayedSubordinateLogbooks.length === 0 && subordinateStatusTab !== 'Sudah Divalidasi' ? (
              <div className="bg-white rounded-2xl p-10 border border-gray-200 text-center">
                <span className="text-3xl">📋</span>
                <p className="text-sm font-bold text-gray-700 mt-2">{isDekan ? 'Tidak ada logbook yang cocok dengan pencarian atau filter' : subordinateStatusTab === 'Sudah Divalidasi' ? 'Belum ada logbook yang disahkan (TTE)' : 'Tidak ada berkas logbook untuk bawahan ini'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{isDekan ? 'Coba ubah kombinasi filter atau kata kunci.' : subordinateStatusTab === 'Sudah Divalidasi' ? 'Logbook yang sudah disahkan pada periode ini akan tampil di sini.' : 'Bawahan belum mengajukan logbook atau tidak ada data yang cocok dengan periode.'}</p>
              </div>
            ) : subordinateStatusTab === 'Sudah Divalidasi' ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-end sm:justify-between">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                    Filter bulan dan tahun
                    <input type="month" value={subordinateValidatedPeriod} onChange={(event) => setSubordinateValidatedPeriod(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700" />
                  </label>
                  <button type="button" disabled={!displayedSubordinateLogbooks.length} onClick={() => {
                    const ownerName = isDekan ? '' : subordinateProfile?.name || subordinates.find((sub) => Number(sub.id_pengguna) === Number(selectedSubordinateId))?.nama || 'Bawahan';
                    const exportRows = displayedSubordinateLogbooks
                      .filter((item) => item.statusKey === 'sah')
                      .map((item) => ({ ...item, namaBawahan: item.namaBawahan || ownerName }));
                    exportLogbooksXlsx(exportRows, false, 'Logbook_Bawahan_Tervalidasi', null, subordinateValidatedPeriod || (isDekan ? dekanPeriodFilter : '') || 'Semua Periode', currentUserId);
                  }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F5132] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#14532D] disabled:cursor-not-allowed disabled:opacity-50">
                    <span aria-hidden="true">⬇</span>Download Excel
                  </button>
                </div>
              <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white">
                <table className="w-full min-w-[1360px] table-fixed border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-[#006B68] text-[11px] font-bold text-white">
                      <th className="w-[4%] border border-[#8bb8b6] px-2 py-3 text-center">No</th>
                      <th className="w-[13%] border border-[#8bb8b6] px-3 py-3">Nama Pengirim</th>
                      <th className="w-[12%] border border-[#8bb8b6] px-3 py-3">Hari/Tanggal</th>
                      <th className="w-[7.5%] border border-[#8bb8b6] px-2 py-3 text-center">Waktu Mulai</th>
                      <th className="w-[7.5%] border border-[#8bb8b6] px-2 py-3 text-center">Waktu Selesai</th>
                      <th className="w-[22%] border border-[#8bb8b6] px-3 py-3">Uraian Kegiatan/Pekerjaan</th>
                      <th className="w-[13%] border border-[#8bb8b6] px-3 py-3">Hasil/Output</th>
                      <th className="w-[6%] border border-[#8bb8b6] px-2 py-3 text-center">Kuantitas</th>
                      <th className="w-[6%] border border-[#8bb8b6] px-2 py-3 text-center">Satuan</th>
                      <th className="w-[9%] border border-[#8bb8b6] px-3 py-3">Keterangan/Link Bukti</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {displayedSubordinateLogbooks.length === 0 ? (
                      <tr><td colSpan="10" className="border border-gray-200 px-4 py-10 text-center text-gray-500">Tidak ada logbook tervalidasi pada bulan dan tahun yang dipilih.</td></tr>
                    ) : displayedSubordinateLogbooks.map((item, index) => {
                      const timeParts = String(item.waktu || '').match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
                      return (
                        <tr key={item.id} className="cursor-pointer transition-colors hover:bg-teal-50/60" onClick={() => openSubordinateDetail(item.id)}>
                          <td className="border border-gray-200 px-2 py-3 text-center align-top">{index + 1}</td>
                          <td className="border border-gray-200 px-3 py-3 align-top font-semibold text-gray-800">{item.namaBawahan || '—'}</td>
                          <td className="border border-gray-200 px-3 py-3 align-top font-medium text-gray-800">{item.tanggal || '—'}</td>
                          <td className="border border-gray-200 px-2 py-3 text-center align-top">{timeParts?.[1] || '—'}</td>
                          <td className="border border-gray-200 px-2 py-3 text-center align-top">{timeParts?.[2] || '—'}</td>
                          <td className="border border-gray-200 px-3 py-3 align-top"><div className="font-semibold text-gray-900">{item.judul || item.kategori}</div><p className="mt-1 leading-relaxed text-gray-600">{item.uraian || '—'}</p>{item.nomorSk && <div className="mt-1 text-[10px] text-gray-400">{item.nomorSk}</div>}</td>
                          <td className="border border-gray-200 px-3 py-3 align-top">{item.outputShort || item.hasil || item.targetOutput || '—'}</td>
                          <td className="border border-gray-200 px-2 py-3 text-center align-top">—</td>
                          <td className="border border-gray-200 px-2 py-3 text-center align-top">{item.berkasJenis === 'application/pdf' || /\.pdf$/i.test(item.berkasNama || '') ? 'PDF' : ['image/jpeg', 'image/png'].includes(item.berkasJenis) || /\.(jpe?g|png)$/i.test(item.berkasNama || '') ? 'Gambar' : '—'}</td>
                          <td className="border border-gray-200 px-3 py-3 align-top">
                            {item.berkasNama ? <button type="button" onClick={(event) => { event.stopPropagation(); openSubordinateDetail(item.id); }} className="break-words text-left font-semibold text-blue-700 hover:text-blue-900">{item.berkasNama}</button> : <span className="text-gray-500">Tidak ada bukti</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedSubordinateLogbooks.map((item) => {
                  const selectedSubordinate = subordinates.find(s => Number(s.id_pengguna) === Number(selectedSubordinateId));
                  const nameForInitials = isDekan
                    ? item.namaBawahan
                    : (subordinateProfile?.name || selectedSubordinate?.nama || 'Bawahan');
                  const positionForCard = isDekan ? item.jabatanBawahan : (subordinateProfile?.position || selectedSubordinate?.nama_jabatan);
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
                              {positionForCard}{isDekan ? ` • ${item.divisi}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
                            {isDekan ? item.statusLabel : `${subordinateProfile?.realisasiPersen || 98}% Realisasi`}
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
                      {!isDekan && <div className="my-3">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 mb-1">
                          <span>Beban Kerja &amp; Kelengkapan Eviden</span>
                          <span className="text-[#0F5132] font-bold">Lengkap</span>
                        </div>
                        <div className="w-full h-2.5 bg-[#DCFCE7] rounded-full overflow-hidden">
                          <div className="h-full bg-[#0F5132] rounded-full w-full transition-all duration-500" />
                        </div>
                      </div>}

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
                                <span>Menunggu Validasi</span>
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
                                <span>Tervalidasi</span>
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
                                <span>Revisi</span>
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
                <span className="text-[10px] font-bold tracking-wider text-emerald-800 uppercase">TERVALIDASI</span>
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
                <span className="text-[10px] font-bold tracking-wider text-amber-800 uppercase">MENUNGGU VALIDASI</span>
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
                  REVISI
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
                onClick={handleExportPersonalLogbooks}
                disabled={isExportingPersonalLogbooks || !currentUserId}
                className="px-4 py-2 rounded-xl bg-[#F8FAFC] hover:bg-gray-100 text-gray-700 text-xs font-semibold flex items-center gap-2 border border-gray-200 cursor-pointer transition-colors self-start sm:self-auto"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>{isExportingPersonalLogbooks ? 'Menyiapkan Excel...' : isDosen ? 'Ekspor Rekap BKD (.XLSX)' : 'Ekspor Rekap SKP (.XLSX)'}</span>
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
                        {tab === 'Review' ? 'Menunggu Validasi' : tab}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Table View */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] table-fixed text-left border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-[#006B68] text-white text-[11px] font-bold">
                    <th className="w-[4%] border border-[#8bb8b6] py-3 px-2 text-center">No</th>
                    <th className="w-[13%] border border-[#8bb8b6] py-3 px-3">Hari/Tanggal</th>
                    <th className="w-[8%] border border-[#8bb8b6] py-3 px-2 text-center">Waktu Mulai</th>
                    <th className="w-[8%] border border-[#8bb8b6] py-3 px-2 text-center">Waktu Selesai</th>
                    <th className="w-[25%] border border-[#8bb8b6] py-3 px-3">Uraian Kegiatan/Pekerjaan</th>
                    <th className="w-[15%] border border-[#8bb8b6] py-3 px-3">Hasil/Output</th>
                    <th className="w-[7%] border border-[#8bb8b6] py-3 px-2 text-center">Kuantitas</th>
                    <th className="w-[8%] border border-[#8bb8b6] py-3 px-2 text-center">Satuan</th>
                    <th className="w-[12%] border border-[#8bb8b6] py-3 px-3">Keterangan/Link Bukti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {loading ? (
                    /* Loading skeleton */
                    [1, 2, 3].map((i) => (
                      <tr key={i}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((j) => (
                          <td key={j} className="border border-gray-200 py-4 px-3">
                            <div className="h-4 bg-gray-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredLogbooks.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="border border-gray-200 py-14 text-center">
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
                    displayedLogbooks.map((item, index) => {
                      const timeParts = String(item.waktu || '').match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
                      return (
                        <tr key={item.id} className={`${item.statusKey === 'sah' ? 'bg-green-50 hover:bg-green-100' : item.statusKey === 'revisi' ? 'bg-rose-100 hover:bg-rose-200' : 'bg-amber-50 hover:bg-amber-100'} transition-colors cursor-pointer`} onClick={() => setSelectedLogbookDetail(item)}>
                          <td className={`border border-gray-200 py-3 px-2 text-center align-top ${item.statusKey === 'revisi' ? 'border-l-4 border-l-rose-600 font-bold text-rose-900' : ''}`}>{currentStartIndex + index + 1}</td>
                          <td className="border border-gray-200 py-3 px-3 align-top font-medium text-gray-800">{item.tanggal || '—'}</td>
                          <td className="border border-gray-200 py-3 px-2 text-center align-top">{timeParts?.[1] || '—'}</td>
                          <td className="border border-gray-200 py-3 px-2 text-center align-top">{timeParts?.[2] || '—'}</td>
                          <td className="border border-gray-200 py-3 px-3 align-top"><div className="font-semibold text-gray-900">{item.judul}</div><p className="mt-1 text-gray-600 leading-relaxed">{item.uraian}</p>{item.nomorSk && <div className="mt-1 text-[10px] text-gray-400">{item.nomorSk}</div>}</td>
                          <td className="border border-gray-200 py-3 px-3 align-top"><div className="font-medium text-gray-800">{item.outputShort || item.targetOutput || '—'}</div>{item.statusKey === 'revisi' ? <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedLogbookDetail(item); }} className="mt-2 inline-flex rounded-full border border-rose-300 bg-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-900 hover:bg-rose-300">Revisi</button> : <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${item.statusKey === 'sah' ? 'border-rose-200 bg-rose-100 text-rose-800' : 'border-amber-300 bg-amber-100 text-amber-900'}`}>{item.statusKey === 'sah' ? 'Tervalidasi' : 'Menunggu Validasi'}</div>}</td>
                          <td className="border border-gray-200 py-3 px-2 text-center align-top">{item.kuantitas || '—'}</td>
                          <td className="border border-gray-200 py-3 px-2 text-center align-top">{item.satuan || (item.berkasJenis === 'application/pdf' || /\.pdf$/i.test(item.berkasNama || '') ? 'PDF' : ['image/jpeg', 'image/png'].includes(item.berkasJenis) || /\.(jpe?g|png)$/i.test(item.berkasNama || '') ? 'Gambar' : '—')}</td>
                          <td className="border border-gray-200 py-3 px-3 align-top"><button type="button" aria-label={`Lihat preview bukti ${item.berkasNama || 'logbook'}`} onClick={(e) => { e.stopPropagation(); setSelectedLogbookDetail(item); }} className="inline-flex max-w-full items-center gap-1.5 text-left text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900 text-[11px] font-semibold"><span>Bukti:</span><span className="break-words">{item.berkasNama || 'Tidak ada bukti'}</span></button></td>
                        </tr>
                      );
                    })
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
                      handleSelectEvidenceFile(e.dataTransfer.files?.[0]);
                    }}
                    onClick={() => document.getElementById('logbook-file-input').click()}
                    className={`md:col-span-7 bg-[#F4F8FC] rounded-2xl p-5 border transition-all flex flex-col items-center justify-center text-center cursor-pointer ${isDragging ? 'border-[#0F5132] bg-[#E8F4EC]' : 'border-dashed border-[#C5D7F2] hover:border-[#0F5132]/60'}`}
                  >
                    <input
                      id="logbook-file-input"
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      onChange={(e) => {
                        handleSelectEvidenceFile(e.target.files?.[0]);
                        e.target.value = '';
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
                    <p className="text-[11px] text-gray-400 mt-1">Format JPG, JPEG, PNG, PDF • Maksimal 5 MB</p>
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

                    {/* Preview gambar sebelum disimpan */}
                    {evidenFile ? (
                      <div className="mt-3 bg-white rounded-xl p-2.5 border border-gray-100 shadow-2xs">
                        {evidenPreviewUrl && (getEvidenceMimeType(evidenFile) === 'application/pdf'
                          ? <iframe src={evidenPreviewUrl} title="Pratinjau PDF bukti kegiatan" className="w-full h-48 rounded-lg bg-slate-50 mb-2 border border-gray-200" />
                          : <img src={evidenPreviewUrl} alt="Pratinjau bukti kegiatan" className="w-full max-h-40 object-contain rounded-lg bg-slate-50 mb-2" />)}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-gray-800 truncate" title={evidenFile.name}>{evidenFile.name}</span>
                            <span className="text-[10px] text-gray-400 font-medium">{(evidenFile.size / (1024 * 1024)).toFixed(2)} MB • Pratinjau siap</span>
                          </div>
                          <button type="button" onClick={() => { setEvidenFile(null); setEvidenTitle(''); }} className="text-gray-400 hover:text-red-500 p-1 rounded-md text-xs font-bold cursor-pointer transition-colors" title="Hapus berkas">×</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 py-3 px-3 bg-white/60 rounded-xl border border-dashed border-gray-200 text-center text-[11px] text-gray-400">
                        Pilih gambar untuk melihat pratinjau sebelum menyimpan.
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
      {selectedLogbookDetail?.statusKey === 'revisi' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl animate-scale-up sm:max-w-3xl">
            <div className="flex items-center justify-between bg-[#0F5132] px-6 py-4 text-white">
              <div>
                <h3 className="text-base font-bold">Revisi Logbook Kegiatan</h3>
                <p className="mt-0.5 text-xs text-emerald-200">Perbaiki data logbook sesuai catatan atasan, lalu kirim kembali untuk validasi.</p>
              </div>
              <button type="button" onClick={closeRevisionModal} className="cursor-pointer p-1 text-xl font-bold text-emerald-100 hover:text-white" aria-label="Tutup form revisi">×</button>
            </div>
            <form onSubmit={handleResubmitRevision} className="max-h-[80vh] space-y-4 overflow-y-auto p-6">
              <div className="flex flex-col gap-1 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold text-emerald-900">Revisi untuk Pengguna: <strong>{user?.name || 'Pegawai'}</strong> <span className="font-normal">(ID Logbook #{selectedLogbookDetail.id})</span></span>
                <span className="font-medium text-emerald-700">{user?.position || user?.roleName || 'Pegawai'} ({user?.username || '—'})</span>
              </div>
              {selectedLogbookDetail.catatanReviewer && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><strong>Catatan atasan:</strong> {selectedLogbookDetail.catatanReviewer}</div>}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div><label className="mb-1 block text-xs font-bold text-gray-700">Tanggal Kegiatan</label><input type="date" required value={revisionDraft?.tglKegiatan || ''} onChange={(event) => setRevisionDraft((draft) => ({ ...draft, tglKegiatan: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs" /></div>
                <div><label className="mb-1 block text-xs font-bold text-gray-700">Jam Mulai</label><input type="time" required value={revisionDraft?.waktuMulai || ''} onChange={(event) => setRevisionDraft((draft) => ({ ...draft, waktuMulai: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs" /></div>
                <div><label className="mb-1 block text-xs font-bold text-gray-700">Jam Selesai</label><input type="time" required value={revisionDraft?.waktuSelesai || ''} onChange={(event) => setRevisionDraft((draft) => ({ ...draft, waktuSelesai: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs" /></div>
              </div>

              <div><label className="mb-1 block text-xs font-bold text-gray-700">Kategori Kegiatan</label><select required value={revisionDraft?.kategori || ''} onChange={(event) => setRevisionDraft((draft) => ({ ...draft, kategori: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs">
                {revisionDraft?.kategori && !['Pengajaran', 'Penelitian', 'Pengabdian', 'Kepanitiaan SK', 'Administrasi', 'Tugas Tambahan'].includes(revisionDraft.kategori) && <option value={revisionDraft.kategori}>{revisionDraft.kategori}</option>}
                <option value="Pengajaran">Pengajaran (Perkuliahan/Praktikum/Bimbingan)</option><option value="Penelitian">Penelitian (Riset/Publikasi/Jurnal)</option><option value="Pengabdian">Pengabdian Kepada Masyarakat</option><option value="Kepanitiaan SK">Kepanitiaan SK Fakultas / Universitas</option><option value="Administrasi">Administrasi / Operasional Layanan</option><option value="Tugas Tambahan">Tugas Tambahan Struktural / Non-Struktural</option>
              </select></div>
              <div><label className="mb-1 block text-xs font-bold text-gray-700">Judul Butir Tugas / Kegiatan</label><input type="text" required maxLength={255} value={revisionDraft?.judul || ''} onChange={(event) => setRevisionDraft((draft) => ({ ...draft, judul: event.target.value }))} placeholder="Misal: Perkuliahan IF3102 Sistem Terdistribusi Pertemuan 12" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs" /></div>
              <div><label className="mb-1 block text-xs font-bold text-gray-700">Dasar Penugasan / Nomor SK (Opsional)</label><input type="text" maxLength={255} value={revisionDraft?.nomorSk || ''} onChange={(event) => setRevisionDraft((draft) => ({ ...draft, nomorSk: event.target.value }))} placeholder="Misal: SK Dekan No. 142/UN16.08/KP/2024 atau Jadwal Kuliah" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs" /></div>
              <div><label className="mb-1 block text-xs font-bold text-gray-700">Uraian Kegiatan Rinci</label><textarea required rows="3" value={revisionDraft?.uraian || ''} onChange={(event) => setRevisionDraft((draft) => ({ ...draft, uraian: event.target.value }))} placeholder="Tuliskan ringkasan substansi aktivitas yang dilaksanakan..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs" /></div>
              <div><label className="mb-1 block text-xs font-bold text-gray-700">Target / Output Capaian</label><input type="text" value={revisionDraft?.target || ''} onChange={(event) => setRevisionDraft((draft) => ({ ...draft, target: event.target.value }))} placeholder="Misal: BAP & Presensi Mahasiswa, 1 Berita Acara, Draf Bab 4" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs" /></div>

              <div>
                <label className="mb-2 block text-xs font-bold text-gray-800">Bukti Pendukung Kinerja (Eviden)</label>
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-12">
                  <div onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); handleSelectRevisionEvidenceFile(event.dataTransfer.files?.[0]); }} onClick={() => document.getElementById('revision-logbook-file-input')?.click()} className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border p-5 text-center transition-all md:col-span-7 ${isDragging ? 'border-[#0F5132] bg-[#E8F4EC]' : 'border-dashed border-[#C5D7F2] bg-[#F4F8FC] hover:border-[#0F5132]/60'}`}>
                    <input id="revision-logbook-file-input" type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onClick={(event) => event.stopPropagation()} onChange={(event) => { handleSelectRevisionEvidenceFile(event.target.files?.[0]); event.target.value = ''; }} />
                    <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-[#E6F4EA] text-xl text-[#0F5132]">⇧</div>
                    <div className="text-xs text-gray-700"><span className="font-bold">Ganti File: tarik berkas ke sini atau </span><span className="font-bold text-[#0F5132] underline">Pilih File</span></div>
                    <p className="mt-1 text-[11px] text-gray-400">Format JPG, JPEG, PNG, PDF • Maksimal 5 MB</p>
                  </div>
                  <div className="flex flex-col justify-between rounded-2xl border border-[#E2ECF8] bg-[#F4F8FC] p-3.5 md:col-span-5">
                    <div><label className="mb-1.5 block text-xs font-semibold text-gray-800">Keterangan / Judul Eviden</label><input type="text" maxLength={255} value={revisionDraft?.keterangan || ''} onChange={(event) => setRevisionDraft((draft) => ({ ...draft, keterangan: event.target.value }))} placeholder="Judul eviden..." className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 shadow-2xs placeholder-gray-400 focus:border-[#0F5132] focus:outline-none" /></div>
                    {revisionEvidenceFile ? <div className="mt-3 rounded-xl border border-gray-100 bg-white p-2.5 shadow-2xs">
                      {getEvidenceMimeType(revisionEvidenceFile) === 'application/pdf' ? <iframe src={revisionEvidencePreviewUrl} title="Pratinjau PDF bukti revisi" className="mb-2 h-40 w-full rounded-lg border border-gray-200 bg-slate-50" /> : <img src={revisionEvidencePreviewUrl} alt="Pratinjau bukti revisi" className="mb-2 max-h-40 w-full rounded-lg bg-slate-50 object-contain" />}
                      <div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-bold text-gray-800" title={revisionEvidenceFile.name}>{revisionEvidenceFile.name}</span><button type="button" onClick={() => { setRevisionEvidenceFile(null); setRevisionEvidenceAction('keep'); }} className="rounded-md p-1 text-xs font-bold text-gray-400 hover:text-red-500" aria-label="Batalkan pilihan bukti baru">×</button></div>
                      <span className="text-[10px] text-gray-400">Pratinjau siap • bukti lama tetap tersimpan</span>
                    </div> : <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-white/60 px-3 py-3 text-center text-[11px] text-gray-400">Bukti lama akan dipertahankan jika tidak memilih file baru.</div>}
                  </div>
                  <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-3.5 md:col-span-12" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-800">Bukti yang sudah tersimpan</span>
                      {revisionStoredEvidenceLoading && <span className="text-[11px] text-gray-500">Memuat bukti...</span>}
                    </div>
                    {revisionStoredEvidenceError && <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{revisionStoredEvidenceError}</p>}
                    {!revisionStoredEvidenceLoading && !revisionStoredEvidenceError && revisionStoredEvidence.length === 0 && <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Tidak ada catatan bukti pada logbook ini. Unggah kembali file bukti sebelum mengirim revisi.</p>}
                    {revisionStoredEvidence.map((file) => {
                      const preview = revisionStoredEvidencePreviews[file.id_bukti];
                      const previewError = revisionStoredEvidenceErrors[file.id_bukti];
                      return (
                        <div key={file.id_bukti} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-[#F8FAFC] p-3 sm:flex-row sm:items-center">
                          <div className="flex h-20 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white sm:w-28">
                            {preview?.contentType.startsWith('image/') ? <img src={preview.url} alt={file.nama_berkas} className="h-full w-full object-contain" /> : preview?.contentType === 'application/pdf' ? <span className="font-black text-red-700">PDF</span> : <span className="text-xs font-bold text-gray-400">BUKTI</span>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="break-all text-xs font-semibold text-gray-800">{file.nama_berkas}</div>
                            <div className="mt-1 text-[11px] text-gray-500">{file.jenis_berkas} · {file.tgl_unggah || 'Tanggal unggah tidak tersedia'}</div>
                            {previewError ? <p className="mt-1 text-[11px] font-medium text-rose-700">File lama perlu diunggah kembali: {previewError}</p> : <p className="mt-1 text-[11px] text-gray-500">{file.keterangan || 'Bukti kegiatan tersimpan'}</p>}
                          </div>
                          {preview && <button type="button" onClick={() => setLargeRevisionPreviewId(file.id_bukti)} className="shrink-0 rounded-lg border border-[#0F5132] px-3 py-2 text-xs font-semibold text-[#0F5132] hover:bg-emerald-50">Lihat lebih besar</button>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                <button type="button" onClick={closeRevisionModal} className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={isSubmittingRevision} className="rounded-lg bg-[#0F5132] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#14532D] disabled:opacity-60">{isSubmittingRevision ? 'Mengirim...' : 'Kirim Kembali'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {largeRevisionPreviewId && selectedLogbookDetail?.statusKey === 'revisi' && (() => {
        const file = revisionStoredEvidence.find((item) => Number(item.id_bukti) === Number(largeRevisionPreviewId));
        const preview = revisionStoredEvidencePreviews[largeRevisionPreviewId];
        if (!file || !preview) return null;
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 sm:p-6" onClick={() => setLargeRevisionPreviewId(null)}>
            <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
                <span className="break-all text-sm font-bold text-gray-800">{file.nama_berkas}</span>
                <div className="flex shrink-0 items-center gap-3">
                  <a href={preview.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-700 underline">Buka di tab baru</a>
                  <button type="button" onClick={() => setLargeRevisionPreviewId(null)} className="text-lg font-bold text-gray-500 hover:text-gray-900" aria-label="Tutup pratinjau">×</button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-2">
                {preview.contentType === 'application/pdf'
                  ? <iframe src={preview.url} title={`Pratinjau ${file.nama_berkas}`} className="h-[82vh] w-full rounded-lg bg-white" />
                  : <img src={preview.url} alt={file.nama_berkas} className="mx-auto max-h-[82vh] max-w-full object-contain" />}
              </div>
            </div>
          </div>
        );
      })()}

      {selectedLogbookDetail && selectedLogbookDetail.statusKey !== 'revisi' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-xs sm:p-5">
          <div className={`flex max-h-[94vh] w-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl animate-scale-up ${isRevisionDetail ? 'max-w-5xl' : 'max-w-xl'}`}>
            <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold">{isRevisionDetail ? 'Detail Logbook • Mode Revisi' : 'Detail Entri Logbook'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold">ID #{selectedLogbookDetail.id}</span>
              </div>
              <button onClick={() => setSelectedLogbookDetail(null)} className="text-gray-300 hover:text-white text-sm font-bold p-1 cursor-pointer">{isRevisionDetail ? 'Kembali ke daftar' : '✕'}</button>
            </div>

            <div className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 ${isRevisionDetail ? 'space-y-4 text-sm' : 'space-y-4 text-xs'}`}>
              {/* Alert jika butuh perbaikan */}
              {selectedLogbookDetail.statusKey === 'revisi' && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                  <div className="flex items-center gap-2 text-red-800 font-bold mb-1">
                    <span>⚠️</span>
                    <span>Catatan Review Peninjau (Perlu Perbaikan):</span>
                  </div>
                  <p className="text-red-700 leading-relaxed font-medium">
                    {selectedLogbookDetail.catatanReviewer || 'Belum ada catatan dari pimpinan.'}
                  </p>
                  {readRevisionAspects(selectedLogbookDetail.aspekRevisi).length > 0 && (
                    <div className="mt-3 text-red-800 text-[11px]">
                      <strong>Aspek perbaikan:</strong>{' '}
                      {readRevisionAspects(selectedLogbookDetail.aspekRevisi)
                        .map((aspect) => revisionAspectLabels[aspect] || aspect).join(', ')}
                    </div>
                  )}
                  {selectedLogbookDetail.tenggatRevisi && (
                    <div className="mt-1 text-[11px] font-semibold text-red-800">
                      Batas pengiriman ulang: {selectedLogbookDetail.tenggatRevisi}
                    </div>
                  )}
                  {selectedLogbookDetail.namaBerkasRevisi && (
                    <div className="mt-1 text-[11px] text-red-800">
                      Dokumen catatan/markup: {selectedLogbookDetail.namaBerkasRevisi}
                    </div>
                  )}
                  {selectedLogbookDetail.reviewerName && (
                    <div className="mt-2 text-[11px] text-red-600">
                      Oleh: {selectedLogbookDetail.reviewerName} • {selectedLogbookDetail.tglReview}
                    </div>
                  )}
                </div>
              )}

              {selectedLogbookDetail.statusKey === 'sah' && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="inline-flex px-4 py-2 border-2 border-emerald-700 rounded-lg text-emerald-800 font-black tracking-[0.2em] rotate-[-2deg] mb-3">
                    TERVALIDASI
                  </div>
                  <div className="flex items-center gap-2 text-emerald-800 font-bold mb-1">
                    <span>🛡️</span>
                    <span>Tervalidasi TTE Resmi:</span>
                  </div>
                  <p className="text-emerald-700 leading-relaxed">
                    {selectedLogbookDetail.catatanReviewer || 'Belum ada catatan dari pimpinan.'}
                  </p>
                  {selectedLogbookDetail.reviewerName && (
                    <div className="mt-2 text-[11px] text-emerald-600">Diverifikasi: {selectedLogbookDetail.reviewerName}</div>
                  )}
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
                  <span className="font-semibold text-gray-800">{selectedLogbookDetail.outputShort || selectedLogbookDetail.targetOutput}</span>
                  {(selectedLogbookDetail.kuantitas || selectedLogbookDetail.satuan) && <span className="mt-1 block text-xs text-gray-600">{selectedLogbookDetail.kuantitas || '—'} {selectedLogbookDetail.satuan || ''}</span>}
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Dokumen Eviden</span>
                  {selectedLogbookDetail.berkasId && ['image/jpeg', 'image/png', 'application/pdf'].includes(selectedLogbookDetail.berkasJenis) ? (
                    <div className="mt-2">
                      {selectedLogbookDetail.berkasJenis === 'application/pdf' ? (
                        <iframe src={getLogbookEvidenceUrl(selectedLogbookDetail.id, selectedLogbookDetail.berkasId, currentUserId)} title={`Pratinjau ${selectedLogbookDetail.berkasNama || 'PDF'}`} className={`w-full rounded-lg border border-gray-200 bg-white ${isRevisionDetail ? 'h-[38vh] min-h-[260px]' : 'h-[65vh] min-h-[500px]'}`} />
                      ) : (
                        <img
                          src={getLogbookEvidenceUrl(selectedLogbookDetail.id, selectedLogbookDetail.berkasId, currentUserId)}
                          alt={`Bukti kegiatan ${selectedLogbookDetail.berkasNama || ''}`}
                          onError={() => setUnavailableEvidenceIds((current) => ({ ...current, [selectedLogbookDetail.berkasId]: true }))}
                          className="w-full max-h-64 object-contain rounded-lg border border-gray-200 bg-white"
                        />
                      )}
                      {unavailableEvidenceIds[selectedLogbookDetail.berkasId]
                        ? <span className="text-xs text-amber-700 block mt-2">Bukti kegiatan belum tersedia di penyimpanan backend.</span>
                        : <span className="text-xs font-semibold text-blue-700 block mt-2 break-all">{selectedLogbookDetail.berkasNama}</span>}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Bukti kegiatan belum tersedia.</div>
                  )}
                  <span className="text-[10px] text-gray-400 block mt-0.5">Ukuran: {selectedLogbookDetail.berkasUkuran || '—'}</span>
                </div>
              </div>

              {/* Pemilik hanya dapat mengubah isi logbook ketika status revisi. */}
              {selectedLogbookDetail.statusKey === 'revisi' && (
                <form onSubmit={handleResubmitRevision} className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-3">Perbaiki logbook sebelum dikirim ulang:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">Tanggal kegiatan *</label>
                      <input
                        type="date"
                        required
                        value={revisionDraft?.tglKegiatan || ''}
                        onChange={(e) => setRevisionDraft((draft) => ({ ...draft, tglKegiatan: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">Kategori *</label>
                      <select
                        required
                        value={revisionDraft?.kategori || ''}
                        onChange={(e) => setRevisionDraft((draft) => ({ ...draft, kategori: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                      >
                        {['Pengajaran', 'Penelitian', 'Pengabdian', 'Kepanitiaan SK', 'Administrasi', 'Tugas Tambahan'].map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">Waktu mulai *</label>
                      <input type="time" required value={revisionDraft?.waktuMulai || ''} onChange={(e) => setRevisionDraft((draft) => ({ ...draft, waktuMulai: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">Waktu selesai *</label>
                      <input type="time" required value={revisionDraft?.waktuSelesai || ''} onChange={(e) => setRevisionDraft((draft) => ({ ...draft, waktuSelesai: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-gray-600 mb-1 font-medium">Butir kegiatan *</label>
                      <input
                        type="text"
                        required
                        maxLength={255}
                        value={revisionDraft?.judul || ''}
                        onChange={(e) => setRevisionDraft((draft) => ({ ...draft, judul: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-gray-600 mb-1 font-medium">Nomor SK / dasar kegiatan</label>
                      <input
                        type="text"
                        maxLength={255}
                        value={revisionDraft?.nomorSk || ''}
                        onChange={(e) => setRevisionDraft((draft) => ({ ...draft, nomorSk: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-gray-600 mb-1 font-medium">Uraian kegiatan *</label>
                      <textarea
                        rows="4"
                        required
                        value={revisionDraft?.uraian || ''}
                        onChange={(e) => setRevisionDraft((draft) => ({ ...draft, uraian: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">Target / output</label>
                      <textarea
                        rows="2"
                        value={revisionDraft?.target || ''}
                        onChange={(e) => setRevisionDraft((draft) => ({ ...draft, target: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">Hasil / realisasi</label>
                      <textarea
                        rows="2"
                        value={revisionDraft?.hasil || ''}
                        onChange={(e) => setRevisionDraft((draft) => ({ ...draft, hasil: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">Kuantitas</label>
                      <input type="text" maxLength={60} value={revisionDraft?.kuantitas || ''} onChange={(e) => setRevisionDraft((draft) => ({ ...draft, kuantitas: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" placeholder="Contoh: 1" />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">Satuan</label>
                      <input type="text" maxLength={60} value={revisionDraft?.satuan || ''} onChange={(e) => setRevisionDraft((draft) => ({ ...draft, satuan: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" placeholder="Contoh: Dokumen" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-gray-600 mb-1 font-medium">Keterangan</label>
                      <textarea rows="2" maxLength={255} value={revisionDraft?.keterangan || ''} onChange={(e) => setRevisionDraft((draft) => ({ ...draft, keterangan: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" placeholder="Keterangan tambahan atau informasi bukti" />
                    </div>
                    <div className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3 space-y-3">
                      <div className="font-semibold text-gray-700">Bukti pendukung</div>
                      {selectedLogbookDetail.berkasId ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white border border-gray-200 p-2">
                          <span className="text-xs text-gray-700 break-all">Tersimpan: {selectedLogbookDetail.berkasNama}</span>
                          <a className="text-xs text-blue-700 underline" href={getLogbookEvidenceUrl(selectedLogbookDetail.id, selectedLogbookDetail.berkasId, currentUserId)} target="_blank" rel="noreferrer">Lihat bukti saat ini</a>
                        </div>
                      ) : <p className="text-xs text-amber-700">Belum ada bukti tersimpan.</p>}
                      <label className="block text-gray-600 mb-1 font-medium">Tindakan berkas</label>
                      <select
                        value={revisionEvidenceAction}
                        onChange={(event) => {
                          const action = event.target.value;
                          setRevisionEvidenceAction(action);
                          if (action === 'remove' || action === 'keep') setRevisionEvidenceFile(null);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white"
                      >
                        <option value="keep">Pertahankan bukti saat ini</option>
                        <option value="add">Tambahkan bukti baru</option>
                        <option value="replace">Ganti bukti terbaru (bukti lama tetap diarsip)</option>
                        <option value="remove">Hapus semua bukti</option>
                      </select>
                      {['add', 'replace'].includes(revisionEvidenceAction) && (
                        <>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (!file) return;
                              if (!getEvidenceMimeType(file)) {
                                setRevisionEvidenceFile(null);
                                event.target.value = '';
                                alert('Berkas bukti harus berupa JPG, JPEG, PNG, atau PDF.');
                                return;
                              }
                              if (file.size > 5 * 1024 * 1024) {
                                setRevisionEvidenceFile(null);
                                event.target.value = '';
                                alert('Ukuran berkas maksimal 5 MB.');
                                return;
                              }
                              setRevisionEvidenceFile(file);
                              setRevisionEvidenceAction((action) => action === 'keep' ? 'add' : action);
                            }}
                            className="w-full text-xs"
                          />
                          {revisionEvidencePreviewUrl && (getEvidenceMimeType(revisionEvidenceFile) === 'application/pdf'
                            ? <iframe src={revisionEvidencePreviewUrl} title="Pratinjau bukti revisi PDF" className="w-full h-48 rounded-lg border border-gray-200 bg-white" />
                            : <img src={revisionEvidencePreviewUrl} alt="Pratinjau bukti revisi" className="w-full max-h-52 object-contain rounded-lg border border-gray-200 bg-white" />)}
                          {revisionEvidenceFile && <p className="text-xs text-gray-600">Berkas terpilih: {revisionEvidenceFile.name}</p>}
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveRevisionDraft}
                      disabled={isSavingRevisionDraft || isSubmittingRevision}
                      className="sm:col-span-2 w-full py-2.5 rounded-lg border border-[#0F5132] text-[#0F5132] hover:bg-emerald-50 font-bold text-xs disabled:opacity-60"
                    >
                      {isSavingRevisionDraft ? 'Menyimpan perubahan...' : 'Simpan Perubahan'}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingRevision || isSavingRevisionDraft}
                      className="sm:col-span-2 w-full py-2.5 rounded-lg bg-[#0F5132] hover:bg-[#14532D] text-white font-bold text-xs shadow-xs disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {isSubmittingRevision ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
                          Mengirim...
                        </>
                      ) : 'Kirim Ulang untuk Validasi'}
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
                  <span className="font-semibold text-gray-800">{reviewingLogbook.outputShort || reviewingLogbook.targetOutput}</span>
                  {(reviewingLogbook.kuantitas || reviewingLogbook.satuan) && <span className="mt-1 block text-xs text-gray-600">{reviewingLogbook.kuantitas || '—'} {reviewingLogbook.satuan || ''}</span>}
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
                  <span className="font-semibold text-gray-800">{reviewingLogbook.outputShort || reviewingLogbook.targetOutput}</span>
                  {(reviewingLogbook.kuantitas || reviewingLogbook.satuan) && <span className="mt-1 block text-xs text-gray-600">{reviewingLogbook.kuantitas || '—'} {reviewingLogbook.satuan || ''}</span>}
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

      {isRevisionRequestOpen && subordinateDetailData?.logbook && (
        <div className="fixed inset-0 z-[70] bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <form onSubmit={handleRevisionRequestSubmit} className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold mb-2">Status: Perlu Revisi</span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Permintaan Revisi &amp; Catatan Perbaikan Logbook</h3>
                <p className="text-xs text-gray-500 mt-1">{subordinateDetailData.logbook.judul}</p>
              </div>
              <button type="button" onClick={() => setIsRevisionRequestOpen(false)} className="text-gray-500 hover:text-gray-900 text-xl p-1" aria-label="Tutup">×</button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 max-h-[72vh] overflow-y-auto">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs">
                <span className="font-bold text-slate-800">Pemilik logbook:</span>{' '}
                <span className="text-slate-700">{subordinateDetailData.logbook.nama_pegawai} · {subordinateDetailData.logbook.nama_jabatan}</span>
              </div>

              <fieldset>
                <legend className="text-xs font-bold text-slate-800 mb-2">Aspek yang perlu diperbaiki <span className="text-red-600">* pilih minimal satu</span></legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(revisionAspectLabels).map(([key, label]) => (
                    <label key={key} className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer ${revisionAspects.includes(key) ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                      <input
                        type="checkbox"
                        checked={revisionAspects.includes(key)}
                        onChange={(event) => setRevisionAspects((current) => event.target.checked
                          ? [...current, key]
                          : current.filter((item) => item !== key))}
                        className="mt-0.5 accent-amber-700"
                      />
                      <span className="text-[11px] text-gray-700 leading-relaxed">{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Uraian catatan revisi &amp; arahan tindak lanjut <span className="text-red-600">*</span></label>
                <textarea
                  required
                  minLength={20}
                  maxLength={1000}
                  rows={5}
                  value={revisionReason}
                  onChange={(event) => setRevisionReason(event.target.value)}
                  placeholder="Jelaskan dengan spesifik bagian yang harus diperbaiki dan dokumen pendukung yang diperlukan..."
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl text-xs leading-relaxed focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                <div className="text-right text-[10px] text-gray-400 mt-1">{revisionReason.length}/1000 karakter (minimal 20)</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">Batas waktu pengiriman ulang <span className="text-red-600">*</span></label>
                  <input
                    type="date"
                    required
                    min={getLocalDateString()}
                    value={revisionDeadline}
                    onChange={(event) => setRevisionDeadline(event.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">Nama dokumen catatan/markup (opsional)</label>
                  <input
                    type="text"
                    maxLength={255}
                    value={revisionAttachmentName}
                    onChange={(event) => setRevisionAttachmentName(event.target.value)}
                    placeholder="Nama dokumen pendukung"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-3 bg-slate-50 border-t border-gray-100 flex justify-end gap-2">
              <button type="button" onClick={() => setIsRevisionRequestOpen(false)} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-semibold">Batal</button>
              <button type="submit" disabled={isSubmittingDetailReview} className="px-5 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold disabled:opacity-60">
                {isSubmittingDetailReview ? 'Mengirim...' : 'Kirim Revisi'}
              </button>
            </div>
          </form>
        </div>
      )}


    </div>
  );
}
