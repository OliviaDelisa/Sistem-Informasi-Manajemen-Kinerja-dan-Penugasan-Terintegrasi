const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

async function parseResponse(res, fallbackMsg) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || fallbackMsg);
  }
  return data;
}

export async function fetchBawahan(userId) {
  const res = await fetch(`${API_BASE}/penugasan/bawahan?userId=${encodeURIComponent(userId || "")}`);
  const data = await parseResponse(res, "Gagal memuat daftar bawahan.");
  return data.data || [];
}

export async function fetchDaftarPenugasan(userId) {
  const res = await fetch(`${API_BASE}/penugasan?userId=${encodeURIComponent(userId || "")}`);
  return parseResponse(res, "Gagal memuat daftar penugasan.");
}

export async function createPenugasanApi(payload) {
  const res = await fetch(`${API_BASE}/penugasan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse(res, "Gagal membuat penugasan.");
}

export async function updatePenugasanApi(id, payload) {
  const res = await fetch(`${API_BASE}/penugasan/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse(res, "Gagal mengubah penugasan.");
}

export async function cancelPenugasanApi(id, payload) {
  const res = await fetch(`${API_BASE}/penugasan/${id}/batal`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse(res, "Gagal membatalkan penugasan.");
}

export async function delegatePenugasanApi(id, payload) {
  const res = await fetch(`${API_BASE}/penugasan/${id}/delegasi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse(res, "Gagal mendelegasikan penugasan.");
}

export async function respondPenugasanApi(id, payload) {
  const res = await fetch(`${API_BASE}/penugasan/${id}/respons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse(res, "Gagal mengirim respons penugasan.");
}

export async function updateProgresPenugasanApi(id, payload) {
  const res = await fetch(`${API_BASE}/penugasan/${id}/progres`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse(res, "Gagal memperbarui progres penugasan.");
}

export async function fetchRiwayatPenugasan(userId) {
  const res = await fetch(`${API_BASE}/riwayat-penugasan?userId=${encodeURIComponent(userId || "")}`);
  const data = await parseResponse(res, "Gagal memuat riwayat penugasan.");
  return data.data || [];
}

export async function fetchDetailRiwayatPenugasan(id) {
  const res = await fetch(`${API_BASE}/riwayat-penugasan/${id}`);
  return parseResponse(res, "Gagal memuat detail riwayat penugasan.");
}
