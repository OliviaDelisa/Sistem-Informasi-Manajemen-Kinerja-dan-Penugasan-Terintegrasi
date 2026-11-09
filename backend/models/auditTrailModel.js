const db = require("../config/database");

async function findRecent(limit = 100) {
    const [rows] = await db.execute(
        "SELECT * FROM audit_trail ORDER BY waktu DESC, id_aktivitas DESC LIMIT ?",
        [Math.min(Math.max(Number(limit) || 100, 1), 500)],
    );
    return rows;
}

async function create(data) {
    const [result] = await db.execute(
        `INSERT INTO audit_trail
            (id_pengguna, jenis_aktivitas, objek_diubah, id_objek,
             data_sebelum, data_sesudah, keterangan)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            data.idPengguna || null, data.jenisAktivitas, data.objekDiubah || null,
            data.idObjek || null, data.dataSebelum ? JSON.stringify(data.dataSebelum) : null,
            data.dataSesudah ? JSON.stringify(data.dataSesudah) : null, data.keterangan || null,
        ],
    );
    return result.insertId;
}

module.exports = { findRecent, create };
