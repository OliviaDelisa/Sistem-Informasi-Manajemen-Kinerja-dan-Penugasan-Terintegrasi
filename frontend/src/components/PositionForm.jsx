import { useState } from 'react'

export default function PositionForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ namaJabatan: '', uraianTupoksi: '' })
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  return <form className="management-form" onSubmit={(event) => { event.preventDefault(); onSubmit(form) }}>
    <div className="form-section-title">Informasi jabatan baru</div>
    <label>Nama jabatan<input name="namaJabatan" value={form.namaJabatan} onChange={update} required /></label>
    <label>Uraian tupoksi<textarea name="uraianTupoksi" value={form.uraianTupoksi} onChange={update} rows="4" required /><small className="form-hint">Pisahkan beberapa uraian dengan baris baru.</small></label>
    <div className="form-actions"><button type="button" className="outline-button" onClick={onCancel}>Batal</button><button type="submit" className="primary-button">Simpan Jabatan</button></div>
  </form>
}
