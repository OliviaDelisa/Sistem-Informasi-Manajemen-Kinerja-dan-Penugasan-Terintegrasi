const db = require("../config/database");

async function findByPenggunaId(idPengguna) {
    const [rows] = await db.execute(
        `SELECT * FROM logbook
         WHERE id_pengguna = ?
         ORDER BY tgl_kegiatan DESC, id_logbook DESC`,
        [idPengguna],
    );
    return rows;
}

async function create(data) {
    const [result] = await db.execute(
        `INSERT INTO logbook
            (id_pengguna, id_tupoksi, id_penugasan, id_kepanitiaan,
             tgl_kegiatan, kategori, uraian, target, hasil)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.idPengguna, data.idTupoksi || null, data.idPenugasan || null,
            data.idKepanitiaan || null, data.tglKegiatan, data.kategori,
            data.uraian, data.target || null, data.hasil || null,
        ],
    );
    return result.insertId;
}

module.exports = { findByPenggunaId, create };
