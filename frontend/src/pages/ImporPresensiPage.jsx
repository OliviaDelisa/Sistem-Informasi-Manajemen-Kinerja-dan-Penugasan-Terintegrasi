import { useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon'
import './impor-presensi.css'

const columns = [
  { key: 'username', label: 'Username / NIP' },
  { key: 'nama', label: 'Nama pegawai' },
  { key: 'tanggal', label: 'Tanggal' },
  { key: 'jam_masuk', label: 'Jam masuk' },
  { key: 'jam_mulai_istirahat', label: 'Mulai istirahat' },
  { key: 'jam_selesai_istirahat', label: 'Selesai istirahat' },
  { key: 'jam_keluar', label: 'Jam keluar' },
  { key: 'status', label: 'Status' },
]
const previewColumns = columns.filter((column) => column.key !== 'username')

const statusNames = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  cuti: 'Cuti',
  alpa: 'Alpa',
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"' && quoted && text[index + 1] === '"') {
      cell += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      row.push(cell.trim())
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
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
  return value.trim().toLowerCase().replace(/[\s/-]+/g, '_')
}

function validateRow(record) {
  const issues = []
  if (!record.username) issues.push('Username/NIP kosong')
  if (!record.nama) issues.push('Nama kosong')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.tanggal)) issues.push('Format tanggal harus YYYY-MM-DD')
  if (!Object.hasOwn(statusNames, record.status.toLowerCase())) issues.push('Status tidak dikenal')
  for (const key of ['jam_masuk', 'jam_mulai_istirahat', 'jam_selesai_istirahat', 'jam_keluar']) {
    if (record[key] && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(record[key])) {
      issues.push(`Format ${key.replaceAll('_', ' ')} tidak valid`)
    }
  }
  if (['hadir', 'terlambat'].includes(record.status.toLowerCase()) && !record.jam_masuk) {
    issues.push('Jam masuk wajib untuk status hadir/terlambat')
  }
  return issues
}

function downloadTemplate() {
  const content = `${columns.map((column) => column.key).join(',')}\npegawai@unand.ac.id,Contoh Pegawai,2026-11-09,08:00,12:00,13:00,16:00,hadir\n`
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'template-impor-presensi.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function ImporPresensiPage() {
  const fileInput = useRef(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('semua')

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setRows([])
    setFileName(file.name)
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Format file belum didukung. Pilih file CSV.')
      return
    }

    try {
      const parsed = parseCsv(await file.text())
      if (parsed.length < 2) {
        setError('File belum memiliki baris data.')
        return
      }
      const headers = parsed[0].map(normalizeHeader)
      const missing = columns.filter((column) => !headers.includes(column.key)).map((column) => column.key)
      if (missing.length) {
        setError(`Kolom wajib tidak ditemukan: ${missing.join(', ')}.`)
        return
      }
      const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]))
      setRows(parsed.slice(1).map((cells, index) => {
        const record = Object.fromEntries(columns.map(({ key }) => [key, cells[headerIndex[key]] || '']))
        return { ...record, id: index + 1, issues: validateRow(record) }
      }))
    } catch {
      setError('File tidak dapat dibaca. Pastikan file CSV tidak rusak.')
    }
  }

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesSearch = !search || `${row.username} ${row.nama} ${row.tanggal}`.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'semua' || (filter === 'valid' ? row.issues.length === 0 : row.issues.length > 0)
    return matchesSearch && matchesFilter
  }), [rows, search, filter])

  const validCount = rows.filter((row) => row.issues.length === 0).length
  const invalidCount = rows.length - validCount

  return (
    <section className="page-section attendance-import-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MANAJEMEN PRESENSI</span>
          <h1>Impor Presensi</h1>
          <p>Unggah file presensi dan periksa datanya sebelum diproses.</p>
        </div>
        <button type="button" className="outline-button" onClick={downloadTemplate}>Unduh template CSV</button>
      </div>

      {error && <div className="page-message error-message" role="alert">{error}</div>}

      <div className="attendance-upload-card">
        <div className="attendance-upload-icon"><Icon name="upload" size={24} /></div>
        <div className="attendance-upload-copy">
          <strong>{fileName || 'Pilih file presensi'}</strong>
          <span>Format CSV. Pastikan kolom sesuai template sebelum mengunggah.</span>
        </div>
        <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={handleFileChange} hidden />
        <button type="button" className="primary-button" onClick={() => fileInput.current?.click()}>Pilih file</button>
      </div>

      <div className="attendance-summary">
        <div><span>Total baris</span><strong>{rows.length}</strong></div>
        <div><span>Data valid</span><strong className="attendance-valid-number">{validCount}</strong></div>
        <div><span>Perlu diperiksa</span><strong className={invalidCount ? 'attendance-invalid-number' : ''}>{invalidCount}</strong></div>
      </div>

      <div className="data-panel attendance-table-panel">
        <div className="attendance-table-heading">
          <div><h2>Pratinjau data presensi</h2><p>{fileName ? `Menampilkan ${filteredRows.length} dari ${rows.length} baris dari ${fileName}` : 'Pilih file CSV untuk menampilkan data di tabel.'}</p></div>
          <div className="attendance-table-tools">
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau NIP" disabled={!rows.length} />
            <select value={filter} onChange={(event) => setFilter(event.target.value)} disabled={!rows.length} aria-label="Filter validasi">
              <option value="semua">Semua data</option>
              <option value="valid">Data valid</option>
              <option value="invalid">Perlu diperiksa</option>
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr>{previewColumns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Validasi</th></tr></thead>
            <tbody>
              {filteredRows.length ? filteredRows.map((row) => (
                <tr key={row.id}>
                  {previewColumns.map(({ key }) => (
                    <td key={key}>{key === 'nama'
                      ? <strong>{row[key] || '—'}</strong>
                      : key === 'status'
                        ? <span className={`attendance-status ${row[key].toLowerCase()}`}>{statusNames[row[key].toLowerCase()] || row[key] || '—'}</span>
                        : row[key] || '—'}</td>
                  ))}
                  <td>{row.issues.length
                    ? <span className="attendance-validation invalid" title={row.issues.join('; ')}>{row.issues[0]}</span>
                    : <span className="attendance-validation valid">Siap</span>}</td>
                </tr>
              )) : (
                <tr><td className="table-empty" colSpan={previewColumns.length + 1}>
                  {rows.length ? 'Tidak ada data yang cocok dengan pencarian atau filter.' : 'Belum ada data. Unggah file CSV untuk melihat pratinjau presensi.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="attendance-import-note">Tabel ini memeriksa format dan kelengkapan file sebagai pratinjau; data belum disimpan ke database.</div>
      </div>
    </section>
  )
}
