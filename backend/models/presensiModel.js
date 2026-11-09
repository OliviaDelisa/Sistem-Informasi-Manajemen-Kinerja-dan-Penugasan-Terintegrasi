const db = require("../config/database");

async function findByPenggunaAndPeriod(idPengguna, mulai, selesai) {
    const [rows] = await db.execute(
        `SELECT * FROM presensi
         WHERE id_pengguna = ? AND tgl_presensi BETWEEN ? AND ?
         ORDER BY tgl_presensi`,
        [idPengguna, mulai, selesai],
    );
    return rows;
}

async function create(data) {
    const [result] = await db.execute(
        `INSERT INTO presensi
            (id_pengguna, id_impor, tgl_presensi, jam_masuk, jam_mulai_istirahat,
             jam_selesai_istirahat, jam_keluar, status_presensi)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.idPengguna, data.idImpor || null, data.tglPresensi,
            data.jamMasuk || null, data.jamMulaiIstirahat || null,
            data.jamSelesaiIstirahat || null, data.jamKeluar || null,
            data.statusPresensi,
        ],
    );
    return result.insertId;
}

module.exports = { findByPenggunaAndPeriod, create };
