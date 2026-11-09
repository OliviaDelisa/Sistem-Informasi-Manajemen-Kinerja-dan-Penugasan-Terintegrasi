import { useEffect, useMemo, useState } from 'react'
import AccountForm from '../components/AccountForm'
import {
  createUser,
  getPositions,
  getSubordinates,
  getSupervisorOptions,
  getUnits,
  getUsers,
  resetUserPassword,
  transferSubordinates,
  updateUser,
} from '../services/managementApi'

export default function AccountManagementPage() {
  const [users, setUsers] = useState([])
  const [units, setUnits] = useState([])
  const [positions, setPositions] = useState([])
  const [roles, setRoles] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [unitFilter, setUnitFilter] = useState('all')
  const [unassignedFilter, setUnassignedFilter] = useState(false)
  const [temporaryCredential, setTemporaryCredential] = useState(null)
  const [transferUser, setTransferUser] = useState(null)
  const [transferData, setTransferData] = useState({ users: [], options: [] })
  const [replacementId, setReplacementId] = useState('')

  useEffect(() => {
    Promise.all([getUsers(), getUnits(), getPositions()])
      .then(([userPayload, unitPayload, positionPayload]) => {
        setUsers(userPayload.users || [])
        setRoles(userPayload.roles || [])
        setUnits(unitPayload.units || [])
        setPositions(positionPayload.positions || [])
      })
      .catch((error) => setMessage(error.message))
  }, [])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch = !search || `${user.nama} ${user.username} ${user.nama_jabatan} ${user.nama_unit}`.toLowerCase().includes(search.toLowerCase())
      const matchesRole = roleFilter === 'all' || String(user.id_role) === roleFilter
      const matchesUnit = unitFilter === 'all' || String(user.id_unit) === unitFilter
      const matchesUnassigned = !unassignedFilter || !user.id_atasan
      return matchesSearch && matchesRole && matchesUnit && matchesUnassigned
    })
  }, [users, search, roleFilter, unitFilter, unassignedFilter])

  async function refreshUsers() {
    const response = await getUsers()
    setUsers(response.users || [])
    setRoles(response.roles || [])
  }

  async function handleSubmit(form) {
    try {
      if (editingUser) {
        await updateUser(editingUser.id_pengguna, {
          nama: form.nama,
          username: form.username,
          password: form.password && form.password.trim() ? form.password.trim() : undefined,
          jenisPengguna: form.jenisPengguna,
          nidn: form.jenisPengguna === 'dosen' ? form.nidn : '',
          idUnit: Number(form.idUnit),
          idJabatan: Number(form.idJabatan),
          idAtasan: form.idAtasan ? Number(form.idAtasan) : null,
          idRole: Number(form.idRole),
          statusAkun: form.statusAkun,
        })
        setMessage('Akun berhasil diperbarui.')
      } else {
        setTemporaryCredential(null)
        await createUser(form)
        setTemporaryCredential({ username: form.username, password: form.password })
        setMessage('Akun berhasil ditambahkan.')
      }
      setShowForm(false)
      setEditingUser(null)
      await refreshUsers()
    } catch (error) {
      setMessage(error.message)
      throw error
    }
  }

  async function handleReset(user) {
    if (!window.confirm(`Buat password sementara baru untuk ${user.nama}? Password lama tidak dapat digunakan dan pengguna wajib menggantinya saat masuk.`)) return
    try {
      const result = await resetUserPassword(user.id_pengguna)
      setTemporaryCredential({ username: user.username, password: result.temporaryPassword })
      setMessage(`Password sementara ${user.nama} dibuat. Salin sekarang karena hanya ditampilkan sekali.`)
    } catch (error) {
      setMessage(error.message)
    }
  }

  function openCreateForm() {
    setEditingUser(null)
    setShowForm(true)
  }

  function openEditForm(user) {
    setEditingUser(user)
    setShowForm(true)
  }

  async function openTransferForm(user) {
    try {
      const { users: subordinates } = await getSubordinates(user.id_pengguna)
      const payload = await getSupervisorOptions(user.id_pengguna)
      setTransferUser(user)
      setTransferData({ users: subordinates || [], options: payload.supervisors || [] })
      setReplacementId('')
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function submitTransfer() {
    if (!transferUser || !replacementId) return
    if (!window.confirm(`Pindahkan ${transferData.users.length} bawahan dari ${transferUser.nama} ke atasan pengganti?`)) return
    try {
      const result = await transferSubordinates(transferUser.id_pengguna, Number(replacementId))
      setMessage(result.message)
      setTransferUser(null)
      await refreshUsers()
    } catch (error) {
      setMessage(error.message)
    }
  }

  const formValues = editingUser ? {
    nama: editingUser.nama,
    username: editingUser.username.replace('@unand.ac.id', ''),
    password: '',
    jenisPengguna: editingUser.jenis_pengguna,
    nidn: editingUser.nidn || '',
    idUnit: editingUser.id_unit,
    idJabatan: editingUser.id_jabatan,
    idAtasan: editingUser.id_atasan || '',
    idPengguna: editingUser.id_pengguna,
    idRole: editingUser.id_role,
    statusAkun: editingUser.status_akun,
    bawahanAktif: editingUser.bawahan_aktif,
  } : {}

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MANAJEMEN AKUN</span>
          <h1>Manajemen Akun & Hak Akses</h1>
          <p>Kelola akun, role, unit kerja, dan jabatan pengguna.</p>
        </div>
        <button className="primary-button page-action" onClick={openCreateForm}>+ Tambah akun</button>
      </div>

      {message && <div className="page-message">{message}</div>}

      <div className="toolbar-panel">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari nama, username, jabatan, unit..."
        />
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="all">Semua hak akses</option>
          {roles.map((role) => <option key={role.id_role} value={role.id_role}>{role.nama_role}</option>)}
        </select>
        <select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}>
          <option value="all">Semua unit</option>
          {units.map((unit) => <option key={unit.id_unit} value={unit.id_unit}>{unit.nama_unit}</option>)}
        </select>
        <label className="account-unassigned-filter"><input type="checkbox" checked={unassignedFilter} onChange={(event) => setUnassignedFilter(event.target.checked)} /> Atasan belum ditentukan</label>
      </div>

      {temporaryCredential && <div className="org-temporary-password" role="status">
        <div><strong>Password sementara — salin sekarang</strong><span>{temporaryCredential.username} · {temporaryCredential.password}</span><small>Ini hanya ditampilkan satu kali. Pengguna wajib menggantinya saat masuk.</small></div>
        <button type="button" className="outline-button" onClick={() => navigator.clipboard.writeText(temporaryCredential.password).then(() => setMessage('Password disalin.')).catch(() => setMessage('Password tidak dapat disalin dari browser ini.'))}>Salin password</button>
        <button type="button" className="table-action" onClick={() => setTemporaryCredential(null)}>Tutup</button>
      </div>}

      <div className="data-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Username</th>
                <th>Hak akses</th>
                <th>Unit kerja</th>
                <th>Jabatan</th>
                <th>Atasan</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length ? filteredUsers.map((user) => (
                <tr key={user.id_pengguna}>
                  <td><strong>{user.nama}</strong><small>{user.jenis_pengguna}</small></td>
                  <td>{user.username}</td>
                  <td><span className="status-pill">{user.nama_role}</span></td>
                  <td>{user.nama_unit}</td>
                  <td>{user.nama_jabatan}</td>
                  <td>{user.nama_atasan ? `${user.nama_atasan} (${user.jabatan_atasan})` : <span className="org-unassigned">Atasan belum ditentukan</span>}</td>
                  <td><span className={`status-pill ${user.status_akun === 'aktif' ? '' : 'danger'}`}>{user.status_akun}</span></td>
                  <td className="table-actions">
                    <button className="table-action" onClick={() => openEditForm(user)}>Edit</button>
                    {Number(user.bawahan_aktif) > 0 && <button className="table-action" onClick={() => openTransferForm(user)}>Pindahkan bawahan ({user.bawahan_aktif})</button>}
                    <button className="table-action danger" onClick={() => handleReset(user)}>Buat password sementara</button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="table-empty" colSpan="8">Tidak ada akun yang sesuai dengan pencarian atau filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <div className="org-modal-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget) { setShowForm(false); setEditingUser(null) }
      }}>
        <section className="org-modal account-modal" role="dialog" aria-modal="true" aria-label={editingUser ? 'Ubah akun pengguna' : 'Tambah akun pengguna'}>
          <div className="org-modal-heading">
            <div>
              <span className="eyebrow">MANAJEMEN AKUN</span>
              <h2>{editingUser ? 'Edit akun pengguna' : 'Tambah akun pengguna'}</h2>
              <small>{editingUser ? 'Perbarui data akun sesuai struktur organisasi.' : 'Buat akun dan tetapkan hak akses sesuai struktur organisasi.'}</small>
            </div>
            <button type="button" className="outline-button" onClick={() => { setShowForm(false); setEditingUser(null) }}>Tutup</button>
          </div>
          <AccountForm
            units={units}
            positions={positions}
            roles={roles}
            users={users}
            initialValues={formValues}
            submitText={editingUser ? 'Simpan perubahan' : 'Simpan akun'}
            title={editingUser ? 'Informasi akun' : 'Informasi akun baru'}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingUser(null) }}
          />
        </section>
      </div>}

      {transferUser && <div className="org-drawer-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setTransferUser(null)
      }}>
        <aside className="org-drawer" aria-label="Pindahkan bawahan">
          <div className="org-drawer-heading"><h2>Pindahkan bawahan</h2><button className="outline-button" onClick={() => setTransferUser(null)}>Tutup</button></div>
          <div className="org-transfer-content">
            <p>Bawahan aktif dari <strong>{transferUser.nama}</strong> yang akan dipindahkan:</p>
            <ul>{transferData.users.map((subordinate) => <li key={subordinate.id_pengguna}>{subordinate.nama} — {subordinate.nama_jabatan} · {subordinate.nama_unit}</li>)}</ul>
            <label>Atasan pengganti<select value={replacementId} onChange={(event) => setReplacementId(event.target.value)} required>
              <option value="">Pilih atasan pengganti</option>
              {transferData.options.map((option) => <option key={option.id_pengguna} value={option.id_pengguna}>{option.nama} — {option.nama_jabatan}</option>)}
            </select></label>
            {!transferData.options.length && <div className="org-supervisor-warning">Belum ada atasan aktif yang memenuhi aturan jabatan untuk semua bawahan. Perbarui struktur atau buat akun atasan lebih dulu.</div>}
            <div className="form-actions"><button className="outline-button" onClick={() => setTransferUser(null)}>Batal</button><button className="primary-button" disabled={!replacementId} onClick={submitTransfer}>Pindahkan bawahan</button></div>
          </div>
        </aside>
      </div>}
    </section>
  )
}
