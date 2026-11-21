// Use the Vite proxy during development. Set VITE_API_URL (or the legacy
// VITE_API_BASE_URL) when the API is hosted at a different address.
const configuredApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL

export const API_BASE_URL = (configuredApiUrl || '/api').replace(/\/$/, '')
