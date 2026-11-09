const db = require("../config/database");

async function findByUsername(username) {
    const [rows] = await db.execute(
        `SELECT
            p.id_pengguna, p.nama, p.username, p.password_hash, p.jenis_pengguna,
            p.status_akun, p.gagal_login, p.terkunci_sampai,
            (p.terkunci_sampai IS NOT NULL AND p.terkunci_sampai > NOW()) AS akun_terkunci,
            p.wajib_ganti_password,
            p.id_unit, p.id_jabatan, r.id_role, r.nama_role,
            u.nama_unit, j.nama_jabatan
         FROM pengguna p
         INNER JOIN \`role\` r ON r.id_role = p.id_role
         INNER JOIN unit_kerja u ON u.id_unit = p.id_unit
         INNER JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         WHERE p.username = ?
         LIMIT 1`,
        [username],
    );
    return rows[0] || null;
}

async function findById(id) {
    const [rows] = await db.execute(
        `SELECT id_pengguna, nama, jenis_pengguna, nidn, username,
                id_unit, id_jabatan, id_atasan, id_role, status_akun,
                gagal_login, terkunci_sampai, wajib_ganti_password
         FROM pengguna WHERE id_pengguna = ?`,
        [id],
    );
    return rows[0] || null;
}

async function findAuthById(id) {
    const [rows] = await db.execute(
        `SELECT id_pengguna, password_hash, status_akun, wajib_ganti_password
         FROM pengguna WHERE id_pengguna = ?`,
        [id],
    );
    return rows[0] || null;
}

async function findAll() {
    const [rows] = await db.execute(
        `SELECT p.id_pengguna, p.nama, p.jenis_pengguna, p.nidn, p.username,
                p.id_unit, p.id_jabatan, p.id_atasan, p.id_role, p.status_akun,
                p.gagal_login, p.terkunci_sampai, r.nama_role,
                p.wajib_ganti_password, u.nama_unit, j.nama_jabatan,
                supervisor.nama AS nama_atasan, supervisorJob.nama_jabatan AS jabatan_atasan,
                (SELECT COUNT(*) FROM pengguna subordinate
                 WHERE subordinate.id_atasan = p.id_pengguna
                   AND subordinate.status_akun = 'aktif') AS bawahan_aktif
         FROM pengguna p
         INNER JOIN \`role\` r ON r.id_role = p.id_role
         INNER JOIN unit_kerja u ON u.id_unit = p.id_unit
         INNER JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         LEFT JOIN pengguna supervisor ON supervisor.id_pengguna = p.id_atasan
         LEFT JOIN jabatan supervisorJob ON supervisorJob.id_jabatan = supervisor.id_jabatan
         ORDER BY p.nama`,
    );
    return rows;
}

function normalizedUsername(username) {
    const value = typeof username === "string" ? username.trim().toLowerCase() : "";
    return value && !value.includes("@") ? `${value}@unand.ac.id` : value;
}

function validateData(data) {
    if (!data || typeof data.nama !== "string" || !data.nama.trim()) {
        throw new Error("Nama pengguna wajib diisi.");
    }
    if (!["dosen", "tendik"].includes(data.jenisPengguna)) {
        throw new Error("Jenis pengguna harus dosen atau tendik.");
    }
    if (data.jenisPengguna === "dosen" && (!data.nidn || !/^\d{1,10}$/.test(data.nidn))) {
        throw new Error("NIDN wajib berupa angka maksimal 10 digit untuk dosen.");
    }
    if (data.jenisPengguna === "tendik" && data.nidn) {
        throw new Error("NIDN hanya boleh diisi untuk dosen.");
    }
    if (!/^[^\s@]+@unand\.ac\.id$/.test(normalizedUsername(data.username))) {
        throw new Error("Username harus menggunakan email @unand.ac.id.");
    }
    if (data.statusAkun && !["aktif", "nonaktif"].includes(data.statusAkun)) {
        throw new Error("Status akun harus aktif atau nonaktif.");
    }
}

async function create(data) {
    validateData(data);
    const [result] = await db.execute(
        `INSERT INTO pengguna
            (nama, jenis_pengguna, nidn, username, password_hash,
             status_akun, wajib_ganti_password, id_unit, id_jabatan, id_atasan, id_role)
         VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?, ?, ?)`,
        [
            data.nama.trim(), data.jenisPengguna, data.nidn || null,
            normalizedUsername(data.username), data.passwordHash,
            "aktif", data.idUnit, data.idJabatan,
            data.idAtasan || null, data.idRole,
        ],
    );
    return findById(result.insertId);
}

async function updateById(id, data) {
    const current = await findById(id);
    if (!current) return null;

    const next = {
        nama: data.nama === undefined ? current.nama : data.nama.trim(),
        jenisPengguna: data.jenisPengguna || current.jenis_pengguna,
        username: data.username === undefined ? current.username : normalizedUsername(data.username),
        nidn: data.nidn === undefined ? current.nidn : data.nidn || null,
        idUnit: data.idUnit || current.id_unit,
        idJabatan: data.idJabatan || current.id_jabatan,
        idAtasan: data.idAtasan === undefined ? current.id_atasan : data.idAtasan || null,
        idRole: data.idRole || current.id_role,
        statusAkun: data.statusAkun || current.status_akun,
    };
    validateData(next);
    if (Number(next.idAtasan) === Number(id)) {
        throw new Error("Pengguna tidak dapat menjadi atasannya sendiri.");
    }

    await db.execute(
        `UPDATE pengguna
         SET nama = ?, jenis_pengguna = ?, nidn = ?, username = ?,
             id_unit = ?, id_jabatan = ?, id_atasan = ?, id_role = ?, status_akun = ?
         WHERE id_pengguna = ?`,
        [
            next.nama, next.jenisPengguna, next.nidn || null, next.username,
            next.idUnit, next.idJabatan, next.idAtasan, next.idRole, next.statusAkun, id,
        ],
    );
    if (data.passwordHash) {
        await db.execute(
            "UPDATE pengguna SET password_hash = ?, wajib_ganti_password = TRUE, gagal_login = 0, terkunci_sampai = NULL WHERE id_pengguna = ?",
            [data.passwordHash, id],
        );
    }
    return findById(id);
}

async function updatePassword(id, passwordHash) {
    const [result] = await db.execute(
        `UPDATE pengguna SET password_hash = ?, wajib_ganti_password = TRUE, gagal_login = 0, terkunci_sampai = NULL
         WHERE id_pengguna = ?`,
        [passwordHash, id],
    );
    return result.affectedRows ? findById(id) : null;
}

async function recordLoginFailure(id) {
    await db.execute(
        `UPDATE pengguna
         SET terkunci_sampai = CASE
                 WHEN gagal_login + 1 >= 5 THEN DATE_ADD(NOW(), INTERVAL 15 MINUTE)
                 ELSE terkunci_sampai
             END,
             gagal_login = LEAST(gagal_login + 1, 5)
         WHERE id_pengguna = ? AND status_akun = 'aktif'
           AND (terkunci_sampai IS NULL OR terkunci_sampai <= NOW())`,
        [id],
    );
}

async function clearLoginFailures(id) {
    await db.execute(
        "UPDATE pengguna SET gagal_login = 0, terkunci_sampai = NULL WHERE id_pengguna = ?",
        [id],
    );
}

async function isUsernameAvailable(username, excludeUserId) {
    const [rows] = await db.execute(
        `SELECT id_pengguna FROM pengguna
         WHERE username = ? AND (? IS NULL OR id_pengguna <> ?) LIMIT 1`,
        [normalizedUsername(username), excludeUserId || null, excludeUserId || null],
    );
    return rows.length === 0;
}

async function findActiveSubordinates(id) {
    const [rows] = await db.execute(
        `SELECT p.id_pengguna, p.nama, p.username, p.id_unit, p.id_jabatan,
                u.nama_unit, j.nama_jabatan
         FROM pengguna p
         INNER JOIN unit_kerja u ON u.id_unit = p.id_unit
         INNER JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         WHERE p.id_atasan = ? AND p.status_akun = 'aktif'
         ORDER BY p.nama`,
        [id],
    );
    return rows;
}

async function findSupervisorOptions(id) {
    const [rows] = await db.execute(
        `WITH RECURSIVE descendants (id_pengguna) AS (
             SELECT id_pengguna FROM pengguna
             WHERE id_atasan = ? AND status_akun = 'aktif'
             UNION DISTINCT
             SELECT child.id_pengguna FROM pengguna child
             INNER JOIN descendants parent ON parent.id_pengguna = child.id_atasan
             WHERE child.status_akun = 'aktif'
         )
         SELECT candidate.id_pengguna, candidate.nama, candidate.id_jabatan, job.nama_jabatan
         FROM pengguna candidate
         INNER JOIN jabatan job ON job.id_jabatan = candidate.id_jabatan AND job.aktif = TRUE
         INNER JOIN unit_kerja unit ON unit.id_unit = candidate.id_unit AND unit.aktif = TRUE
         WHERE candidate.status_akun = 'aktif' AND candidate.id_pengguna <> ?
           AND candidate.id_pengguna NOT IN (SELECT id_pengguna FROM descendants)
           AND EXISTS (
               SELECT 1 FROM pengguna subordinate
               WHERE subordinate.id_atasan = ? AND subordinate.status_akun = 'aktif'
           )
           AND NOT EXISTS (
               SELECT 1
               FROM pengguna subordinate
               LEFT JOIN jabatan_atasan allowed
                 ON allowed.id_jabatan = subordinate.id_jabatan
                AND allowed.id_jabatan_atasan = candidate.id_jabatan
               WHERE subordinate.id_atasan = ? AND subordinate.status_akun = 'aktif'
                 AND (allowed.id_jabatan IS NULL
                      OR (allowed.wajib_unit_sama = TRUE AND subordinate.id_unit <> candidate.id_unit))
           )
         ORDER BY candidate.nama`,
        [id, id, id, id],
    );
    return rows;
}

async function transferSubordinates(id, newSupervisorId) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [subordinates] = await connection.execute(
            "SELECT id_pengguna FROM pengguna WHERE id_atasan = ? AND status_akun = 'aktif' FOR UPDATE",
            [id],
        );
        for (const subordinate of subordinates) {
            await connection.execute(
                "UPDATE pengguna SET id_atasan = ? WHERE id_pengguna = ?",
                [newSupervisorId, subordinate.id_pengguna],
            );
        }
        await connection.commit();
        return subordinates.length;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function updateOwnPassword(id, passwordHash) {
    const [result] = await db.execute(
        `UPDATE pengguna
         SET password_hash = ?, wajib_ganti_password = FALSE,
             gagal_login = 0, terkunci_sampai = NULL
         WHERE id_pengguna = ? AND status_akun = 'aktif'`,
        [passwordHash, id],
    );
    return result.affectedRows > 0;
}

module.exports = {
    findByUsername,
    findById,
    findAuthById,
    findAll,
    create,
    updateById,
    updatePassword,
    recordLoginFailure,
    clearLoginFailures,
    isUsernameAvailable,
    findActiveSubordinates,
    findSupervisorOptions,
    transferSubordinates,
    updateOwnPassword,
    validateData,
};
