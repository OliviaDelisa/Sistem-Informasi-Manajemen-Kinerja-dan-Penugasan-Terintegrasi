import { useState } from 'react'

export default function LoginPage({ onLogin, error }) {
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const quickLogins = [
    { label: 'Dosen', desc: 'Dosen SI', user: 'dosen@unand.ac.id', pass: 'dosen123456' },
    { label: 'Tendik', desc: 'Staf Keuangan', user: 'tendik@unand.ac.id', pass: 'tendik123456' },
    { label: 'Dekan', desc: 'Pimpinan', user: 'dekan@unand.ac.id', pass: 'dekan123' },
    { label: 'Kepala Kantor', desc: 'Kantor FTI', user: 'kepalakantor@unand.ac.id', pass: 'kantor123456' },
    { label: 'Kasi', desc: 'Kasi Keuangan', user: 'kasi@unand.ac.id', pass: 'kasi123456' },
    { label: 'Superadmin', desc: 'Staf SDM', user: 'superadmin@unand.ac.id', pass: 'admin123456' },
  ]

  const handleQuickLogin = async (userEmail, pass) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await onLogin({ username: userEmail, password: pass })
    } finally {
      setIsSubmitting(false)
    }
  }

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
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #e5eee7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <small style={{ fontSize: 10, fontWeight: 700, color: '#547263', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                LOGIN CEPAT PER ROLE:
              </small>
              <small style={{ fontSize: 9, color: '#829188' }}>Klik untuk langsung masuk</small>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {quickLogins.map((item) => (
                <button
                  key={item.user}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleQuickLogin(item.user, item.pass)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #cde4d3',
                    background: '#f2f7f3',
                    color: '#004f28',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    opacity: isSubmitting ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.background = '#e2f0e6'
                      e.currentTarget.style.borderColor = '#9ec8ab'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f2f7f3'
                    e.currentTarget.style.borderColor = '#cde4d3'
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 800 }}>{item.label}</span>
                  <span style={{ fontSize: 9, color: '#4f705b' }}>{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="login-footer">SIM-KP FTI UNAND 2026</p>
        </div>
      </section>
    </main>
  )
}
