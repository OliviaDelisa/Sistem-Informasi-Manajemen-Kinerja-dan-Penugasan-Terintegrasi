const db = require("../config/database");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const uploadRoot = path.resolve(__dirname, "..", "uploads");
const logbookImageDirectory = path.join(uploadRoot, "logbook");
const maxEvidenceBytes = 5 * 1024 * 1024;

function decodeLogbookImage(data, mimeType) {
    const allowedMimeTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);
    if (!allowedMimeTypes.has(mimeType)) {
        const error = new Error("Bukti logbook harus berformat JPG, JPEG, PNG, atau PDF.");
        error.statusCode = 400;
        throw error;
    }
    if (typeof data !== "string" || !data || data.length > Math.ceil(maxEvidenceBytes * 4 / 3) + 8) {
        const error = new Error("Berkas bukti wajib diisi dan ukurannya maksimal 5 MB.");
        error.statusCode = 400;
        throw error;
    }

    const base64 = data.replace(/^data:(?:image\/(?:jpeg|png)|application\/pdf);base64,/i, "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        const error = new Error("Data gambar tidak valid.");
        error.statusCode = 400;
        throw error;
    }
    const buffer = Buffer.from(base64, "base64");
    const isJpeg = mimeType === "image/jpeg" && buffer.length >= 3 &&
        buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = mimeType === "image/png" && buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isPdf = mimeType === "application/pdf" && buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    if ((!isJpeg && !isPng && !isPdf) || buffer.length > maxEvidenceBytes) {
        const error = new Error("Isi berkas bukan gambar JPG/PNG atau PDF yang valid, atau ukurannya melebihi 5 MB.");
        error.statusCode = 400;
        throw error;
    }
    return buffer;
}

function resolveEvidenceDiskPath(location) {
    if (typeof location !== "string" || !location.startsWith("/uploads/")) return null;
    const relativePath = location.slice("/uploads/".length).replace(/[\\/]/g, path.sep);
    const absolutePath = path.resolve(uploadRoot, relativePath);
    if (!absolutePath.startsWith(`${uploadRoot}${path.sep}`)) return null;
    return absolutePath;
}

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
                WHEN l.status = 'divalidasi' THEN 'Tervalidasi'
                WHEN l.status = 'perlu_revisi' THEN 'Revisi'
                ELSE 'Menunggu Validasi'
            END AS statusLabel,
            b.id_bukti AS berkasId,
            b.jenis_berkas AS berkasJenis,
            b.nama_berkas AS berkasNama,
            COALESCE(b.ukuran_berkas, '1.5 MB') AS berkasUkuran,
            COALESCE(r.catatan_revisi, r.komentar, v.alasan_pengembalian) AS catatanReviewer,
            r.aspek_revisi AS aspekRevisi,
            DATE_FORMAT(r.tenggat_revisi, '%Y-%m-%d') AS tenggatRevisi,
            r.nama_berkas_revisi AS namaBerkasRevisi,
            COALESCE(peninjau.nama, validator.nama) AS reviewerName,
            DATE_FORMAT(COALESCE(r.waktu, v.waktu_validasi, l.tgl_pengajuan), '%d %b %Y %H:%i') AS tglReview,
            l.id_peninjau_aktif,
            activeReviewer.nama AS namaPeninjauAktif
        FROM logbook l
        LEFT JOIN (
            SELECT id_logbook, id_bukti, nama_berkas, jenis_berkas, ukuran_berkas,
                   ROW_NUMBER() OVER (PARTITION BY id_logbook ORDER BY id_bukti DESC) as rn
            FROM bukti_logbook
        ) b ON b.id_logbook = l.id_logbook AND b.rn = 1
        LEFT JOIN (
            SELECT id_logbook, id_peninjau, komentar, catatan_revisi, aspek_revisi,
                   tenggat_revisi, nama_berkas_revisi, status_review, waktu,
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
        LEFT JOIN pengguna activeReviewer ON activeReviewer.id_pengguna = l.id_peninjau_aktif
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

    if (filters.idPeninjauAktif) {
        sql += ` AND l.id_peninjau_aktif = ? AND l.status IN ('diajukan', 'direview')`;
        params.push(Number(filters.idPeninjauAktif));
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

const reviewerRoleByOwnerRole = {
    "Dosen": "Kasi",
    "Tendik": "Kasi",
    "Kasi": "Kepala Kantor",
    "Kepala Kantor": "Dekan / Wakil Dekan",
};

async function getUserRole(connection, idPengguna) {
    const [[user]] = await connection.execute(
        `SELECT p.id_pengguna, p.id_atasan, p.id_unit, p.nama,
                r.nama_role, p.status_akun
         FROM pengguna p JOIN \`role\` r ON r.id_role = p.id_role
         WHERE p.id_pengguna = ?`,
        [Number(idPengguna)],
    );
    return user || null;
}

async function findReviewerForRole(connection, user, roleName) {
    if (user.id_atasan) {
        const directSupervisor = await getUserRole(connection, user.id_atasan);
        if (directSupervisor?.status_akun === "aktif" && directSupervisor.nama_role === roleName) {
            return directSupervisor;
        }
    }

    const [[reviewer]] = await connection.execute(
        `SELECT p.id_pengguna, p.id_atasan, p.id_unit, p.nama,
                r.nama_role, p.status_akun
         FROM pengguna p JOIN \`role\` r ON r.id_role = p.id_role
         WHERE r.nama_role = ? AND p.status_akun = 'aktif'
           AND (? = 'Dekan / Wakil Dekan' OR p.id_unit = ?)
         ORDER BY (p.id_unit = ?) DESC, p.id_pengguna ASC
         LIMIT 1`,
        [roleName, roleName, user.id_unit, user.id_unit],
    );
    return reviewer || null;
}

async function resolveLogbookReviewer(connection, userId) {
    const user = await getUserRole(connection, userId);
    if (!user || user.status_akun !== "aktif") {
        const error = new Error("Pengguna aktif untuk alur validasi logbook tidak ditemukan.");
        error.statusCode = 400;
        throw error;
    }

    if (user.nama_role === "Dekan / Wakil Dekan") return null;

    const reviewerRole = reviewerRoleByOwnerRole[user.nama_role];
    if (!reviewerRole) {
        const error = new Error(`Role ${user.nama_role} tidak termasuk dalam alur validasi logbook.`);
        error.statusCode = 400;
        throw error;
    }

    const reviewer = await findReviewerForRole(connection, user, reviewerRole);
    if (!reviewer) {
        const error = new Error(`Atasan dengan role ${reviewerRole} belum tersedia. Lengkapi struktur pengguna sebelum mengirim logbook.`);
        error.statusCode = 400;
        throw error;
    }
    return reviewer;
}

async function createLogbook(data) {
    const connection = await db.getConnection();
    let savedImagePath = null;
    try {
        await connection.beginTransaction();

        const imageBuffer = decodeLogbookImage(data.berkasDataBase64, data.jenisBerkas);

        const reviewer = await resolveLogbookReviewer(connection, data.idPengguna);
        const initialStatus = reviewer ? "diajukan" : "divalidasi";

        const [result] = await connection.execute(
            `INSERT INTO logbook
                (id_pengguna, tgl_kegiatan, waktu, kategori, judul, nomor_sk,
                 uraian, target, hasil, status, id_peninjau_aktif, tgl_pengajuan)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                Number(data.idPengguna),
                data.tglKegiatan,
                data.waktu || "08:00 - 11:00",
                data.kategori || "Pengajaran",
                data.judul,
                data.nomorSk || null,
                data.uraian,
                data.target || null,
                data.hasil || data.target || null,
                initialStatus,
                reviewer?.id_pengguna || null,
            ]
        );

        const idLogbook = result.insertId;

        await fs.mkdir(logbookImageDirectory, { recursive: true });
        const extension = data.jenisBerkas === "image/png" ? ".png" : data.jenisBerkas === "application/pdf" ? ".pdf" : ".jpg";
        const storedFileName = `${crypto.randomUUID()}${extension}`;
        savedImagePath = path.join(logbookImageDirectory, storedFileName);
        await fs.writeFile(savedImagePath, imageBuffer, { flag: "wx" });
        const fileName = path.basename(String(data.berkasNama || "bukti-kegiatan"), path.extname(String(data.berkasNama || "")))
            .replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180) || "bukti-kegiatan";
        const storedName = `${fileName}${extension}`;
        const relativeLocation = `/uploads/logbook/${storedFileName}`;

        await connection.execute(
            `INSERT INTO bukti_logbook
                (id_logbook, nama_berkas, jenis_berkas, ukuran_berkas, lokasi_berkas, keterangan)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                idLogbook,
                storedName,
                data.jenisBerkas,
                `${(imageBuffer.length / (1024 * 1024)).toFixed(2)} MB`,
                relativeLocation,
                data.keteranganEviden || data.judul
            ]
        );

        await connection.commit();
        return { idLogbook, reviewer };
    } catch (err) {
        await connection.rollback();
        if (savedImagePath) await fs.unlink(savedImagePath).catch(() => {});
        throw err;
    } finally {
        connection.release();
    }
}

async function getEvidenceFile(idLogbook, idBukti, viewerId) {
    const detail = await getLogbookDetail(Number(idLogbook), Number(viewerId));
    const evidence = detail.bukti.find((item) => Number(item.id_bukti) === Number(idBukti));
    if (!evidence) {
        const error = new Error("Bukti kegiatan tidak ditemukan untuk logbook ini.");
        error.statusCode = 404;
        throw error;
    }
    const diskPath = resolveEvidenceDiskPath(evidence.lokasi_berkas);
    if (!diskPath) {
        const error = new Error("Lokasi bukti kegiatan tidak valid.");
        error.statusCode = 404;
        throw error;
    }
    return { evidence, diskPath };
}

async function resubmitRevision(idLogbook, idPengguna, data = {}) {
    const connection = await db.getConnection();
    let newEvidenceDiskPath = null;
    let oldEvidenceDiskPaths = [];
    try {
        await connection.beginTransaction();

        const [[currentEntry]] = await connection.execute(
            `SELECT status, id_peninjau_aktif, waktu FROM logbook
             WHERE id_logbook = ? AND id_pengguna = ? FOR UPDATE`,
            [Number(idLogbook), Number(idPengguna)],
        );
        if (!currentEntry || currentEntry.status !== "perlu_revisi") {
            const error = new Error("Logbook tidak ditemukan atau belum berstatus perlu revisi.");
            error.statusCode = 400;
            throw error;
        }
        if (!data.tglKegiatan || !data.judul?.trim() || !data.uraian?.trim()) {
            const error = new Error("Tanggal, judul, dan uraian logbook wajib diisi sebelum dikirim ulang.");
            error.statusCode = 400;
            throw error;
        }
        const evidenceAction = data.evidenceAction || (data.berkasDataBase64 ? "add" : "keep");
        if (!new Set(["keep", "add", "replace", "remove"]).has(evidenceAction)) {
            const error = new Error("Tindakan bukti logbook tidak valid.");
            error.statusCode = 400;
            throw error;
        }
        let imageBuffer = null;
        if (["add", "replace"].includes(evidenceAction)) {
            imageBuffer = decodeLogbookImage(data.berkasDataBase64, data.jenisBerkas);
            if (!data.berkasNama) {
                const error = new Error("Pilih berkas bukti JPG, JPEG, PNG, atau PDF.");
                error.statusCode = 400;
                throw error;
            }
        }

        let reviewer;
        if (currentEntry.id_peninjau_aktif) {
            reviewer = await getUserRole(connection, currentEntry.id_peninjau_aktif);
            const owner = await getUserRole(connection, idPengguna);
            if (!reviewer || reviewer.status_akun !== 'aktif' ||
                reviewerRoleByOwnerRole[owner?.nama_role] !== reviewer.nama_role) {
                const error = new Error("Atasan yang meminta revisi tidak lagi aktif atau tidak sesuai jabatan. Hubungi administrator.");
                error.statusCode = 409;
                throw error;
            }
        } else {
            reviewer = await resolveLogbookReviewer(connection, idPengguna);
        }
        if (!reviewer) {
            const error = new Error("Atasan yang meminta revisi tidak ditemukan. Hubungi administrator sebelum mengirim ulang.");
            error.statusCode = 409;
            throw error;
        }

        await connection.execute(
            `UPDATE logbook
             SET tgl_kegiatan = ?, waktu = ?, kategori = ?, judul = ?, nomor_sk = ?, uraian = ?,
                 target = ?, hasil = ?, status = ?, id_peninjau_aktif = ?,
                 tgl_pengajuan = IF(? = 1, NOW(), tgl_pengajuan)
             WHERE id_logbook = ? AND id_pengguna = ? AND status = 'perlu_revisi'`,
            [
                data.tglKegiatan,
                data.waktu || currentEntry.waktu || "08:00 - 11:00",
                data.kategori || 'Pengajaran',
                data.judul.trim(),
                data.nomorSk || null,
                data.uraian.trim(),
                data.target || null,
                data.hasil || null,
                data.submit === false ? 'perlu_revisi' : 'diajukan',
                reviewer.id_pengguna,
                data.submit === false ? 0 : 1,
                Number(idLogbook),
                Number(idPengguna),
            ]
        );

        if (evidenceAction === "replace" || evidenceAction === "remove") {
            const [oldEvidence] = await connection.execute(
                "SELECT lokasi_berkas FROM bukti_logbook WHERE id_logbook = ?",
                [Number(idLogbook)]
            );
            oldEvidenceDiskPaths = oldEvidence.map((row) => resolveEvidenceDiskPath(row.lokasi_berkas)).filter(Boolean);
            await connection.execute(
                "DELETE FROM bukti_logbook WHERE id_logbook = ?",
                [Number(idLogbook)]
            );
        }

        if (imageBuffer) {
            await fs.mkdir(logbookImageDirectory, { recursive: true });
            const extension = data.jenisBerkas === "image/png" ? ".png" : data.jenisBerkas === "application/pdf" ? ".pdf" : ".jpg";
            const storedFileName = `${crypto.randomUUID()}${extension}`;
            newEvidenceDiskPath = path.join(logbookImageDirectory, storedFileName);
            await fs.writeFile(newEvidenceDiskPath, imageBuffer, { flag: "wx" });
            const baseName = path.basename(String(data.berkasNama), path.extname(String(data.berkasNama)))
                .replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180) || "bukti-kegiatan";
            await connection.execute(
                `INSERT INTO bukti_logbook
                    (id_logbook, nama_berkas, jenis_berkas, ukuran_berkas, lokasi_berkas, keterangan)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    Number(idLogbook), `${baseName}${extension}`, data.jenisBerkas,
                    `${(imageBuffer.length / (1024 * 1024)).toFixed(2)} MB`,
                    `/uploads/logbook/${storedFileName}`, `Bukti revisi: ${data.revisionNote || "Perbaikan logbook"}`
                ]
            );
        }

        await connection.commit();
        await Promise.all(oldEvidenceDiskPaths.map((filePath) => fs.unlink(filePath).catch(() => {})));
        return { reviewer, status: data.submit === false ? 'perlu_revisi' : 'diajukan' };
    } catch (err) {
        await connection.rollback();
        if (newEvidenceDiskPath) await fs.unlink(newEvidenceDiskPath).catch(() => {});
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
 * Ambil pemilik logbook yang saat ini ditugaskan kepada pemeriksa ini.
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
            SUM(CASE WHEN l.status = 'perlu_revisi' THEN 1 ELSE 0 END) AS revisi,
            SUM(CASE WHEN l.id_peninjau_aktif = ? THEN 1 ELSE 0 END) AS menunggu_validasi
        FROM pengguna p
        LEFT JOIN jabatan j ON j.id_jabatan = p.id_jabatan
        LEFT JOIN unit_kerja u ON u.id_unit = p.id_unit
        LEFT JOIN role r ON r.id_role = p.id_role
        LEFT JOIN logbook l ON l.id_pengguna = p.id_pengguna
        WHERE p.status_akun = 'aktif'
          AND EXISTS (
              SELECT 1 FROM logbook assignedLog
              WHERE assignedLog.id_pengguna = p.id_pengguna
                AND assignedLog.id_peninjau_aktif = ?
                AND assignedLog.status IN ('diajukan', 'direview')
          )
          AND EXISTS (
              SELECT 1
              FROM pengguna assignedReviewer
              JOIN \`role\` assignedReviewerRole ON assignedReviewerRole.id_role = assignedReviewer.id_role
              WHERE assignedReviewer.id_pengguna = ?
                AND assignedReviewer.id_unit = p.id_unit
                AND assignedReviewerRole.nama_role = CASE r.nama_role
                    WHEN 'Dosen' THEN 'Kasi'
                    WHEN 'Tendik' THEN 'Kasi'
                    WHEN 'Kasi' THEN 'Kepala Kantor'
                    WHEN 'Kepala Kantor' THEN 'Dekan / Wakil Dekan'
                END
          )
        GROUP BY p.id_pengguna
        ORDER BY menunggu_validasi DESC, p.id_pengguna ASC
    `;
    const [rows] = await db.execute(sql, [Number(idSupervisor), Number(idSupervisor), Number(idSupervisor)]);
    return rows;
}

async function getDekanAssignedLogbooks(idSupervisor) {
    const supervisor = await getUserRole(db, idSupervisor);
    if (!supervisor || supervisor.status_akun !== 'aktif' || supervisor.nama_role !== 'Dekan / Wakil Dekan') {
        const error = new Error('Akses hanya tersedia untuk Dekan/Wakil Dekan.');
        error.statusCode = 403;
        throw error;
    }

    const [rows] = await db.execute(
        `SELECT l.id_logbook AS id, l.id_pengguna AS idPemilik,
                p.nama AS namaBawahan, COALESCE(j.nama_jabatan, 'Kepala Kantor') AS jabatanBawahan,
                u.id_unit AS idDivisi, COALESCE(u.nama_unit, 'Unit belum ditentukan') AS divisi,
                DATE_FORMAT(l.tgl_kegiatan, '%d %b %Y') AS tanggal,
                DATE_FORMAT(l.tgl_kegiatan, '%Y-%m-%d') AS tglRaw,
                DATE_FORMAT(l.tgl_pengajuan, '%Y-%m-%d') AS tglPengajuan,
                COALESCE(l.waktu, '08:00 - 11:00') AS waktu, l.periode,
                l.kategori, COALESCE(l.judul, l.kategori) AS judul, l.uraian,
                COALESCE(l.target, 'Terlaksana') AS targetOutput,
                COALESCE(l.hasil, l.target, 'Terlaksana') AS outputShort,
                l.status,
                CASE WHEN l.status = 'divalidasi' THEN 'sah'
                     WHEN l.status = 'perlu_revisi' THEN 'revisi'
                     ELSE 'review' END AS statusKey,
                CASE WHEN l.status = 'divalidasi' THEN 'Tervalidasi'
                     WHEN l.status = 'perlu_revisi' THEN 'Revisi'
                     ELSE 'Menunggu Validasi' END AS statusLabel,
                b.nama_berkas AS berkasNama
         FROM logbook l
         JOIN pengguna p ON p.id_pengguna = l.id_pengguna
         JOIN \`role\` ownerRole ON ownerRole.id_role = p.id_role
         LEFT JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         LEFT JOIN unit_kerja u ON u.id_unit = p.id_unit
         LEFT JOIN (
             SELECT id_logbook, nama_berkas,
                    ROW_NUMBER() OVER (PARTITION BY id_logbook ORDER BY id_bukti DESC) AS rn
             FROM bukti_logbook
         ) b ON b.id_logbook = l.id_logbook AND b.rn = 1
         WHERE ownerRole.nama_role = 'Kepala Kantor'
           AND p.status_akun = 'aktif'
           AND l.status IN ('diajukan', 'direview', 'perlu_revisi', 'divalidasi')
           AND (
               l.id_peninjau_aktif = ?
               OR EXISTS (SELECT 1 FROM review_logbook r WHERE r.id_logbook = l.id_logbook AND r.id_peninjau = ?)
               OR EXISTS (SELECT 1 FROM validasi_logbook v WHERE v.id_logbook = l.id_logbook AND v.id_validator = ?)
           )
         ORDER BY l.tgl_kegiatan DESC, l.id_logbook DESC`,
        [Number(idSupervisor), Number(idSupervisor), Number(idSupervisor)],
    );
    return rows;
}

/**
 * Ambil entri logbook milik bawahan atau pemilik yang sedang ditugaskan kepada pemeriksa.
 */
async function getSubordinateLogbookData(idSupervisor, subordinateId, filters = {}) {
    // 1. Verifikasi ketat relasi atasan-bawahan di database
    const [subRows] = await db.execute(
        `SELECT p.id_pengguna, p.nama, p.username,
                COALESCE(j.nama_jabatan, 'Pegawai') AS nama_jabatan,
                COALESCE(u.nama_unit, 'FTI UNAND') AS nama_unit,
                EXISTS (
                    SELECT 1 FROM logbook assigned
                    WHERE assigned.id_pengguna = p.id_pengguna
                      AND assigned.id_peninjau_aktif = ?
                      AND assigned.status IN ('diajukan', 'direview')
                      AND EXISTS (
                          SELECT 1
                          FROM pengguna assignedReviewer
                          JOIN \`role\` assignedReviewerRole ON assignedReviewerRole.id_role = assignedReviewer.id_role
                          WHERE assignedReviewer.id_pengguna = ?
                            AND assignedReviewer.id_unit = p.id_unit
                            AND assignedReviewerRole.nama_role = CASE ownerRole.nama_role
                                WHEN 'Dosen' THEN 'Kasi'
                                WHEN 'Tendik' THEN 'Kasi'
                                WHEN 'Kasi' THEN 'Kepala Kantor'
                                WHEN 'Kepala Kantor' THEN 'Dekan / Wakil Dekan'
                            END
                      )
                ) AS has_assigned_logbook
         FROM pengguna p
         JOIN \`role\` ownerRole ON ownerRole.id_role = p.id_role
         LEFT JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         LEFT JOIN unit_kerja u ON u.id_unit = p.id_unit
         WHERE p.id_pengguna = ?`,
        [Number(idSupervisor), Number(idSupervisor), Number(subordinateId)]
    );

    if (subRows.length === 0) {
        const error = new Error("Bawahan tidak ditemukan di sistem.");
        error.statusCode = 404;
        throw error;
    }

    const subordinate = subRows[0];
    if (!Number(subordinate.has_assigned_logbook)) {
        const error = new Error("Akses ditolak: logbook ini tidak sedang ditugaskan kepada Anda untuk divalidasi.");
        error.statusCode = 403;
        throw error;
    }

    // 2. Ambil logbook milik bawahan tersebut
    const entries = await findByUserId(subordinateId, {
        ...filters,
        idPeninjauAktif: idSupervisor,
    });
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
            `SELECT l.id_logbook, l.id_pengguna, l.status, l.id_peninjau_aktif,
                    p.nama AS nama_bawahan, ownerRole.nama_role AS role_pemilik
             FROM logbook l
             JOIN pengguna p ON p.id_pengguna = l.id_pengguna
             JOIN \`role\` ownerRole ON ownerRole.id_role = p.id_role
             WHERE l.id_logbook = ?
             FOR UPDATE`,
            [Number(idLogbook)]
        );

        if (ownerRows.length === 0) {
            const error = new Error("Entri logbook tidak ditemukan.");
            error.statusCode = 404;
            throw error;
        }

        const logbookData = ownerRows[0];
        const activeReviewerId = Number(logbookData.id_peninjau_aktif) || null;
        if (!activeReviewerId || activeReviewerId !== Number(idSupervisor)) {
            const error = new Error("Akses ditolak: logbook ini tidak sedang ditugaskan kepada Anda untuk divalidasi.");
            error.statusCode = 403;
            throw error;
        }
        const reviewer = await getUserRole(connection, idSupervisor);
        const owner = await getUserRole(connection, logbookData.id_pengguna);
        if (reviewer?.status_akun !== 'aktif' ||
            reviewerRoleByOwnerRole[logbookData.role_pemilik] !== reviewer?.nama_role) {
            const error = new Error("Role Anda tidak sesuai dengan tingkat jabatan pemilik logbook.");
            error.statusCode = 403;
            throw error;
        }
        if (!['simpan_catatan', 'catatan'].includes(action) &&
            !['diajukan', 'direview'].includes(logbookData.status)) {
            const error = new Error("Logbook ini tidak sedang menunggu pemeriksaan.");
            error.statusCode = 409;
            throw error;
        }

        const { catatanRevisi, komentar, aspekRevisi, tenggatRevisi, namaBerkasRevisi } = payload;
        const noteText = (komentar && komentar.trim()) ? komentar.trim() : (catatanRevisi && catatanRevisi.trim()) ? catatanRevisi.trim() : null;

        if (action === 'simpan_catatan' || action === 'catatan') {
            if (!noteText) {
                const error = new Error("Catatan dan evaluasi pimpinan tidak boleh kosong.");
                error.statusCode = 400;
                throw error;
            }

            // Simpan catatan dan evaluasi pimpinan ke review_logbook
            await connection.execute(
                `INSERT INTO review_logbook (id_logbook, id_peninjau, komentar, catatan_revisi, status_review, waktu)
                 VALUES (?, ?, ?, ?, 'disetujui', NOW())`,
                [Number(idLogbook), Number(idSupervisor), noteText, noteText]
            );
        } else if (action === 'validasi' || action === 'sah') {
            await connection.execute(
                `UPDATE logbook
                 SET status = ?, id_peninjau_aktif = ?
                 WHERE id_logbook = ?`,
                ['divalidasi', null, Number(idLogbook)]
            );

            // Rekam di validasi_logbook
            await connection.execute(
                `INSERT INTO validasi_logbook (id_logbook, id_validator, keputusan, waktu_validasi)
                 VALUES (?, ?, 'divalidasi', NOW())`,
                [Number(idLogbook), Number(idSupervisor)]
            );

            // Jika pimpinan mengisi catatan evaluasi, rekam catatan tersebut ke review_logbook (tanpa teks otomatis)
            if (noteText) {
                await connection.execute(
                    `INSERT INTO review_logbook (id_logbook, id_peninjau, komentar, catatan_revisi, status_review, waktu)
                     VALUES (?, ?, ?, ?, 'disetujui', NOW())`,
                    [Number(idLogbook), Number(idSupervisor), noteText, noteText]
                );
            }
        } else if (action === 'revisi') {
            if (!noteText || noteText.length < 20 || noteText.length > 1000) {
                const error = new Error("Uraian revisi wajib diisi minimal 20 dan maksimal 1000 karakter.");
                error.statusCode = 400;
                throw error;
            }
            const allowedAspects = new Set([
                'eviden', 'kesesuaian', 'target', 'deskripsi',
            ]);
            const selectedAspects = Array.isArray(aspekRevisi)
                ? [...new Set(aspekRevisi.filter((aspect) => allowedAspects.has(aspect)))]
                : [];
            if (!selectedAspects.length) {
                const error = new Error("Pilih minimal satu aspek yang perlu diperbaiki.");
                error.statusCode = 400;
                throw error;
            }
            const deadlineDate = typeof tenggatRevisi === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tenggatRevisi)
                ? new Date(`${tenggatRevisi}T00:00:00Z`)
                : null;
            if (!deadlineDate || Number.isNaN(deadlineDate.getTime()) ||
                deadlineDate.toISOString().slice(0, 10) !== tenggatRevisi) {
                const error = new Error("Batas waktu revisi wajib diisi dengan tanggal yang valid.");
                error.statusCode = 400;
                throw error;
            }

            // Ubah status logbook menjadi perlu_revisi
            await connection.execute(
                `UPDATE logbook SET status = 'perlu_revisi', id_peninjau_aktif = ? WHERE id_logbook = ?`,
                [Number(idSupervisor), Number(idLogbook)]
            );

            // Rekam di review_logbook
            await connection.execute(
                `INSERT INTO review_logbook
                    (id_logbook, id_peninjau, komentar, catatan_revisi, aspek_revisi,
                     tenggat_revisi, nama_berkas_revisi, status_review, waktu)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'revisi', NOW())`,
                [
                    Number(idLogbook), Number(idSupervisor), noteText, noteText,
                    JSON.stringify(selectedAspects), tenggatRevisi,
                    typeof namaBerkasRevisi === 'string' ? namaBerkasRevisi.trim().slice(0, 255) || null : null,
                ]
            );
        } else if (action === 'tolak' || action === 'kembalikan') {
            await connection.execute(
                `UPDATE logbook SET status = 'dikembalikan', id_peninjau_aktif = NULL WHERE id_logbook = ?`,
                [Number(idLogbook)]
            );

            await connection.execute(
                `INSERT INTO validasi_logbook (id_logbook, id_validator, keputusan, alasan_pengembalian, waktu_validasi)
                 VALUES (?, ?, 'dikembalikan', ?, NOW())`,
                [Number(idLogbook), Number(idSupervisor), noteText || null]
            );
        } else {
            const error = new Error(`Aksi '${action}' tidak dikenali. Gunakan 'validasi', 'revisi', atau 'simpan_catatan'.`);
            error.statusCode = 400;
            throw error;
        }

        await connection.commit();
        const [[updatedLogbook]] = await connection.execute(
            `SELECT l.id_peninjau_aktif, l.status, p.nama AS nama_peninjau
             FROM logbook l LEFT JOIN pengguna p ON p.id_pengguna = l.id_peninjau_aktif
             WHERE l.id_logbook = ?`,
            [Number(idLogbook)],
        );
        return {
            success: true,
            idLogbook: Number(idLogbook),
            action,
            namaBawahan: logbookData.nama_bawahan,
            diteruskanKe: updatedLogbook?.nama_peninjau || null,
            selesai: updatedLogbook?.status === 'divalidasi',
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
            l.id_peninjau_aktif,
            EXISTS (
                SELECT 1 FROM validasi_logbook previous_review
                WHERE previous_review.id_logbook = l.id_logbook
                  AND previous_review.id_validator = ?
            ) OR EXISTS (
                SELECT 1 FROM review_logbook previous_note
                WHERE previous_note.id_logbook = l.id_logbook
                  AND previous_note.id_peninjau = ?
            ) AS has_reviewed_by_supervisor,
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
                WHEN l.status = 'divalidasi' THEN 'Tervalidasi'
                WHEN l.status = 'perlu_revisi' THEN 'Revisi'
                ELSE 'Menunggu Validasi'
            END AS statusLabel,
            DATE_FORMAT(l.tgl_pengajuan, '%d %b %Y %H:%i') AS tglPengajuanFormatted,
            p.nama AS nama_pegawai,
            p.username AS email_pegawai,
            ownerRole.nama_role AS role_pemilik,
            p.nidn,
            COALESCE(j.nama_jabatan, 'Pegawai') AS nama_jabatan,
            COALESCE(u.nama_unit, 'FTI Universitas Andalas') AS nama_unit,
            COALESCE(activeReviewer.nama, atasan.nama) AS nama_atasan,
            COALESCE(activeReviewerJob.nama_jabatan, atasan_j.nama_jabatan, 'Pimpinan') AS jabatan_atasan,
            activeReviewer.nama AS nama_peninjau_aktif
         FROM logbook l
         JOIN pengguna p ON p.id_pengguna = l.id_pengguna
         JOIN \`role\` ownerRole ON ownerRole.id_role = p.id_role
         LEFT JOIN jabatan j ON j.id_jabatan = p.id_jabatan
         LEFT JOIN unit_kerja u ON u.id_unit = p.id_unit
         LEFT JOIN pengguna atasan ON atasan.id_pengguna = p.id_atasan
         LEFT JOIN jabatan atasan_j ON atasan_j.id_jabatan = atasan.id_jabatan
         LEFT JOIN pengguna activeReviewer ON activeReviewer.id_pengguna = l.id_peninjau_aktif
         LEFT JOIN jabatan activeReviewerJob ON activeReviewerJob.id_jabatan = activeReviewer.id_jabatan
         WHERE l.id_logbook = ?`,
        [Number(idSupervisor) || 0, Number(idSupervisor) || 0, Number(idLogbook)]
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
        const activeReviewerId = Number(logbook.id_peninjau_aktif) || null;
        const supervisor = ownerId !== supId ? await getUserRole(db, supId) : null;
        if (ownerId !== supId &&
            (!supervisor || supervisor.status_akun !== 'aktif' ||
             reviewerRoleByOwnerRole[logbook.role_pemilik] !== supervisor.nama_role)) {
            const error = new Error("Akses ditolak: jabatan Anda tidak berwenang memeriksa logbook ini.");
            error.statusCode = 403;
            throw error;
        }
        if (ownerId !== supId && activeReviewerId !== supId &&
            !Number(logbook.has_reviewed_by_supervisor)) {
            const error = new Error("Akses ditolak: logbook ini tidak sedang ditugaskan kepada Anda untuk divalidasi.");
            error.statusCode = 403;
            throw error;
        }
    }

    logbook.canReview = Boolean(idSupervisor) &&
        ['diajukan', 'direview'].includes(logbook.status) &&
        Number(logbook.id_peninjau_aktif) === Number(idSupervisor);

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
            r.aspek_revisi,
            DATE_FORMAT(r.tenggat_revisi, '%Y-%m-%d') AS tenggat_revisi,
            r.nama_berkas_revisi,
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
    getDekanAssignedLogbooks,
    getSubordinateLogbookData,
    reviewAndValidateLogbook,
    getLogbookDetail,
    getEvidenceFile
};
