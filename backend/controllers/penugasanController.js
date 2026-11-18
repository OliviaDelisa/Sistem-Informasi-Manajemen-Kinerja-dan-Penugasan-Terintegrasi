const db = require("../config/database");

// Helper: ambil informasi lengkap pengguna beserta role & jabatan
async function getUserInfo(connection, userId) {
    if (!userId) return null;
    const [rows] = await connection.execute(
        `SELECT p.id_pengguna, p.nama, p.username, p.id_atasan, p.id_unit, p.id_jabatan, p.id_role,
                r.nama_role, j.nama_jabatan, u.nama_unit
         FROM pengguna p
         INNER JOIN \`role\` r ON r.id_role = p.id_role
         INNER JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         INNER JOIN unit_kerja u ON u.id_unit = p.id_unit
         WHERE p.id_pengguna = ? LIMIT 1`,
        [userId]
    );
    return rows[0] || null;
}

// Helper: daftar calon bawahan sesuai hierarki organisasi (RBAC & id_atasan + aturan struktural PRD)
async function getSubordinatesForUser(connection, giver) {
    if (!giver) return [];
    let query = `
        SELECT p.id_pengguna, p.nama, p.username, p.id_atasan,
               j.nama_jabatan, u.nama_unit, r.nama_role,
               (SELECT COUNT(*) FROM penugasan pg
                WHERE pg.id_penerima = p.id_pengguna
                  AND pg.status IN ('Ditugaskan', 'Diterima', 'Dikerjakan')) AS tugas_aktif,
               (SELECT COUNT(*) FROM penugasan pg
                WHERE pg.id_penerima = p.id_pengguna
                  AND pg.status = 'Selesai') AS tugas_selesai
        FROM pengguna p
        INNER JOIN jabatan j ON j.id_jabatan = p.id_jabatan
        INNER JOIN unit_kerja u ON u.id_unit = p.id_unit
        INNER JOIN \`role\` r ON r.id_role = p.id_role
        WHERE p.status_akun = 'aktif' AND p.id_pengguna <> ?
    `;
    const params = [giver.id_pengguna];

    if (giver.nama_role === "Dekan / Wakil Dekan") {
        // Dekan/Wadek dapat menugaskan/mendelegasikan ke bawahan langsung (Kepala Kantor, Wadek, Kadep) atau langsung ke Kasi
        query += ` AND (p.id_atasan = ? OR r.nama_role IN ('Kepala Kantor', 'Kasi'))`;
        params.push(giver.id_pengguna);
    } else if (giver.nama_role === "Kepala Kantor") {
        // Kepala Kantor menugaskan/mendelegasikan ke Kasi (bawahan langsung)
        query += ` AND (p.id_atasan = ? OR r.nama_role = 'Kasi')`;
        params.push(giver.id_pengguna);
    } else if (giver.nama_role === "Kasi") {
        // Kasi menugaskan/mendelegasikan ke Tendik di seksinya (id_atasan = kasi)
        query += ` AND p.id_atasan = ?`;
        params.push(giver.id_pengguna);
    } else {
        query += ` AND p.id_atasan = ?`;
        params.push(giver.id_pengguna);
    }

    query += ` ORDER BY tugas_aktif ASC, p.nama ASC`;
    const [rows] = await connection.execute(query, params);

    // Hitung skor rekomendasi SPK (UC-19) berdasarkan beban tugas aktif & riwayat penyelesaian
    return rows.map((row) => {
        const aktif = Number(row.tugas_aktif || 0);
        const selesai = Number(row.tugas_selesai || 0);
        const skorSpk = Math.max(55, Math.min(98, 95 - aktif * 12 + selesai * 3));
        return {
            ...row,
            tugas_aktif: aktif,
            tugas_selesai: selesai,
            skor_spk: skorSpk,
            kategori_beban: aktif === 0 ? "Kosong / Siap" : aktif <= 2 ? "Ideal" : "Padat"
        };
    });
}

// GET /api/penugasan/bawahan?userId=...
async function listBawahan(req, res) {
    const userId = Number(req.query.userId || req.headers["x-user-id"]);
    const connection = await db.getConnection();
    try {
        const giver = await getUserInfo(connection, userId);
        if (!giver) {
            return res.status(400).json({ message: "Pengguna tidak ditemukan." });
        }
        const subordinates = await getSubordinatesForUser(connection, giver);
        return res.json({ data: subordinates });
    } catch (error) {
        console.error("Gagal memuat daftar bawahan:", error);
        return res.status(500).json({ message: "Gagal memuat daftar bawahan." });
    } finally {
        connection.release();
    }
}

// GET /api/penugasan?userId=...
async function listPenugasan(req, res) {
    const userId = Number(req.query.userId || req.headers["x-user-id"]);
    const connection = await db.getConnection();
    try {
        const user = await getUserInfo(connection, userId);
        const [rows] = await connection.execute(
            `SELECT pg.*,
                    pemberi.nama AS nama_pemberi,
                    jpemberi.nama_jabatan AS jabatan_pemberi,
                    upemberi.nama_unit AS unit_pemberi,
                    penerima.nama AS nama_penerima,
                    jpenerima.nama_jabatan AS jabatan_penerima,
                    upenerima.nama_unit AS unit_penerima,
                    penerima.id_atasan AS id_atasan_penerima,
                    asal.deskripsi AS deskripsi_asal,
                    (SELECT COUNT(*) FROM delegasi_penugasan dp WHERE dp.id_penugasan = pg.id_penugasan) AS jumlah_delegasi,
                    (SELECT pdel.nama FROM delegasi_penugasan dp
                     INNER JOIN pengguna pdel ON pdel.id_pengguna = dp.id_penerima_delegasi
                     WHERE dp.id_penugasan = pg.id_penugasan
                     ORDER BY dp.id_delegasi DESC LIMIT 1) AS didelegasikan_ke_nama
             FROM penugasan pg
             INNER JOIN pengguna pemberi ON pemberi.id_pengguna = pg.id_pemberi
             INNER JOIN jabatan jpemberi ON jpemberi.id_jabatan = pemberi.id_jabatan
             INNER JOIN unit_kerja upemberi ON upemberi.id_unit = pemberi.id_unit
             INNER JOIN pengguna penerima ON penerima.id_pengguna = pg.id_penerima
             INNER JOIN jabatan jpenerima ON jpenerima.id_jabatan = penerima.id_jabatan
             INNER JOIN unit_kerja upenerima ON upenerima.id_unit = penerima.id_unit
             LEFT JOIN penugasan asal ON asal.id_penugasan = pg.id_penugasan_asal
             ORDER BY pg.id_penugasan DESC`
        );

        if (!user) {
            return res.json({ dikelola: rows, masuk: rows, semua: rows });
        }

        // Filter penugasan yang dikelola (dibuat oleh user ini, atau untuk Dekan seluruh penugasan pimpinan)
        const dikelola = rows.filter((r) => {
            if (user.nama_role === "Dekan / Wakil Dekan") {
                return Number(r.id_pemberi) === Number(user.id_pengguna) || r.jabatan_pemberi.includes("Dekan");
            }
            return Number(r.id_pemberi) === Number(user.id_pengguna);
        });

        // Filter penugasan masuk (ditujukan kepada user ini)
        const masuk = rows.filter((r) => Number(r.id_penerima) === Number(user.id_pengguna));

        return res.json({
            dikelola,
            masuk,
            semua: rows
        });
    } catch (error) {
        console.error("Gagal mengambil daftar penugasan:", error);
        return res.status(500).json({ message: "Gagal mengambil daftar penugasan." });
    } finally {
        connection.release();
    }
}

// UC-04: POST /api/penugasan (Buat Penugasan)
async function createPenugasan(req, res) {
    const id_pemberi = Number(req.body.id_pemberi || req.headers["x-user-id"]);
    const id_penerima = Number(req.body.id_penerima);
    const deskripsi = (req.body.deskripsi || "").trim();
    const prioritas = req.body.prioritas || "Sedang";
    const tenggat = req.body.tenggat;
    const id_kepanitiaan = req.body.id_kepanitiaan ? Number(req.body.id_kepanitiaan) : null;

    if (!id_pemberi || !id_penerima || !deskripsi || !tenggat) {
        return res.status(400).json({
            message: "Penerima penugasan, deskripsi, prioritas, dan tenggat waktu wajib diisi."
        });
    }
    if (!["Tinggi", "Sedang", "Rendah"].includes(prioritas)) {
        return res.status(400).json({ message: "Prioritas harus bernilai Tinggi, Sedang, atau Rendah." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const giver = await getUserInfo(connection, id_pemberi);
        if (!giver || !["Dekan / Wakil Dekan", "Kepala Kantor", "Kasi"].includes(giver.nama_role)) {
            await connection.rollback();
            return res.status(403).json({ message: "Anda tidak memiliki wewenang struktural untuk membuat penugasan." });
        }

        const allowedSubordinates = await getSubordinatesForUser(connection, giver);
        const isAllowed = allowedSubordinates.some((sub) => Number(sub.id_pengguna) === id_penerima);
        if (!isAllowed) {
            await connection.rollback();
            return res.status(403).json({
                message: "Calon penerima tugas berada di luar hierarki bawahan Anda."
            });
        }

        const [result] = await connection.execute(
            `INSERT INTO penugasan
                (id_pemberi, id_penerima, id_kepanitiaan, deskripsi, prioritas, tenggat, status, persen_progres, tgl_penugasan)
             VALUES (?, ?, ?, ?, ?, ?, 'Ditugaskan', 0, CURRENT_DATE)`,
            [id_pemberi, id_penerima, id_kepanitiaan, deskripsi, prioritas, tenggat]
        );
        const newId = result.insertId;

        await connection.execute(
            `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
             VALUES (?, ?, NULL, 'Ditugaskan', 0, ?, NOW())`,
            [newId, id_pemberi, `Penugasan dibuat oleh ${giver.nama} (${giver.nama_jabatan})`]
        );

        await connection.execute(
            `INSERT INTO audit_trail (id_pengguna, jenis_aktivitas, objek_diubah, id_objek, data_sesudah, keterangan)
             VALUES (?, 'CREATE_PENUGASAN', 'PENUGASAN', ?, ?, ?)`,
            [
                id_pemberi,
                newId,
                JSON.stringify({ id_penerima, deskripsi, prioritas, tenggat, status: "Ditugaskan" }),
                `Membuat penugasan baru #${newId}`
            ]
        );

        await connection.commit();
        return res.status(201).json({
            message: "Penugasan berhasil dibuat.",
            id_penugasan: newId
        });
    } catch (error) {
        await connection.rollback();
        console.error("Gagal membuat penugasan:", error);
        return res.status(500).json({ message: "Gagal membuat penugasan." });
    } finally {
        connection.release();
    }
}

// UC-04: PUT /api/penugasan/:id (Ubah Penugasan)
async function updatePenugasan(req, res) {
    const id_penugasan = Number(req.params.id);
    const id_pengguna = Number(req.body.id_pengguna || req.headers["x-user-id"]);
    const id_penerima = Number(req.body.id_penerima);
    const deskripsi = (req.body.deskripsi || "").trim();
    const prioritas = req.body.prioritas;
    const tenggat = req.body.tenggat;

    if (!id_penugasan || !id_penerima || !deskripsi || !prioritas || !tenggat) {
        return res.status(400).json({ message: "Seluruh field perubahan penugasan wajib diisi." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [[existing]] = await connection.execute(
            "SELECT * FROM penugasan WHERE id_penugasan = ? LIMIT 1",
            [id_penugasan]
        );
        if (!existing) {
            await connection.rollback();
            return res.status(404).json({ message: "Data penugasan tidak ditemukan." });
        }
        if (existing.status === "Dibatalkan" || existing.status === "Selesai") {
            await connection.rollback();
            return res.status(400).json({ message: "Penugasan yang sudah selesai atau dibatalkan tidak dapat diubah." });
        }

        const actorId = id_pengguna || existing.id_pemberi;
        const giver = await getUserInfo(connection, actorId);
        if (giver && Number(existing.id_pemberi) !== Number(actorId) && giver.nama_role !== "Dekan / Wakil Dekan") {
            await connection.rollback();
            return res.status(403).json({ message: "Anda hanya dapat mengubah penugasan yang berada dalam wewenang Anda." });
        }

        await connection.execute(
            `UPDATE penugasan
             SET id_penerima = ?, deskripsi = ?, prioritas = ?, tenggat = ?
             WHERE id_penugasan = ?`,
            [id_penerima, deskripsi, prioritas, tenggat, id_penugasan]
        );

        await connection.execute(
            `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
             VALUES (?, ?, ?, ?, ?, 'Rincian penugasan diperbarui oleh pemberi tugas', NOW())`,
            [id_penugasan, actorId, existing.status, existing.status, existing.persen_progres]
        );

        await connection.execute(
            `INSERT INTO audit_trail (id_pengguna, jenis_aktivitas, objek_diubah, id_objek, data_sebelum, data_sesudah, keterangan)
             VALUES (?, 'UPDATE_PENUGASAN', 'PENUGASAN', ?, ?, ?, 'Mengubah data penugasan')`,
            [
                actorId,
                id_penugasan,
                JSON.stringify({
                    id_penerima: existing.id_penerima,
                    deskripsi: existing.deskripsi,
                    prioritas: existing.prioritas,
                    tenggat: existing.tenggat
                }),
                JSON.stringify({ id_penerima, deskripsi, prioritas, tenggat })
            ]
        );

        await connection.commit();
        return res.json({ message: "Penugasan berhasil diperbarui." });
    } catch (error) {
        await connection.rollback();
        console.error("Gagal mengubah penugasan:", error);
        return res.status(500).json({ message: "Gagal mengubah penugasan." });
    } finally {
        connection.release();
    }
}

// UC-04: PATCH /api/penugasan/:id/batal (Batalkan Penugasan - Tanpa DELETE)
async function cancelPenugasan(req, res) {
    const id_penugasan = Number(req.params.id);
    const id_pengguna = Number(req.body.id_pengguna || req.headers["x-user-id"]);
    const alasan_pembatalan = (req.body.alasan_pembatalan || "").trim();

    if (!alasan_pembatalan) {
        return res.status(400).json({ message: "Alasan pembatalan wajib diisi." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [[existing]] = await connection.execute(
            "SELECT * FROM penugasan WHERE id_penugasan = ? LIMIT 1",
            [id_penugasan]
        );
        if (!existing) {
            await connection.rollback();
            return res.status(404).json({ message: "Penugasan tidak ditemukan." });
        }
        if (existing.status === "Dibatalkan") {
            await connection.rollback();
            return res.status(400).json({ message: "Penugasan ini sudah dibatalkan sebelumnya." });
        }

        const actorId = id_pengguna || existing.id_pemberi;

        await connection.execute(
            `UPDATE penugasan
             SET status = 'Dibatalkan',
                 alasan_pembatalan = ?,
                 tgl_pembatalan = CURRENT_DATE
             WHERE id_penugasan = ?`,
            [alasan_pembatalan, id_penugasan]
        );

        await connection.execute(
            `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
             VALUES (?, ?, ?, 'Dibatalkan', ?, ?, NOW())`,
            [id_penugasan, actorId, existing.status, existing.persen_progres, `Dibatalkan: ${alasan_pembatalan}`]
        );

        await connection.execute(
            `INSERT INTO audit_trail (id_pengguna, jenis_aktivitas, objek_diubah, id_objek, data_sebelum, data_sesudah, keterangan)
             VALUES (?, 'CANCEL_PENUGASAN', 'PENUGASAN', ?, ?, ?, ?)`,
            [
                actorId,
                id_penugasan,
                JSON.stringify({ status: existing.status }),
                JSON.stringify({ status: "Dibatalkan", alasan_pembatalan }),
                alasan_pembatalan
            ]
        );

        await connection.commit();
        return res.json({ message: "Penugasan berhasil dibatalkan." });
    } catch (error) {
        await connection.rollback();
        console.error("Gagal membatalkan penugasan:", error);
        return res.status(500).json({ message: "Gagal membatalkan penugasan." });
    } finally {
        connection.release();
    }
}

// UC-05: POST /api/penugasan/:id/delegasi (Mendelegasikan Penugasan)
async function delegatePenugasan(req, res) {
    const id_penugasan = Number(req.params.id);
    const id_pemberi_delegasi = Number(req.body.id_pemberi_delegasi || req.headers["x-user-id"]);
    const id_penerima_delegasi = Number(req.body.id_penerima_delegasi);
    const alasan_delegasi = (req.body.alasan_delegasi || "").trim();
    const tenggat = req.body.tenggat;

    if (!id_penugasan || !id_penerima_delegasi || !alasan_delegasi || !tenggat) {
        return res.status(400).json({
            message: "Penerima delegasi, alasan/instruksi delegasi, dan tenggat waktu wajib diisi."
        });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [[parentTask]] = await connection.execute(
            "SELECT * FROM penugasan WHERE id_penugasan = ? LIMIT 1",
            [id_penugasan]
        );
        if (!parentTask) {
            await connection.rollback();
            return res.status(404).json({ message: "Penugasan induk tidak ditemukan." });
        }

        const actorId = id_pemberi_delegasi || parentTask.id_penerima;
        const delegator = await getUserInfo(connection, actorId);
        if (!delegator || !["Dekan / Wakil Dekan", "Kepala Kantor", "Kasi"].includes(delegator.nama_role)) {
            await connection.rollback();
            return res.status(403).json({
                message: "Hanya pejabat struktural (Dekan/Wadek, Kepala Kantor, Kasi) yang dapat mendelegasikan penugasan."
            });
        }

        const allowedSubordinates = await getSubordinatesForUser(connection, delegator);
        const targetSub = allowedSubordinates.find((s) => Number(s.id_pengguna) === id_penerima_delegasi);
        if (!targetSub) {
            await connection.rollback();
            return res.status(403).json({
                message: "Penerima delegasi tidak valid atau berada di luar hierarki bawahan langsung Anda."
            });
        }

        // Insert ke DELEGASI_PENUGASAN
        await connection.execute(
            `INSERT INTO delegasi_penugasan
                (id_penugasan, id_pemberi_delegasi, id_penerima_delegasi, alasan_delegasi, status_delegasi, waktu)
             VALUES (?, ?, ?, ?, 'Ditugaskan', NOW())`,
            [id_penugasan, actorId, id_penerima_delegasi, alasan_delegasi]
        );

        // Jika tugas induk masih berstatus 'Ditugaskan', otomatis ubah ke 'Diterima' karena telah ditindaklanjuti dengan delegasi
        if (parentTask.status === "Ditugaskan") {
            await connection.execute(
                "UPDATE penugasan SET status = 'Diterima', tgl_respons = NOW() WHERE id_penugasan = ?",
                [id_penugasan]
            );
        }

        // Buat record PENUGASAN baru untuk bawahan dengan mereferensikan id_penugasan_asal = id_penugasan induk
        const [childRes] = await connection.execute(
            `INSERT INTO penugasan
                (id_pemberi, id_penerima, id_penugasan_asal, id_kepanitiaan, deskripsi, prioritas, tenggat, status, persen_progres, alasan_delegasi, tgl_penugasan)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Ditugaskan', 0, ?, CURRENT_DATE)`,
            [
                actorId,
                id_penerima_delegasi,
                id_penugasan,
                parentTask.id_kepanitiaan,
                parentTask.deskripsi,
                parentTask.prioritas,
                tenggat,
                alasan_delegasi
            ]
        );
        const childId = childRes.insertId;

        // Catat ke RIWAYAT_PENUGASAN pada tugas induk & tugas turunan
        await connection.execute(
            `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
                id_penugasan,
                actorId,
                parentTask.status,
                parentTask.status === "Ditugaskan" ? "Diterima" : parentTask.status,
                parentTask.persen_progres,
                `Didelegasikan oleh ${delegator.nama} kepada ${targetSub.nama} (${targetSub.nama_jabatan}). Instruksi: ${alasan_delegasi}`
            ]
        );

        await connection.execute(
            `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
             VALUES (?, ?, NULL, 'Ditugaskan', 0, ?, NOW())`,
            [
                childId,
                actorId,
                `Penugasan hasil delegasi dari #${id_penugasan} oleh ${delegator.nama}. Instruksi: ${alasan_delegasi}`
            ]
        );

        await connection.execute(
            `INSERT INTO audit_trail (id_pengguna, jenis_aktivitas, objek_diubah, id_objek, data_sesudah, keterangan)
             VALUES (?, 'DELEGATE_PENUGASAN', 'PENUGASAN', ?, ?, ?)`,
            [
                actorId,
                id_penugasan,
                JSON.stringify({ id_penugasan_baru: childId, id_penerima_delegasi, alasan_delegasi, tenggat }),
                `Mendelegasikan penugasan #${id_penugasan} ke ${targetSub.nama}`
            ]
        );

        await connection.commit();
        return res.status(201).json({
            message: `Penugasan berhasil didelegasikan kepada ${targetSub.nama}.`,
            id_penugasan_baru: childId
        });
    } catch (error) {
        await connection.rollback();
        console.error("Gagal mendelegasikan penugasan:", error);
        return res.status(500).json({ message: "Gagal mendelegasikan penugasan." });
    } finally {
        connection.release();
    }
}

// UC-06: POST /api/penugasan/:id/respons (Terima / Tolak Penugasan)
async function respondPenugasan(req, res) {
    const id_penugasan = Number(req.params.id);
    const id_penerima = Number(req.body.id_penerima || req.headers["x-user-id"]);
    const keputusan = req.body.keputusan; // 'Terima' atau 'Tolak'
    const alasan_penolakan = (req.body.alasan_penolakan || "").trim();

    if (!["Terima", "Tolak"].includes(keputusan)) {
        return res.status(400).json({ message: "Keputusan harus berupa 'Terima' atau 'Tolak'." });
    }
    if (keputusan === "Tolak" && !alasan_penolakan) {
        return res.status(400).json({ message: "Alasan penolakan wajib diisi jika menolak penugasan." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [[task]] = await connection.execute(
            "SELECT * FROM penugasan WHERE id_penugasan = ? LIMIT 1",
            [id_penugasan]
        );
        if (!task) {
            await connection.rollback();
            return res.status(404).json({ message: "Penugasan tidak ditemukan." });
        }
        if (task.status !== "Ditugaskan") {
            await connection.rollback();
            return res.status(400).json({ message: "Hanya penugasan berstatus 'Ditugaskan' yang dapat direspons." });
        }

        const actorId = id_penerima || task.id_penerima;
        const statusBaru = keputusan === "Terima" ? "Diterima" : "Ditolak";

        await connection.execute(
            `UPDATE penugasan
             SET status = ?,
                 alasan_penolakan = ?,
                 tgl_respons = NOW()
             WHERE id_penugasan = ?`,
            [statusBaru, keputusan === "Tolak" ? alasan_penolakan : null, id_penugasan]
        );

        await connection.execute(
            `INSERT INTO respons_penugasan (id_penugasan, id_penerima, keputusan, alasan_penolakan, tgl_respons)
             VALUES (?, ?, ?, ?, NOW())`,
            [id_penugasan, actorId, keputusan, keputusan === "Tolak" ? alasan_penolakan : null]
        );

        await connection.execute(
            `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
                id_penugasan,
                actorId,
                task.status,
                statusBaru,
                task.persen_progres,
                keputusan === "Terima"
                    ? "Penugasan diterima oleh penerima tugas."
                    : `Penugasan ditolak. Alasan: ${alasan_penolakan}`
            ]
        );

        await connection.execute(
            `INSERT INTO audit_trail (id_pengguna, jenis_aktivitas, objek_diubah, id_objek, data_sebelum, data_sesudah, keterangan)
             VALUES (?, 'RESPOND_PENUGASAN', 'PENUGASAN', ?, ?, ?, ?)`,
            [
                actorId,
                id_penugasan,
                JSON.stringify({ status: task.status }),
                JSON.stringify({ status: statusBaru, keputusan, alasan_penolakan }),
                `Merespons penugasan #${id_penugasan}: ${keputusan}`
            ]
        );

        await connection.commit();
        return res.json({
            message: keputusan === "Terima" ? "Penugasan berhasil diterima." : "Penugasan telah ditolak.",
            status: statusBaru
        });
    } catch (error) {
        await connection.rollback();
        console.error("Gagal menyimpan respons penugasan:", error);
        return res.status(500).json({ message: "Gagal menyimpan respons penugasan." });
    } finally {
        connection.release();
    }
}

// UC-08: PUT /api/penugasan/:id/progres (Memperbarui Status & Progres Pekerjaan)
async function updateProgresPenugasan(req, res) {
    const id_penugasan = Number(req.params.id);
    const id_pengguna = Number(req.body.id_pengguna || req.headers["x-user-id"]);
    let persen_progres = Number(req.body.persen_progres);
    const catatan_progres = (req.body.catatan_progres || "").trim();
    let status = req.body.status || "Dikerjakan";

    if (Number.isNaN(persen_progres) || persen_progres < 0 || persen_progres > 100) {
        return res.status(400).json({ message: "Persentase progres harus berupa angka antara 0 hingga 100." });
    }
    if (!["Dikerjakan", "Selesai"].includes(status)) {
        return res.status(400).json({ message: "Status progres harus bernilai 'Dikerjakan' atau 'Selesai'." });
    }
    if (status === "Selesai") {
        persen_progres = 100;
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [[task]] = await connection.execute(
            "SELECT * FROM penugasan WHERE id_penugasan = ? LIMIT 1",
            [id_penugasan]
        );
        if (!task) {
            await connection.rollback();
            return res.status(404).json({ message: "Penugasan tidak ditemukan." });
        }
        if (!["Diterima", "Dikerjakan"].includes(task.status)) {
            await connection.rollback();
            return res.status(400).json({
                message: "Hanya penugasan berstatus 'Diterima' atau 'Dikerjakan' yang dapat diperbarui progresnya."
            });
        }

        const actorId = id_pengguna || task.id_penerima;

        if (status === "Selesai") {
            await connection.execute(
                `UPDATE penugasan
                 SET persen_progres = 100,
                     catatan_progres = ?,
                     status = 'Selesai',
                     tgl_selesai = CURRENT_DATE
                 WHERE id_penugasan = ?`,
                [catatan_progres, id_penugasan]
            );
        } else {
            await connection.execute(
                `UPDATE penugasan
                 SET persen_progres = ?,
                     catatan_progres = ?,
                     status = 'Dikerjakan'
                 WHERE id_penugasan = ?`,
                [persen_progres, catatan_progres, id_penugasan]
            );
        }

        await connection.execute(
            `INSERT INTO riwayat_penugasan (id_penugasan, id_pengguna, status_lama, status_baru, progres, catatan, waktu_perubahan)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
                id_penugasan,
                actorId,
                task.status,
                status,
                persen_progres,
                catatan_progres || `Pembaruan progres ke ${persen_progres}%`
            ]
        );

        await connection.execute(
            `INSERT INTO audit_trail (id_pengguna, jenis_aktivitas, objek_diubah, id_objek, data_sebelum, data_sesudah, keterangan)
             VALUES (?, 'UPDATE_PROGRES_PENUGASAN', 'PENUGASAN', ?, ?, ?, ?)`,
            [
                actorId,
                id_penugasan,
                JSON.stringify({ status: task.status, persen_progres: task.persen_progres }),
                JSON.stringify({ status, persen_progres, catatan_progres }),
                `Memperbarui progres penugasan #${id_penugasan} menjadi ${persen_progres}% (${status})`
            ]
        );

        await connection.commit();
        return res.json({
            message: "Status dan progres pekerjaan berhasil diperbarui.",
            status,
            persen_progres
        });
    } catch (error) {
        await connection.rollback();
        console.error("Gagal memperbarui progres penugasan:", error);
        return res.status(500).json({ message: "Gagal memperbarui progres penugasan." });
    } finally {
        connection.release();
    }
}

// UC-09: GET /api/riwayat-penugasan (Daftar Riwayat Penugasan sesuai RBAC)
async function listRiwayatPenugasan(req, res) {
    const userId = Number(req.query.userId || req.headers["x-user-id"]);
    const connection = await db.getConnection();
    try {
        const user = await getUserInfo(connection, userId);

        const [rows] = await connection.execute(
            `SELECT pg.*,
                    pemberi.nama AS nama_pemberi,
                    jpemberi.nama_jabatan AS jabatan_pemberi,
                    penerima.nama AS nama_penerima,
                    jpenerima.nama_jabatan AS jabatan_penerima,
                    penerima.id_atasan AS id_atasan_penerima,
                    (SELECT COUNT(*) FROM delegasi_penugasan dp WHERE dp.id_penugasan = pg.id_penugasan) AS jumlah_delegasi,
                    (SELECT MAX(rp.waktu_perubahan) FROM riwayat_penugasan rp WHERE rp.id_penugasan = pg.id_penugasan) AS waktu_perubahan_terakhir
             FROM penugasan pg
             INNER JOIN pengguna pemberi ON pemberi.id_pengguna = pg.id_pemberi
             INNER JOIN jabatan jpemberi ON jpemberi.id_jabatan = pemberi.id_jabatan
             INNER JOIN pengguna penerima ON penerima.id_pengguna = pg.id_penerima
             INNER JOIN jabatan jpenerima ON jpenerima.id_jabatan = penerima.id_jabatan
             ORDER BY COALESCE(waktu_perubahan_terakhir, pg.tgl_penugasan) DESC, pg.id_penugasan DESC`
        );

        let filtered = rows;
        if (user) {
            if (user.nama_role === "Dekan / Wakil Dekan" || user.nama_role === "Superadmin") {
                filtered = rows; // Seluruh riwayat fakultas
            } else if (user.nama_role === "Kepala Kantor") {
                filtered = rows.filter(
                    (r) =>
                        Number(r.id_pemberi) === Number(user.id_pengguna) ||
                        Number(r.id_penerima) === Number(user.id_pengguna) ||
                        Number(r.id_atasan_penerima) === Number(user.id_pengguna)
                );
            } else if (user.nama_role === "Kasi") {
                filtered = rows.filter(
                    (r) =>
                        Number(r.id_pemberi) === Number(user.id_pengguna) ||
                        Number(r.id_penerima) === Number(user.id_pengguna) ||
                        Number(r.id_atasan_penerima) === Number(user.id_pengguna)
                );
            } else {
                // Tendik & Dosen: riwayat penugasan yang ditujukan kepadanya
                filtered = rows.filter((r) => Number(r.id_penerima) === Number(user.id_pengguna));
            }
        }

        return res.json({ data: filtered });
    } catch (error) {
        console.error("Gagal mengambil daftar riwayat penugasan:", error);
        return res.status(500).json({ message: "Gagal mengambil daftar riwayat penugasan." });
    } finally {
        connection.release();
    }
}

// UC-09: GET /api/riwayat-penugasan/:id (Detail Timeline Riwayat Penugasan & Rantai Delegasi)
async function getDetailRiwayatPenugasan(req, res) {
    const id_penugasan = Number(req.params.id);
    const connection = await db.getConnection();
    try {
        const [[task]] = await connection.execute(
            `SELECT pg.*,
                    pemberi.nama AS nama_pemberi,
                    jpemberi.nama_jabatan AS jabatan_pemberi,
                    penerima.nama AS nama_penerima,
                    jpenerima.nama_jabatan AS jabatan_penerima
             FROM penugasan pg
             INNER JOIN pengguna pemberi ON pemberi.id_pengguna = pg.id_pemberi
             INNER JOIN jabatan jpemberi ON jpemberi.id_jabatan = pemberi.id_jabatan
             INNER JOIN pengguna penerima ON penerima.id_pengguna = pg.id_penerima
             INNER JOIN jabatan jpenerima ON jpenerima.id_jabatan = penerima.id_jabatan
             WHERE pg.id_penugasan = ? LIMIT 1`,
            [id_penugasan]
        );
        if (!task) {
            return res.status(404).json({ message: "Penugasan tidak ditemukan." });
        }

        // Ambil riwayat perubahan status & progres (RIWAYAT_PENUGASAN)
        const [riwayat] = await connection.execute(
            `SELECT rp.*, u.nama AS nama_pengguna, j.nama_jabatan
             FROM riwayat_penugasan rp
             INNER JOIN pengguna u ON u.id_pengguna = rp.id_pengguna
             INNER JOIN jabatan j ON j.id_jabatan = u.id_jabatan
             WHERE rp.id_penugasan = ?
             ORDER BY rp.waktu_perubahan ASC, rp.id_riwayat ASC`,
            [id_penugasan]
        );

        // Ambil daftar delegasi dari tugas ini (DELEGASI_PENUGASAN)
        const [delegasi] = await connection.execute(
            `SELECT dp.*,
                    pemberi.nama AS nama_pemberi_delegasi,
                    jpemberi.nama_jabatan AS jabatan_pemberi_delegasi,
                    penerima.nama AS nama_penerima_delegasi,
                    jpenerima.nama_jabatan AS jabatan_penerima_delegasi
             FROM delegasi_penugasan dp
             INNER JOIN pengguna pemberi ON pemberi.id_pengguna = dp.id_pemberi_delegasi
             INNER JOIN jabatan jpemberi ON jpemberi.id_jabatan = pemberi.id_jabatan
             INNER JOIN pengguna penerima ON penerima.id_pengguna = dp.id_penerima_delegasi
             INNER JOIN jabatan jpenerima ON jpenerima.id_jabatan = penerima.id_jabatan
             WHERE dp.id_penugasan = ?
             ORDER BY dp.waktu ASC`,
            [id_penugasan]
        );

        // Ambil respons penerimaan/penolakan (RESPONS_PENUGASAN)
        const [respons] = await connection.execute(
            `SELECT rsp.*, u.nama AS nama_penerima, j.nama_jabatan
             FROM respons_penugasan rsp
             INNER JOIN pengguna u ON u.id_pengguna = rsp.id_penerima
             INNER JOIN jabatan j ON j.id_jabatan = u.id_jabatan
             WHERE rsp.id_penugasan = ?
             ORDER BY rsp.tgl_respons ASC`,
            [id_penugasan]
        );

        return res.json({
            penugasan: task,
            riwayat,
            delegasi,
            respons
        });
    } catch (error) {
        console.error("Gagal mengambil detail riwayat penugasan:", error);
        return res.status(500).json({ message: "Gagal mengambil detail riwayat penugasan." });
    } finally {
        connection.release();
    }
}

module.exports = {
    listBawahan,
    listPenugasan,
    createPenugasan,
    updatePenugasan,
    cancelPenugasan,
    delegatePenugasan,
    respondPenugasan,
    updateProgresPenugasan,
    listRiwayatPenugasan,
    getDetailRiwayatPenugasan
};
