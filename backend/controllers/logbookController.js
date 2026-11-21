const logbookModel = require("../models/logbookModel");
const fs = require("fs/promises");

async function listLogbooks(req, res) {
    try {
        const userId = req.query.userId || req.query.idPengguna;
        if (!userId) {
            return res.status(400).json({ success: false, message: "ID Pengguna wajib disertakan." });
        }

        const filters = {
            periode: req.query.periode,
            kategori: req.query.kategori,
            status: req.query.status,
            search: req.query.search
        };

        const [data, summary] = await Promise.all([
            logbookModel.findByUserId(userId, filters),
            logbookModel.getSummary(userId, filters.periode)
        ]);

        return res.json({
            success: true,
            data,
            summary
        });
    } catch (error) {
        console.error("Gagal mengambil daftar logbook:", error);
        return res.status(500).json({ success: false, message: "Gagal mengambil data logbook dari database." });
    }
}

async function getSummary(req, res) {
    try {
        const userId = req.query.userId || req.query.idPengguna;
        if (!userId) {
            return res.status(400).json({ success: false, message: "ID Pengguna wajib disertakan." });
        }
        const summary = await logbookModel.getSummary(userId, req.query.periode);
        return res.json({ success: true, summary });
    } catch (error) {
        console.error("Gagal mengambil ringkasan logbook:", error);
        return res.status(500).json({ success: false, message: "Gagal mengambil statistik logbook." });
    }
}

async function createLogbook(req, res) {
    try {
        const { idPengguna, tglKegiatan, waktu, kategori, judul, nomorSk, uraian, target,
            berkasNama, berkasUkuran, jenisBerkas, berkasDataBase64, keteranganEviden } = req.body;

        if (!idPengguna || !tglKegiatan || !judul || !uraian || !berkasNama || !jenisBerkas || !berkasDataBase64) {
            return res.status(400).json({
                success: false,
                message: "Tanggal, judul, uraian, dan bukti kegiatan JPG, JPEG, PNG, atau PDF wajib diisi."
            });
        }

        const result = await logbookModel.createLogbook({
            idPengguna,
            tglKegiatan,
            waktu,
            kategori,
            judul,
            nomorSk,
            uraian,
            target,
            berkasNama,
            berkasUkuran,
            jenisBerkas,
            berkasDataBase64,
            keteranganEviden
        });

        return res.status(201).json({
            success: true,
            message: result.reviewer
                ? `Logbook berhasil dikirim kepada ${result.reviewer.nama} (${result.reviewer.nama_role}) untuk diperiksa.`
                : "Logbook berhasil dicatat. Anda berada pada tahap tertinggi alur validasi.",
            id: result.idLogbook
        });
    } catch (error) {
        console.error("Gagal menyimpan logbook:", error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: "Gagal menyimpan logbook ke database: " + error.message
        });
    }
}

async function submitRevision(req, res) {
    try {
        const idLogbook = Number(req.params.id);
        const { idPengguna, revisionNote, tglKegiatan, waktu, kategori, judul, nomorSk, uraian, target, hasil,
            kuantitas, satuan, keterangan, evidenceAction, berkasNama, jenisBerkas, berkasDataBase64, submit } = req.body;

        if (!idLogbook || !idPengguna) {
            return res.status(400).json({ success: false, message: "ID Logbook dan ID Pengguna wajib disertakan." });
        }

        const result = await logbookModel.resubmitRevision(idLogbook, idPengguna, {
            revisionNote, tglKegiatan, waktu, kategori, judul, nomorSk, uraian, target, hasil,
            kuantitas, satuan, keterangan, evidenceAction, berkasNama, jenisBerkas, berkasDataBase64, submit,
        });

        return res.json({
            success: true,
            status: result.status,
            message: submit === false
                ? "Perubahan logbook berhasil disimpan. Status masih Revisi."
                : "Revisi logbook berhasil dikirim ulang ke peninjau."
        });
    } catch (error) {
        console.error("Gagal mengirim revisi logbook:", error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: "Gagal mengirim perbaikan logbook: " + error.message
        });
    }
}

async function getSubordinates(req, res) {
    try {
        const supervisorId = req.query.supervisorId || req.query.idPengguna;
        if (!supervisorId) {
            return res.status(400).json({ success: false, message: "ID Supervisor wajib disertakan." });
        }
        const subordinates = await logbookModel.getSubordinates(supervisorId);
        return res.json({ success: true, data: subordinates });
    } catch (error) {
        console.error("Gagal mengambil daftar bawahan:", error);
        return res.status(500).json({ success: false, message: "Gagal mengambil daftar bawahan: " + error.message });
    }
}

async function getDekanAssignedLogbooks(req, res) {
    try {
        const supervisorId = req.query.supervisorId || req.query.idPengguna;
        if (!supervisorId) {
            return res.status(400).json({ success: false, message: "ID Dekan/Wakil Dekan wajib disertakan." });
        }
        const data = await logbookModel.getDekanAssignedLogbooks(supervisorId);
        return res.json({ success: true, data });
    } catch (error) {
        console.error("Gagal mengambil logbook dalam kewenangan Dekanat:", error);
        return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
}

async function getSubordinateLogbooks(req, res) {
    try {
        const supervisorId = req.query.supervisorId || req.query.idPengguna;
        const subordinateId = req.query.subordinateId;

        if (!supervisorId || !subordinateId) {
            return res.status(400).json({
                success: false,
                message: "ID Supervisor dan ID Bawahan wajib disertakan."
            });
        }

        const filters = {
            periode: req.query.periode,
            status: req.query.status,
            search: req.query.search
        };

        const result = await logbookModel.getSubordinateLogbookData(supervisorId, subordinateId, filters);
        return res.json({ success: true, ...result });
    } catch (error) {
        console.error("Gagal mengambil logbook bawahan:", error);
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
}

async function reviewSubordinateLogbook(req, res) {
    try {
        const idLogbook = Number(req.params.id);
        const { idSupervisor, action, catatanRevisi, komentar, aspekRevisi, tenggatRevisi, namaBerkasRevisi } = req.body;

        if (!idLogbook || !idSupervisor || !action) {
            return res.status(400).json({
                success: false,
                message: "ID Logbook, ID Supervisor, dan aksi review wajib disertakan."
            });
        }

        const result = await logbookModel.reviewAndValidateLogbook(idLogbook, idSupervisor, action, {
            catatanRevisi,
            komentar,
            aspekRevisi,
            tenggatRevisi,
            namaBerkasRevisi
        });

        const actionText = (action === 'validasi' || action === 'sah')
            ? 'divalidasi oleh atasan yang berwenang'
            : (action === 'simpan_catatan' || action === 'catatan')
            ? 'disimpan catatan evaluasinya'
            : 'diminta revisi';
        return res.json({
            success: true,
            message: `Logbook milik ${result.namaBawahan} berhasil ${actionText}.`,
            data: result
        });
    } catch (error) {
        console.error("Gagal mereview logbook bawahan:", error);
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
}

async function getLogbookDetail(req, res) {
    try {
        const idLogbook = Number(req.params.id);
        const supervisorId = req.query.supervisorId || req.query.idPengguna;

        if (!idLogbook) {
            return res.status(400).json({ success: false, message: "ID Logbook wajib disertakan." });
        }

        const data = await logbookModel.getLogbookDetail(idLogbook, supervisorId);
        return res.json({ success: true, data });
    } catch (error) {
        console.error("Gagal mengambil detail logbook:", error);
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
}

async function getLogbookEvidence(req, res) {
    try {
        const idLogbook = Number(req.params.id);
        const idBukti = Number(req.params.idBukti);
        const viewerId = Number(req.query.viewerId || req.query.userId);
        if (!idLogbook || !idBukti || !viewerId) {
            return res.status(400).json({ success: false, message: "ID logbook, bukti, dan pengguna wajib disertakan." });
        }

        const { evidence, diskPath } = await logbookModel.getEvidenceFile(idLogbook, idBukti, viewerId);
        await fs.access(diskPath);
        const contentType = await logbookModel.getEvidenceContentType(diskPath, evidence);
        res.set("Content-Type", contentType);
        res.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(evidence.nama_berkas)}`);
        res.set("Cache-Control", "private, no-store");
        res.set("X-Content-Type-Options", "nosniff");
        return res.sendFile(diskPath, (sendError) => {
            if (!sendError || res.headersSent) return;
            if (sendError.code === "ENOENT") {
                return res.status(404).json({ success: false, message: "File bukti kegiatan belum tersedia di penyimpanan." });
            }
            console.error("Gagal mengirim file bukti logbook:", sendError);
            return res.status(500).json({ success: false, message: "Gagal menampilkan file bukti kegiatan." });
        });
    } catch (error) {
        if (error.code === "ENOENT") {
            return res.status(404).json({ success: false, message: "File bukti kegiatan belum tersedia di penyimpanan." });
        }
        console.error("Gagal mengambil file bukti logbook:", error);
        return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
}

module.exports = {
    listLogbooks,
    getSummary,
    createLogbook,
    submitRevision,
    getSubordinates,
    getDekanAssignedLogbooks,
    getSubordinateLogbooks,
    reviewSubordinateLogbook,
    getLogbookDetail,
    getLogbookEvidence
};
