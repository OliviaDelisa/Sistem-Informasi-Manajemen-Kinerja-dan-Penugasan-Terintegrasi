import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createPosition,
  createTupoksi,
  createUnit,
  getPositions,
  getUnits,
  setPositionActive,
  setTupoksiActive,
  setUnitActive,
  updatePosition,
  updateTupoksi,
  updateUnit,
} from '../services/managementApi'
import './organization.css'

const tabs = ['Unit Kerja', 'Jabatan', 'Tupoksi']
const positionParents = {
  Dekan: [],
  'Wakil Dekan I': ['Dekan'],
  'Wakil Dekan II': ['Dekan'],
  'Kepala Departemen': ['Wakil Dekan I', 'Wakil Dekan II'],
  Dosen: ['Kepala Departemen'],
  'Kepala Kantor': ['Wakil Dekan I', 'Wakil Dekan II'],
  'Kasi Keuangan dan Aset': ['Kepala Kantor'],
  'Kasi Administrasi dan Umum': ['Kepala Kantor'],
  'Staf Keuangan dan Aset': ['Kasi Keuangan dan Aset'],
  'Staf Administrasi dan Umum': ['Kasi Administrasi dan Umum'],
  'Staf SDM': [],
}

function SidePanel({ title, onClose, children }) {
  return (
    <div className="org-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="org-modal organization-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="org-modal-heading">
          <h2>{title}</h2>
          <button type="button" className="outline-button" onClick={onClose}>Tutup</button>
        </div>
        {children}
      </section>
    </div>
  )
}

function hierarchyDepth(unit, units) {
  let depth = 0
  let parentId = unit.id_induk
  while (parentId && depth < units.length) {
    const parent = units.find((item) => Number(item.id_unit) === Number(parentId))
    if (!parent) break
    depth += 1
    parentId = parent.id_induk
  }
  return depth
}

export default function PositionManagementPage() {
  const [tab, setTab] = useState(tabs[0])
  const [units, setUnits] = useState([])
  const [positions, setPositions] = useState([])
  const [selectedPositionId, setSelectedPositionId] = useState(null)
  const [drawer, setDrawer] = useState('')
  const [editing, setEditing] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [unitForm, setUnitForm] = useState({ namaUnit: '', idInduk: '' })
  const [positionForm, setPositionForm] = useState({
    namaJabatan: '', untukJenis: 'tendik', idJabatanAtasan: '',
  })
  const [newTupoksi, setNewTupoksi] = useState('')
  const [editingTupoksiId, setEditingTupoksiId] = useState(null)
  const [editingTupoksiText, setEditingTupoksiText] = useState('')

  const loadData = useCallback(async () => {
    const [unitPayload, positionPayload] = await Promise.all([getUnits(), getPositions()])
    setUnits(unitPayload.units || [])
    const nextPositions = positionPayload.positions || []
    setPositions(nextPositions)
    if (nextPositions.length) setSelectedPositionId((current) => current || nextPositions[0].id_jabatan)
  }, [])

  useEffect(() => {
    Promise.resolve().then(loadData).catch((error) => setMessage(error.message))
  }, [loadData])

  const selectedPosition = useMemo(
    () => positions.find((position) => Number(position.id_jabatan) === Number(selectedPositionId)),
    [positions, selectedPositionId],
  )

  function openUnitForm(unit = null) {
    setEditing(unit)
    setUnitForm(unit
      ? { namaUnit: unit.nama_unit, idInduk: unit.id_induk || '' }
      : { namaUnit: '', idInduk: '' })
    setDrawer('unit')
  }

  function openPositionForm(position = null) {
    setEditing(position)
    setPositionForm(position ? {
      namaJabatan: position.nama_jabatan,
      untukJenis: position.untuk_jenis,
      idJabatanAtasan: position.boleh_di_bawah[0]?.id_jabatan_atasan || '',
    } : { namaJabatan: '', untukJenis: 'tendik', idJabatanAtasan: '' })
    setDrawer('position')
  }

  async function submitUnit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const payload = {
        namaUnit: unitForm.namaUnit,
        idInduk: unitForm.idInduk ? Number(unitForm.idInduk) : null,
      }
      if (editing) await updateUnit(editing.id_unit, payload)
      else await createUnit(payload)
      await loadData()
      setDrawer('')
      setMessage(editing ? 'Unit kerja berhasil diperbarui.' : 'Unit kerja berhasil ditambahkan.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitPosition(event) {
    event.preventDefault()
    setBusy(true)
    const parent = activeParents.find(
      (item) => Number(item.id_jabatan) === Number(positionForm.idJabatanAtasan),
    )
    const supervisors = parent ? [{
      idJabatan: Number(parent.id_jabatan),
      wajibUnitSama: parent.nama_jabatan === 'Kepala Departemen',
    }] : []
    try {
      const payload = {
        namaJabatan: positionForm.namaJabatan,
        untukJenis: positionForm.untukJenis,
        bolehDiBawah: supervisors,
      }
      const response = editing
        ? await updatePosition(editing.id_jabatan, payload)
        : await createPosition(payload)
      await loadData()
      if (response.position?.id_jabatan) setSelectedPositionId(response.position.id_jabatan)
      setDrawer('')
      setMessage(editing ? 'Jabatan berhasil diperbarui.' : 'Jabatan berhasil ditambahkan.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function changeUnitStatus(unit) {
    const nextActive = !unit.aktif
    const prompt = nextActive
      ? `Aktifkan unit ${unit.nama_unit}?`
      : `${unit.nama_unit} akan disembunyikan dari pilihan unit baru. Akun atau unit anak yang masih aktif harus dipindahkan dulu. Lanjutkan?`
    if (!window.confirm(prompt)) return
    try {
      await setUnitActive(unit.id_unit, nextActive)
      await loadData()
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function changePositionStatus(position) {
    const nextActive = !position.aktif
    if (!window.confirm(nextActive
      ? `Aktifkan jabatan ${position.nama_jabatan}?`
      : `Jabatan ${position.nama_jabatan} akan disembunyikan dari pilihan akun baru. Akun yang sudah ada tidak berubah. Lanjutkan?`)) return
    try {
      await setPositionActive(position.id_jabatan, nextActive)
      await loadData()
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function addTupoksi(event) {
    event.preventDefault()
    if (!selectedPosition || !newTupoksi.trim()) return
    try {
      await createTupoksi(selectedPosition.id_jabatan, newTupoksi)
      setNewTupoksi('')
      await loadData()
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function saveTupoksi(id) {
    try {
      await updateTupoksi(id, editingTupoksiText)
      setEditingTupoksiId(null)
      await loadData()
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function toggleTupoksi(item) {
    if (item.aktif && item.jumlah_logbook) {
      if (!window.confirm(`Butir ini dipakai di ${item.jumlah_logbook} logbook. Logbook lama tetap utuh, dan tupoksi tidak muncul untuk logbook baru. Nonaktifkan?`)) return
    }
    try {
      await setTupoksiActive(item.id_tupoksi, !item.aktif)
      await loadData()
    } catch (error) {
      setMessage(error.message)
    }
  }

  const activeUnits = units.filter((unit) => unit.aktif && (!editing || Number(unit.id_unit) !== Number(editing.id_unit)))
  const activeParents = positions.filter((position) => position.aktif && (!editing || Number(position.id_jabatan) !== Number(editing.id_jabatan)))
  const knownSupervisorNames = [...new Set(Object.values(positionParents).flat())]
  const expectedParentNames = positionParents[positionForm.namaJabatan.trim()]
  const plausibleParents = activeParents.filter((position) => (
    expectedParentNames
      ? expectedParentNames.includes(position.nama_jabatan) ||
        editing?.boleh_di_bawah.some((parent) => Number(parent.id_jabatan_atasan) === Number(position.id_jabatan))
      : knownSupervisorNames.includes(position.nama_jabatan) ||
        editing?.boleh_di_bawah.some((parent) => Number(parent.id_jabatan_atasan) === Number(position.id_jabatan))
  ))

  return (
    <section className="page-section organization-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">STRUKTUR ORGANISASI</span>
          <h1>Jabatan, Unit Kerja & Tupoksi</h1>
          <p>Isi berurutan dari kiri ke kanan: unit, jabatan, lalu tupoksi.</p>
        </div>
      </div>

      {message && <div className="page-message" role="status">{message}<button type="button" onClick={() => setMessage('')}>Tutup</button></div>}

      <div className="org-tabs" role="tablist" aria-label="Pengelolaan organisasi">
        {tabs.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? 'active' : ''}
            key={item}
            onClick={() => setTab(item)}
          >{item}</button>
        ))}
      </div>

      {tab === 'Unit Kerja' && (
        <div className="data-panel">
          <div className="org-panel-heading">
            <div><h2>Unit kerja</h2><p>Unit induk Fakultas Teknologi Informasi membawahi kantor dan departemen.</p></div>
            <button type="button" className="primary-button" onClick={() => openUnitForm()}>+ Tambah unit</button>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Nama unit</th><th>Akun aktif</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.id_unit}>
                    <td><span className="org-tree-name" style={{ '--org-depth': hierarchyDepth(unit, units) }}><strong>{unit.nama_unit}</strong>{unit.nama_induk && <small>{unit.nama_induk}</small>}</span></td>
                    <td>{unit.akun_aktif}</td>
                    <td><span className={`status-pill ${unit.aktif ? '' : 'danger'}`}>{unit.aktif ? 'Aktif' : 'Nonaktif'}</span></td>
                    <td className="table-actions">
                      <button type="button" className="table-action" onClick={() => openUnitForm(unit)}>Ubah</button>
                      <button
                        type="button"
                        className="table-action danger"
                        title={unit.akun_aktif ? 'Pindahkan akun aktif terlebih dahulu' : ''}
                        disabled={Boolean(unit.aktif && (unit.akun_aktif > 0 || unit.anak_aktif > 0))}
                        onClick={() => changeUnitStatus(unit)}
                      >{unit.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                    </td>
                  </tr>
                ))}
                {!units.length && <tr><td className="table-empty" colSpan="4">Belum ada unit kerja. Tambahkan unit induk terlebih dahulu.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Jabatan' && (
        <div className="data-panel">
          <div className="org-panel-heading">
            <div><h2>Jabatan</h2><p>Atur jenis pegawai dan satu atasan langsung untuk setiap jabatan.</p></div>
            <button type="button" className="primary-button" onClick={() => openPositionForm()}>+ Tambah jabatan</button>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Nama jabatan</th><th>Jenis pegawai</th><th>Atasan langsung</th><th>Akun aktif</th><th>Aksi</th></tr></thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.id_jabatan}>
                    <td><strong>{position.nama_jabatan}</strong></td>
                    <td><span className={`org-type ${position.untuk_jenis}`}>{position.untuk_jenis === 'dosen' ? 'Dosen' : 'Tendik'}</span></td>
                    <td>{position.boleh_di_bawah.length
                      ? <span className="org-parent-tag">{position.boleh_di_bawah[0].nama_jabatan_atasan}</span>
                      : <small>—</small>}</td>
                    <td>{position.akun_aktif}</td>
                    <td className="table-actions">
                      <button type="button" className="table-action" onClick={() => { setSelectedPositionId(position.id_jabatan); setTab('Tupoksi') }}>Kelola tupoksi</button>
                      <button type="button" className="table-action" onClick={() => openPositionForm(position)}>Ubah</button>
                      <details className="org-actions-menu">
                        <summary aria-label={`Menu aksi ${position.nama_jabatan}`} title="Aksi lainnya">⋯</summary>
                        <div className="org-actions-menu-content">
                          <button
                            type="button"
                            className={position.aktif ? 'danger' : ''}
                            title={position.akun_aktif ? 'Pindahkan akun aktif terlebih dahulu' : ''}
                            disabled={Boolean(position.aktif && position.akun_aktif > 0)}
                            onClick={(event) => {
                              event.currentTarget.closest('details').open = false
                              changePositionStatus(position)
                            }}
                          >{position.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
                {!positions.length && <tr><td className="table-empty" colSpan="5">Belum ada jabatan. Tambahkan jabatan setelah memeriksa unit kerja.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Tupoksi' && (
        <div className="data-panel org-tupoksi-layout">
          <aside className="org-position-list">
            <h2>Jabatan</h2>
            {positions.map((position) => (
              <button
                type="button"
                key={position.id_jabatan}
                className={Number(selectedPositionId) === Number(position.id_jabatan) ? 'selected' : ''}
                onClick={() => setSelectedPositionId(position.id_jabatan)}
              >
                <span>{position.nama_jabatan}{!position.aktif && <small>Nonaktif</small>}</span>
                <b>{position.tupoksi.length}</b>
              </button>
            ))}
          </aside>
          <div className="org-tupoksi-list">
            <div className="org-panel-heading">
              <div><h2>{selectedPosition?.nama_jabatan || 'Pilih jabatan'}</h2><p>Satu butir tugas per baris. Tupoksi nonaktif tidak muncul di logbook baru.</p></div>
            </div>
            {selectedPosition?.tupoksi.length ? selectedPosition.tupoksi.map((item) => (
              <div className={`org-tupoksi-row ${item.aktif ? '' : 'inactive'}`} key={item.id_tupoksi}>
                {editingTupoksiId === item.id_tupoksi
                  ? <input value={editingTupoksiText} onChange={(event) => setEditingTupoksiText(event.target.value)} aria-label="Uraian tupoksi" />
                  : <div className="org-tupoksi-copy"><span>{item.uraian_tupoksi}</span><small>{item.jumlah_logbook ? `Dipakai di ${item.jumlah_logbook} logbook` : item.aktif ? 'Belum digunakan logbook' : 'Nonaktif'}</small></div>}
                <div className="org-tupoksi-actions">
                  {editingTupoksiId === item.id_tupoksi
                    ? <><button type="button" className="table-action" onClick={() => saveTupoksi(item.id_tupoksi)}>Simpan</button><button type="button" className="table-action" onClick={() => setEditingTupoksiId(null)}>Batal</button></>
                    : <button type="button" className="table-action" onClick={() => { setEditingTupoksiId(item.id_tupoksi); setEditingTupoksiText(item.uraian_tupoksi) }}>Ubah</button>}
                  <label className="org-switch" title={item.aktif ? 'Nonaktifkan tupoksi' : 'Aktifkan tupoksi'}>
                    <input type="checkbox" checked={Boolean(item.aktif)} onChange={() => toggleTupoksi(item)} />
                    <span />
                  </label>
                </div>
              </div>
            )) : <div className="org-empty">Belum ada tupoksi untuk jabatan ini. Tambahkan butir tugas pertama.</div>}
            <form className="org-add-tupoksi" onSubmit={addTupoksi}>
              <input value={newTupoksi} onChange={(event) => setNewTupoksi(event.target.value)} placeholder="Tambah butir tugas" aria-label="Tambah butir tugas" disabled={!selectedPosition?.aktif} />
              <button type="submit" className="primary-button" disabled={!selectedPosition?.aktif || !newTupoksi.trim()}>Tambah</button>
            </form>
          </div>
        </div>
      )}

      {drawer === 'unit' && (
        <SidePanel title={editing ? 'Ubah unit kerja' : 'Tambah unit kerja'} onClose={() => setDrawer('')}>
          <form className="management-form" onSubmit={submitUnit}>
            <label>Nama unit<input value={unitForm.namaUnit} onChange={(event) => setUnitForm({ ...unitForm, namaUnit: event.target.value })} required /></label>
            <label>Bagian dari<select value={unitForm.idInduk} onChange={(event) => setUnitForm({ ...unitForm, idInduk: event.target.value })}>
              <option value="">Unit paling atas (tidak di bawah unit lain)</option>
              {activeUnits.map((unit) => <option key={unit.id_unit} value={unit.id_unit}>{unit.nama_unit}</option>)}
            </select><small className="form-hint">Kosongkan hanya untuk unit teratas.</small></label>
            <div className="form-actions"><button type="button" className="outline-button" onClick={() => setDrawer('')}>Batal</button><button className="primary-button" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan unit'}</button></div>
          </form>
        </SidePanel>
      )}

      {drawer === 'position' && (
        <SidePanel title={editing ? 'Ubah jabatan' : 'Tambah jabatan'} onClose={() => setDrawer('')}>
          <form className="management-form" onSubmit={submitPosition}>
            <label>Nama jabatan<input value={positionForm.namaJabatan} onChange={(event) => setPositionForm({ ...positionForm, namaJabatan: event.target.value })} required /></label>
            <fieldset className="org-choice-field">
              <legend>Jenis pegawai</legend>
              <div className="org-choice-cards">
                {[
                  ['dosen', 'Dosen', 'Jabatan untuk tenaga pendidik.'],
                  ['tendik', 'Tendik', 'Jabatan untuk tenaga kependidikan.'],
                ].map(([value, title, description]) => (
                  <label className={positionForm.untukJenis === value ? 'selected' : ''} key={value}>
                    <input type="radio" name="untukJenis" value={value} checked={positionForm.untukJenis === value} onChange={() => setPositionForm({ ...positionForm, untukJenis: value })} />
                    <strong>{title}</strong><small>{description}</small>
                  </label>
                ))}
              </div>
            </fieldset>
            <label>Atasan langsung
              <select value={positionForm.idJabatanAtasan} onChange={(event) => setPositionForm({ ...positionForm, idJabatanAtasan: event.target.value })}>
                <option value="">Tidak ada (jabatan tertinggi)</option>
                {plausibleParents.map((parent) => <option key={parent.id_jabatan} value={parent.id_jabatan}>{parent.nama_jabatan}</option>)}
              </select>
              <small className="form-hint">Pilih atasan langsung, yaitu satu tingkat di atasnya.</small>
            </label>
            <div className="form-actions"><button type="button" className="outline-button" onClick={() => setDrawer('')}>Batal</button><button className="primary-button" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan jabatan'}</button></div>
          </form>
        </SidePanel>
      )}
    </section>
  )
}
