
import { API_BASE_URL } from './apiConfig'

/**
 * Ambil daftar logbook milik user tertentu dengan filter opsional.
 * @param {number|string} userId  - id_pengguna dari session login
 * @param {object} filters        - { periode, kategori, status, search }
 * @returns {Promise<{data: array, summary: object}>}
 */
export async function fetchLogbooks(userId, filters = {}) {
  const params = new URLSearchParams({ userId });
  if (filters.periode) params.set('periode', filters.periode);
  if (filters.kategori) params.set('kategori', filters.kategori);
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);

  const res = await fetch(`${API_BASE_URL}/logbook?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { success, data, summary }
}

/**
 * Ambil hanya ringkasan statistik (tanpa daftar baris).
 */
export async function fetchLogbookSummary(userId, periode) {
  const params = new URLSearchParams({ userId });
  if (periode) params.set('periode', periode);
  const res = await fetch(`${API_BASE_URL}/logbook/summary?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { success, summary }
}

/**
 * Simpan logbook baru ke database.
 * @param {object} payload - { idPengguna, tglKegiatan, waktu, kategori, judul, nomorSk, uraian, target, berkasNama, berkasUkuran, keteranganEviden }
 */
export async function saveLogbook(payload) {
  const res = await fetch(`${API_BASE_URL}/logbook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || `HTTP ${res.status}`);
  return json; // { success, message, id }
}

/**
 * Kirim ulang revisi logbook yang perlu diperbaiki.
 * @param {number} id      - id_logbook
 * @param {object} payload - updated logbook fields and optional evidence action/file payload
 */
export async function submitLogbookRevision(id, payload) {
  const res = await fetch(`${API_BASE_URL}/logbook/${id}/revisi`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || `HTTP ${res.status}`);
  return json; // { success, message }
}

export async function saveLogbookRevisionDraft(id, payload) {
  return submitLogbookRevision(id, { ...payload, submit: false });
}

/**
 * Ambil bawahan langsung dan pegawai yang memiliki logbook menunggu pemeriksaan.
 * @param {number|string} supervisorId - id_pengguna atasan
 */
export async function fetchSubordinates(supervisorId) {
  const res = await fetch(`${API_BASE_URL}/logbook/subordinates?supervisorId=${supervisorId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { success, data: [...] }
}

/** Ambil logbook dalam cakupan validasi Dekan/Wakil Dekan saja. */
export async function fetchDekanAssignedLogbooks(supervisorId) {
  const params = new URLSearchParams({ supervisorId });
  const res = await fetch(`${API_BASE_URL}/logbook/dekan-assigned?${params.toString()}`);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

/**
 * Ambil data logbook bawahan atau logbook yang sedang ditugaskan (diverifikasi backend).
 * @param {number|string} supervisorId - id_pengguna atasan
 * @param {number|string} subordinateId - id_pengguna bawahan
 * @param {object} filters - { periode, status, search }
 */
export async function fetchSubordinateLogbooks(supervisorId, subordinateId, filters = {}) {
  const params = new URLSearchParams({ supervisorId, subordinateId });
  if (filters.periode) params.set('periode', filters.periode);
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);

  const res = await fetch(`${API_BASE_URL}/logbook/subordinate-entries?${params.toString()}`);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || `HTTP ${res.status}`);
  return json; // { success, subordinate, entries, summary }
}

/**
 * Lakukan review / validasi atas logbook bawahan.
 * @param {number|string} idLogbook
 * @param {object} payload - { idSupervisor, action: 'validasi'|'revisi'|'tolak', catatanRevisi, komentar }
 */
export async function reviewSubordinateLogbook(idLogbook, payload) {
  const res = await fetch(`${API_BASE_URL}/logbook/${idLogbook}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || `HTTP ${res.status}`);
  return json; // { success, message, data }
}

/**
 * Ambil detail lengkap satu logbook dinamis dari database berdasarkan id_logbook.
 * @param {number|string} idLogbook
 * @param {number|string} [supervisorId]
 */
export async function fetchLogbookDetail(idLogbook, supervisorId) {
  const params = supervisorId ? `?supervisorId=${encodeURIComponent(supervisorId)}` : '';
  const res = await fetch(`${API_BASE_URL}/logbook/${idLogbook}${params}`);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || `HTTP ${res.status}`);
  return json; // { success, data: { logbook, bukti, riwayatReview, riwayatValidasi, catatanPimpinan } }
}
