const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Permintaan gagal diproses.')
  return payload
}

export const getUsers = () => request('/management/users')
export const getUnits = () => request('/management/units')
export const getPositions = (options = {}) => {
  const query = new URLSearchParams(options).toString()
  return request(`/management/positions${query ? `?${query}` : ''}`)
}
export const getDashboardSummary = () => request('/management/dashboard-summary')
export const createUser = (data) => request('/management/users', { method: 'POST', body: JSON.stringify(data) })
export const updateUser = (id, data) => request(`/management/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const resetUserPassword = (id) => request(`/management/users/${id}/reset-password`, { method: 'POST' })
export const checkUsername = (username, excludeId) => request(`/management/usernames/available?${new URLSearchParams({ username, ...(excludeId ? { excludeId } : {}) })}`)
export const getEligibleSupervisors = (idJabatan, idUnit, excludeUserId) => request(`/management/eligible-supervisors?${new URLSearchParams({ idJabatan, idUnit, ...(excludeUserId ? { excludeUserId } : {}) })}`)
export const createUnit = (data) => request('/management/units', { method: 'POST', body: JSON.stringify(data) })
export const updateUnit = (id, data) => request(`/management/units/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const setUnitActive = (id, aktif) => request(`/management/units/${id}/status`, { method: 'PATCH', body: JSON.stringify({ aktif }) })
export const createPosition = (data) => request('/management/positions', { method: 'POST', body: JSON.stringify(data) })
export const updatePosition = (id, data) => request(`/management/positions/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const setPositionActive = (id, aktif) => request(`/management/positions/${id}/status`, { method: 'PATCH', body: JSON.stringify({ aktif }) })
export const createTupoksi = (idJabatan, uraianTupoksi) => request(`/management/positions/${idJabatan}/tupoksi`, { method: 'POST', body: JSON.stringify({ uraianTupoksi }) })
export const updateTupoksi = (id, uraianTupoksi) => request(`/management/tupoksi/${id}`, { method: 'PUT', body: JSON.stringify({ uraianTupoksi }) })
export const setTupoksiActive = (id, aktif) => request(`/management/tupoksi/${id}/status`, { method: 'PATCH', body: JSON.stringify({ aktif }) })
export const getSubordinates = (id) => request(`/management/users/${id}/subordinates`)
export const getSupervisorOptions = (id) => request(`/management/users/${id}/supervisor-options`)
export const transferSubordinates = (id, newSupervisorId) => request(`/management/users/${id}/transfer-subordinates`, { method: 'POST', body: JSON.stringify({ newSupervisorId }) })
