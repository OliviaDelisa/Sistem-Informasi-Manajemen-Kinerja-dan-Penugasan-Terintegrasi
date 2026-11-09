const db = require("../config/database");

async function findAll() {
    const [rows] = await db.execute("SELECT * FROM kepanitiaan ORDER BY periode_mulai DESC, id_kepanitiaan DESC");
    return rows;
}

async function create({ namaKegiatan, periodeMulai, periodeSelesai, dasarPenugasan, idPembuat }) {
    const [result] = await db.execute(
        `INSERT INTO kepanitiaan
            (nama_kegiatan, periode_mulai, periode_selesai, dasar_penugasan, id_pembuat)
         VALUES (?, ?, ?, ?, ?)`,
        [namaKegiatan, periodeMulai, periodeSelesai, dasarPenugasan || null, idPembuat],
    );
    return result.insertId;
}

module.exports = { findAll, create };
