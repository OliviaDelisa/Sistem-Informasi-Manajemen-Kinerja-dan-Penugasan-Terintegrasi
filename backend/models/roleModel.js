const db = require("../config/database");

async function findAll() {
    const [rows] = await db.execute("SELECT id_role, nama_role FROM `role` ORDER BY id_role");
    return rows;
}

async function findById(id) {
    const [rows] = await db.execute("SELECT id_role, nama_role FROM `role` WHERE id_role = ?", [id]);
    return rows[0] || null;
}

module.exports = { findAll, findById };
