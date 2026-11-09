const bcrypt = require("bcryptjs");
const penggunaModel = require("../models/penggunaModel");
const roleModel = require("../models/roleModel");
const unitKerjaModel = require("../models/unitKerjaModel");
const jabatanModel = require("../models/jabatanModel");
const tupoksiModel = require("../models/tupoksiModel");
const dashboardModel = require("../models/dashboardModel");
const db = require("../config/database");
const crypto = require("node:crypto");

async function validateAccountReferences(data) {
    const [unit, position, role, supervisor] = await Promise.all([
        unitKerjaModel.findById(Number(data.idUnit)),
        jabatanModel.findById(Number(data.idJabatan)),
        roleModel.findById(Number(data.idRole)),
        data.idAtasan ? penggunaModel.findById(Number(data.idAtasan)) : Promise.resolve(true),
    ]);
    if (!unit) throw new Error("Unit kerja tidak valid.");
    if (!unit.aktif) throw new Error("Pilih unit kerja yang masih aktif.");
    if (!position) throw new Error("Jabatan tidak valid.");
    if (!position.aktif) throw new Error("Pilih jabatan yang masih aktif.");
    if (position.untuk_jenis !== data.jenisPengguna) {
        throw new Error("Jenis pengguna tidak sesuai dengan jabatan.");
    }
    if (!role) throw new Error("Role tidak valid.");
    if (!supervisor) throw new Error("Atasan tidak valid.");
    if (data.idAtasan) {
        const eligible = await jabatanModel.findEligibleSupervisors({
            idJabatan: Number(data.idJabatan),
            idUnit: Number(data.idUnit),
            excludeUserId: data.excludeUserId,
        });
        if (!eligible.some((candidate) => Number(candidate.id_pengguna) === Number(data.idAtasan))) {
            throw new Error("Pilih atasan aktif yang sesuai aturan hierarki dan unit kerja.");
        }
    }
}

function friendlyDatabaseError(error) {
    const messages = {
        "Pindahkan akunnya dulu": "Pindahkan akun aktif dari unit atau jabatan ini dulu.",
        "Pindahkan bawahan dulu": "Pindahkan bawahan aktif ke atasan lain sebelum menonaktifkan akun ini.",
        "Jenis pengguna tidak sesuai dengan jabatan": "Jenis pengguna tidak sesuai dengan jabatan yang dipilih.",
        "Akun atasan sudah tidak aktif": "Atasan yang dipilih sudah tidak aktif. Pilih atasan aktif.",
        "Jabatan atasan tidak sesuai aturan hierarki jabatan": "Atasan yang dipilih tidak sesuai aturan hierarki jabatan.",
        "Atasan harus berada di unit kerja yang sama": "Pilih atasan dari unit kerja yang sama.",
        "Atasan membentuk lingkaran": "Pilihan atasan membentuk lingkaran. Pilih atasan lain.",
        "Jabatan atau Unit kerja sudah tidak aktif": "Jabatan atau unit kerja yang dipilih sudah tidak aktif.",
        "Tupoksi sudah tidak aktif": "Tupoksi nonaktif tidak dapat dipakai untuk logbook baru.",
        "Unit induk tidak aktif": "Pilih unit induk yang masih aktif.",
        "Unit kerja membentuk lingkaran": "Unit induk tidak dapat membentuk lingkaran dengan unit ini.",
        "Hierarki unit kerja terlalu panjang": "Periksa kembali susunan unit kerja.",
        "Jabatan tidak dapat menjadi atasannya sendiri": "Jabatan tidak dapat menjadi atasannya sendiri.",
        "Akun atasan tidak ditemukan": "Akun atasan tidak ditemukan. Pilih akun lain.",
        "Rantai atasan terlalu panjang atau membentuk lingkaran": "Rantai atasan membentuk lingkaran. Pilih atasan lain.",
    };
    return messages[error.message] || error.message;
}

async function listUsers(req, res) {
    try {
        const [users, roles] = await Promise.all([penggunaModel.findAll(), roleModel.findAll()]);
        return res.json({ users, roles });
    } catch (error) {
        console.error("Gagal mengambil akun:", error);
        return res.status(500).json({ message: "Data akun tidak dapat diambil." });
    }
}

async function createUser(req, res) {
    try {
        const { password = "", username, ...data } = req.body;
        const normalizedPassword = typeof password === "string" ? password : "";

        if (typeof username !== "string" || !username.trim()) {
            return res.status(400).json({ message: "Username wajib diisi." });
        }
        if (!Number.isInteger(Number(data.idUnit)) || !Number.isInteger(Number(data.idJabatan)) || !Number.isInteger(Number(data.idRole))) {
            return res.status(400).json({ message: "Unit kerja, jabatan, dan role wajib dipilih." });
        }
        if (normalizedPassword.length < 12) {
            return res.status(400).json({ message: "Buat password sementara minimal 12 karakter." });
        }

        await validateAccountReferences(data);
        data.username = username;
        data.passwordHash = await bcrypt.hash(normalizedPassword, 10);
        const user = await penggunaModel.create(data);
        return res.status(201).json({ user });
    } catch (error) {
        console.error("Gagal membuat akun:", error);
        return res.status(400).json({
            message: error.code === "ER_DUP_ENTRY"
                ? "Username atau NIDN sudah digunakan."
                : friendlyDatabaseError(error),
        });
    }
}

async function updateUser(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ message: "ID akun tidak valid." });

        const { password, ...data } = req.body;
        const payload = { ...data };

        if (typeof password === 'string' && password.trim()) {
            if (password.length < 8) {
                return res.status(400).json({ message: 'Password minimal 8 karakter.' });
            }
            payload.passwordHash = await bcrypt.hash(password, 10);
        }

        const current = await penggunaModel.findById(id);
        if (!current) return res.status(404).json({ message: 'Akun tidak ditemukan.' });
        await validateAccountReferences({
            jenisPengguna: payload.jenisPengguna || current.jenis_pengguna,
            idUnit: payload.idUnit || current.id_unit,
            idJabatan: payload.idJabatan || current.id_jabatan,
            idRole: payload.idRole || current.id_role,
            idAtasan: payload.idAtasan === undefined ? current.id_atasan : payload.idAtasan,
            excludeUserId: id,
        });
        const user = await penggunaModel.updateById(id, payload);
        if (!user) return res.status(404).json({ message: 'Akun tidak ditemukan.' });
        return res.json({ message: 'Akun berhasil diperbarui.', user });
    } catch (error) {
        console.error('Gagal memperbarui akun:', error);
        return res.status(400).json({ message: friendlyDatabaseError(error) || 'Akun tidak dapat diperbarui.' });
    }
}

async function resetUserPassword(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ message: "ID akun tidak valid." });
        const temporaryPassword = crypto.randomBytes(12).toString("base64url");
        const user = await penggunaModel.updatePassword(id, await bcrypt.hash(temporaryPassword, 10));
        if (!user) return res.status(404).json({ message: "Akun tidak ditemukan." });
        return res.json({ message: "Buat password sementara satu kali. Pengguna wajib menggantinya saat masuk.", user, temporaryPassword });
    } catch (error) {
        console.error("Gagal mereset password:", error);
        return res.status(500).json({ message: "Password tidak dapat direset." });
    }
}

async function getDashboardSummary(req, res) {
    try {
        return res.json({ summary: await dashboardModel.getSummary() });
    } catch (error) {
        console.error("Gagal mengambil ringkasan dashboard:", error);
        return res.status(500).json({ message: "Ringkasan dashboard tidak dapat diambil." });
    }
}

async function listUnits(req, res) {
    try {
        return res.json({ units: await unitKerjaModel.findAll() });
    } catch (error) {
        console.error("Gagal mengambil unit kerja:", error);
        return res.status(500).json({ message: "Data unit kerja tidak dapat diambil." });
    }
}

async function createUnit(req, res) {
    try {
        const { namaUnit, idInduk } = req.body;
        if (idInduk && !await unitKerjaModel.findById(Number(idInduk))) {
            return res.status(400).json({ message: "Unit induk tidak ditemukan." });
        }
        const unit = await unitKerjaModel.create(namaUnit, idInduk ? Number(idInduk) : null);
        return res.status(201).json({ unit });
    } catch (error) {
        console.error("Gagal membuat unit:", error);
        return res.status(400).json({
            message: error.code === "ER_DUP_ENTRY" ? "Nama unit sudah digunakan." : friendlyDatabaseError(error),
        });
    }
}

async function updateUnit(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ message: "ID unit tidak valid." });
        const unit = await unitKerjaModel.update(id, req.body);
        if (!unit) return res.status(404).json({ message: "Unit kerja tidak ditemukan." });
        return res.json({ unit });
    } catch (error) {
        console.error("Gagal memperbarui unit:", error);
        return res.status(400).json({
            message: error.code === "ER_DUP_ENTRY" ? "Nama unit sudah digunakan." : friendlyDatabaseError(error),
        });
    }
}

async function setUnitActive(req, res) {
    try {
        const unit = await unitKerjaModel.setActive(Number(req.params.id), req.body.aktif);
        if (!unit) return res.status(404).json({ message: "Unit kerja tidak ditemukan." });
        return res.json({ unit });
    } catch (error) {
        console.error("Gagal mengubah status unit:", error);
        return res.status(400).json({ message: friendlyDatabaseError(error) });
    }
}

async function listPositions(req, res) {
    try {
        const positions = await jabatanModel.findAll({
            jenisPengguna: req.query.jenisPengguna,
            includeInactive: req.query.includeInactive !== "false",
        });
        const withTupoksi = await Promise.all(positions.map(async (position) => {
            const tupoksi = await tupoksiModel.findByJabatanId(position.id_jabatan);
            return { ...position, tupoksi, uraian_tupoksi: tupoksi.map((item) => item.uraian_tupoksi).join("\n") };
        }));
        return res.json({ positions: withTupoksi });
    } catch (error) {
        console.error("Gagal mengambil jabatan:", error);
        return res.status(500).json({ message: "Data jabatan tidak dapat diambil." });
    }
}

async function createPosition(req, res) {
    let connection;
    try {
        const { namaJabatan, untukJenis, bolehDiBawah = [] } = req.body;
        if (!Array.isArray(bolehDiBawah)) throw new Error("Aturan jabatan atasan tidak valid.");

        connection = await db.getConnection();
        await connection.beginTransaction();
        const position = await jabatanModel.create({ namaJabatan, untukJenis }, connection);
        await jabatanModel.replaceSupervisors(position.id_jabatan, bolehDiBawah, connection);
        await connection.commit();
        return res.status(201).json({ position });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Gagal membuat jabatan:", error);
        return res.status(400).json({
            message: error.code === "ER_DUP_ENTRY" ? "Nama jabatan sudah tersedia." : friendlyDatabaseError(error),
        });
    } finally {
        if (connection) connection.release();
    }
}

async function updatePosition(req, res) {
    let connection;
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ message: "ID jabatan tidak valid." });
        const current = await jabatanModel.findById(id);
        if (!current) return res.status(404).json({ message: "Jabatan tidak ditemukan." });
        const { namaJabatan = current.nama_jabatan, untukJenis = current.untuk_jenis, bolehDiBawah = [] } = req.body;
        if (!Array.isArray(bolehDiBawah)) throw new Error("Aturan jabatan atasan tidak valid.");
        connection = await db.getConnection();
        await connection.beginTransaction();
        const position = await jabatanModel.update(id, { namaJabatan, untukJenis }, connection);
        await jabatanModel.replaceSupervisors(id, bolehDiBawah, connection);
        await connection.commit();
        return res.json({ position });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Gagal memperbarui jabatan:", error);
        return res.status(400).json({
            message: error.code === "ER_DUP_ENTRY" ? "Nama jabatan sudah digunakan." : friendlyDatabaseError(error),
        });
    } finally {
        if (connection) connection.release();
    }
}

async function setPositionActive(req, res) {
    try {
        const position = await jabatanModel.setActive(Number(req.params.id), req.body.aktif);
        if (!position) return res.status(404).json({ message: "Jabatan tidak ditemukan." });
        return res.json({ position });
    } catch (error) {
        console.error("Gagal mengubah status jabatan:", error);
        return res.status(400).json({ message: friendlyDatabaseError(error) });
    }
}

async function createTupoksi(req, res) {
    try {
        const tupoksi = await tupoksiModel.create({
            idJabatan: Number(req.params.id),
            uraianTupoksi: req.body.uraianTupoksi,
        });
        return res.status(201).json({ tupoksi });
    } catch (error) {
        console.error("Gagal menambah tupoksi:", error);
        return res.status(400).json({ message: friendlyDatabaseError(error) });
    }
}

async function updateTupoksi(req, res) {
    try {
        const updated = await tupoksiModel.update(Number(req.params.id), req.body.uraianTupoksi);
        if (!updated) return res.status(404).json({ message: "Butir tupoksi tidak ditemukan." });
        return res.json({ message: "Tupoksi diperbarui." });
    } catch (error) {
        console.error("Gagal memperbarui tupoksi:", error);
        return res.status(400).json({ message: friendlyDatabaseError(error) });
    }
}

async function setTupoksiActive(req, res) {
    try {
        const updated = await tupoksiModel.setActive(Number(req.params.id), req.body.aktif);
        if (!updated) return res.status(404).json({ message: "Butir tupoksi tidak ditemukan." });
        const logbooks = await tupoksiModel.countUsedByLogbook(Number(req.params.id));
        return res.json({ message: "Status tupoksi diperbarui.", jumlahLogbook: logbooks });
    } catch (error) {
        console.error("Gagal mengubah status tupoksi:", error);
        return res.status(400).json({ message: friendlyDatabaseError(error) });
    }
}

async function eligibleSupervisors(req, res) {
    try {
        const { idJabatan, idUnit, excludeUserId } = req.query;
        if (!idJabatan || !idUnit) {
            return res.status(400).json({ message: "Jabatan dan unit harus dipilih lebih dulu." });
        }
        const supervisors = await jabatanModel.findEligibleSupervisors({
            idJabatan: Number(idJabatan),
            idUnit: Number(idUnit),
            excludeUserId: excludeUserId ? Number(excludeUserId) : null,
        });
        const parentJobs = await jabatanModel.findParentJobs(Number(idJabatan));
        return res.json({ supervisors, parentJobs });
    } catch (error) {
        console.error("Gagal mengambil pilihan atasan:", error);
        return res.status(500).json({ message: "Pilihan atasan tidak dapat diambil." });
    }
}

async function checkUsername(req, res) {
    try {
        if (typeof req.query.username !== "string" || !req.query.username.trim()) {
            return res.status(400).json({ message: "Username wajib diisi." });
        }
        return res.json({
            available: await penggunaModel.isUsernameAvailable(req.query.username, req.query.excludeId),
        });
    } catch (error) {
        console.error("Gagal memeriksa username:", error);
        return res.status(500).json({ message: "Username tidak dapat diperiksa." });
    }
}

async function listSubordinates(req, res) {
    try {
        const users = await penggunaModel.findActiveSubordinates(Number(req.params.id));
        return res.json({ users });
    } catch (error) {
        console.error("Gagal mengambil bawahan:", error);
        return res.status(500).json({ message: "Daftar bawahan tidak dapat diambil." });
    }
}

async function listSupervisorOptions(req, res) {
    try {
        return res.json({
            supervisors: await penggunaModel.findSupervisorOptions(Number(req.params.id)),
        });
    } catch (error) {
        console.error("Gagal mengambil pilihan atasan pengganti:", error);
        return res.status(500).json({ message: "Pilihan atasan pengganti tidak dapat diambil." });
    }
}

async function transferSubordinates(req, res) {
    try {
        const id = Number(req.params.id);
        const newSupervisorId = Number(req.body.newSupervisorId);
        if (!Number.isInteger(id) || !Number.isInteger(newSupervisorId) || id === newSupervisorId) {
            return res.status(400).json({ message: "Pilih atasan pengganti yang valid." });
        }
        const supervisor = await penggunaModel.findById(newSupervisorId);
        if (!supervisor || supervisor.status_akun !== "aktif") {
            return res.status(400).json({ message: "Pilih akun atasan yang masih aktif." });
        }
        const transferred = await penggunaModel.transferSubordinates(id, newSupervisorId);
        return res.json({ message: `${transferred} bawahan berhasil dipindahkan.`, transferred });
    } catch (error) {
        console.error("Gagal memindahkan bawahan:", error);
        return res.status(400).json({ message: friendlyDatabaseError(error) });
    }
}

module.exports = {
    listUsers,
    createUser,
    updateUser,
    resetUserPassword,
    listUnits,
    createUnit,
    updateUnit,
    setUnitActive,
    listPositions,
    createPosition,
    updatePosition,
    setPositionActive,
    createTupoksi,
    updateTupoksi,
    setTupoksiActive,
    eligibleSupervisors,
    checkUsername,
    listSubordinates,
    listSupervisorOptions,
    transferSubordinates,
    getDashboardSummary,
};
