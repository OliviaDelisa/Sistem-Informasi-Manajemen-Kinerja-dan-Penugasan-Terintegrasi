const db = require("../config/database");

function normalizePeriode(p) {
    if (!p) return null;
    const str = String(p).trim();
    if (!str || str.toLowerCase() === "semua" || str.toLowerCase().includes("semua periode")) {
        return null;
    }
    // Jika format sudah YYYY-MM
    if (/^\d{4}-\d{2}$/.test(str)) {
        return str;
    }
    // Jika format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str.substring(0, 7);
    }
    // Jika format nama bulan tahun seperti "November 2024" atau "November 2026"
    const months = {
        januari: "01", jan: "01", january: "01",
        februari: "02", feb: "02", february: "02",
        maret: "03", mar: "03", march: "03",
        april: "04", apr: "04",
        mei: "05", may: "05",
        juni: "06", jun: "06", june: "06",
        juli: "07", jul: "07", july: "07",
        agustus: "08", agu: "08", ags: "08", august: "08",
        september: "09", sep: "09", sept: "09",
        oktober: "10", okt: "10", oct: "10", october: "10",
        november: "11", nov: "11",
        desember: "12", des: "12", dec: "12", december: "12"
    };
    const parts = str.toLowerCase().split(/\s+/);
    if (parts.length === 2) {
        const [monthName, year] = parts;
        if (months[monthName] && /^\d{4}$/.test(year)) {
            return `${year}-${months[monthName]}`;
        }
        if (/^\d{4}$/.test(monthName) && months[year]) {
            return `${monthName}-${months[year]}`;
        }
    }
    return null;
}

async function findByUserId(idPengguna, filters = {}) {
    let sql = `
        SELECT 
            l.id_logbook AS id,
            l.id_pengguna,
            DATE_FORMAT(l.tgl_kegiatan, '%d %b %Y') AS tanggal,
            DATE_FORMAT(l.tgl_kegiatan, '%Y-%m-%d') AS tglRaw,
            COALESCE(l.waktu, '08:00 - 11:00') AS waktu,
            l.kategori,
            COALESCE(l.judul, l.kategori) AS judul,
            COALESCE(l.nomor_sk, 'Mandiri / Tupoksi') AS nomorSk,
            l.uraian,
            COALESCE(l.target, 'Terlaksana') AS targetOutput,
            COALESCE(l.hasil, l.target, 'Terlaksana') AS outputShort,
            l.periode,
            l.status,
            CASE 
                WHEN l.status = 'divalidasi' THEN 'sah'
                WHEN l.status = 'perlu_revisi' THEN 'revisi'
                ELSE 'review'
            END AS statusKey,
            CASE 
                WHEN l.status = 'divalidasi' THEN 'Tervalidasi TTE ✓'
                WHEN l.status = 'perlu_revisi' THEN 'Perlu Perbaikan'
                ELSE 'Menunggu Review'
            END AS statusLabel,
            b.nama_berkas AS berkasNama,
            COALESCE(b.ukuran_berkas, '1.5 MB') AS berkasUkuran,
            COALESCE(r.catatan_revisi, r.komentar, v.alasan_pengembalian, 
                CASE 
                    WHEN l.status = 'divalidasi' THEN 'Kegiatan telah disetujui dan divalidasi dengan Tanda Tangan Elektronik (TTE BSrE BSSN).'
                    WHEN l.status = 'perlu_revisi' THEN 'Mohon perbaiki berkas eviden atau lengkapi presensi kehadiran sebelum divalidasi.'
                    ELSE 'Menunggu proses peninjauan oleh Dekanat / atasan langsung.'
                END
            ) AS catatanReviewer,
            COALESCE(peninjau.nama, validator.nama, 
                CASE 
                    WHEN l.status = 'divalidasi' THEN 'Dekanat / Wadek I & II (Sah)'
                    WHEN l.status = 'perlu_revisi' THEN 'Prof. Dr. Ir. Ahmad Hidayat, M.T. (Dekan)'
                    ELSE 'Dalam Antrean Review'
                END
            ) AS reviewerName,
            DATE_FORMAT(COALESCE(r.waktu, v.waktu_validasi, l.tgl_pengajuan), '%d %b %Y %H:%i') AS tglReview
        FROM logbook l
        LEFT JOIN (
            SELECT id_logbook, nama_berkas, ukuran_berkas,
                   ROW_NUMBER() OVER (PARTITION BY id_logbook ORDER BY id_bukti DESC) as rn
            FROM bukti_logbook
        ) b ON b.id_logbook = l.id_logbook AND b.rn = 1
        LEFT JOIN (
            SELECT id_logbook, id_peninjau, komentar, catatan_revisi, status_review, waktu,
                   ROW_NUMBER() OVER (PARTITION BY id_logbook ORDER BY id_review DESC) as rn
            FROM review_logbook
        ) r ON r.id_logbook = l.id_logbook AND r.rn = 1
        LEFT JOIN pengguna peninjau ON peninjau.id_pengguna = r.id_peninjau
        LEFT JOIN (
            SELECT id_logbook, id_validator, keputusan, alasan_pengembalian, waktu_validasi,
                   ROW_NUMBER() OVER (PARTITION BY id_logbook ORDER BY id_validasi DESC) as rn
            FROM validasi_logbook
        ) v ON v.id_logbook = l.id_logbook AND v.rn = 1
        LEFT JOIN pengguna validator ON validator.id_pengguna = v.id_validator
        WHERE l.id_pengguna = ?
    `;

    const params = [Number(idPengguna)];

    const normalizedPeriode = normalizePeriode(filters.periode);
    if (normalizedPeriode) {
        sql += ` AND l.periode = ?`;
        params.push(normalizedPeriode);
    }

    if (filters.kategori && filters.kategori !== "Semua") {
        sql += ` AND l.kategori = ?`;
        params.push(filters.kategori);
    }

    if (filters.status && filters.status !== "Semua") {
        if (filters.status === "Sah" || filters.status === "sah") {
            sql += ` AND l.status = 'divalidasi'`;
        } else if (filters.status === "Review" || filters.status === "review") {
            sql += ` AND l.status IN ('diajukan', 'direview')`;
        } else if (filters.status === "Revisi" || filters.status === "revisi") {
            sql += ` AND l.status = 'perlu_revisi'`;
        }
    }

    if (filters.search && filters.search.trim()) {
        const keyword = `%${filters.search.trim()}%`;
        sql += ` AND (l.uraian LIKE ? OR l.judul LIKE ? OR l.nomor_sk LIKE ? OR l.target LIKE ?)`;
        params.push(keyword, keyword, keyword, keyword);
    }

    sql += ` ORDER BY l.tgl_kegiatan DESC, l.id_logbook DESC`;

    const [rows] = await db.execute(sql, params);
    return rows;
}

async function getSummary(idPengguna, periode = null) {
    let sql = `
        SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'divalidasi' THEN 1 ELSE 0 END) AS sah,
            SUM(CASE WHEN status IN ('diajukan', 'direview') THEN 1 ELSE 0 END) AS review,
            SUM(CASE WHEN status = 'perlu_revisi' THEN 1 ELSE 0 END) AS revisi
        FROM logbook
        WHERE id_pengguna = ?
    `;
    const params = [Number(idPengguna)];
    const normalizedPeriode = normalizePeriode(periode);
    if (normalizedPeriode) {
        sql += ` AND periode = ?`;
        params.push(normalizedPeriode);
    }
    const [rows] = await db.execute(sql, params);
    return {
        total: Number(rows[0]?.total || 0),
        sah: Number(rows[0]?.sah || 0),
        review: Number(rows[0]?.review || 0),
        revisi: Number(rows[0]?.revisi || 0)
    };
}

async function createLogbook(data) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [result] = await connection.execute(
            `INSERT INTO logbook
                (id_pengguna, tgl_kegiatan, waktu, kategori, judul, nomor_sk,
                 uraian, target, hasil, status, tgl_pengajuan)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'diajukan', NOW())`,
            [
                Number(data.idPengguna),
                data.tglKegiatan,
                data.waktu || "08:00 - 11:00",
                data.kategori || "Pengajaran",
                data.judul,
                data.nomorSk || null,
                data.uraian,
                data.target || null,
                data.hasil || data.target || null
            ]
        );

        const idLogbook = result.insertId;

        if (data.berkasNama) {
            await connection.execute(
                `INSERT INTO bukti_logbook
                    (id_logbook, nama_berkas, jenis_berkas, ukuran_berkas, lokasi_berkas, keterangan)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    idLogbook,
                    data.berkasNama,
                    data.jenisBerkas || "application/pdf",
                    data.berkasUkuran || "1.8 MB",
                    `/uploads/eviden/${data.berkasNama}`,
                    data.keteranganEviden || data.judul
                ]
            );
        }

        await connection.commit();
        return idLogbook;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function resubmitRevision(idLogbook, idPengguna, revisionNote, newFileName) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        await connection.execute(
            `UPDATE logbook
             SET status = 'diajukan', tgl_pengajuan = NOW()
             WHERE id_logbook = ? AND id_pengguna = ?`,
            [Number(idLogbook), Number(idPengguna)]
        );

        if (newFileName) {
            await connection.execute(
                `INSERT INTO bukti_logbook
                    (id_logbook, nama_berkas, jenis_berkas, ukuran_berkas, lokasi_berkas, keterangan)
                 VALUES (?, ?, 'application/pdf', '1.8 MB', ?, ?)`,
                [
                    Number(idLogbook),
                    newFileName,
                    `/uploads/eviden/${newFileName}`,
                    `Revisi eviden: ${revisionNote || "Perbaikan dokumen"}`
                ]
            );
        }

        if (revisionNote) {
            await connection.execute(
                `INSERT INTO review_logbook
                    (id_logbook, id_peninjau, komentar, catatan_revisi, status_review, waktu)
                 VALUES (?, ?, ?, ?, 'revisi', NOW())`,
                [
                    Number(idLogbook),
                    Number(idPengguna),
                    `Catatan pengajuan revisi: ${revisionNote}`,
                    revisionNote
                ]
            );
        }

        await connection.commit();
        return true;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function seedSampleLogbooks(connection) {
    const [[cntRow]] = await connection.execute("SELECT COUNT(*) AS cnt FROM logbook");
    if (Number(cntRow.cnt) > 0) return;

    // Get Dosen and Dekan IDs
    const [[dosen]] = await connection.execute("SELECT id_pengguna FROM pengguna WHERE username = 'dosen@unand.ac.id' LIMIT 1");
    const [[dekan]] = await connection.execute("SELECT id_pengguna FROM pengguna WHERE username = 'dekan@unand.ac.id' LIMIT 1");
    const [[tendik]] = await connection.execute("SELECT id_pengguna FROM pengguna WHERE username = 'tendik@unand.ac.id' LIMIT 1");

    if (!dosen) return;
    const idDosen = dosen.id_pengguna;
    const idDekan = dekan ? dekan.id_pengguna : idDosen;

    const samples = [
        {
            idPengguna: idDosen,
            tglKegiatan: '2024-11-12',
            waktu: '09:00 - 12:30 (3.5 jam)',
            kategori: 'Kepanitiaan SK',
            judul: 'Koordinasi Venue & Sponsor ICITACEE 2025',
            nomorSk: 'SK Dekan No. 142/UN16.08/KP/2024',
            uraian: 'Rapat pleno negosiasi bersama pihak venue hotel dan calon sponsor utama tier platinum untuk penyelenggaraan konferensi internasional ICITACEE 2025.',
            target: 'Target: 1 Berita Acara Rapat',
            hasil: '1 Berita Acara Rapat',
            status: 'perlu_revisi',
            tglPengajuan: '2024-11-12 13:00:00',
            berkas: 'Notula_12Nov.pdf',
            ukuran: '1.4 MB',
            catatanRevisi: 'Mohon lampirkan tanda tangan presensi kehadiran perwakilan pihak hotel dan ringkasan penawaran paket sponsorship sebelum pengesahan TTE.'
        },
        {
            idPengguna: idDosen,
            tglKegiatan: '2024-11-15',
            waktu: '07:30 - 10:00 (2.5 jam)',
            kategori: 'Pengajaran',
            judul: 'Kuliah Perkuliahan IF3102 - Sistem Terdistribusi',
            nomorSk: 'Pertemuan Ke-11 (Kelas A, R. Gedung H 2.1)',
            uraian: 'Penyampaian materi konsensus distributed system Raft, studi kasus fault-tolerance pada distributed ledger, dan evaluasi tugas pemrograman socket.',
            target: 'Output: BAP & Presensi 42 Mahasiswa',
            hasil: 'BAP & Presensi 42 Mahasiswa',
            status: 'divalidasi',
            tglPengajuan: '2024-11-15 10:30:00',
            berkas: 'BAP_P11_SIKOLA.pdf',
            ukuran: '820 KB',
            isValidasi: true
        },
        {
            idPengguna: idDosen,
            tglKegiatan: '2024-11-16',
            waktu: '13:30 - 16:30 (3.0 jam)',
            kategori: 'Kepanitiaan SK',
            judul: 'Penyusunan Borang Kriteria 4 Akreditasi ASIIN',
            nomorSk: 'SK Dekan No. 088/UN16.08/KP/2024',
            uraian: 'Sinkronisasi matriks keselarasan CPL dan capaian mata kuliah laboratorium sesuai standar sertifikasi akreditasi internasional ASIIN.',
            target: 'Output: Dokumen Self Assessment Report Bab 4',
            hasil: 'Dokumen Self Assessment Report Bab 4',
            status: 'diajukan',
            tglPengajuan: '2024-11-16 17:00:00',
            berkas: 'SAR_Kriteria4_v2.docx',
            ukuran: '2.8 MB'
        },
        {
            idPengguna: idDosen,
            tglKegiatan: '2024-11-18',
            waktu: '09:00 - 12:00 (3.0 jam)',
            kategori: 'Penelitian',
            judul: 'Eksperimen Model Deteksi Intrusi Jaringan IoT',
            nomorSk: 'Hibah Riset Fakultas FTI 2024',
            uraian: 'Pengujian performa model deep learning pada dataset traffic IoT UNSW-NB15 untuk mitigasi serangan DDoS berbasis protokol MQTT.',
            target: 'Output: Draf Naskah Jurnal & Log Hasil Pengujian',
            hasil: 'Draf Naskah Jurnal & Log Hasil Pengujian',
            status: 'divalidasi',
            tglPengajuan: '2024-11-18 12:30:00',
            berkas: 'Draft_Paper_IoT_v1.pdf',
            ukuran: '3.1 MB',
            isValidasi: true
        }
    ];

    if (tendik) {
        samples.push({
            idPengguna: tendik.id_pengguna,
            tglKegiatan: '2024-11-14',
            waktu: '08:30 - 12:00 (3.5 jam)',
            kategori: 'Administrasi',
            judul: 'Verifikasi Kuitansi & SPJ Belanja Modal Triwulan IV',
            nomorSk: 'Tupoksi Keuangan FTI',
            uraian: 'Melakukan rekonsiliasi berkas bukti transaksi belanja modal laboratorium dan verifikasi kelengkapan faktur pajak.',
            target: 'Output: Berkas SPJ Terverifikasi',
            hasil: 'Berkas SPJ Terverifikasi',
            status: 'divalidasi',
            tglPengajuan: '2024-11-14 13:00:00',
            berkas: 'SPJ_Modal_Nov2024.pdf',
            ukuran: '2.1 MB',
            isValidasi: true
        });
    }

    for (const item of samples) {
        const [res] = await connection.execute(
            `INSERT INTO logbook
                (id_pengguna, tgl_kegiatan, waktu, kategori, judul, nomor_sk,
                 uraian, target, hasil, status, tgl_pengajuan)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                item.idPengguna,
                item.tglKegiatan,
                item.waktu,
                item.kategori,
                item.judul,
                item.nomorSk,
                item.uraian,
                item.target,
                item.hasil,
                item.status,
                item.tglPengajuan
            ]
        );
        const idLogbook = res.insertId;

        if (item.berkas) {
            await connection.execute(
                `INSERT INTO bukti_logbook
                    (id_logbook, nama_berkas, jenis_berkas, ukuran_berkas, lokasi_berkas, keterangan)
                 VALUES (?, ?, 'application/pdf', ?, ?, ?)`,
                [
                    idLogbook,
                    item.berkas,
                    item.ukuran || '1.5 MB',
                    `/uploads/eviden/${item.berkas}`,
                    item.judul
                ]
            );
        }

        if (item.catatanRevisi) {
            await connection.execute(
                `INSERT INTO review_logbook
                    (id_logbook, id_peninjau, komentar, catatan_revisi, status_review, waktu)
                 VALUES (?, ?, ?, ?, 'revisi', ?)`,
                [
                    idLogbook,
                    idDekan,
                    item.catatanRevisi,
                    item.catatanRevisi,
                    item.tglPengajuan
                ]
            );
        }

        if (item.isValidasi) {
            await connection.execute(
                `INSERT INTO validasi_logbook
                    (id_logbook, id_validator, keputusan, waktu_validasi)
                 VALUES (?, ?, 'divalidasi', ?)`,
                [
                    idLogbook,
                    idDekan,
                    item.tglPengajuan
                ]
            );
        }
    }
}

/**
 * Ambil daftar bawahan langsung dari seorang atasan/supervisor berdasarkan relasi p.id_atasan.
 */
async function getSubordinates(idSupervisor) {
    const sql = `
        SELECT 
            p.id_pengguna,
            p.nama,
            p.username,
            p.nidn,
            COALESCE(j.nama_jabatan, 'Pegawai') AS nama_jabatan,
            COALESCE(u.nama_unit, 'FTI UNAND') AS nama_unit,
            r.nama_role,
            p.jenis_pengguna,
            COUNT(l.id_logbook) AS total_logbook,
            SUM(CASE WHEN l.status = 'divalidasi' THEN 1 ELSE 0 END) AS disahkan,
            SUM(CASE WHEN l.status IN ('diajukan', 'direview') THEN 1 ELSE 0 END) AS antrean,
            SUM(CASE WHEN l.status = 'perlu_revisi' THEN 1 ELSE 0 END) AS revisi
        FROM pengguna p
        LEFT JOIN jabatan j ON j.id_jabatan = p.id_jabatan
        LEFT JOIN unit_kerja u ON u.id_unit = p.id_unit
        LEFT JOIN role r ON r.id_role = p.id_role
        LEFT JOIN logbook l ON l.id_pengguna = p.id_pengguna
        WHERE p.id_atasan = ? AND p.status_akun = 'aktif'
        GROUP BY p.id_pengguna
        ORDER BY p.id_pengguna ASC
    `;
    const [rows] = await db.execute(sql, [Number(idSupervisor)]);
    return rows;
}

/**
 * Ambil entri logbook milik bawahan dengan pengecekan ketat relasi atasan-bawahan di database.
 */
async function getSubordinateLogbookData(idSupervisor, subordinateId, filters = {}) {
    // 1. Verifikasi ketat relasi atasan-bawahan di database
    const [subRows] = await db.execute(
        `SELECT p.id_pengguna, p.nama, p.username, p.id_atasan,
                COALESCE(j.nama_jabatan, 'Pegawai') AS nama_jabatan,
                COALESCE(u.nama_unit, 'FTI UNAND') AS nama_unit
         FROM pengguna p
         LEFT JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         LEFT JOIN unit_kerja u ON u.id_unit = p.id_unit
         WHERE p.id_pengguna = ?`,
        [Number(subordinateId)]
    );

    if (subRows.length === 0) {
        const error = new Error("Bawahan tidak ditemukan di sistem.");
        error.statusCode = 404;
        throw error;
    }

    const subordinate = subRows[0];
    if (Number(subordinate.id_atasan) !== Number(idSupervisor)) {
        const error = new Error("Akses ditolak: Anda tidak memiliki wewenang untuk memeriksa logbook bawahan ini karena tidak berada di bawah tanggung jawab langsung Anda.");
        error.statusCode = 403;
        throw error;
    }

    // 2. Ambil logbook milik bawahan tersebut
    const entries = await findByUserId(subordinateId, filters);
    const summary = await getSummary(subordinateId, filters.periode);

    // Hitung persentase realisasi
    const totalSemua = summary.total || entries.length;
    const realisasiPersen = totalSemua > 0
        ? Math.min(100, Math.round(((summary.sah + summary.review) / totalSemua) * 100))
        : 100;

    return {
        subordinate: {
            id: subordinate.id_pengguna,
            name: subordinate.nama,
            username: subordinate.username,
            position: subordinate.nama_jabatan,
            unit: subordinate.nama_unit,
            realisasiPersen: realisasiPersen || 98
        },
        entries,
        summary: {
            disahkan: summary.sah,
            antrean: summary.review,
            revisi: summary.revisi,
            total: summary.total
        }
    };
}

/**
 * Eksekusi review & validasi logbook bawahan dengan validasi wewenang relasi atasan di database.
 */
async function reviewAndValidateLogbook(idLogbook, idSupervisor, action, payload = {}) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Verifikasi kepemilikan dan kewenangan atasan di database
        const [ownerRows] = await connection.execute(
            `SELECT l.id_logbook, l.id_pengguna, l.status, p.nama AS nama_bawahan, p.id_atasan
             FROM logbook l
             JOIN pengguna p ON p.id_pengguna = l.id_pengguna
             WHERE l.id_logbook = ?`,
            [Number(idLogbook)]
        );

        if (ownerRows.length === 0) {
            const error = new Error("Entri logbook tidak ditemukan.");
            error.statusCode = 404;
            throw error;
        }

        const logbookData = ownerRows[0];
        if (Number(logbookData.id_atasan) !== Number(idSupervisor)) {
            const error = new Error("Akses ditolak: Anda tidak memiliki wewenang memvalidasi logbook ini karena pemilik bukan bawahan langsung Anda.");
            error.statusCode = 403;
            throw error;
        }

        const { catatanRevisi, komentar } = payload;

        if (action === 'validasi' || action === 'sah') {
            // Ubah status logbook menjadi divalidasi
            await connection.execute(
                `UPDATE logbook SET status = 'divalidasi' WHERE id_logbook = ?`,
                [Number(idLogbook)]
            );

            // Rekam di validasi_logbook
            await connection.execute(
                `INSERT INTO validasi_logbook (id_logbook, id_validator, keputusan, waktu_validasi)
                 VALUES (?, ?, 'divalidasi', NOW())`,
                [Number(idLogbook), Number(idSupervisor)]
            );

            // Rekam di review_logbook
            await connection.execute(
                `INSERT INTO review_logbook (id_logbook, id_peninjau, komentar, status_review, waktu)
                 VALUES (?, ?, ?, 'sesuai', NOW())`,
                [Number(idLogbook), Number(idSupervisor), komentar || 'Logbook kegiatan telah disetujui dan divalidasi oleh atasan langsung.']
            );
        } else if (action === 'revisi') {
            if (!catatanRevisi || !catatanRevisi.trim()) {
                const error = new Error("Catatan revisi wajib diisi agar bawahan mengetahui bagian yang perlu diperbaiki.");
                error.statusCode = 400;
                throw error;
            }

            // Ubah status logbook menjadi perlu_revisi
            await connection.execute(
                `UPDATE logbook SET status = 'perlu_revisi' WHERE id_logbook = ?`,
                [Number(idLogbook)]
            );

            // Rekam di review_logbook
            await connection.execute(
                `INSERT INTO review_logbook (id_logbook, id_peninjau, komentar, catatan_revisi, status_review, waktu)
                 VALUES (?, ?, ?, ?, 'revisi', NOW())`,
                [Number(idLogbook), Number(idSupervisor), komentar || catatanRevisi, catatanRevisi]
            );
        } else if (action === 'tolak' || action === 'kembalikan') {
            await connection.execute(
                `UPDATE logbook SET status = 'dikembalikan' WHERE id_logbook = ?`,
                [Number(idLogbook)]
            );

            await connection.execute(
                `INSERT INTO validasi_logbook (id_logbook, id_validator, keputusan, alasan_pengembalian, waktu_validasi)
                 VALUES (?, ?, 'dikembalikan', ?, NOW())`,
                [Number(idLogbook), Number(idSupervisor), catatanRevisi || komentar || 'Ditolak oleh atasan']
            );
        } else {
            const error = new Error(`Aksi '${action}' tidak dikenali. Gunakan 'validasi' atau 'revisi'.`);
            error.statusCode = 400;
            throw error;
        }

        await connection.commit();
        return {
            success: true,
            idLogbook: Number(idLogbook),
            action,
            namaBawahan: logbookData.nama_bawahan
        };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

/**
 * Mengambil detail satu entri logbook secara dinamis dari database.
 * Memeriksa hak akses relasi atasan-bawahan jika idSupervisor diberikan.
 */
async function getLogbookDetail(idLogbook, idSupervisor = null) {
    const [rows] = await db.execute(
        `SELECT 
            l.id_logbook AS id,
            l.id_pengguna,
            l.tgl_kegiatan,
            DATE_FORMAT(l.tgl_kegiatan, '%d %b %Y') AS tanggalFormatted,
            DATE_FORMAT(l.tgl_kegiatan, '%Y-%m-%d') AS tglRaw,
            COALESCE(l.waktu, '08:00 - 11:00') AS waktu,
            l.kategori,
            COALESCE(l.judul, l.kategori) AS judul,
            COALESCE(l.nomor_sk, 'Mandiri / Tupoksi') AS nomorSk,
            l.uraian,
            COALESCE(l.target, 'Terlaksana') AS target,
            COALESCE(l.hasil, l.target, 'Terlaksana') AS hasil,
            l.periode,
            l.status,
            CASE 
                WHEN l.status = 'divalidasi' THEN 'sah'
                WHEN l.status = 'perlu_revisi' THEN 'revisi'
                ELSE 'review'
            END AS statusKey,
            CASE 
                WHEN l.status = 'divalidasi' THEN 'Tervalidasi TTE ✓'
                WHEN l.status = 'perlu_revisi' THEN 'Perlu Perbaikan'
                ELSE 'Menunggu Pengesahan'
            END AS statusLabel,
            DATE_FORMAT(l.tgl_pengajuan, '%d %b %Y %H:%i') AS tglPengajuanFormatted,
            p.nama AS nama_pegawai,
            p.username AS email_pegawai,
            p.nidn,
            p.id_atasan,
            COALESCE(j.nama_jabatan, 'Pegawai') AS nama_jabatan,
            COALESCE(u.nama_unit, 'FTI Universitas Andalas') AS nama_unit,
            atasan.nama AS nama_atasan,
            COALESCE(atasan_j.nama_jabatan, 'Pimpinan') AS jabatan_atasan
         FROM logbook l
         JOIN pengguna p ON p.id_pengguna = l.id_pengguna
         LEFT JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         LEFT JOIN unit_kerja u ON u.id_unit = p.id_unit
         LEFT JOIN pengguna atasan ON atasan.id_pengguna = p.id_atasan
         LEFT JOIN jabatan atasan_j ON atasan_j.id_jabatan = atasan.id_jabatan
         WHERE l.id_logbook = ?`,
        [Number(idLogbook)]
    );

    if (rows.length === 0) {
        const error = new Error("Data logbook tidak ditemukan.");
        error.statusCode = 404;
        throw error;
    }

    const logbook = rows[0];

    // Cek hak akses jika atasan mengakses logbook bawahan
    if (idSupervisor) {
        const supId = Number(idSupervisor);
        const ownerId = Number(logbook.id_pengguna);
        const atasanId = Number(logbook.id_atasan);

        if (atasanId !== supId && ownerId !== supId) {
            const error = new Error("Akses ditolak: Anda tidak memiliki wewenang untuk memeriksa logbook bawahan ini karena tidak berada di bawah tanggung jawab langsung Anda.");
            error.statusCode = 403;
            throw error;
        }
    }

    // Ambil seluruh berkas bukti/lampiran dari tabel bukti_logbook
    const [buktiRows] = await db.execute(
        `SELECT 
            id_bukti,
            id_logbook,
            nama_berkas,
            jenis_berkas,
            COALESCE(ukuran_berkas, '1.5 MB') AS ukuran_berkas,
            lokasi_berkas,
            DATE_FORMAT(tgl_unggah, '%d %b %Y %H:%i') AS tgl_unggah,
            COALESCE(keterangan, 'Eviden Unggahan') AS keterangan
         FROM bukti_logbook
         WHERE id_logbook = ?
         ORDER BY id_bukti ASC`,
        [Number(idLogbook)]
    );

    // Ambil riwayat review dari review_logbook
    const [reviewRows] = await db.execute(
        `SELECT 
            r.id_review,
            r.id_logbook,
            r.id_peninjau,
            p.nama AS peninjau_nama,
            COALESCE(j.nama_jabatan, 'Peninjau') AS peninjau_jabatan,
            r.komentar,
            r.catatan_revisi,
            r.status_review,
            DATE_FORMAT(r.waktu, '%d %b %Y %H:%i') AS waktu_review
         FROM review_logbook r
         LEFT JOIN pengguna p ON p.id_pengguna = r.id_peninjau
         LEFT JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         WHERE r.id_logbook = ?
         ORDER BY r.waktu DESC`,
        [Number(idLogbook)]
    );

    // Ambil riwayat validasi dari validasi_logbook
    const [validasiRows] = await db.execute(
        `SELECT 
            v.id_validasi,
            v.id_logbook,
            v.id_validator,
            p.nama AS validator_nama,
            COALESCE(j.nama_jabatan, 'Validator') AS validator_jabatan,
            v.keputusan,
            v.alasan_pengembalian,
            DATE_FORMAT(v.waktu_validasi, '%d %b %Y %H:%i') AS waktu_validasi
         FROM validasi_logbook v
         LEFT JOIN pengguna p ON p.id_pengguna = v.id_validator
         LEFT JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         WHERE v.id_logbook = ?
         ORDER BY v.waktu_validasi DESC`,
        [Number(idLogbook)]
    );

    // Catatan evaluasi pimpinan terkini
    const latestReview = reviewRows[0] || null;
    const latestValidasi = validasiRows[0] || null;
    const catatanPimpinan = latestReview?.catatan_revisi || latestReview?.komentar || latestValidasi?.alasan_pengembalian || null;

    return {
        logbook,
        bukti: buktiRows,
        riwayatReview: reviewRows,
        riwayatValidasi: validasiRows,
        catatanPimpinan,
        latestReview,
        latestValidasi
    };
}

module.exports = {
    findByUserId,
    getSummary,
    createLogbook,
    resubmitRevision,
    seedSampleLogbooks,
    getSubordinates,
    getSubordinateLogbookData,
    reviewAndValidateLogbook,
    getLogbookDetail
};
