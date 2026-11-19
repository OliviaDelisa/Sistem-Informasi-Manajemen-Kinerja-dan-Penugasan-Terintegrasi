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
        ["Kepala Departemen", "Dekan", false],
        ["Kepala Departemen", "Wakil Dekan I", false],
        ["Kepala Departemen", "Wakil Dekan II", false],
        ["Dosen", "Kepala Departemen", true],
        ["Dosen", "Dekan", false],
        ["Kepala Kantor", "Dekan", false],
        ["Kepala Kantor", "Wakil Dekan I", false],
        ["Kepala Kantor", "Wakil Dekan II", false],
        ["Kasi Keuangan dan Aset", "Dekan", false],
        ["Kasi Keuangan dan Aset", "Wakil Dekan I", false],
        ["Kasi Keuangan dan Aset", "Wakil Dekan II", false],
        ["Kasi Keuangan dan Aset", "Kepala Kantor", false],
        ["Kasi Administrasi dan Umum", "Dekan", false],
        ["Kasi Administrasi dan Umum", "Wakil Dekan I", false],
        ["Kasi Administrasi dan Umum", "Wakil Dekan II", false],
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

    const defaultAccounts = [
        ["Superadmin SDM", "tendik", "superadmin@unand.ac.id", "Kantor FTI", "Staf SDM", "Superadmin", null],
        ["Prof. Dr. Ir. Ahmad Hidayat, M.T.", "dosen", "dekan@unand.ac.id", "Fakultas Teknologi Informasi", "Dekan", "Dekan / Wakil Dekan", null],
        ["Dr. Eng. Budi Raharjo, M.T.", "dosen", "wadek1@unand.ac.id", "Fakultas Teknologi Informasi", "Wakil Dekan I", "Dekan / Wakil Dekan", "dekan@unand.ac.id"],
        ["Dr. Sari Wahyuni, M.Kom.", "dosen", "wadek2@unand.ac.id", "Fakultas Teknologi Informasi", "Wakil Dekan II", "Dekan / Wakil Dekan", "dekan@unand.ac.id"],
        ["Budi Hartono, S.Kom., M.Kom.", "tendik", "kepalakantor@unand.ac.id", "Kantor FTI", "Kepala Kantor", "Kepala Kantor", "dekan@unand.ac.id"],
        ["Hendra Saputra, S.E.", "tendik", "kasi@unand.ac.id", "Kantor FTI", "Kasi Keuangan dan Aset", "Kasi", "kepalakantor@unand.ac.id"],
        ["Dra. Ratna Sari, M.M.", "tendik", "kasiadm@unand.ac.id", "Kantor FTI", "Kasi Administrasi dan Umum", "Kasi", "kepalakantor@unand.ac.id"],
        ["Dr. Rahmat Hidayat, M.Sc.", "dosen", "dosen@unand.ac.id", "Departemen Sistem Informasi", "Dosen", "Dosen", "dekan@unand.ac.id"],
        ["Muhammad Arif, A.Md.", "tendik", "tendik@unand.ac.id", "Kantor FTI", "Staf Keuangan dan Aset", "Tendik", "kasi@unand.ac.id"],
        ["Rina Marlina, A.Md.", "tendik", "rina.marlina@unand.ac.id", "Kantor FTI", "Staf Keuangan dan Aset", "Tendik", "kasi@unand.ac.id"],
        ["Dedi Kurniawan, A.Md.", "tendik", "dedi.kurniawan@unand.ac.id", "Kantor FTI", "Staf Keuangan dan Aset", "Tendik", "kasi@unand.ac.id"],
        ["Siti Rahmawati, S.E.", "tendik", "siti.rahmawati@unand.ac.id", "Kantor FTI", "Staf Administrasi dan Umum", "Tendik", "kasiadm@unand.ac.id"],
    ];
    for (const [nama, jenis, email, unitName, posName, roleName] of defaultAccounts) {
        const [[rRow]] = await connection.execute("SELECT id_role FROM `role` WHERE nama_role = ?", [roleName]);
        const posRow = await findPosition(connection, posName);
        if (rRow && posRow && unitIds.get(unitName)) {
            await connection.execute(
                `INSERT INTO pengguna
                    (nama, jenis_pengguna, username, password_hash, wajib_ganti_password, status_akun, id_unit, id_jabatan, id_role)
                 VALUES (?, ?, ?, ?, FALSE, 'aktif', ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    nama = VALUES(nama),
                    id_unit = VALUES(id_unit),
                    id_jabatan = VALUES(id_jabatan),
                    id_role = VALUES(id_role),
                    wajib_ganti_password = FALSE,
                    status_akun = 'aktif',
                    gagal_login = 0,
                    terkunci_sampai = NULL`,
                [nama, jenis, email, defaultPasswordHash, unitIds.get(unitName), posRow.id_jabatan, rRow.id_role],
            );
        }
    }

    for (const [, , email, , , , supervisorEmail] of defaultAccounts) {
        if (supervisorEmail) {
            const [[sup]] = await connection.execute("SELECT id_pengguna FROM pengguna WHERE username = ?", [supervisorEmail]);
            if (sup) {
                await connection.execute("UPDATE pengguna SET id_atasan = ? WHERE username = ?", [sup.id_pengguna, email]);
            }
        }
    }

    // Seed sample Penugasan, Delegasi, Respons, & Riwayat Penugasan if empty
    const [[penCount]] = await connection.execute("SELECT COUNT(*) AS cnt FROM penugasan");
    if (Number(penCount.cnt) === 0) {
        const getUserId = async (uname) => {
            const [[u]] = await connection.execute("SELECT id_pengguna FROM pengguna WHERE username = ?", [uname]);
            return u ? u.id_pengguna : null;
        };
        const idDekan = await getUserId("dekan@unand.ac.id");
        const idKaKantor = await getUserId("kepalakantor@unand.ac.id");
        const idKasiKeu = await getUserId("kasi@unand.ac.id");
        const idKasiAdm = await getUserId("kasiadm@unand.ac.id");
        const idTendikArif = await getUserId("tendik@unand.ac.id");
        const idTendikRina = await getUserId("rina.marlina@unand.ac.id");

        if (idDekan && idKaKantor && idKasiKeu && idKasiAdm && idTendikArif && idTendikRina) {
            // 1. Tugas dari Dekan ke Kepala Kantor (Diterima & Dikerjakan, lalu didelegasikan ke Kasi Keuangan)
            const [res1] = await connection.execute(
                `INSERT INTO penugasan (id_pemberi, id_penerima, deskripsi, prioritas, tenggat, status, persen_progres, catatan_progres, tgl_penugasan)
                 VALUES (?, ?, ?, 'Tinggi', '2026-11-28', 'Dikerjakan', 65, 'Koordinasi rekapitulasi anggaran lintas seksi sedang berjalan.', '2026-11-10')`,
                [idDekan, idKaKantor, "Penyusunan Laporan Realisasi Anggaran & Evaluasi Serapan DIPA Triwulan IV FTI Unand"]
            );
            const p1 = res1.insertId;
            await connection.execute(
                `INSERT INTO respons_penugasan (id_penugasan, id_penerima, keputusan, tgl_respons)
                 VALUES (?, ?, 'Terima', '2026-11-10 09:30:00')`,
                [p1, idKaKantor]
            );
            await connection.execute(
                `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
                 VALUES
                 (?, ?, NULL, 'Ditugaskan', 0, 'Penugasan dibuat oleh Dekan FTI', '2026-11-10 08:15:00'),
                 (?, ?, 'Ditugaskan', 'Diterima', 0, 'Penugasan diterima oleh Kepala Kantor', '2026-11-10 09:30:00'),
                 (?, ?, 'Diterima', 'Dikerjakan', 65, 'Koordinasi rekapitulasi anggaran lintas seksi sedang berjalan.', '2026-11-12 14:20:00')`,
                [p1, idDekan, p1, idKaKantor, p1, idKaKantor]
            );

            // 2. Sub-penugasan (Delegasi dari Kepala Kantor ke Kasi Keuangan & Aset)
            const [res2] = await connection.execute(
                `INSERT INTO penugasan (id_pemberi, id_penerima, id_penugasan_asal, deskripsi, prioritas, tenggat, status, persen_progres, catatan_progres, alasan_delegasi, tgl_penugasan)
                 VALUES (?, ?, ?, ?, 'Tinggi', '2026-11-25', 'Dikerjakan', 70, 'Verifikasi SPJ belanja modal dan barang sudah mencapai 70%.', 'Mohon segera siapkan kertas kerja rincian realisasi anggaran Seksi Keuangan & Aset.', '2026-11-11')`,
                [idKaKantor, idKasiKeu, p1, "Penyusunan Kertas Kerja Realisasi Anggaran & Verifikasi SPJ Seksi Keuangan dan Aset"]
            );
            const p2 = res2.insertId;
            await connection.execute(
                `INSERT INTO delegasi_penugasan (id_penugasan, id_pemberi_delegasi, id_penerima_delegasi, alasan_delegasi, status_delegasi, waktu)
                 VALUES (?, ?, ?, 'Mohon segera siapkan kertas kerja rincian realisasi anggaran Seksi Keuangan & Aset.', 'Diterima', '2026-11-11 10:00:00')`,
                [p1, idKaKantor, idKasiKeu]
            );
            await connection.execute(
                `INSERT INTO respons_penugasan (id_penugasan, id_penerima, keputusan, tgl_respons)
                 VALUES (?, ?, 'Terima', '2026-11-11 11:00:00')`,
                [p2, idKasiKeu]
            );
            await connection.execute(
                `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
                 VALUES
                 (?, ?, NULL, 'Ditugaskan', 0, 'Delegasi penugasan dari Kepala Kantor kepada Kasi Keuangan dan Aset', '2026-11-11 10:00:00'),
                 (?, ?, 'Ditugaskan', 'Diterima', 0, 'Delegasi diterima oleh Kasi Keuangan dan Aset', '2026-11-11 11:00:00'),
                 (?, ?, 'Diterima', 'Dikerjakan', 70, 'Verifikasi SPJ belanja modal dan barang sudah mencapai 70%.', '2026-11-14 15:10:00')`,
                [p2, idKaKantor, p2, idKasiKeu, p2, idKasiKeu]
            );

            // 3. Sub-delegasi tingkat 2 (Kasi Keuangan mendelegasikan ke Tendik Muhammad Arif)
            const [res3] = await connection.execute(
                `INSERT INTO penugasan (id_pemberi, id_penerima, id_penugasan_asal, deskripsi, prioritas, tenggat, status, persen_progres, catatan_progres, alasan_delegasi, tgl_penugasan)
                 VALUES (?, ?, ?, ?, 'Tinggi', '2026-11-23', 'Dikerjakan', 80, 'Telah memeriksa 32 dari 40 berkas kuitansi perjalanan dinas.', 'Lakukan pengecekan bukti pengeluaran riil dan kelengkapan kuitansi SPJ.', '2026-11-12')`,
                [idKasiKeu, idTendikArif, p2, "Verifikasi Kelengkapan Bukti Pengeluaran Riil & Kuitansi SPJ Perjalanan Dinas"]
            );
            const p3 = res3.insertId;
            await connection.execute(
                `INSERT INTO delegasi_penugasan (id_penugasan, id_pemberi_delegasi, id_penerima_delegasi, alasan_delegasi, status_delegasi, waktu)
                 VALUES (?, ?, ?, 'Lakukan pengecekan bukti pengeluaran riil dan kelengkapan kuitansi SPJ.', 'Diterima', '2026-11-12 09:00:00')`,
                [p2, idKasiKeu, idTendikArif]
            );
            await connection.execute(
                `INSERT INTO respons_penugasan (id_penugasan, id_penerima, keputusan, tgl_respons)
                 VALUES (?, ?, 'Terima', '2026-11-12 09:45:00')`,
                [p3, idTendikArif]
            );
            await connection.execute(
                `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
                 VALUES
                 (?, ?, NULL, 'Ditugaskan', 0, 'Delegasi dari Kasi Keuangan dan Aset kepada Staf Keuangan', '2026-11-12 09:00:00'),
                 (?, ?, 'Ditugaskan', 'Diterima', 0, 'Tugas diterima oleh Muhammad Arif, A.Md.', '2026-11-12 09:45:00'),
                 (?, ?, 'Diterima', 'Dikerjakan', 80, 'Telah memeriksa 32 dari 40 berkas kuitansi perjalanan dinas.', '2026-11-15 16:00:00')`,
                [p3, idKasiKeu, p3, idTendikArif, p3, idTendikArif]
            );

            // 4. Tugas Baru (Status: Ditugaskan / Menunggu Konfirmasi) dari Dekan langsung ke Kasi Keuangan
            const [res4] = await connection.execute(
                `INSERT INTO penugasan (id_pemberi, id_penerima, deskripsi, prioritas, tenggat, status, persen_progres, tgl_penugasan)
                 VALUES (?, ?, ?, 'Tinggi', '2026-11-26', 'Ditugaskan', 0, '2026-11-16')`,
                [idDekan, idKasiKeu, "Rekonsiliasi Data Aset Laboratorium & Inventaris Barang Milik Negara (BMN) Semester Ganjil"]
            );
            await connection.execute(
                `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
                 VALUES (?, ?, NULL, 'Ditugaskan', 0, 'Penugasan baru dibuat oleh Dekan FTI', '2026-11-16 10:15:00')`,
                [res4.insertId, idDekan]
            );

            // 5. Tugas Baru (Status: Ditugaskan) dari Kepala Kantor ke Kasi Keuangan
            const [res5] = await connection.execute(
                `INSERT INTO penugasan (id_pemberi, id_penerima, deskripsi, prioritas, tenggat, status, persen_progres, tgl_penugasan)
                 VALUES (?, ?, ?, 'Sedang', '2026-11-29', 'Ditugaskan', 0, '2026-11-17')`,
                [idKaKantor, idKasiKeu, "Evaluasi Kebutuhan Bahan Habis Pakai (ATK) & Pemeliharaan Sarana Ruang Rapat Dekanat"]
            );
            await connection.execute(
                `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
                 VALUES (?, ?, NULL, 'Ditugaskan', 0, 'Penugasan dibuat oleh Kepala Kantor', '2026-11-17 08:40:00')`,
                [res5.insertId, idKaKantor]
            );

            // 6. Tugas Baru (Status: Ditugaskan) dari Dekan ke Kepala Kantor
            const [res6] = await connection.execute(
                `INSERT INTO penugasan (id_pemberi, id_penerima, deskripsi, prioritas, tenggat, status, persen_progres, tgl_penugasan)
                 VALUES (?, ?, ?, 'Tinggi', '2026-11-24', 'Ditugaskan', 0, '2026-11-17')`,
                [idDekan, idKaKantor, "Penyiapan Dokumen Pendukung Audit Mutu Internal Administrasi Kepegawaian & Tata Usaha FTI"]
            );
            await connection.execute(
                `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
                 VALUES (?, ?, NULL, 'Ditugaskan', 0, 'Penugasan dibuat oleh Dekan FTI', '2026-11-17 11:00:00')`,
                [res6.insertId, idDekan]
            );

            // 7. Tugas Baru (Status: Ditugaskan) dari Kasi Keuangan ke Tendik Muhammad Arif
            const [res7] = await connection.execute(
                `INSERT INTO penugasan (id_pemberi, id_penerima, deskripsi, prioritas, tenggat, status, persen_progres, tgl_penugasan)
                 VALUES (?, ?, ?, 'Sedang', '2026-11-27', 'Ditugaskan', 0, '2026-11-17')`,
                [idKasiKeu, idTendikArif, "Penataan Arsip Bukti Potong Pajak PPh 21 & PPh 23 Honorarium Kegiatan Akademik"]
            );
            await connection.execute(
                `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
                 VALUES (?, ?, NULL, 'Ditugaskan', 0, 'Penugasan dibuat oleh Kasi Keuangan dan Aset', '2026-11-17 13:20:00')`,
                [res7.insertId, idKasiKeu]
            );

            // 8. Tugas Selesai (Status: Selesai) dari Kasi Keuangan ke Rina Marlina
            const [res8] = await connection.execute(
                `INSERT INTO penugasan (id_pemberi, id_penerima, deskripsi, prioritas, tenggat, status, persen_progres, catatan_progres, tgl_penugasan, tgl_selesai)
                 VALUES (?, ?, ?, 'Rendah', '2026-11-14', 'Selesai', 100, 'Seluruh daftar inventaris ruangan telah diperbarui dan diserahkan ke Kasi.', '2026-11-05', '2026-11-13')`,
                [idKasiKeu, idTendikRina, "Pemutakhiran Kartu Inventaris Ruangan (KIR) Gedung Perkuliahan dan Ruang Staf FTI"]
            );
            await connection.execute(
                `INSERT INTO respons_penugasan (id_penugasan, id_penerima, keputusan, tgl_respons)
                 VALUES (?, ?, 'Terima', '2026-11-05 10:00:00')`,
                [res8.insertId, idTendikRina]
            );
            await connection.execute(
                `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
                 VALUES
                 (?, ?, NULL, 'Ditugaskan', 0, 'Penugasan dibuat oleh Kasi Keuangan dan Aset', '2026-11-05 09:00:00'),
                 (?, ?, 'Ditugaskan', 'Diterima', 0, 'Diterima oleh Rina Marlina, A.Md.', '2026-11-05 10:00:00'),
                 (?, ?, 'Diterima', 'Selesai', 100, 'Seluruh daftar inventaris ruangan telah diperbarui dan diserahkan ke Kasi.', '2026-11-13 16:30:00')`,
                [res8.insertId, idKasiKeu, res8.insertId, idTendikRina, res8.insertId, idTendikRina]
            );
        }
    }

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

    // Seed sample logbook data jika tabel kosong
    try {
        const { seedSampleLogbooks } = require('../models/logbookModel');
        await seedSampleLogbooks(connection);
    } catch (err) {
        console.warn('Seed logbook dilewati (mungkin tabel belum siap):', err.message);
    }
}

module.exports = { seedDatabase };
