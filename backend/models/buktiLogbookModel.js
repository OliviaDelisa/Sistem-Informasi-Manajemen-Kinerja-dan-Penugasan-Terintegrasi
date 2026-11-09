const db = require("../config/database");

async function findByLogbookId(idLogbook) {
    const [rows] = await db.execute(
        "SELECT * FROM bukti_logbook WHERE id_logbook = ? ORDER BY id_bukti",
        [idLogbook],
    );
    return rows;
}

async function create(data) {
    const [result] = await db.execute(
        `INSERT INTO bukti_logbook
            (id_logbook, nama_berkas, jenis_berkas, lokasi_berkas, keterangan)
         VALUES (?, ?, ?, ?, ?)`,
        [
            data.idLogbook, data.namaBerkas, data.jenisBerkas,
            data.lokasiBerkas, data.keterangan || null,
        ],
    );
    return result.insertId;
}

module.exports = { findByLogbookId, create };
