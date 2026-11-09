const db = require("../config/database");

async function findAll() {
    const [rows] = await db.execute("SELECT * FROM impor_presensi ORDER BY waktu_impor DESC, id_impor DESC");
    return rows;
}

async function create(data) {
    const [result] = await db.execute(
        `INSERT INTO impor_presensi
            (id_pengimpor, nama_berkas, periode, baris_berhasil, baris_gagal, hasil_validasi)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            data.idPengimpor, data.namaBerkas, data.periode,
            data.barisBerhasil || 0, data.barisGagal || 0, data.hasilValidasi || null,
        ],
    );
    return result.insertId;
}

module.exports = { findAll, create };
