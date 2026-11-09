const db = require("../config/database");

async function findByKepanitiaanId(idKepanitiaan) {
    const [rows] = await db.execute(
        `SELECT a.*, p.nama, p.username
         FROM anggota_kepanitiaan a
         INNER JOIN pengguna p ON p.id_pengguna = a.id_pengguna
         WHERE a.id_kepanitiaan = ? ORDER BY a.id_anggota`,
        [idKepanitiaan],
    );
    return rows;
}

async function create({ idKepanitiaan, idPengguna, peran }) {
    const [result] = await db.execute(
        `INSERT INTO anggota_kepanitiaan (id_kepanitiaan, id_pengguna, peran)
         VALUES (?, ?, ?)`,
        [idKepanitiaan, idPengguna, peran],
    );
    return result.insertId;
}

module.exports = { findByKepanitiaanId, create };
