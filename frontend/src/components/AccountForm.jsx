import { useEffect, useMemo, useState } from 'react'
import { checkUsername, getEligibleSupervisors } from '../services/managementApi'

const initialForm = {
  nama: '',
  username: '',
  password: '',
  jenisPengguna: 'tendik',
  nidn: '',
  idUnit: '',
  idJabatan: '',
  idAtasan: '',
  idRole: '',
  statusAkun: 'aktif',
}

function generatePassword() {
  const groups = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '!@#$%&*',
  ]
  const alphabet = groups.join('')
  const values = new Uint8Array(18)
  window.crypto.getRandomValues(values)
  const password = [
    ...groups.map((group, index) => group[values[index] % group.length]),
    ...Array.from(values.slice(groups.length), (value) => alphabet[value % alphabet.length]),
  ]
  for (let index = password.length - 1; index > 0; index -= 1) {
    const swap = values[index] % (index + 1)
    const character = password[index]
    password[index] = password[swap]
    password[swap] = character
  }
  return password.join('')
}

export default function AccountForm({
  units = [], positions = [], roles = [], users = [], onSubmit, onCancel,
  initialValues = {}, submitText = 'Simpan akun', title = 'Informasi akun baru',
}) {
  const editing = Boolean(initialValues.idPengguna)
  const [form, setForm] = useState({
    ...initialForm,
    ...initialValues,
    jenisPengguna: initialValues.jenisPengguna || initialForm.jenisPengguna,
    password: initialValues.password ?? '',
  })
  const [supervisors, setSupervisors] = useState([])
  const [parentJobs, setParentJobs] = useState([])
  const [usernameAvailable, setUsernameAvailable] = useState(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [passwordGenerated, setPasswordGenerated] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState('')
  const [supervisorManual, setSupervisorManual] = useState(false)

  const matchingPositions = useMemo(
    () => positions.filter((position) => (
      (position.aktif && position.untuk_jenis === form.jenisPengguna) ||
      (editing && Number(position.id_jabatan) === Number(initialValues.idJabatan)
        && position.untuk_jenis === form.jenisPengguna)
    )),
    [positions, form.jenisPengguna, editing, initialValues.idJabatan],
  )
  const activeUnits = units.filter((unit) => (
    (unit.aktif || (editing && Number(unit.id_unit) === Number(initialValues.idUnit))) &&
    (unit.nama_unit !== 'Fakultas Teknologi Informasi' ||
      (editing && Number(unit.id_unit) === Number(initialValues.idUnit)))
  ))
  const usernameValue = form.username.includes('@') ? form.username : `${form.username}@unand.ac.id`

  useEffect(() => {
    if (!form.idJabatan || !form.idUnit) {
      return
    }
    let active = true
    getEligibleSupervisors(form.idJabatan, form.idUnit, initialValues.idPengguna)
      .then(({ supervisors: choices = [], parentJobs: jobs = [] }) => {
        if (!active) return
        setSupervisors(choices)
        setParentJobs(jobs)
        setForm((current) => {
          if (choices.length === 1) return { ...current, idAtasan: String(choices[0].id_pengguna) }
          return choices.some((choice) => String(choice.id_pengguna) === String(current.idAtasan))
            ? current
            : { ...current, idAtasan: '' }
        })
      })
      .catch((error) => {
        if (active) setLocalError(error.message)
      })
    return () => { active = false }
  }, [form.idJabatan, form.idUnit, initialValues.idPengguna])

  useEffect(() => {
    const raw = form.username.trim()
    if (!raw) return undefined
    let active = true
    const timer = window.setTimeout(() => {
      checkUsername(usernameValue, initialValues.idPengguna)
        .then((result) => {
          if (active) setUsernameAvailable(result.available)
        })
        .catch((error) => {
          if (active) setLocalError(error.message)
        })
        .finally(() => {
          if (active) setCheckingUsername(false)
        })
    }, 350)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [form.username, initialValues.idPengguna, usernameValue])

  const update = (event) => {
    const { name, value } = event.target
    setForm((current) => {
      const next = { ...current, [name]: value }
      if (name === 'jenisPengguna') {
        next.nidn = value === 'dosen' ? current.nidn : ''
        next.idJabatan = ''
        next.idAtasan = ''
        setSupervisors([])
        setParentJobs([])
        setSupervisorManual(false)
      }
      if (name === 'idUnit' || name === 'idJabatan') {
        next.idAtasan = ''
        setSupervisors([])
        setParentJobs([])
        setSupervisorManual(false)
      }
      if (name === 'username') {
        setUsernameAvailable(null)
        setCheckingUsername(Boolean(value.trim()))
      }
      if (name === 'password') setPasswordGenerated(false)
      return next
    })
    setLocalError('')
  }

  const updateNidn = (event) => {
    setForm((current) => ({ ...current, nidn: event.target.value.replace(/\D/g, '').slice(0, 10) }))
    setLocalError('')
  }

  const eligible = usernameAvailable === true && !checkingUsername

  function supervisorChain() {
    const first = users.find((item) => String(item.id_pengguna) === String(form.idAtasan))
    if (!first) return ''
    const chain = []
    let current = first
    const visited = new Set()
    while (current && !visited.has(String(current.id_pengguna)) && chain.length < 20) {
      visited.add(String(current.id_pengguna))
      chain.push(`${current.nama} (${current.nama_jabatan})`)
      current = users.find((item) => String(item.id_pengguna) === String(current.id_atasan))
    }
    return [form.nama.trim() || 'Pegawai baru', ...chain].join(' → ')
  }

  async function submit(event) {
    event.preventDefault()
    setLocalError('')
    if (!eligible) {
      if (checkingUsername) {
        setLocalError('Sedang memeriksa username. Tunggu sebentar lalu simpan kembali.')
      } else if (usernameAvailable === false) {
        setLocalError('Username sudah digunakan. Pilih username lain.')
      } else {
        setLocalError('Username belum berhasil diverifikasi. Periksa koneksi backend lalu coba lagi.')
      }
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({ ...form, username: usernameValue })
    } catch (error) {
      setLocalError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="management-form account-form" onSubmit={submit}>
      <div className="form-section-title">{title}</div>
      {localError && <div className="org-form-error" role="alert">{localError}</div>}

      <section className="account-form-section">
        <h3>1. Data pegawai</h3>
        <label>Nama lengkap *<input name="nama" value={form.nama} onChange={update} required autoComplete="name" /></label>
        <fieldset className="org-choice-field">
          <legend>Jenis pengguna *</legend>
          <div className="org-choice-cards">
            {[['dosen', 'Dosen', 'Tenaga pendidik'], ['tendik', 'Tendik', 'Tenaga kependidikan']].map(([value, name, description]) => (
              <label className={form.jenisPengguna === value ? 'selected' : ''} key={value}>
                <input type="radio" name="jenisPengguna" value={value} checked={form.jenisPengguna === value} onChange={update} />
                <strong>{name}</strong><small>{description}</small>
              </label>
            ))}
          </div>
        </fieldset>
        {form.jenisPengguna === 'dosen' && (
          <label>NIDN *<input
            name="nidn"
            value={form.nidn}
            onChange={updateNidn}
            inputMode="numeric"
            pattern="[0-9]{1,10}"
            maxLength="10"
            required
          /></label>
        )}
      </section>

      <section className="account-form-section">
        <h3>2. Posisi di organisasi</h3>
        <label>Unit kerja *<select name="idUnit" value={form.idUnit} onChange={update} required>
          <option value="">Pilih unit kerja</option>
          {activeUnits.map((unit) => <option key={unit.id_unit} value={unit.id_unit}>{unit.nama_unit}</option>)}
        </select></label>
        <label>Jabatan *<select name="idJabatan" value={form.idJabatan} onChange={update} required>
          <option value="">Pilih jabatan sesuai jenis pengguna</option>
          {matchingPositions.map((position) => <option key={position.id_jabatan} value={position.id_jabatan}>{position.nama_jabatan}</option>)}
        </select></label>
        <label>Atasan langsung
          {supervisors.length === 1 && !supervisorManual
            ? <div className="org-supervisor-single">Atasan: {supervisors[0].nama} ({supervisors[0].nama_jabatan}) <button type="button" className="table-action" onClick={() => { setSupervisorManual(true); setForm({ ...form, idAtasan: '' }) }}>Ubah</button></div>
            : <select name="idAtasan" value={form.idAtasan} onChange={update}>
              <option value="">Tidak ditentukan</option>
              {supervisors.map((person) => <option key={person.id_pengguna} value={person.id_pengguna}>{person.nama} — {person.nama_jabatan}{person.nama_unit ? ` · ${person.nama_unit}` : ''}</option>)}
            </select>}
        </label>
        {form.idJabatan && parentJobs.length > 0 && supervisors.length === 0 && (
          <div className="org-supervisor-warning">
            {parentJobs.map((parent) => parent.nama_jabatan).join(' atau ')} belum dibuat untuk aturan unit ini. Akun tetap bisa disimpan, atasan dapat diisi nanti.
          </div>
        )}
        {form.idAtasan && <div className="org-chain-preview"><strong>Pratinjau rantai atasan</strong><span>{supervisorChain()}</span></div>}
      </section>

      <section className="account-form-section">
        <h3>3. Akun dan hak akses</h3>
        <label>Username *
          <span className="org-username-input"><input name="username" value={form.username.replace(/@unand\.ac\.id$/i, '')} onChange={update} pattern="[A-Za-z0-9._-]+" required autoComplete="off" /><b>@unand.ac.id</b></span>
          {form.username.trim() && <small className={usernameAvailable === true ? 'org-username-available' : usernameAvailable === false ? 'org-username-taken' : ''}>
            {checkingUsername ? 'Memeriksa username...' : usernameAvailable === true ? 'Username tersedia' : usernameAvailable === false ? 'Username sudah dipakai' : 'Username belum dapat diverifikasi'}
          </small>}
        </label>
        {editing && <label>Status akun<select name="statusAkun" value={form.statusAkun} onChange={(event) => {
          if (event.target.value === 'nonaktif' && Number(initialValues.bawahanAktif) > 0) {
            setLocalError('Pindahkan bawahan aktif terlebih dahulu melalui aksi Pindahkan bawahan.')
            return
          }
          if (event.target.value === 'nonaktif' && !window.confirm('Akun dinonaktifkan dan tidak dapat digunakan untuk login. Lanjutkan?')) return
          update(event)
        }}><option value="aktif">Aktif</option><option value="nonaktif" disabled={Number(initialValues.bawahanAktif) > 0}>Nonaktif</option></select>
          {Number(initialValues.bawahanAktif) > 0 && <small className="form-hint">Pindahkan {initialValues.bawahanAktif} bawahan aktif sebelum menonaktifkan akun ini.</small>}
        </label>}
        <label>Hak akses *
          <select name="idRole" value={form.idRole} onChange={update} required>
            <option value="">Pilih hak akses</option>
            {roles.map((role) => <option key={role.id_role} value={role.id_role}>{role.nama_role}</option>)}
          </select>
          <small className="form-hint">Hak akses menentukan menu apa yang dapat dibuka.</small>
        </label>
        <label>{editing ? 'Password baru (opsional)' : 'Password sementara *'}
          <div className="org-password-field">
            <input type={passwordVisible ? 'text' : 'password'} name="password" value={form.password} onChange={update} minLength="12" required={!editing} autoComplete="new-password" />
            <button
              type="button"
              className="org-password-visibility"
              aria-label={passwordVisible ? 'Sembunyikan password' : 'Lihat password'}
              aria-pressed={passwordVisible}
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              {passwordVisible
                ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.7 10.7 0 0 1 12 5c5.5 0 9 7 9 7a15.8 15.8 0 0 1-3.1 3.8M6.2 6.2C3.9 7.7 3 12 3 12s3.5 7 9 7a9.7 9.7 0 0 0 3-.5" /></svg>
                : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>}
            </button>
            {!editing && <button type="button" className="outline-button" onClick={() => {
              setForm((current) => ({ ...current, password: generatePassword() }))
              setPasswordGenerated(true)
            }}>Buat password</button>}
          </div>
          {!editing && passwordGenerated
            ? <small className="form-hint">Password sementara harus minimal 12 karakter dan wajib diganti saat masuk pertama kali. <button type="button" className="org-copy-button" onClick={() => navigator.clipboard.writeText(form.password).then(() => setLocalError('Password disalin.')).catch(() => setLocalError('Password tidak dapat disalin dari browser ini.'))}>Salin</button></small>
            : <small className="form-hint">{editing ? 'Kosongkan jika tidak ingin mengganti password.' : 'Masukkan password sementara minimal 12 karakter atau buat dengan tombol di atas.'}</small>}
        </label>
      </section>

      <div className="form-actions account-form-actions">
        <button type="button" className="outline-button" onClick={onCancel}>Batal</button>
        <button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Menyimpan...' : submitText}</button>
      </div>
    </form>
  )
}
