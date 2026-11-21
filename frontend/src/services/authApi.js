import { API_BASE_URL } from './apiConfig'

async function postAuth(path, body, fallbackMessage) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Server tidak dapat dihubungi. Pastikan backend aktif di port 5000.')
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (payload.message) throw new Error(payload.message)
    if (response.status === 404) {
      throw new Error('Endpoint login tidak ditemukan. Periksa alamat API dan pastikan backend berjalan.')
    }
    if (response.status >= 500) {
      throw new Error('Backend gagal memproses login. Periksa terminal backend dan koneksi MySQL.')
    }
    throw new Error(`${fallbackMessage} (HTTP ${response.status}).`)
  }
  return payload
}

export async function loginRequest(credentials) {
  const payload = await postAuth('/auth/login', credentials, 'Login gagal')
  return payload.user
}

export async function changePasswordRequest({ idPengguna, passwordSaatIni, passwordBaru }) {
  return postAuth('/auth/change-password', { idPengguna, passwordSaatIni, passwordBaru }, 'Password tidak dapat diperbarui')
}
