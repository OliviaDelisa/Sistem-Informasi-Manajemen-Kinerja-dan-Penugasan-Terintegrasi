import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import Icon from '../components/Icon'
import { getPresensi, getPresensiByEmployee, importPresensi } from '../services/managementApi'
import './impor-presensi.css'

const columns = [
  { key: 'tanggal_sesi', label: 'Tanggal Sesi', aliases: ['tanggal_sesi', 'tgl_sesi', 'tanggal'] },
  { key: 'nomor_pegawai', label: 'Nomor Pegawai', aliases: ['nomor_pegawai', 'no_pegawai', 'nip'] },
  { key: 'nama_pegawai', label: 'Nama Pegawai', aliases: ['nama_pegawai', 'pegawai', 'nama'] },
  { key: 'email', label: 'Email', aliases: ['email', 'email_pegawai'] },
  { key: 'unit', label: 'Unit', aliases: ['unit', 'unit_kerja'] },
  { key: 'status_kepegawaian', label: 'Status Kepegawaian', aliases: ['status_kepegawaian', 'status'] },
  { key: 'shift', label: 'Shift', aliases: ['shift', 'jadwal_kerja'] },
  { key: 'lokasi', label: 'Lokasi', aliases: ['lokasi', 'titik_scan'] },
  { key: 'mode_kerja', label: 'Mode Kerja', aliases: ['mode_kerja', 'mode'] },
  { key: 'tipe_sesi', label: 'Tipe Sesi', aliases: ['tipe_sesi', 'tipe'] },
  { key: 'status_sesi', label: 'Status Sesi', aliases: ['status_sesi'] },
  { key: 'event_wajib', label: 'Event Wajib', aliases: ['event_wajib'] },
  { key: 'event_selesai', label: 'Event Selesai', aliases: ['event_selesai'] },
  { key: 'jam_mulai', label: 'Jam Mulai', aliases: ['jam_mulai', 'waktu_mulai'] },
  { key: 'jam_akhir', label: 'Jam Akhir', aliases: ['jam_akhir', 'waktu_akhir'] },
]

const validSessionStatuses = ['OPEN', 'CLOSED']

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || ''
  const counts = {
    ',': (firstLine.match(/,/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ','
}

function parseCsv(text) {
  const cleanText = text.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(cleanText)
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < cleanText.length; index += 1) {
    const character = cleanText[index]
    if (character === '"' && quoted && cleanText[index + 1] === '"') {
      cell += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim())
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && cleanText[index + 1] === '\n') index += 1
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s/-]+/g, '_')
}

function pad2(num) {
  return String(num).padStart(2, '0')
}

function formatExcelCell(value, columnKey) {
  if (value === null || value === undefined) return ''

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const datePart = `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`
    if (columnKey === 'tanggal_sesi') return datePart
    const timePart = `${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`
    return `${datePart} ${timePart}`
  }

  if (typeof value === 'number') {
    if (columnKey === 'tanggal_sesi' && value > 20000) {
      const parsed = XLSX.SSF.parse_date_code(value)
      if (parsed) return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`
    }
    if ((columnKey === 'jam_mulai' || columnKey === 'jam_akhir') && value > 0) {
      const parsed = XLSX.SSF.parse_date_code(value)
      if (parsed) {
        const timePart = `${pad2(parsed.H)}:${pad2(parsed.M)}:${pad2(Math.floor(parsed.S))}`
        if (value >= 1 && parsed.y > 1900) {
          return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)} ${timePart}`
        }
        return timePart
      }
    }
    return String(value)
  }

  const trimmed = String(value).trim()
  if (columnKey === 'tanggal_sesi') {
    // Support DD/MM/YYYY or DD-MM-YYYY -> YYYY-MM-DD
    const dmy = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  }
  return trimmed
}

function parseExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return []
  const sheet = workbook.Sheets[firstSheetName]
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
  return rawRows.filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''))
}

function findHeaderRowIndex(parsedRows) {
  const maxScan = Math.min(parsedRows.length, 10)
  for (let i = 0; i < maxScan; i += 1) {
    const normalized = parsedRows[i].map(normalizeHeader)
    const matchedCount = columns.filter((col) => col.aliases.some((alias) => normalized.includes(alias))).length
    if (matchedCount >= 5) return i
  }
  return 0
}

function isValidTimeOrDatetime(value) {
  return (
    /^\d{4}-\d{2}-\d{2}\s([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value) ||
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)
  )
}

function parseComparableTime(value, sessionDate) {
  if (!value) return null
  const normalized = value.includes(' ') ? value : `${sessionDate} ${value}`
  const timestamp = Date.parse(normalized.replace(' ', 'T'))
  return Number.isNaN(timestamp) ? null : timestamp
}

function formatTimeOnly(value) {
  if (!value) return '—'
  const parts = String(value).trim().split(' ')
  return parts.length > 1 ? parts[1] : parts[0]
}

function validateRow(record) {
  const issues = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.tanggal_sesi)) {
    issues.push('Format Tanggal Sesi harus YYYY-MM-DD')
  }
  if (!record.nomor_pegawai) issues.push('Nomor Pegawai kosong')
  if (!record.nama_pegawai) issues.push('Nama Pegawai kosong')
  if (!record.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
    issues.push('Email tidak valid')
  }
  if (!record.unit) issues.push('Unit kosong')
  if (!record.status_kepegawaian) issues.push('Status Kepegawaian kosong')
  if (!record.shift) issues.push('Shift kosong')
  if (!record.lokasi) issues.push('Lokasi kosong')
  if (!record.mode_kerja) issues.push('Mode Kerja kosong')
  if (!record.tipe_sesi) issues.push('Tipe Sesi kosong')

  const statusSesi = record.status_sesi.toUpperCase()
  if (!validSessionStatuses.includes(statusSesi)) {
    issues.push('Status Sesi harus OPEN atau CLOSED')
  }

  const eventWajib = Number(record.event_wajib)
  const eventSelesai = Number(record.event_selesai)
  const validWajib = /^\d+$/.test(record.event_wajib) && eventWajib >= 1
  const validSelesai = /^\d+$/.test(record.event_selesai) && eventSelesai >= 0

  if (!validWajib) issues.push('Event Wajib harus angka bulat minimal 1')
  if (!validSelesai) issues.push('Event Selesai harus angka bulat minimal 0')
  if (validWajib && validSelesai && eventSelesai > eventWajib) {
    issues.push('Event Selesai tidak boleh melebihi Event Wajib')
  }

  if (record.jam_mulai && !isValidTimeOrDatetime(record.jam_mulai)) {
    issues.push('Format Jam Mulai tidak valid')
  } else if (validSelesai && eventSelesai > 0 && !record.jam_mulai) {
    issues.push('Jam Mulai wajib diisi jika Event Selesai > 0')
  }

  if (record.jam_akhir && !isValidTimeOrDatetime(record.jam_akhir)) {
    issues.push('Format Jam Akhir tidak valid')
  } else if (record.jam_mulai && record.jam_akhir) {
    const startTs = parseComparableTime(record.jam_mulai, record.tanggal_sesi)
    const endTs = parseComparableTime(record.jam_akhir, record.tanggal_sesi)
    if (startTs !== null && endTs !== null && endTs < startTs) {
      issues.push('Jam Akhir lebih awal dari Jam Mulai')
    }
  }

  return issues
}

function downloadExcelTemplate() {
  const header = columns.map((column) => column.label)
  const sampleRows = [
    ['2026-10-30', '210196507202601201', 'SRI MADONA', 'srimadona@adm.unand.ac.id', 'Fakultas Teknologi Informasi', 'CPT', 'Regular Jumat', 'Titik Scan Kampus Utama Limau Manis', 'WFO', 'NORMAL', 'OPEN', 4, 3, '2026-10-30 07:11:34', ''],
    ['2026-10-29', '210196507202601201', 'SRI MADONA', 'srimadona@adm.unand.ac.id', 'Fakultas Teknologi Informasi', 'CPT', 'Regular Senin-Kamis', 'Titik Scan Kampus Utama Limau Manis', 'WFO', 'NORMAL', 'CLOSED', 4, 4, '2026-10-29 07:07:17', '2026-10-29 16:08:48'],
    ['2026-10-28', '210196507202601201', 'SRI MADONA', 'srimadona@adm.unand.ac.id', 'Fakultas Teknologi Informasi', 'CPT', 'Regular Senin-Kamis', 'Titik Scan Kampus Utama Limau Manis', 'WFO', 'NORMAL', 'CLOSED', 4, 4, '2026-10-28 07:02:27', '2026-10-28 16:00:37'],
    ['2026-10-27', '210196507202601201', 'SRI MADONA', 'srimadona@adm.unand.ac.id', 'Fakultas Teknologi Informasi', 'CPT', 'Regular Senin-Kamis', 'Titik Scan Kampus Utama Limau Manis', 'WFO', 'NORMAL', 'CLOSED', 4, 4, '2026-10-27 06:57:23', '2026-10-27 16:12:44'],
    ['2026-10-23', '210196507202601201', 'SRI MADONA', 'srimadona@adm.unand.ac.id', 'Fakultas Teknologi Informasi', 'CPT', 'Regular Jumat', 'Titik Scan Kampus Utama Limau Manis', 'WFO', 'NORMAL', 'CLOSED', 4, 4, '2026-10-23 07:17:09', '2026-10-23 16:39:00'],
  ]
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...sampleRows])
  worksheet['!cols'] = [
    { wch: 13 }, { wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 28 },
    { wch: 18 }, { wch: 20 }, { wch: 36 }, { wch: 12 }, { wch: 11 },
    { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 20 }, { wch: 20 },
  ]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Presensi')
  XLSX.writeFile(workbook, 'template-impor-presensi.xlsx')
}

export default function ImporPresensiPage({ user }) {
  const fileInput = useRef(null)

  // CSV preview & upload state
  const [fileName, setFileName] = useState('')
  const [previewRows, setPreviewRows] = useState([])
  const [previewFilter, setPreviewFilter] = useState('semua')
  const [isSaving, setIsSaving] = useState(false)

  // Saved database records state
  const [employees, setEmployees] = useState([])
  const [periods, setPeriods] = useState([])
  const [dbSummary, setDbSummary] = useState({
    totalPegawai: 0,
    totalSesi: 0,
    sesiLengkap: 0,
    sesiBelumLengkap: 0,
    sesiOpen: 0,
  })
  const [loadingDb, setLoadingDb] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [completenessFilter, setCompletenessFilter] = useState('semua')

  // Employee detail view state
  const [detailEmployee, setDetailEmployee] = useState(null)
  const [detailSessions, setDetailSessions] = useState([])
  const [detailPeriod, setDetailPeriod] = useState('')
  const [detailFilter, setDetailFilter] = useState('semua')
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Feedback messages
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadPresensi = useCallback(async () => {
    setLoadingDb(true)
    try {
      const payload = await getPresensi({
        periode: selectedDate ? '' : selectedPeriod,
        tanggal: selectedDate,
      })
      setEmployees(payload.employees || [])
      setPeriods(payload.periods || [])
      setDbSummary(payload.summary || {
        totalPegawai: 0,
        totalSesi: 0,
        sesiLengkap: 0,
        sesiBelumLengkap: 0,
        sesiOpen: 0,
      })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoadingDb(false)
    }
  }, [selectedPeriod, selectedDate])

  useEffect(() => {
    loadPresensi()
  }, [loadPresensi])

  async function openEmployeeDetail(employee) {
    setError('')
    setDetailEmployee(employee)
    setDetailPeriod(selectedPeriod)
    setDetailFilter('semua')
    setLoadingDetail(true)
    try {
      const payload = await getPresensiByEmployee(employee.nomor_pegawai, {
        periode: selectedPeriod,
      })
      setDetailEmployee(payload.employee || employee)
      setDetailSessions(payload.sessions || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoadingDetail(false)
    }
  }

  async function handleDetailPeriodChange(nextPeriod) {
    setDetailPeriod(nextPeriod)
    if (!detailEmployee) return
    setLoadingDetail(true)
    try {
      const payload = await getPresensiByEmployee(detailEmployee.nomor_pegawai, {
        periode: nextPeriod,
      })
      setDetailSessions(payload.sessions || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoadingDetail(false)
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setMessage('')
    setPreviewRows([])
    setFileName(file.name)

    const lowerName = file.name.toLowerCase()
    const isCsv = lowerName.endsWith('.csv')
    const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')

    if (!isCsv && !isExcel) {
      setError('Format file belum didukung. Pilih file Excel (.xlsx, .xls) atau CSV (.csv).')
      return
    }

    try {
      const parsed = isExcel
        ? parseExcel(await file.arrayBuffer())
        : parseCsv(await file.text())

      if (parsed.length < 2) {
        setError('File belum memiliki baris data.')
        return
      }

      const headerRowIndex = findHeaderRowIndex(parsed)
      const headers = parsed[headerRowIndex].map(normalizeHeader)
      const headerMap = {}
      const missing = []

      for (const column of columns) {
        const foundIndex = headers.findIndex((header) => column.aliases.includes(header))
        if (foundIndex === -1) {
          missing.push(column.label)
        } else {
          headerMap[column.key] = foundIndex
        }
      }

      if (missing.length) {
        setError(`Kolom wajib tidak ditemukan: ${missing.join(', ')}.`)
        return
      }

      const dataRows = parsed.slice(headerRowIndex + 1)
      if (!dataRows.length) {
        setError('File belum memiliki baris data di bawah header.')
        return
      }

      const seenKeys = new Set()
      setPreviewRows(dataRows.map((cells, index) => {
        const record = Object.fromEntries(
          columns.map(({ key }) => [key, formatExcelCell(cells[headerMap[key]], key)]),
        )
        const issues = validateRow(record)
        const uniqueKey = `${record.nomor_pegawai}__${record.tanggal_sesi}`
        const isDuplicateInFile = seenKeys.has(uniqueKey)
        seenKeys.add(uniqueKey)
        const eventWajib = Number(record.event_wajib)
        const eventSelesai = Number(record.event_selesai)
        const isComplete = issues.length === 0 && eventSelesai >= eventWajib
        return {
          ...record,
          status_sesi: record.status_sesi.toUpperCase(),
          id: index + 1,
          issues,
          isComplete,
          isDuplicateInFile,
        }
      }))
    } catch {
      setError('File tidak dapat dibaca. Pastikan file Excel atau CSV tidak rusak.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function clearPreview() {
    setFileName('')
    setPreviewRows([])
    setPreviewFilter('semua')
  }

  async function handleSaveToDatabase() {
    const validRows = previewRows.filter((row) => row.issues.length === 0)
    if (!validRows.length) {
      setError('Tidak ada baris data yang valid untuk disimpan.')
      return
    }

    setError('')
    setMessage('')
    setIsSaving(true)
    try {
      const response = await importPresensi({
        idPengimpor: user?.id,
        namaBerkas: fileName,
        rows: validRows.map((row) => ({
          tanggal_sesi: row.tanggal_sesi,
          nomor_pegawai: row.nomor_pegawai,
          nama_pegawai: row.nama_pegawai,
          email: row.email,
          unit: row.unit,
          status_kepegawaian: row.status_kepegawaian,
          shift: row.shift,
          lokasi: row.lokasi,
          mode_kerja: row.mode_kerja,
          tipe_sesi: row.tipe_sesi,
          status_sesi: row.status_sesi,
          event_wajib: row.event_wajib,
          event_selesai: row.event_selesai,
          jam_mulai: row.jam_mulai,
          jam_akhir: row.jam_akhir,
        })),
      })
      setMessage(response.message || 'Data presensi berhasil disimpan ke database.')
      clearPreview()
      await loadPresensi()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredPreviewRows = useMemo(() => previewRows.filter((row) => {
    if (previewFilter === 'valid') return row.issues.length === 0
    if (previewFilter === 'invalid') return row.issues.length > 0
    if (previewFilter === 'belum_lengkap') return row.issues.length === 0 && !row.isComplete
    return true
  }), [previewRows, previewFilter])

  const filteredEmployees = useMemo(() => employees.filter((employee) => {
    const haystack = `${employee.nama_pegawai} ${employee.nomor_pegawai} ${employee.email} ${employee.unit} ${employee.status_kepegawaian || ''}`.toLowerCase()
    const matchesSearch = !search || haystack.includes(search.toLowerCase())
    const matchesCompleteness =
      completenessFilter === 'semua' ||
      (completenessFilter === 'lengkap' && employee.sesi_belum_lengkap === 0) ||
      (completenessFilter === 'belum_lengkap' && employee.sesi_belum_lengkap > 0) ||
      (completenessFilter === 'open' && employee.sesi_open > 0)
    return matchesSearch && matchesCompleteness
  }), [employees, search, completenessFilter])

  const filteredDetailSessions = useMemo(() => detailSessions.filter((session) => {
    const isComplete = Number(session.event_selesai) >= Number(session.event_wajib)
    if (detailFilter === 'lengkap') return isComplete
    if (detailFilter === 'belum_lengkap') return !isComplete
    if (detailFilter === 'open') return session.status_sesi === 'OPEN'
    if (detailFilter === 'closed') return session.status_sesi === 'CLOSED'
    return true
  }), [detailSessions, detailFilter])

  const previewValidCount = previewRows.filter((row) => row.issues.length === 0).length
  const previewInvalidCount = previewRows.length - previewValidCount

  // === DETAIL VIEW PER EMPLOYEE ===
  if (detailEmployee) {
    const detailComplete = detailSessions.filter((s) => Number(s.event_selesai) >= Number(s.event_wajib)).length
    const detailIncomplete = detailSessions.length - detailComplete
    const detailOpen = detailSessions.filter((s) => s.status_sesi === 'OPEN').length

    return (
      <section className="page-section attendance-import-page">
        <div className="page-heading">
          <div>
            <button
              type="button"
              className="attendance-back-link"
              onClick={() => { setDetailEmployee(null); setDetailSessions([]) }}
            >
              ← Kembali ke Rekap Presensi Pegawai
            </button>
            <span className="eyebrow">DETAIL PRESENSI PEGAWAI</span>
            <h1>{detailEmployee.nama_pegawai}</h1>
            <p>
              {detailEmployee.nomor_pegawai} · {detailEmployee.email} · {detailEmployee.unit}
              {detailEmployee.status_kepegawaian ? ` (${detailEmployee.status_kepegawaian})` : ''}
            </p>
          </div>
        </div>

        {error && <div className="page-message error-message" role="alert">{error}</div>}

        <div className="attendance-summary">
          <div><span>Total hari / sesi</span><strong>{detailSessions.length}</strong></div>
          <div><span>Presensi lengkap</span><strong className="attendance-valid-number">{detailComplete}</strong></div>
          <div><span>Belum lengkap</span><strong className={detailIncomplete ? 'attendance-warning-number' : ''}>{detailIncomplete}</strong></div>
          <div><span>Status OPEN</span><strong className={detailOpen ? 'attendance-warning-number' : ''}>{detailOpen}</strong></div>
        </div>

        <div className="data-panel attendance-table-panel">
          <div className="attendance-table-heading">
            <div>
              <h2>Riwayat absensi per tanggal</h2>
              <p>Menampilkan {filteredDetailSessions.length} dari {detailSessions.length} sesi presensi untuk {detailEmployee.nama_pegawai}.</p>
            </div>
            <div className="attendance-table-tools">
              <select
                value={detailPeriod}
                onChange={(event) => handleDetailPeriodChange(event.target.value)}
                aria-label="Filter periode"
              >
                <option value="">Semua periode</option>
                {periods.map((period) => (
                  <option key={period} value={period}>{period}</option>
                ))}
              </select>
              <select
                value={detailFilter}
                onChange={(event) => setDetailFilter(event.target.value)}
                aria-label="Filter kelengkapan detail"
              >
                <option value="semua">Semua sesi</option>
                <option value="lengkap">Presensi lengkap</option>
                <option value="belum_lengkap">Belum lengkap</option>
                <option value="open">Status OPEN</option>
                <option value="closed">Status CLOSED</option>
              </select>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tanggal Sesi</th>
                  <th>Shift</th>
                  <th>Lokasi</th>
                  <th>Mode</th>
                  <th>Tipe</th>
                  <th>Status Sesi</th>
                  <th>Event</th>
                  <th>Jam Mulai</th>
                  <th>Jam Akhir</th>
                  <th>Kelengkapan</th>
                </tr>
              </thead>
              <tbody>
                {loadingDetail ? (
                  <tr><td className="table-empty" colSpan="10">Memuat riwayat absensi pegawai...</td></tr>
                ) : filteredDetailSessions.length ? filteredDetailSessions.map((session) => {
                  const isComplete = Number(session.event_selesai) >= Number(session.event_wajib)
                  const statusClass = session.status_sesi === 'CLOSED' ? 'closed' : 'open'
                  return (
                    <tr key={session.id_presensi}>
                      <td><strong>{session.tgl_sesi}</strong></td>
                      <td>{session.shift || '—'}</td>
                      <td>{session.lokasi || '—'}</td>
                      <td><span className="attendance-chip">{session.mode_kerja || '—'}</span></td>
                      <td><span className="attendance-chip">{session.tipe_sesi || '—'}</span></td>
                      <td><span className={`attendance-status ${statusClass}`}>{session.status_sesi}</span></td>
                      <td><strong>{session.event_selesai} / {session.event_wajib}</strong></td>
                      <td>{session.jam_mulai || '—'}</td>
                      <td>{session.jam_akhir || '—'}</td>
                      <td>
                        {isComplete ? (
                          <span className="attendance-validation valid">Lengkap</span>
                        ) : (
                          <span className="attendance-validation incomplete">
                            Kurang {Number(session.event_wajib) - Number(session.event_selesai)} scan
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td className="table-empty" colSpan="10">Tidak ada data presensi pada filter yang dipilih.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    )
  }

  // === MAIN VIEW: IMPORT + EMPLOYEE SUMMARY TABLE FROM DATABASE ===
  return (
    <section className="page-section attendance-import-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MANAJEMEN PRESENSI</span>
          <h1>Impor & Rekap Presensi Pegawai</h1>
          <p>Unggah file Excel (.xlsx/.xls) atau CSV rekap sesi presensi ke database, saring per pegawai atau per tanggal, dan lihat detail riwayat tiap pegawai.</p>
        </div>
        <button type="button" className="outline-button" onClick={downloadExcelTemplate}>Unduh template Excel</button>
      </div>

      {message && <div className="page-message">{message}</div>}
      {error && <div className="page-message error-message" role="alert">{error}</div>}

      <div className="attendance-upload-card">
        <div className="attendance-upload-icon"><Icon name="upload" size={24} /></div>
        <div className="attendance-upload-copy">
          <strong>{fileName || 'Impor file Excel / CSV rekap sesi presensi'}</strong>
          <span>Mendukung Excel (.xlsx, .xls) dan CSV (.csv) 15 kolom. Data duplikat (nomor pegawai & tanggal yang sama) otomatis dicegah saat disimpan.</span>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          onChange={handleFileChange}
          hidden
        />
        <button type="button" className="primary-button" onClick={() => fileInput.current?.click()}>Pilih file</button>
      </div>

      {/* PREVIEW PANEL WHEN A CSV FILE IS SELECTED */}
      {previewRows.length > 0 && (
        <div className="data-panel attendance-table-panel attendance-preview-box">
          <div className="attendance-table-heading">
            <div>
              <h2>Pratinjau impor: {fileName}</h2>
              <p>
                {previewValidCount} baris valid siap disimpan
                {previewInvalidCount > 0 ? `, ${previewInvalidCount} baris perlu diperiksa` : ''}.
              </p>
            </div>
            <div className="attendance-table-tools">
              <select
                value={previewFilter}
                onChange={(event) => setPreviewFilter(event.target.value)}
                aria-label="Filter pratinjau"
              >
                <option value="semua">Semua ({previewRows.length})</option>
                <option value="valid">Valid ({previewValidCount})</option>
                <option value="belum_lengkap">Belum lengkap</option>
                <option value="invalid">Perlu diperiksa ({previewInvalidCount})</option>
              </select>
              <button type="button" className="outline-button" onClick={clearPreview} disabled={isSaving}>Batal</button>
              <button
                type="button"
                className="primary-button"
                onClick={handleSaveToDatabase}
                disabled={isSaving || previewValidCount === 0}
              >
                {isSaving ? 'Menyimpan...' : `Simpan ke Database (${previewValidCount})`}
              </button>
            </div>
          </div>
          <div className="table-scroll attendance-preview-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tanggal Sesi</th>
                  <th>Nama Pegawai</th>
                  <th>Nomor Pegawai</th>
                  <th>Unit</th>
                  <th>Shift</th>
                  <th>Status Sesi</th>
                  <th>Event</th>
                  <th>Jam Mulai</th>
                  <th>Jam Akhir</th>
                  <th>Validasi</th>
                </tr>
              </thead>
              <tbody>
                {filteredPreviewRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.tanggal_sesi || '—'}</td>
                    <td><strong>{row.nama_pegawai || '—'}</strong><small>{row.email}</small></td>
                    <td>{row.nomor_pegawai || '—'}</td>
                    <td>{row.unit || '—'}</td>
                    <td>{row.shift || '—'}</td>
                    <td>
                      <span className={`attendance-status ${row.status_sesi === 'CLOSED' ? 'closed' : row.status_sesi === 'OPEN' ? 'open' : 'unknown'}`}>
                        {row.status_sesi || '—'}
                      </span>
                    </td>
                    <td>{row.event_selesai} / {row.event_wajib}</td>
                    <td>{row.jam_mulai || '—'}</td>
                    <td>{row.jam_akhir || '—'}</td>
                    <td>
                      {row.issues.length ? (
                        <span className="attendance-validation invalid" title={row.issues.join('; ')}>{row.issues[0]}</span>
                      ) : row.isDuplicateInFile ? (
                        <span className="attendance-validation incomplete">Duplikat di file</span>
                      ) : row.isComplete ? (
                        <span className="attendance-validation valid">Siap (Lengkap)</span>
                      ) : (
                        <span className="attendance-validation incomplete">Siap (Belum lengkap)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DATABASE SUMMARY CARDS */}
      <div className="attendance-summary">
        <div><span>Pegawai tercatat</span><strong>{dbSummary.totalPegawai}</strong></div>
        <div><span>Total sesi presensi</span><strong>{dbSummary.totalSesi}</strong></div>
        <div><span>Sesi lengkap</span><strong className="attendance-valid-number">{dbSummary.sesiLengkap}</strong></div>
        <div><span>Belum lengkap</span><strong className={dbSummary.sesiBelumLengkap ? 'attendance-warning-number' : ''}>{dbSummary.sesiBelumLengkap}</strong></div>
      </div>

      {/* SAVED ATTENDANCE TABLE GROUPED BY EMPLOYEE */}
      <div className="data-panel attendance-table-panel">
        <div className="attendance-table-heading">
          <div>
            <h2>Rekap Presensi Pegawai</h2>
            <p>
              {selectedDate
                ? `Menampilkan kehadiran pegawai pada tanggal ${selectedDate}.`
                : selectedPeriod
                  ? `Menampilkan rekap periode ${selectedPeriod} (${filteredEmployees.length} pegawai).`
                  : `Menampilkan seluruh data tersimpan di database (${filteredEmployees.length} pegawai).`}
            </p>
          </div>
          <div className="attendance-table-tools">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama, nomor pegawai, email..."
            />
            <select
              value={selectedPeriod}
              onChange={(event) => {
                setSelectedPeriod(event.target.value)
                setSelectedDate('')
              }}
              aria-label="Filter periode"
            >
              <option value="">Semua periode</option>
              {periods.map((period) => (
                <option key={period} value={period}>{period}</option>
              ))}
            </select>
            <div className="attendance-date-filter">
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                aria-label="Filter tanggal spesifik"
                title="Saring berdasarkan tanggal tertentu"
              />
              {selectedDate && (
                <button
                  type="button"
                  className="attendance-clear-date"
                  onClick={() => setSelectedDate('')}
                  title="Hapus filter tanggal"
                >
                  ×
                </button>
              )}
            </div>
            <select
              value={completenessFilter}
              onChange={(event) => setCompletenessFilter(event.target.value)}
              aria-label="Filter kelengkapan"
            >
              <option value="semua">Semua status</option>
              <option value="lengkap">Semua sesi lengkap</option>
              <option value="belum_lengkap">Ada sesi belum lengkap</option>
              <option value="open">Ada sesi OPEN</option>
            </select>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Pegawai</th>
                <th>Unit & Status</th>
                <th>{selectedDate ? 'Tanggal' : 'Tanggal Terbaru'}</th>
                <th>Jam Mulai</th>
                <th>Jam Akhir</th>
                <th>Rekap Sesi</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loadingDb ? (
                <tr><td className="table-empty" colSpan="8">Memuat data presensi dari database...</td></tr>
              ) : filteredEmployees.length ? filteredEmployees.map((employee) => {
                const statusClass = employee.status_sesi_terbaru === 'CLOSED' ? 'closed' : 'open'
                return (
                  <tr key={employee.nomor_pegawai}>
                    <td>
                      <strong>{employee.nama_pegawai}</strong>
                      <small>{employee.nomor_pegawai} · {employee.email}</small>
                    </td>
                    <td>
                      <strong>{employee.unit}</strong>
                      <small>{employee.status_kepegawaian || '—'}</small>
                    </td>
                    <td>
                      <strong>{employee.tgl_terbaru}</strong>
                      <small>{employee.shift_terbaru || '—'}</small>
                    </td>
                    <td title={employee.jam_mulai_terbaru || ''}>
                      <strong>{formatTimeOnly(employee.jam_mulai_terbaru)}</strong>
                    </td>
                    <td title={employee.jam_akhir_terbaru || ''}>
                      <strong>{formatTimeOnly(employee.jam_akhir_terbaru)}</strong>
                    </td>
                    <td>
                      <div className="attendance-recap-badges">
                        <span className="attendance-chip">{employee.total_sesi} hari</span>
                        <span className="attendance-validation valid">{employee.sesi_lengkap} lengkap</span>
                        {employee.sesi_belum_lengkap > 0 && (
                          <span className="attendance-validation incomplete">{employee.sesi_belum_lengkap} kurang</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`attendance-status ${statusClass}`}>
                        {employee.status_sesi_terbaru} ({employee.event_selesai_terbaru}/{employee.event_wajib_terbaru})
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-action"
                        onClick={() => openEmployeeDetail(employee)}
                      >
                        Lihat Detail
                      </button>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td className="table-empty" colSpan="8">
                    {employees.length
                      ? 'Tidak ada pegawai yang cocok dengan pencarian atau filter.'
                      : 'Belum ada data presensi di database. Unggah file CSV lalu klik "Simpan ke Database".'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="attendance-import-note">
          Pilih tanggal pada filter untuk melihat jam masuk (mulai) dan jam keluar (akhir) pegawai di tanggal tertentu, atau klik <strong>Lihat Detail</strong> untuk melihat seluruh riwayat presensi per tanggal pegawai tersebut.
        </div>
      </div>
    </section>
  )
}
