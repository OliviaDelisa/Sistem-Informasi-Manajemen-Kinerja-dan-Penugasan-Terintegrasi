const db = require("../config/database");

async function findByLogbookId(idLogbook) {
    const [rows] = await db.execute(
        "SELECT * FROM validasi_logbook WHERE id_logbook = ? ORDER BY waktu_validasi DESC, id_validasi DESC",
        [idLogbook],
    );
    return rows;
}

async function create(data) {
    const [result] = await db.execute(
        `INSERT INTO validasi_logbook
            (id_logbook, id_validator, keputusan, alasan_pengembalian)
         VALUES (?, ?, ?, ?)`,
        [
            data.idLogbook, data.idValidator, data.keputusan,
            data.alasanPengembalian || null,
        ],
    );
    return result.insertId;
}

module.exports = { findByLogbookId, create };
