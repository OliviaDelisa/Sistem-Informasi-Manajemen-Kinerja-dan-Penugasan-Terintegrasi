const db = require("../config/database");

async function findAll() {
    const [rows] = await db.execute(
        `SELECT u.id_unit, u.nama_unit, u.id_induk, u.aktif, parent.nama_unit AS nama_induk,
                COUNT(DISTINCT CASE WHEN p.status_akun = 'aktif' THEN p.id_pengguna END) AS akun_aktif,
                COUNT(DISTINCT CASE WHEN child.aktif = TRUE THEN child.id_unit END) AS anak_aktif
         FROM unit_kerja u
         LEFT JOIN unit_kerja parent ON parent.id_unit = u.id_induk
         LEFT JOIN pengguna p ON p.id_unit = u.id_unit
         LEFT JOIN unit_kerja child ON child.id_induk = u.id_unit
         GROUP BY u.id_unit, u.nama_unit, u.id_induk, u.aktif, parent.nama_unit
         ORDER BY COALESCE(parent.nama_unit, u.nama_unit), u.id_induk IS NOT NULL, u.nama_unit`,
    );
    return rows;
}

async function findById(id) {
    const [rows] = await db.execute(
        "SELECT id_unit, nama_unit, id_induk, aktif FROM unit_kerja WHERE id_unit = ?",
        [id],
    );
    return rows[0] || null;
}

async function create(namaUnit, idInduk = null) {
    if (typeof namaUnit !== "string" || !namaUnit.trim()) {
        throw new Error("Nama unit kerja wajib diisi.");
    }
    const [result] = await db.execute(
        "INSERT INTO unit_kerja (nama_unit, id_induk, aktif) VALUES (?, ?, TRUE)",
        [namaUnit.trim(), idInduk || null],
    );
    return findById(result.insertId);
}

async function update(id, { namaUnit, idInduk }) {
    if (typeof namaUnit !== "string" || !namaUnit.trim()) {
        throw new Error("Nama unit kerja wajib diisi.");
    }
    if (Number(idInduk) === Number(id)) throw new Error("Unit tidak dapat menjadi induknya sendiri.");
    await db.execute(
        "UPDATE unit_kerja SET nama_unit = ?, id_induk = ? WHERE id_unit = ?",
        [namaUnit.trim(), idInduk || null, id],
    );
    return findById(id);
}

async function setActive(id, active) {
    const [result] = await db.execute(
        "UPDATE unit_kerja SET aktif = ? WHERE id_unit = ?",
        [Boolean(active), id],
    );
    return result.affectedRows ? findById(id) : null;
}

module.exports = { findAll, findById, create, update, setActive };
