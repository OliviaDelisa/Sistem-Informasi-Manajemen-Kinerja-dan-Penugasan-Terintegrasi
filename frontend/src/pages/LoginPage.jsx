import { useState } from 'react'

export default function LoginPage({ onLogin, error }) {
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="unand-logo"><span>UNAND</span><small>UNIVERSITAS ANDALAS</small></div>
        <div className="login-brand-copy">
          <span className="eyebrow">SISTEM INFORMASI TERINTEGRASI</span>
          <h1>SIM-KP<br /><em>FTI UNAND</em></h1>
          <p>Sistem Informasi Manajemen Kinerja dan Penugasan Terintegrasi</p>
          <span className="brand-description">Mewujudkan tata kelola kinerja sivitas akademika yang terukur, transparan, akuntabel, dan terintegrasi secara sah dengan Tanda Tangan Elektronik (BSrE BSSN).</span>
        </div>
        <small className="login-copyright">SIM-KP FTI UNAND 2026</small>
      </section>
      <section className="login-form-panel">
        <div className="login-form-wrap">
          {error && <div className="login-alert" role="alert">{error}</div>}
          <div className="form-heading"><h2>Selamat Datang di Portal SIM-KP</h2><p>Silakan masukkan kredensial akun Unand Anda untuk mengakses sistem penugasan dan kinerja.</p></div>
          <form onSubmit={async (event) => {
            event.preventDefault()
            setIsSubmitting(true)
            await onLogin({ username: event.currentTarget.username.value, password: event.currentTarget.password.value })
            setIsSubmitting(false)
          }}>
            <label htmlFor="username">Username</label>
            <input id="username" name="username" type="text" defaultValue="superadmin@unand.ac.id" autoComplete="username" required />
            <label htmlFor="password">Password</label>
            <div className="password-input"><input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Masukkan password" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Sembunyikan' : 'Lihat'}</button></div>
            <div className="form-options"><label className="check-label"><input type="checkbox" /> Ingatkan saya di perangkat ini</label><a href="#forgot">Lupa password?</a></div>
            <button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? 'MEMPROSES...' : 'LOGIN'}</button>
          </form>
          <p className="login-footer">SIM-KP FTI UNAND 2026</p>
        </div>
      </section>
    </main>
  )
}
