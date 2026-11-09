const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export async function loginRequest(credentials) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Login gagal. Silakan coba lagi.')
  }

  return payload.user
}

export async function changePasswordRequest({ idPengguna, passwordSaatIni, passwordBaru }) {
  const response = await fetch(`${API_URL}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idPengguna, passwordSaatIni, passwordBaru }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Password tidak dapat diperbarui.')
  return payload
}
