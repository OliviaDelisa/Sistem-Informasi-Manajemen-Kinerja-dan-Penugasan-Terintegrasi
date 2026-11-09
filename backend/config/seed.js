const defaultPasswordHash = "$2b$10$54tXygE7XRyOQqb7iy7LfeMuSEy5oUdtO0SCmuEZNvxx.3G27eXMG";
const units = [
    { name: "Fakultas Teknologi Informasi", parent: null },
    { name: "Kantor FTI", parent: "Fakultas Teknologi Informasi" },
    { name: "Departemen Sistem Informasi", parent: "Fakultas Teknologi Informasi" },
    { name: "Departemen Teknik Komputer", parent: "Fakultas Teknologi Informasi" },
    { name: "Departemen Informatika", parent: "Fakultas Teknologi Informasi" },
];
const roles = ["Superadmin", "Dekan / Wakil Dekan", "Kepala Kantor", "Kasi", "Dosen", "Tendik"];
const positions = [
    { name: "Dekan", type: "dosen" },
    { name: "Wakil Dekan I", type: "dosen" },
    { name: "Wakil Dekan II", type: "dosen" },
    { name: "Kepala Departemen", type: "dosen" },
    { name: "Dosen", type: "dosen" },
    { name: "Kepala Kantor", type: "tendik" },
    { name: "Kasi Keuangan dan Aset", type: "tendik" },
    { name: "Kasi Administrasi dan Umum", type: "tendik" },
    { name: "Staf Keuangan dan Aset", type: "tendik" },
    { name: "Staf Administrasi dan Umum", type: "tendik" },
    { name: "Staf SDM", type: "tendik" },
];
const positionAliases = [
    ["Superadmin", "Staf SDM"],
    ["Kasi", "Kasi Keuangan dan Aset"],
    ["Tendik", "Staf Keuangan dan Aset"],
];

async function findUnit(connection, name) {
    const [rows] = await connection.execute(
        "SELECT id_unit FROM unit_kerja WHERE nama_unit = ? LIMIT 1",
        [name],
    );
    return rows[0] || null;
}

async function findPosition(connection, name) {
    const [rows] = await connection.execute(
        "SELECT id_jabatan FROM jabatan WHERE nama_jabatan = ? LIMIT 1",
        [name],
    );
    return rows[0] || null;
}

async function migrateLegacyUnits(connection) {
    const oldFaculty = await findUnit(connection, "Dekanat FTI");
    const newFaculty = await findUnit(connection, "Fakultas Teknologi Informasi");
    if (oldFaculty && !newFaculty) {
        await connection.execute(
            "UPDATE unit_kerja SET nama_unit = ? WHERE id_unit = ?",
            ["Fakultas Teknologi Informasi", oldFaculty.id_unit],
        );
    } else if (oldFaculty && newFaculty && oldFaculty.id_unit !== newFaculty.id_unit) {
        await connection.execute("UPDATE pengguna SET id_unit = ? WHERE id_unit = ?", [
            newFaculty.id_unit, oldFaculty.id_unit,
        ]);
        await connection.execute(
            "UPDATE unit_kerja SET id_induk = ? WHERE id_induk = ? AND id_unit <> ?",
            [newFaculty.id_unit, oldFaculty.id_unit, newFaculty.id_unit],
        );
        await connection.execute("UPDATE unit_kerja SET id_induk = NULL WHERE id_unit = ?", [
            newFaculty.id_unit,
        ]);
        await connection.execute("DELETE FROM unit_kerja WHERE id_unit = ?", [oldFaculty.id_unit]);
    }

    for (const unit of units) {
        await connection.execute(
            "INSERT IGNORE INTO unit_kerja (nama_unit, aktif) VALUES (?, TRUE)",
            [unit.name],
        );
    }
    const unitIds = new Map();
    for (const unit of units) {
        unitIds.set(unit.name, (await findUnit(connection, unit.name)).id_unit);
    }
    for (const unit of units.filter((item) => item.parent)) {
        await connection.execute(
            `UPDATE unit_kerja SET id_induk = ?
             WHERE id_unit = ?`,
            [unitIds.get(unit.parent), unitIds.get(unit.name)],
        );
    }
    return unitIds;
}

async function migrateLegacyPositions(connection) {
    for (const position of positions) {
        await connection.execute(
            `INSERT IGNORE INTO jabatan (nama_jabatan, untuk_jenis, aktif)
             VALUES (?, ?, TRUE)`,
            [position.name, position.type],
        );
        await connection.execute(
            "UPDATE jabatan SET untuk_jenis = ? WHERE nama_jabatan = ?",
            [position.type, position.name],
        );
    }

    for (const [alias, canonical] of positionAliases) {
        const oldPosition = await findPosition(connection, alias);
        const canonicalPosition = await findPosition(connection, canonical);
        if (!oldPosition || !canonicalPosition || oldPosition.id_jabatan === canonicalPosition.id_jabatan) {
            continue;
        }
        await connection.execute("UPDATE pengguna SET id_jabatan = ? WHERE id_jabatan = ?", [
            canonicalPosition.id_jabatan, oldPosition.id_jabatan,
        ]);
        await connection.execute("UPDATE tupoksi SET id_jabatan = ? WHERE id_jabatan = ?", [
            canonicalPosition.id_jabatan, oldPosition.id_jabatan,
        ]);
        await connection.execute(
            `UPDATE IGNORE jabatan_atasan SET id_jabatan = ? WHERE id_jabatan = ?`,
            [canonicalPosition.id_jabatan, oldPosition.id_jabatan],
        );
        await connection.execute(
            `UPDATE IGNORE jabatan_atasan SET id_jabatan_atasan = ? WHERE id_jabatan_atasan = ?`,
            [canonicalPosition.id_jabatan, oldPosition.id_jabatan],
        );
        await connection.execute(
            "DELETE FROM jabatan_atasan WHERE id_jabatan = ? OR id_jabatan_atasan = ?",
            [oldPosition.id_jabatan, oldPosition.id_jabatan],
        );
        await connection.execute("DELETE FROM jabatan WHERE id_jabatan = ?", [oldPosition.id_jabatan]);
    }
}

async function seedHierarchy(connection) {
    const rules = [
        ["Wakil Dekan I", "Dekan", false],
        ["Wakil Dekan II", "Dekan", false],
        ["Kepala Departemen", "Wakil Dekan I", false],
        ["Kepala Departemen", "Wakil Dekan II", false],
        ["Dosen", "Kepala Departemen", true],
        ["Kepala Kantor", "Wakil Dekan I", false],
        ["Kepala Kantor", "Wakil Dekan II", false],
        ["Kasi Keuangan dan Aset", "Kepala Kantor", false],
        ["Kasi Administrasi dan Umum", "Kepala Kantor", false],
        ["Staf Keuangan dan Aset", "Kasi Keuangan dan Aset", false],
        ["Staf Administrasi dan Umum", "Kasi Administrasi dan Umum", false],
    ];
    for (const [child, parent, sameUnit] of rules) {
        await connection.execute(
            `INSERT INTO jabatan_atasan (id_jabatan, id_jabatan_atasan, wajib_unit_sama)
             SELECT child.id_jabatan, parent.id_jabatan, ?
             FROM jabatan child CROSS JOIN jabatan parent
             WHERE child.nama_jabatan = ? AND parent.nama_jabatan = ?
             ON DUPLICATE KEY UPDATE wajib_unit_sama = VALUES(wajib_unit_sama)`,
            [sameUnit, child, parent],
        );
    }
}

async function assignLegacyUsers(connection, unitIds) {
    const facultyJobs = ["Dekan", "Wakil Dekan I", "Wakil Dekan II"];
    const officeJobs = [
        "Kepala Kantor", "Kasi Keuangan dan Aset", "Kasi Administrasi dan Umum",
        "Staf Keuangan dan Aset", "Staf Administrasi dan Umum", "Staf SDM",
    ];
    const facultyMarks = facultyJobs.map(() => "?").join(", ");
    const officeMarks = officeJobs.map(() => "?").join(", ");
    await connection.execute(
        `UPDATE pengguna p INNER JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         SET p.id_unit = ? WHERE j.nama_jabatan IN (${facultyMarks})`,
        [unitIds.get("Fakultas Teknologi Informasi"), ...facultyJobs],
    );
    await connection.execute(
        `UPDATE pengguna p INNER JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         SET p.id_unit = ? WHERE j.nama_jabatan IN (${officeMarks})`,
        [unitIds.get("Kantor FTI"), ...officeJobs],
    );
    await connection.execute(
        `UPDATE pengguna p INNER JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         SET p.id_unit = ?
         WHERE j.nama_jabatan IN ('Kepala Departemen', 'Dosen')
           AND p.id_unit NOT IN (?, ?, ?)`,
        [
            unitIds.get("Departemen Sistem Informasi"),
            unitIds.get("Departemen Sistem Informasi"),
            unitIds.get("Departemen Teknik Komputer"),
            unitIds.get("Departemen Informatika"),
        ],
    );
    await connection.execute(
        `UPDATE pengguna p INNER JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         SET p.jenis_pengguna = j.untuk_jenis,
             p.nidn = CASE WHEN j.untuk_jenis = 'dosen' THEN p.nidn ELSE NULL END`,
    );
}

async function repairLegacySupervisors(connection) {
    await connection.execute(
        `UPDATE pengguna child
         LEFT JOIN pengguna parent ON parent.id_pengguna = child.id_atasan
         LEFT JOIN jabatan_atasan allowed
           ON allowed.id_jabatan = child.id_jabatan
          AND allowed.id_jabatan_atasan = parent.id_jabatan
         SET child.id_atasan = NULL
         WHERE child.id_atasan IS NOT NULL
           AND (parent.id_pengguna IS NULL OR parent.status_akun <> 'aktif'
                OR allowed.id_jabatan IS NULL
                OR (allowed.wajib_unit_sama = TRUE AND child.id_unit <> parent.id_unit))`,
    );
    const [rows] = await connection.execute(
        "SELECT id_pengguna, id_atasan FROM pengguna WHERE id_atasan IS NOT NULL",
    );
    const parents = new Map(rows.map((row) => [Number(row.id_pengguna), Number(row.id_atasan)]));
    const repaired = new Set();
    for (const [userId] of parents) {
        const path = new Set();
        let current = userId;
        while (parents.has(current) && !path.has(current)) {
            path.add(current);
            current = parents.get(current);
        }
        if (path.has(current) && !repaired.has(current)) {
            await connection.execute("UPDATE pengguna SET id_atasan = NULL WHERE id_pengguna = ?", [current]);
            repaired.add(current);
        }
    }
}

async function seedDatabase(connection) {
    const unitIds = await migrateLegacyUnits(connection);
    for (const name of roles) {
        await connection.execute("INSERT IGNORE INTO `role` (nama_role) VALUES (?)", [name]);
    }
    await migrateLegacyPositions(connection);
    await seedHierarchy(connection);
    await assignLegacyUsers(connection, unitIds);
    await repairLegacySupervisors(connection);

    const [[role]] = await connection.execute(
        "SELECT id_role FROM `role` WHERE nama_role = 'Superadmin'",
    );
    const position = await findPosition(connection, "Staf SDM");
    await connection.execute(
        `INSERT IGNORE INTO pengguna
            (nama, jenis_pengguna, username, password_hash, wajib_ganti_password,
             id_unit, id_jabatan, id_role)
         VALUES ('Superadmin', 'tendik', 'superadmin@unand.ac.id', ?, TRUE, ?, ?, ?)`,
        [defaultPasswordHash, unitIds.get("Kantor FTI"), position.id_jabatan, role.id_role],
    );

    const assignments = [
        ["Superadmin", "Dekan / Wakil Dekan", "tugas", true],
        ["Superadmin", "Kepala Kantor", "tugas", true],
        ["Dekan / Wakil Dekan", "Kasi", "tugas", true],
        ["Dekan / Wakil Dekan", "Dosen", "tugas", false],
        ["Kepala Kantor", "Tendik", "tugas", false],
    ];
    for (const [giver, receiver, type, delegation] of assignments) {
        await connection.execute(
            `INSERT IGNORE INTO aturan_penugasan
                (id_role_pemberi, id_role_penerima, jenis_penugasan, boleh_delegasi)
             SELECT rp.id_role, rr.id_role, ?, ?
             FROM \`role\` rp CROSS JOIN \`role\` rr
             WHERE rp.nama_role = ? AND rr.nama_role = ?`,
            [type, delegation, giver, receiver],
        );
    }

    await connection.execute(
        `DELETE t FROM tupoksi t
         LEFT JOIN logbook l ON l.id_tupoksi = t.id_tupoksi
         WHERE LOWER(TRIM(t.uraian_tupoksi)) = 'tes' AND l.id_logbook IS NULL`,
    );
    await connection.execute(
        `UPDATE tupoksi SET aktif = FALSE
         WHERE LOWER(TRIM(uraian_tupoksi)) = 'tes'`,
    );
    const allowedUnitNames = units.map((unit) => unit.name.toLowerCase());
    await connection.execute(
        `UPDATE unit_kerja u
         SET u.aktif = FALSE
         WHERE LOWER(u.nama_unit) NOT IN (?, ?, ?, ?, ?)
           AND NOT EXISTS (SELECT 1 FROM pengguna p WHERE p.id_unit = u.id_unit AND p.status_akun = 'aktif')
           AND NOT EXISTS (SELECT 1 FROM unit_kerja child WHERE child.id_induk = u.id_unit AND child.aktif = TRUE)`,
        allowedUnitNames,
    );
    const allowedPositionNames = positions.map((position) => position.name.toLowerCase());
    await connection.execute(
        `UPDATE jabatan j
         SET j.aktif = FALSE
         WHERE LOWER(j.nama_jabatan) NOT IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           AND NOT EXISTS (SELECT 1 FROM pengguna p WHERE p.id_jabatan = j.id_jabatan AND p.status_akun = 'aktif')`,
        allowedPositionNames,
    );
}

module.exports = { seedDatabase };
