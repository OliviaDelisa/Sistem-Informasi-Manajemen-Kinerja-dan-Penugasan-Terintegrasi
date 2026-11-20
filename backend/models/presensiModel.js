const db = require("../config/database");

function normalizeDatetime(value, tglSesi) {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
    if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed) && tglSesi) return `${tglSesi} ${trimmed}`;
    if (/^\d{2}:\d{2}$/.test(trimmed) && tglSesi) return `${tglSesi} ${trimmed}:00`;
    return null;
}

function isSameRow(existing, incoming) {
    return (
        existing.nama_pegawai === incoming.namaPegawai &&
        existing.email.toLowerCase() === incoming.email.toLowerCase() &&
        existing.unit === incoming.unit &&
        (existing.status_kepegawaian || null) === (incoming.statusKepegawaian || null) &&
        (existing.shift || null) === (incoming.shift || null) &&
        (existing.lokasi || null) === (incoming.lokasi || null) &&
        existing.mode_kerja === incoming.modeKerja &&
        existing.tipe_sesi === incoming.tipeSesi &&
        existing.status_sesi === incoming.statusSesi &&
        Number(existing.event_wajib) === Number(incoming.eventWajib) &&
        Number(existing.event_selesai) === Number(incoming.eventSelesai) &&
        (existing.jam_mulai || null) === (incoming.jamMulai || null) &&
        (existing.jam_akhir || null) === (incoming.jamAkhir || null)
    );
}

async function findAll({ periode, tanggal, nomorPegawai, search } = {}) {
    const conditions = [];
    const params = [];

    if (periode) {
        conditions.push("DATE_FORMAT(tgl_sesi, '%Y-%m') = ?");
        params.push(periode);
    }
    if (tanggal) {
        conditions.push("tgl_sesi = ?");
        params.push(tanggal);
    }
    if (nomorPegawai) {
        conditions.push("nomor_pegawai = ?");
        params.push(nomorPegawai);
    }
    if (search) {
        const like = `%${search.trim().toLowerCase()}%`;
        conditions.push(
            "(LOWER(nama_pegawai) LIKE ? OR LOWER(nomor_pegawai) LIKE ? OR LOWER(email) LIKE ? OR LOWER(unit) LIKE ?)",
        );
        params.push(like, like, like, like);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await db.execute(
        `SELECT
            id_presensi,
            id_pengguna,
            id_impor,
            DATE_FORMAT(tgl_sesi, '%Y-%m-%d') AS tgl_sesi,
            nomor_pegawai,
            nama_pegawai,
            email,
            unit,
            status_kepegawaian,
            shift,
            lokasi,
            mode_kerja,
            tipe_sesi,
            status_sesi,
            event_wajib,
            event_selesai,
            DATE_FORMAT(jam_mulai, '%Y-%m-%d %H:%i:%s') AS jam_mulai,
            DATE_FORMAT(jam_akhir, '%Y-%m-%d %H:%i:%s') AS jam_akhir
         FROM presensi
         ${where}
         ORDER BY tgl_sesi DESC, nama_pegawai ASC`,
        params,
    );
    return rows;
}

async function listAvailablePeriods() {
    const [rows] = await db.execute(
        `SELECT DISTINCT DATE_FORMAT(tgl_sesi, '%Y-%m') AS periode
         FROM presensi
         ORDER BY periode DESC`,
    );
    return rows.map((row) => row.periode);
}

async function findEmployeeSummary({ periode, tanggal, search } = {}) {
    const rows = await findAll({ periode, tanggal, search });
    const grouped = new Map();

    for (const row of rows) {
        const key = row.nomor_pegawai;
        const isComplete = Number(row.event_selesai) >= Number(row.event_wajib);

        if (!grouped.has(key)) {
            grouped.set(key, {
                nomor_pegawai: row.nomor_pegawai,
                nama_pegawai: row.nama_pegawai,
                email: row.email,
                unit: row.unit,
                status_kepegawaian: row.status_kepegawaian,
                total_sesi: 0,
                sesi_lengkap: 0,
                sesi_belum_lengkap: 0,
                sesi_open: 0,
                sesi_closed: 0,
                // Rows are ordered by tgl_sesi DESC, so the first row is the latest (or the selected date)
                tgl_terbaru: row.tgl_sesi,
                shift_terbaru: row.shift,
                status_sesi_terbaru: row.status_sesi,
                event_wajib_terbaru: Number(row.event_wajib),
                event_selesai_terbaru: Number(row.event_selesai),
                jam_mulai_terbaru: row.jam_mulai,
                jam_akhir_terbaru: row.jam_akhir,
            });
        }

        const item = grouped.get(key);
        item.total_sesi += 1;
        if (isComplete) item.sesi_lengkap += 1;
        else item.sesi_belum_lengkap += 1;
        if (row.status_sesi === "OPEN") item.sesi_open += 1;
        else item.sesi_closed += 1;
    }

    const employees = Array.from(grouped.values()).sort((a, b) =>
        a.nama_pegawai.localeCompare(b.nama_pegawai, "id"),
    );

    const summary = {
        totalPegawai: employees.length,
        totalSesi: rows.length,
        sesiLengkap: rows.filter((r) => Number(r.event_selesai) >= Number(r.event_wajib)).length,
        sesiBelumLengkap: rows.filter((r) => Number(r.event_selesai) < Number(r.event_wajib)).length,
        sesiOpen: rows.filter((r) => r.status_sesi === "OPEN").length,
    };

    return { employees, summary };
}

async function findByPenggunaAndPeriod(idPengguna, mulai, selesai) {
    const [rows] = await db.execute(
        `SELECT
            id_presensi, id_pengguna, id_impor,
            DATE_FORMAT(tgl_sesi, '%Y-%m-%d') AS tgl_sesi,
            nomor_pegawai, nama_pegawai, email, unit, status_kepegawaian,
            shift, lokasi, mode_kerja, tipe_sesi, status_sesi,
            event_wajib, event_selesai,
            DATE_FORMAT(jam_mulai, '%Y-%m-%d %H:%i:%s') AS jam_mulai,
            DATE_FORMAT(jam_akhir, '%Y-%m-%d %H:%i:%s') AS jam_akhir
         FROM presensi
         WHERE id_pengguna = ? AND tgl_sesi BETWEEN ? AND ?
         ORDER BY tgl_sesi DESC`,
        [idPengguna, mulai, selesai],
    );
    return rows;
}

async function importBatch({ idPengimpor, namaBerkas, rows }) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Resolve valid id_pengimpor (fallback to first active user if omitted)
        let importerId = Number(idPengimpor) || null;
        if (importerId) {
            const [check] = await connection.execute(
                "SELECT id_pengguna FROM pengguna WHERE id_pengguna = ? LIMIT 1",
                [importerId],
            );
            if (!check.length) importerId = null;
        }
        if (!importerId) {
            const [fallback] = await connection.execute(
                "SELECT id_pengguna FROM pengguna WHERE status_akun = 'aktif' ORDER BY id_pengguna ASC LIMIT 1",
            );
            if (!fallback.length) {
                throw new Error("Tidak ada akun aktif yang dapat dicatat sebagai pengimpor.");
            }
            importerId = fallback[0].id_pengguna;
        }

        // Deduplicate rows within the same uploaded file by (nomor_pegawai, tanggal_sesi)
        const uniqueMap = new Map();
        let duplikatDalamFile = 0;

        for (const raw of rows) {
            const tglSesi = String(raw.tanggal_sesi || "").trim();
            const nomorPegawai = String(raw.nomor_pegawai || "").trim();
            const key = `${nomorPegawai}__${tglSesi}`;
            if (uniqueMap.has(key)) {
                duplikatDalamFile += 1;
            }
            uniqueMap.set(key, {
                tglSesi,
                nomorPegawai,
                namaPegawai: String(raw.nama_pegawai || "").trim(),
                email: String(raw.email || "").trim().toLowerCase(),
                unit: String(raw.unit || "").trim(),
                statusKepegawaian: String(raw.status_kepegawaian || "").trim() || null,
                shift: String(raw.shift || "").trim() || null,
                lokasi: String(raw.lokasi || "").trim() || null,
                modeKerja: String(raw.mode_kerja || "WFO").trim().toUpperCase(),
                tipeSesi: String(raw.tipe_sesi || "NORMAL").trim().toUpperCase(),
                statusSesi: String(raw.status_sesi || "OPEN").trim().toUpperCase(),
                eventWajib: Number(raw.event_wajib ?? 4),
                eventSelesai: Number(raw.event_selesai ?? 0),
                jamMulai: normalizeDatetime(raw.jam_mulai, tglSesi),
                jamAkhir: normalizeDatetime(raw.jam_akhir, tglSesi),
            });
        }

        const uniqueRows = Array.from(uniqueMap.values());
        if (!uniqueRows.length) {
            throw new Error("Tidak ada baris valid untuk disimpan.");
        }

        // Determine dominant period (YYYY-MM) for impor_presensi log
        const periodCounts = new Map();
        for (const item of uniqueRows) {
            const p = item.tglSesi.slice(0, 7);
            periodCounts.set(p, (periodCounts.get(p) || 0) + 1);
        }
        const periode = Array.from(periodCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];

        // Create impor_presensi record first
        const [imporRes] = await connection.execute(
            `INSERT INTO impor_presensi
                (id_pengimpor, nama_berkas, periode, baris_berhasil, baris_gagal, hasil_validasi)
             VALUES (?, ?, ?, 0, 0, NULL)`,
            [importerId, namaBerkas || "impor-presensi.csv", periode],
        );
        const idImpor = imporRes.insertId;

        // Preload user email -> id_pengguna map
        const [users] = await connection.execute(
            "SELECT id_pengguna, LOWER(username) AS email FROM pengguna",
        );
        const emailToUserId = new Map(users.map((u) => [u.email, u.id_pengguna]));

        let baru = 0;
        let diperbarui = 0;
        let duplikatDatabase = 0;

        for (const item of uniqueRows) {
            const idPengguna = emailToUserId.get(item.email) || null;

            const [existingRows] = await connection.execute(
                `SELECT
                    id_presensi, nama_pegawai, email, unit, status_kepegawaian,
                    shift, lokasi, mode_kerja, tipe_sesi, status_sesi,
                    event_wajib, event_selesai,
                    DATE_FORMAT(jam_mulai, '%Y-%m-%d %H:%i:%s') AS jam_mulai,
                    DATE_FORMAT(jam_akhir, '%Y-%m-%d %H:%i:%s') AS jam_akhir
                 FROM presensi
                 WHERE nomor_pegawai = ? AND tgl_sesi = ?
                 LIMIT 1`,
                [item.nomorPegawai, item.tglSesi],
            );

            if (!existingRows.length) {
                await connection.execute(
                    `INSERT INTO presensi
                        (id_pengguna, id_impor, tgl_sesi, nomor_pegawai, nama_pegawai, email,
                         unit, status_kepegawaian, shift, lokasi, mode_kerja, tipe_sesi,
                         status_sesi, event_wajib, event_selesai, jam_mulai, jam_akhir)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        idPengguna, idImpor, item.tglSesi, item.nomorPegawai, item.namaPegawai,
                        item.email, item.unit, item.statusKepegawaian, item.shift, item.lokasi,
                        item.modeKerja, item.tipeSesi, item.statusSesi, item.eventWajib,
                        item.eventSelesai, item.jamMulai, item.jamAkhir,
                    ],
                );
                baru += 1;
            } else if (isSameRow(existingRows[0], item)) {
                duplikatDatabase += 1;
            } else {
                await connection.execute(
                    `UPDATE presensi
                     SET id_pengguna = ?, id_impor = ?, nama_pegawai = ?, email = ?,
                         unit = ?, status_kepegawaian = ?, shift = ?, lokasi = ?,
                         mode_kerja = ?, tipe_sesi = ?, status_sesi = ?,
                         event_wajib = ?, event_selesai = ?, jam_mulai = ?, jam_akhir = ?
                     WHERE id_presensi = ?`,
                    [
                        idPengguna, idImpor, item.namaPegawai, item.email,
                        item.unit, item.statusKepegawaian, item.shift, item.lokasi,
                        item.modeKerja, item.tipeSesi, item.statusSesi,
                        item.eventWajib, item.eventSelesai, item.jamMulai, item.jamAkhir,
                        existingRows[0].id_presensi,
                    ],
                );
                diperbarui += 1;
            }
        }

        const totalDuplikat = duplikatDatabase + duplikatDalamFile;
        const hasilValidasi = `Baru: ${baru}, Diperbarui: ${diperbarui}, Duplikat dilewati: ${totalDuplikat}`;
        await connection.execute(
            `UPDATE impor_presensi
             SET baris_berhasil = ?, baris_gagal = ?, hasil_validasi = ?
             WHERE id_impor = ?`,
            [baru + diperbarui, 0, hasilValidasi, idImpor],
        );

        await connection.commit();
        return {
            idImpor,
            periode,
            baru,
            diperbarui,
            duplikat: totalDuplikat,
            totalDisimpan: baru + diperbarui,
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    findAll,
    listAvailablePeriods,
    findEmployeeSummary,
    findByPenggunaAndPeriod,
    importBatch,
};
