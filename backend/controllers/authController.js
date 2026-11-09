const bcrypt = require("bcryptjs");
const penggunaModel = require("../models/penggunaModel");

function roleSlug(roleName) {
    return {
        "Superadmin": "superadmin",
        "Dekan / Wakil Dekan": "dekan",
        "Kepala Kantor": "kepalaKantor",
        "Kasi": "kasi",
        "Dosen": "dosen",
        "Tendik": "tendik",
    }[roleName] || null;
}

async function login(req, res) {
    let { username, password } = req.body;

    if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
        return res.status(400).json({ message: "Username dan password wajib diisi." });
    }
    username = username.trim().toLowerCase();
    if (!username.includes("@")) username = `${username}@unand.ac.id`;

    try {
        const user = await penggunaModel.findByUsername(username.trim());
        if (!user || user.status_akun !== "aktif") {
            return res.status(401).json({ message: "Username atau password tidak sesuai." });
        }

        if (user.akun_terkunci) {
            return res.status(401).json({ message: "Username atau password tidak sesuai." });
        }

        const validPassword = user && await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            await penggunaModel.recordLoginFailure(user.id_pengguna);
            return res.status(401).json({ message: "Username atau password tidak sesuai." });
        }

        await penggunaModel.clearLoginFailures(user.id_pengguna);
        return res.json({
            message: "Login berhasil.",
            user: {
                id: user.id_pengguna,
                name: user.nama,
                username: user.username,
                roleId: user.id_role,
                roleName: user.nama_role,
                roleKey: roleSlug(user.nama_role),
                unit: user.nama_unit,
                position: user.nama_jabatan,
                jenisPengguna: user.jenis_pengguna,
                wajibGantiPassword: Boolean(user.wajib_ganti_password),
            },
        });
    } catch (error) {
        console.error("Login gagal diproses:", error);
        return res.status(500).json({ message: "Layanan login sedang bermasalah." });
    }
}

async function changePassword(req, res) {
    try {
        const id = Number(req.body.idPengguna);
        const { passwordSaatIni, passwordBaru } = req.body;
        if (!Number.isInteger(id) || typeof passwordSaatIni !== "string" ||
            typeof passwordBaru !== "string" || passwordBaru.length < 12) {
            return res.status(400).json({ message: "Password baru wajib minimal 12 karakter." });
        }
        if (passwordSaatIni === passwordBaru) {
            return res.status(400).json({ message: "Password baru harus berbeda dari password saat ini." });
        }

        const user = await penggunaModel.findAuthById(id);
        if (!user || user.status_akun !== "aktif" ||
            !(await bcrypt.compare(passwordSaatIni, user.password_hash))) {
            return res.status(401).json({ message: "Password saat ini tidak sesuai." });
        }
        const updated = await penggunaModel.updateOwnPassword(id, await bcrypt.hash(passwordBaru, 10));
        if (!updated) return res.status(400).json({ message: "Password tidak dapat diperbarui." });
        return res.json({ message: "Password berhasil diperbarui." });
    } catch (error) {
        console.error("Gagal mengganti password:", error);
        return res.status(500).json({ message: "Password tidak dapat diperbarui." });
    }
}

module.exports = { login, changePassword };
