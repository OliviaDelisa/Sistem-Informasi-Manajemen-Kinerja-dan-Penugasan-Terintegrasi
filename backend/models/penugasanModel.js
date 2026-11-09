const db = require("../config/database");

async function findByUserId(idPengguna) {
    const [rows] = await db.execute(
        `SELECT * FROM penugasan
         WHERE id_pemberi = ? OR id_penerima = ?
         ORDER BY tgl_penugasan DESC, id_penugasan DESC`,
        [idPengguna, idPengguna],
    );
    return rows;
}

async function create(data) {
    const [result] = await db.execute(
        `INSERT INTO penugasan
            (id_pemberi, id_penerima, id_penugasan_asal, deskripsi, prioritas, tenggat)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            data.idPemberi, data.idPenerima, data.idPenugasanAsal || null,
            data.deskripsi, data.prioritas || "sedang", data.tenggat || null,
        ],
    );
    return result.insertId;
}

module.exports = { findByUserId, create };
