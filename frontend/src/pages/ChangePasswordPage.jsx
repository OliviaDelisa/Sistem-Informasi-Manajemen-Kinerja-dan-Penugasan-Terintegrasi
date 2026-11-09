import { useState } from 'react'
import { changePasswordRequest } from '../services/authApi'

export default function ChangePasswordPage({ user, onChanged }) {
  const [passwordSaatIni, setPasswordSaatIni] = useState('')
  const [passwordBaru, setPasswordBaru] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setMessage('')
    if (passwordBaru !== konfirmasi) {
      setMessage('Konfirmasi password baru belum sama.')
      return
    }
    setBusy(true)
    try {
      await changePasswordRequest({
        idPengguna: user.id,
        passwordSaatIni,
        passwordBaru,
      })
      onChanged()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mandatory-password-page">
      <form className="management-form" onSubmit={submit}>
        <span className="eyebrow">KEAMANAN AKUN</span>
        <h1>Ganti password sementara</h1>
        <p>Untuk melindungi akun, buat password baru sebelum melanjutkan.</p>
        {message && <div className="org-form-error" role="alert">{message}</div>}
        <label>Password saat ini<input type="password" value={passwordSaatIni} onChange={(event) => setPasswordSaatIni(event.target.value)} autoComplete="current-password" required /></label>
        <label>Password baru<input type="password" value={passwordBaru} onChange={(event) => setPasswordBaru(event.target.value)} minLength="12" autoComplete="new-password" required /><small className="form-hint">Minimal 12 karakter.</small></label>
        <label>Ulangi password baru<input type="password" value={konfirmasi} onChange={(event) => setKonfirmasi(event.target.value)} minLength="12" autoComplete="new-password" required /></label>
        <button className="primary-button" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan password baru'}</button>
      </form>
    </main>
  )
}
