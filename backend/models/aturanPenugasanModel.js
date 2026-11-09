const db = require("../config/database");

async function findAll() {
    const [rows] = await db.execute(
        `SELECT a.id_aturan, a.id_role_pemberi, rp.nama_role AS role_pemberi,
                a.id_role_penerima, rr.nama_role AS role_penerima,
                a.jenis_penugasan, a.boleh_delegasi
         FROM aturan_penugasan a
         INNER JOIN \`role\` rp ON rp.id_role = a.id_role_pemberi
         INNER JOIN \`role\` rr ON rr.id_role = a.id_role_penerima
         ORDER BY a.id_aturan`,
    );
    return rows;
}

async function canAssign(idRolePemberi, idRolePenerima, jenisPenugasan) {
    const [rows] = await db.execute(
        `SELECT id_aturan, boleh_delegasi
         FROM aturan_penugasan
         WHERE id_role_pemberi = ? AND id_role_penerima = ? AND jenis_penugasan = ?
         LIMIT 1`,
        [idRolePemberi, idRolePenerima, jenisPenugasan],
    );
    return rows[0] || null;
}

module.exports = { findAll, canAssign };
