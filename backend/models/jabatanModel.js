const db = require("../config/database");

async function findAll({ jenisPengguna, includeInactive = true } = {}) {
    const conditions = [];
    const values = [];
    if (jenisPengguna) {
        conditions.push("j.untuk_jenis = ?");
        values.push(jenisPengguna);
    }
    if (!includeInactive) conditions.push("j.aktif = TRUE");

    const [rows] = await db.execute(
        `SELECT j.id_jabatan, j.nama_jabatan, j.untuk_jenis, j.aktif,
                COUNT(DISTINCT CASE WHEN p.status_akun = 'aktif' THEN p.id_pengguna END) AS akun_aktif
         FROM jabatan j
         LEFT JOIN pengguna p ON p.id_jabatan = j.id_jabatan
         ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
         GROUP BY j.id_jabatan, j.nama_jabatan, j.untuk_jenis, j.aktif
         ORDER BY j.nama_jabatan`,
        values,
    );
    if (!rows.length) return rows;
    const ids = rows.map((row) => row.id_jabatan);
    const placeholders = ids.map(() => "?").join(", ");
    const [hierarchy] = await db.execute(
        `SELECT ja.id_jabatan, parent.id_jabatan AS id_jabatan_atasan,
                parent.nama_jabatan AS nama_jabatan_atasan, ja.wajib_unit_sama
         FROM jabatan_atasan ja
         INNER JOIN jabatan parent ON parent.id_jabatan = ja.id_jabatan_atasan
         WHERE ja.id_jabatan IN (${placeholders})
         ORDER BY parent.nama_jabatan`,
        ids,
    );
    const parentsByPosition = new Map();
    for (const item of hierarchy) {
        if (!parentsByPosition.has(item.id_jabatan)) parentsByPosition.set(item.id_jabatan, []);
        parentsByPosition.get(item.id_jabatan).push(item);
    }
    return rows.map((row) => ({
        ...row,
        boleh_di_bawah: parentsByPosition.get(row.id_jabatan) || [],
    }));
}

async function findById(id) {
    const [rows] = await db.execute(
        `SELECT id_jabatan, nama_jabatan, untuk_jenis, aktif
         FROM jabatan WHERE id_jabatan = ?`,
        [id],
    );
    return rows[0] || null;
}

async function create({ namaJabatan, untukJenis }, connection = db) {
    if (typeof namaJabatan !== "string" || !namaJabatan.trim()) {
        throw new Error("Nama jabatan wajib diisi.");
    }
    if (!["dosen", "tendik"].includes(untukJenis)) {
        throw new Error("Jenis jabatan harus Dosen atau Tendik.");
    }
    const [result] = await connection.execute(
        "INSERT INTO jabatan (nama_jabatan, untuk_jenis) VALUES (?, ?)",
        [namaJabatan.trim(), untukJenis],
    );
    if (connection === db) return findById(result.insertId);
    const [rows] = await connection.execute(
        `SELECT id_jabatan, nama_jabatan, untuk_jenis, aktif
         FROM jabatan WHERE id_jabatan = ?`,
        [result.insertId],
    );
    return rows[0] || null;
}

async function update(id, { namaJabatan, untukJenis }, connection = db) {
    if (typeof namaJabatan !== "string" || !namaJabatan.trim()) {
        throw new Error("Nama jabatan wajib diisi.");
    }
    if (!["dosen", "tendik"].includes(untukJenis)) {
        throw new Error("Jenis jabatan harus Dosen atau Tendik.");
    }
    await connection.execute(
        "UPDATE jabatan SET nama_jabatan = ?, untuk_jenis = ? WHERE id_jabatan = ?",
        [namaJabatan.trim(), untukJenis, id],
    );
    if (connection === db) return findById(id);
    const [rows] = await connection.execute(
        `SELECT id_jabatan, nama_jabatan, untuk_jenis, aktif
         FROM jabatan WHERE id_jabatan = ?`,
        [id],
    );
    return rows[0] || null;
}

async function replaceSupervisors(id, supervisors, connection = db) {
    const [existing] = await connection.execute(
        "SELECT id_jabatan_atasan FROM jabatan_atasan WHERE id_jabatan = ?",
        [id],
    );
    const desired = new Set(supervisors.map((item) => Number(item.idJabatan)));
    for (const supervisor of supervisors) {
        await connection.execute(
            `INSERT INTO jabatan_atasan
                (id_jabatan, id_jabatan_atasan, wajib_unit_sama)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE wajib_unit_sama = VALUES(wajib_unit_sama)`,
            [id, supervisor.idJabatan, Boolean(supervisor.wajibUnitSama)],
        );
    }
    for (const previous of existing) {
        if (!desired.has(Number(previous.id_jabatan_atasan))) {
            await connection.execute(
                "DELETE FROM jabatan_atasan WHERE id_jabatan = ? AND id_jabatan_atasan = ?",
                [id, previous.id_jabatan_atasan],
            );
        }
    }
}

async function setActive(id, active) {
    const [result] = await db.execute(
        "UPDATE jabatan SET aktif = ? WHERE id_jabatan = ?",
        [Boolean(active), id],
    );
    return result.affectedRows ? findById(id) : null;
}

async function findEligibleSupervisors({ idJabatan, idUnit, excludeUserId }) {
    const [rows] = await db.execute(
        `SELECT p.id_pengguna, p.nama, p.id_jabatan, j.nama_jabatan,
                p.id_unit, u.nama_unit
         FROM jabatan_atasan ja
         INNER JOIN pengguna p ON p.id_jabatan = ja.id_jabatan_atasan
         INNER JOIN jabatan j ON j.id_jabatan = p.id_jabatan AND j.aktif = TRUE
         INNER JOIN unit_kerja u ON u.id_unit = p.id_unit AND u.aktif = TRUE
         WHERE ja.id_jabatan = ? AND p.status_akun = 'aktif'
           AND (ja.wajib_unit_sama = FALSE OR p.id_unit = ?)
           AND (? IS NULL OR p.id_pengguna <> ?)
         ORDER BY p.nama`,
        [idJabatan, idUnit, excludeUserId || null, excludeUserId || null],
    );
    return rows;
}

async function findParentJobs(idJabatan) {
    const [rows] = await db.execute(
        `SELECT parent.id_jabatan, parent.nama_jabatan, ja.wajib_unit_sama
         FROM jabatan_atasan ja
         INNER JOIN jabatan parent ON parent.id_jabatan = ja.id_jabatan_atasan AND parent.aktif = TRUE
         WHERE ja.id_jabatan = ? ORDER BY parent.nama_jabatan`,
        [idJabatan],
    );
    return rows;
}

module.exports = {
    findAll,
    findById,
    create,
    update,
    replaceSupervisors,
    setActive,
    findEligibleSupervisors,
    findParentJobs,
};
